# Alibaba Cloud setup

Two products for the demo:
- **OSS** for screenshot artifact storage from BrowserUse runs (mandatory for multi-cloud)
- **DashScope (Qwen)** for optional Malay paraphrase (stretch goal)

## OSS bucket

Region: `ap-southeast-3` (Kuala Lumpur). Bucket name: `tng-rise-screenshots`.

### Steps

1. In the Alibaba Cloud console, create an OSS bucket:
   - Name: `tng-rise-screenshots`
   - Region: `ap-southeast-3` (Kuala Lumpur)
   - Storage class: Standard
   - Read/Write ACL: Public read (so screenshot URLs render in the frontend without signing)
   - Enable versioning: off (demo only)
2. Create a RAM user `tng-rise-uploader` with programmatic access.
3. Attach an inline policy:

```json
{
  "Version": "1",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["oss:PutObject", "oss:GetObject", "oss:ListObjects"],
      "Resource": [
        "acs:oss:*:*:tng-rise-screenshots",
        "acs:oss:*:*:tng-rise-screenshots/*"
      ]
    }
  ]
}
```

4. Copy `AccessKeyId` and `AccessKeySecret` into `.env`:

```
OSS_REGION=oss-ap-southeast-3
OSS_BUCKET=tng-rise-screenshots
OSS_ENDPOINT=https://oss-ap-southeast-3.aliyuncs.com
OSS_ACCESS_KEY_ID=LTAI...
OSS_ACCESS_KEY_SECRET=...
```

5. Test:

```
oss put services/browser-agent/recordings/grant_happy_path.json oss://tng-rise-screenshots/test.json
```

If the upload returns 200, the credentials work.

## DashScope (optional Qwen)

Used for Malay paraphrase. Stretch goal only.

1. Sign up at https://dashscope.aliyuncs.com/.
2. Generate an API key.
3. Set in `.env`:

```
DASHSCOPE_API_KEY=sk-...
QWEN_MODEL=qwen-max
```

## Stretch: browser agent on Alibaba ECS

The browser agent benefits from Alibaba ECS because Chromium is heavy and persistent. ECS in `ap-southeast-3` keeps latency low to OSS in the same region.

- Image: `ecs.g7.xlarge` (4 vCPU, 16 GB). 8 GB works but 16 GB has zero contention with Chromium spikes.
- OS: Ubuntu 22.04 LTS.
- Bootstrap script: install Docker, build `tng-rise/browser-agent` from source, run with `--shm-size=2g` (Chromium needs more shared memory than Docker's 64 MB default).
- Security group: open inbound 5001 only to the orchestrator's IP.

Local Docker Compose is the demo path. The Terraform module below is the deploy path.

## Terraform path

Everything in this folder is provisioned by `main.tf`: VPC, vSwitch, security group, ECS instance + EIP, screenshots bucket, frontend bucket with static website, and a RAM user the browser-agent uses for OSS uploads.

### One-time setup

```bash
# Auth via env vars. Get keys from RAM (not the root account).
export ALICLOUD_ACCESS_KEY="LTAI..."
export ALICLOUD_SECRET_KEY="..."

cd infra/alibaba
cp terraform.tfvars.example terraform.tfvars
# Fill in admin_ip_cidr, ssh_public_key, dashscope_api_key

terraform init
terraform plan
terraform apply
```

### Outputs you care about

```bash
terraform output browser_agent_url   # set as BROWSER_AGENT_URL on the orchestrator
terraform output browser_agent_ssh   # for debugging the box
terraform output web_url             # paste into a browser after syncing the build
```

### Frontend deploy

```bash
cd apps/web && npm run build
ossutil cp -r dist/ oss://tng-rise-web/ --update
# visit terraform output web_url
```

### Cost ceiling

PAYG hourly billing in `ap-southeast-3`. Approximate monthly burn:

| Resource | Monthly |
| --- | --- |
| `ecs.g7.xlarge` (4 vCPU, 16 GB) | ~$140 |
| 60 GB ESSD system disk | ~$8 |
| 10 Mbps EIP, PayByTraffic | ~$10 demo / ~$25 sustained |
| OSS storage + requests | <$1 |
| **Total** | **~$160-180/mo** |

Tear down between demo days with `terraform destroy` to keep usage to a few dollars per session. The $300 hackathon budget covers ~5 weeks of always-on, indefinite if you destroy when idle.

### Notes

- **State is local.** No S3/OSS backend. `terraform.tfstate` contains the RAM secret access key and is gitignored. Don't commit it.
- **Auth gotchas.** `ALICLOUD_ACCESS_KEY` must be from a RAM user with `AliyunECSFullAccess`, `AliyunOSSFullAccess`, `AliyunRAMFullAccess`, `AliyunVPCFullAccess`, `AliyunCDNFullAccess`. The root account's keys work but are bad practice.
- **First boot is slow.** `user-data.sh` clones the repo, builds the Docker image (Playwright base is ~1.5 GB), then starts the container. Expect 8-10 min before `:5001` answers. SSH in and `tail -f /var/log/user-data.log` if you're impatient.
- **No CDN here.** OSS static-website hosting is HTTP only. Add `alicloud_cdn_domain_new` later if you wire up a real domain. For the hackathon, the bare OSS endpoint is fine.
