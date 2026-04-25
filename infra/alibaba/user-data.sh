#!/bin/bash
# Bootstrap script for the browser-agent ECS instance.
# Runs once on first boot. Logs to /var/log/user-data.log so you can debug via SSH.
set -euxo pipefail
exec > >(tee /var/log/user-data.log) 2>&1

apt-get update
apt-get install -y docker.io git
systemctl enable --now docker

# Clone and build. Building from source (vs pulling from a registry) avoids the
# extra step of pushing to ACR. First boot takes ~8-10 min for the Playwright
# base image pull plus uv sync.
mkdir -p /opt
cd /opt
git clone ${git_repo} rize-tng
cd rize-tng
git checkout ${git_ref}

docker build -f services/browser-agent/Dockerfile -t tng-rise/browser-agent:latest .

# --shm-size=2g is the critical flag. Default 64MB will randomly crash Chromium.
docker run -d \
  --name browser-agent \
  --restart unless-stopped \
  --shm-size=2g \
  -p 5001:5001 \
  -e HEADLESS=1 \
  -e DASHSCOPE_API_KEY='${dashscope_api_key}' \
  -e ANTHROPIC_API_KEY='${anthropic_api_key}' \
  -e OSS_REGION='${oss_region}' \
  -e OSS_BUCKET='${oss_bucket}' \
  -e OSS_ENDPOINT='${oss_endpoint}' \
  -e OSS_ACCESS_KEY_ID='${oss_access_key_id}' \
  -e OSS_ACCESS_KEY_SECRET='${oss_access_key_secret}' \
  tng-rise/browser-agent:latest
