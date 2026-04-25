#!/bin/bash
# Refresh the orchestrator's AWS STS credentials when they expire.
# Run on the EC2 box (NOT your laptop) after grabbing fresh STS creds from
# the hackathon AWS console.
#
# Usage:
#   AWS_ACCESS_KEY_ID=ASIA... AWS_SECRET_ACCESS_KEY=... AWS_SESSION_TOKEN=... \
#     bash /root/refresh-orchestrator-creds.sh

set -euo pipefail

: "${AWS_ACCESS_KEY_ID:?required}"
: "${AWS_SECRET_ACCESS_KEY:?required}"
: "${AWS_SESSION_TOKEN:?required}"

# Update the env file in-place
sed -i \
  -e "s|^AWS_ACCESS_KEY_ID=.*|AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID|" \
  -e "s|^AWS_SECRET_ACCESS_KEY=.*|AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY|" \
  -e "s|^AWS_SESSION_TOKEN=.*|AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN|" \
  /root/orch.env

# Restart the container; --env-file is re-read on each `docker run`/start.
docker stop orchestrator
docker rm orchestrator
docker run -d \
  --name orchestrator \
  --network tng \
  --restart unless-stopped \
  -p 4000:4000 \
  --env-file /root/orch.env \
  tng-rise/orchestrator:latest

docker ps --filter name=orchestrator
echo "Refreshed. Test: curl http://localhost:4000/health"
