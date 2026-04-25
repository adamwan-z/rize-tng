#!/bin/bash
# Bootstrap script for the orchestrator EC2 instance.
# Runs on first boot. Builds and runs orchestrator + mock-tng on a shared
# Docker network so they can talk by service name. Bedrock auth comes via
# /root/orch.env which is also re-readable by the redeploy script when STS
# credentials expire.
set -euxo pipefail
exec > >(tee /var/log/user-data.log) 2>&1

sleep 5  # let cloud-init finish networking

apt-get update
apt-get install -y docker.io git
systemctl enable --now docker

# Persistent env file. Written here for first run; re-edit + restart container
# when STS credentials expire.
cat > /root/orch.env <<EOF
NODE_ENV=production
PORT=4000
LLM_PROVIDER=bedrock
AWS_REGION=${aws_region}
AWS_ACCESS_KEY_ID=${aws_access_key_id}
AWS_SECRET_ACCESS_KEY=${aws_secret_access_key}
AWS_SESSION_TOKEN=${aws_session_token}
BEDROCK_MODEL_ID=${bedrock_model_id}
MOCK_TNG_URL=http://mock-tng:5050
BROWSER_AGENT_URL=${browser_agent_url}
EOF

# Clone and build
mkdir -p /opt
cd /opt
git clone ${git_repo} rize-tng
cd rize-tng
git checkout ${git_ref}

docker build -f services/mock-tng/Dockerfile -t tng-rise/mock-tng:latest .
docker build -f apps/orchestrator/Dockerfile -t tng-rise/orchestrator:latest .

docker network create tng 2>/dev/null || true

docker run -d \
  --name mock-tng \
  --network tng \
  --restart unless-stopped \
  tng-rise/mock-tng:latest

docker run -d \
  --name orchestrator \
  --network tng \
  --restart unless-stopped \
  -p 4000:4000 \
  --env-file /root/orch.env \
  tng-rise/orchestrator:latest

docker ps
