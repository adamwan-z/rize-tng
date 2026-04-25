# Multi-cloud rationale

Two clouds. Both doing real work. Not a sticker exercise.

## AWS Bedrock for cognition

The agent's reasoning runs on Anthropic Claude Sonnet 4.6 via AWS Bedrock in `ap-southeast-5` (Malaysia). Bedrock gives us:

- In-region inference. Lower latency, plus data sovereignty for Malaysian merchant context.
- IAM-scoped access keys, easier to rotate during the hackathon than vendor-direct tokens.
- A migration path: today the orchestrator runs locally, tomorrow we deploy to ECS Fargate in the same region.

We swap to direct Anthropic API in dev (`LLM_PROVIDER=anthropic`) for fastest iteration. The adapter pattern in `apps/orchestrator/src/llm/` makes this a one-env-var change.

## Alibaba OSS for the hands

Every browser-agent run emits 5 to 15 screenshots of the live form being filled. These are the artifact that proves the agent is actually doing the work, not faking. They land in Alibaba OSS bucket `tng-rise-screenshots` in `ap-southeast-3` (Kuala Lumpur).

Why Alibaba OSS specifically:

- Region match: KL bucket beside KL stall owner. Latency stays under 200ms for image loads in the live viewport.
- Public-read ACL means screenshots render directly in the frontend with no signed-URL roundtrip during the demo.
- Pairing with Bedrock on AWS is the textbook multi-cloud split: cognition on one cloud, durable artifacts on another.

## Stretch: browser agent on Alibaba ECS

`ap-southeast-3` ECS is a natural home for the browser agent because:

- Chromium is heavy. ECS gives persistent compute without cold-start cost.
- ECS sits beside OSS in the same region. Screenshot uploads are local network.
- Alibaba's network into Malaysia is well peered with TM and Maxis.

This stays a stretch goal. Local Docker Compose is the demo path.

## What we are not doing

- We are not running the LLM on two clouds simultaneously. We pick one for the live demo and have a one-flag fallback.
- We are not load-balancing across AWS and Alibaba. This is not a global SaaS. It is one merchant, one session.
- We are not using a multi-cloud abstraction layer (e.g., Terraform with two providers). We document setup as runbooks. Faster, less bug surface.

## In one sentence for judges

> AWS Bedrock thinks. Alibaba OSS remembers. Both regions sit in Southeast Asia where the merchant lives.
