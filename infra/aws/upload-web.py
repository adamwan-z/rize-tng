#!/usr/bin/env python3
"""Upload apps/web/dist/ to the AWS S3 frontend bucket and invalidate CloudFront.

Reads bucket name + distribution id from terraform output, so make sure
`terraform apply` has run successfully first.

Auth uses the standard AWS env vars (the ASIA... STS creds you already export):
    AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY
    AWS_SESSION_TOKEN
    AWS_DEFAULT_REGION  (=ap-southeast-1)

Usage from the repo root:
    source .venv-deploy/bin/activate
    pip install boto3
    python3 infra/aws/upload-web.py
"""

import json
import mimetypes
import os
import subprocess
import sys
import time
from pathlib import Path

try:
    import boto3
except ImportError:
    sys.exit("Run: pip install boto3")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
DIST = REPO_ROOT / "apps" / "web" / "dist"
TF_DIR = REPO_ROOT / "infra" / "aws"


def tf_output(name: str) -> str:
    result = subprocess.run(
        ["terraform", "output", "-raw", name],
        cwd=TF_DIR,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def main() -> None:
    if not DIST.is_dir():
        sys.exit(f"Build first: cd apps/web && npm run build  (no {DIST})")

    bucket = tf_output("web_bucket")
    distribution_id = tf_output("web_distribution_id")
    print(f"Bucket: {bucket}")
    print(f"CloudFront distribution: {distribution_id}\n")

    s3 = boto3.client("s3")
    cf = boto3.client("cloudfront")

    count = 0
    for path in DIST.rglob("*"):
        if not path.is_file():
            continue
        key = str(path.relative_to(DIST))
        ctype, _ = mimetypes.guess_type(key)
        extra = {"ContentType": ctype} if ctype else {}
        s3.upload_file(str(path), bucket, key, ExtraArgs=extra)
        print(f"  {key}")
        count += 1

    print(f"\nUploaded {count} files to s3://{bucket}/")

    print("Invalidating CloudFront cache...")
    cf.create_invalidation(
        DistributionId=distribution_id,
        InvalidationBatch={
            "Paths": {"Quantity": 1, "Items": ["/*"]},
            "CallerReference": str(time.time()),
        },
    )
    print(f"Done. URL: {tf_output('web_url')}")
    print("Cache invalidation takes 1-2 min to propagate globally.")


if __name__ == "__main__":
    main()
