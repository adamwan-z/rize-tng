"""Alibaba OSS uploader for screenshot artifacts.

Falls back to a local URL when OSS credentials are not set, so the dev loop
works without cloud setup. The orchestrator does not care which URL it gets,
only that one is present.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

_oss_bucket = None


def _get_bucket():
    global _oss_bucket
    if _oss_bucket is not None:
        return _oss_bucket
    access_key = os.environ.get("OSS_ACCESS_KEY_ID")
    secret_key = os.environ.get("OSS_ACCESS_KEY_SECRET")
    endpoint = os.environ.get("OSS_ENDPOINT")
    bucket_name = os.environ.get("OSS_BUCKET")
    if not all([access_key, secret_key, endpoint, bucket_name]):
        return None
    try:
        import oss2  # type: ignore[import-untyped]
        auth = oss2.Auth(access_key, secret_key)
        _oss_bucket = oss2.Bucket(auth, endpoint, bucket_name)
        return _oss_bucket
    except Exception as exc:
        print(f"[oss] disabled: {exc}")
        return None


async def upload_screenshot(local_path: Path, key: str) -> str:
    """Upload a local screenshot. Returns a public URL.

    If OSS is not configured, returns a local /screenshots URL the FastAPI
    static mount serves.
    """
    bucket = _get_bucket()
    if bucket is None:
        # Local dev URL. The orchestrator forwards this through to the frontend.
        host = os.environ.get("BROWSER_AGENT_PUBLIC_URL", "http://localhost:5001")
        return f"{host}/screenshots/{local_path.name}"

    object_key = f"runs/{key}"

    def _put() -> None:
        bucket.put_object_from_file(object_key, str(local_path))

    await asyncio.get_event_loop().run_in_executor(None, _put)

    region = os.environ.get("OSS_REGION", "oss-ap-southeast-3")
    bucket_name = os.environ.get("OSS_BUCKET", "tng-rise-screenshots")
    return f"https://{bucket_name}.{region}.aliyuncs.com/{object_key}"
