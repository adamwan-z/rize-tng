# Infra

Docker Compose lives at the repo root (`/docker-compose.yml`) so `docker compose up` works from anywhere in the project. This folder holds cloud setup notes and stretch-goal deploy configs.

## Local

```bash
cp .env.example .env       # at repo root
docker compose up --build  # at repo root
```

Services:

| Service | Port | URL |
| --- | --- | --- |
| Frontend | 3000 | http://localhost:3000 |
| Orchestrator | 4000 | http://localhost:4000 |
| Mock TNG | 5000 | http://localhost:5050 |
| Browser agent | 5001 | http://localhost:5001 |

## Cloud setup

- AWS Bedrock: see [`aws/README.md`](./aws/README.md)
- Alibaba OSS: see [`alibaba/README.md`](./alibaba/README.md)

## Stretch deploy

- Orchestrator → AWS ECS Fargate (lightweight, scales to zero)
- Browser agent → Alibaba ECS (needs persistent Chromium, suits a long-running instance)
- Mock TNG → either platform, demo only
- Frontend → Vercel or AWS Amplify (static hosting plus the orchestrator URL via env)

Stretch goal only. Do not block the demo on cloud deploy.
