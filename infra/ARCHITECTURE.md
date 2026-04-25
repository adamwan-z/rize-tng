# Architecture

## TL;DR

Frontend served from AWS CloudFront. LLM brain on AWS Bedrock Singapore. Browser
automation, screenshots, and Malaysian-IP traffic on Alibaba KL. Each cloud
chosen for what it's best at.

## Public URL

**https://d3p8teo5grni0d.cloudfront.net**

CloudFront is the only public ingress. Routes:
- `/` and assets → S3 bucket (Vite static build)
- `/chat` → EC2 orchestrator (SSE streaming, no caching, all methods allowed)
- `/health` → EC2 orchestrator (debug)

Single domain means no CORS, no mixed-content, no third-party tunnel.

## Request flow (a Lotus shopping demo)

```
1. User opens https://d3p8teo5grni0d.cloudfront.net
   ↓
2. CloudFront edge serves S3 (Vite build), HTTPS via ACM cert
   ↓
3. User types "buy 5 milos from Lotus"
   ↓
4. Frontend POSTs /chat → CloudFront → EC2 orchestrator (Singapore)
   ↓
5. Orchestrator calls Bedrock (Claude Sonnet 4.6) for tool dispatching
   ↓
6. Orchestrator POSTs /run/lotus_procurement → Alibaba browser-agent (KL)
   ↓
7. Browser-agent launches headless Chromium, navigates to mock-tng's
   /lotus.html (sibling container on same docker network)
   ↓
8. For each step, browser-agent uploads PNG screenshot to OSS Singapore-3 (KL)
   ↓
9. Browser-agent streams NDJSON events back to orchestrator
   ↓
10. Orchestrator forwards events as SSE to frontend
   ↓
11. Frontend renders <img src="https://tng-rise-screenshots.oss-ap-southeast-3.aliyuncs.com/...">
```

Three cloud hops in a single user turn. Multicloud is structural, not slideware.

## Cloud allocation

| Service | Cloud | Region | Why this cloud |
|---|---|---|---|
| Static frontend | AWS S3 | global | CloudFront edges, free TLS, cheap/free tier |
| CDN/TLS | AWS CloudFront | global | Same as above; same-domain routing for API |
| Orchestrator | AWS EC2 | ap-southeast-1 | Co-located with Bedrock for low-latency LLM hop |
| LLM | AWS Bedrock | ap-southeast-1 | AWS-only; uses `global.anthropic.claude-sonnet-4-6` cross-region inference profile |
| Mock-tng (orchestrator side) | AWS EC2 (sibling container) | ap-southeast-1 | Co-located with orchestrator |
| Browser-agent | Alibaba ECS | ap-southeast-3 (KL) | Heavy Chromium workload; Malaysian IP for demo authenticity |
| Mock-tng (browser-agent side) | Alibaba ECS (sibling container) | ap-southeast-3 | Co-located with browser-agent for sub-ms catalog fetches |
| Screenshots | Alibaba OSS | ap-southeast-3 | Co-located with browser-agent; public-read for direct image rendering |

## Containers

### AWS EC2 (`18.136.128.59`)
- `orchestrator` — Node/Express/tsx. Reads STS env vars; calls Bedrock + Alibaba browser-agent.
- `mock-tng` — Express. Serves `/grant.html`, `/lotus.html`, `/data/*.json`. Used by orchestrator for catalog validation.

### Alibaba ECS (`47.250.172.167`)
- `browser-agent` — Python/FastAPI/Playwright/browser-use. Headless Chromium against public sites + the local mock-tng.
- `mock-tng` — Same image as on AWS, sibling container.

## State management

- Both Terraform modules use **local state** (`*.tfstate` gitignored). No remote backend.
- Secrets live in `terraform.tfvars` (gitignored). Each cloud has its own.
- Long-lived RAM/IAM keys are not in scope; both clouds use **session STS credentials** because the hackathon accounts can't create permanent users. Refresh every 1-12 hours.

## Operational scripts

| Script | Purpose | Where to run |
|---|---|---|
| `infra/aws/refresh-orchestrator-creds.sh` | Push fresh STS to orchestrator container | AWS box |
| `infra/aws/upload-web.py` | Build → S3 → CloudFront invalidation | Laptop |
| `infra/alibaba/redeploy-browser-agent.sh` | Restart browser-agent with new env | Alibaba box |

## Why this design

1. **Each cloud earns its keep.** AWS hosts what AWS is best at (LLM, CDN). Alibaba hosts what Malaysia-region matters for (browser identity, latency to OSS). Not theatre.
2. **Single public domain (CloudFront)** kills CORS and mixed-content as classes of bug. Production multicloud apps almost always do this.
3. **No third-party deploy services in the hot path.** Cloudflare tunnels remain only as standby. Submission link is AWS-managed.
4. **The orchestrator is the integration boundary.** Everything else is replaceable. Frontend can move to Vercel, Netlify, or wherever — only the orchestrator URL changes. Browser-agent could move to GCP or Azure — only the BROWSER_AGENT_URL on the orchestrator changes.

## Known tradeoffs

- **STS expiry** is the most common operational pain. ~1-12 hour rotation. Documented in `infra/DEBUG.md`. Long-term fix: get IAM users with permanent keys (blocked by hackathon role permissions).
- **Local Terraform state** means single-operator only. Multi-engineer setups would need S3+DynamoDB or Alibaba OSS backend with locking.
- **No monitoring/alerting.** A real production deploy would add CloudWatch + Alibaba CloudMonitor. Not in scope for hackathon.
