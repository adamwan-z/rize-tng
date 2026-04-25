#!/bin/bash
# Run on the Alibaba ECS box to (re)deploy the browser-agent container.
# Assumes mock-tng is already running on the `tng` Docker network.
#
# Usage on the box:
#   bash redeploy-browser-agent.sh
#
# Or from your laptop:
#   scp infra/alibaba/redeploy-browser-agent.sh root@<eip>:/root/
#   ssh root@<eip> bash /root/redeploy-browser-agent.sh

set -euo pipefail

# Pull from env vars (export before running) or terraform outputs:
#   export OSS_ACCESS_KEY_ID=$(cd infra/alibaba && terraform output -raw uploader_access_key_id)
#   export OSS_ACCESS_KEY_SECRET=$(cd infra/alibaba && terraform output -raw uploader_access_key_secret)
: "${OSS_ACCESS_KEY_ID:?required: export from terraform output uploader_access_key_id}"
: "${OSS_ACCESS_KEY_SECRET:?required: export from terraform output uploader_access_key_secret}"
DASHSCOPE_API_KEY="${DASHSCOPE_API_KEY:-}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"

cat > /root/ba.env <<EOF
HEADLESS=1
MOCK_TNG_URL=http://mock-tng:5050
OSS_REGION=oss-ap-southeast-3
OSS_BUCKET=tng-rise-screenshots
OSS_ENDPOINT=https://oss-ap-southeast-3.aliyuncs.com
OSS_ACCESS_KEY_ID=$OSS_ACCESS_KEY_ID
OSS_ACCESS_KEY_SECRET=$OSS_ACCESS_KEY_SECRET
DASHSCOPE_API_KEY=$DASHSCOPE_API_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
EOF

docker network create tng 2>/dev/null || true
docker stop browser-agent 2>/dev/null || true
docker rm browser-agent 2>/dev/null || true

docker run -d \
  --name browser-agent \
  --network tng \
  --restart unless-stopped \
  --shm-size=2g \
  -p 5001:5001 \
  --env-file /root/ba.env \
  tng-rise/browser-agent:latest

docker ps
