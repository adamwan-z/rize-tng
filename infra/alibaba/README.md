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

- Image: `ecs.g7.large` (2 vCPU, 8 GB) is plenty.
- OS: Ubuntu 22.04 LTS.
- Bootstrap script: install Docker, pull `tng-rise/browser-agent:latest`, run with `--ipc=host` (Chromium needs it).
- Security group: open inbound 5001 only to the orchestrator's IP.

Stretch goal only. Local Docker Compose is the demo path.
