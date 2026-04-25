# AWS Bedrock setup

The orchestrator's `LLM_PROVIDER=bedrock` mode talks to Amazon Bedrock for LLM inference. This is the multi-cloud "cognition" pillar in the deck.

## Region

Use `ap-southeast-5` (Malaysia) when available for the demo. Falls back to `ap-southeast-1` (Singapore) if the model is not in Malaysia at the time of the hackathon.

## Model

Anthropic Claude Sonnet 4.6 on Bedrock. Model ID: `anthropic.claude-sonnet-4-6`. Verify in the Bedrock console before demo day. If the model id changes, update `BEDROCK_MODEL_ID` in `.env`.

## Access steps

1. Create an IAM user `tng-rise-bedrock` with programmatic access.
2. Attach a custom policy with the minimum needed:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream",
        "bedrock:Converse",
        "bedrock:ConverseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-6*"
      ]
    }
  ]
}
```

3. In the Bedrock console under Model access, request access to `Anthropic Claude Sonnet 4.6`. Approval is usually instant in supported regions.
4. Copy `Access key ID` and `Secret access key` into `.env`:

```
LLM_PROVIDER=bedrock
AWS_REGION=ap-southeast-5
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-6
```

## Demo-day fallback

If Bedrock auth fails on demo day, flip `LLM_PROVIDER=anthropic`. The agent loop is identical, only the adapter changes. Pitch story shifts to: "we deploy to both AWS and Alibaba, and we demo on Anthropic for resilience."

## Stretch: orchestrator on ECS Fargate

- Push image: `docker buildx build --platform linux/amd64 -t <ecr-repo>/orchestrator:latest .`
- Task definition: 0.5 vCPU, 1 GB memory. Public ALB on port 4000.
- Env vars from AWS Secrets Manager. Do not bake keys into the image.
