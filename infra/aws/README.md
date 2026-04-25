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

## Phase 1 deploy: full backend on AWS

This section is the executable runbook for putting all three backend services on AWS Fargate. The frontend stays out of scope. Phase 2 (Alibaba OSS+CDN) follows once the AWS endpoint is live.

### Topology

| Service | Public? | Sizing | DNS inside the VPC |
| --- | --- | --- | --- |
| orchestrator | yes, via ALB :443 | 0.5 vCPU / 1 GB | n/a (frontend hits ALB) |
| mock-tng | no | 0.25 vCPU / 0.5 GB | `mock-tng.tng-rise.local:5050` |
| browser-agent | no | 2 vCPU / 4 GB | `browser-agent.tng-rise.local:5001` |

LLM goes through Bedrock (Claude Sonnet 4.6, see top of this file). Screenshots still upload to Alibaba OSS — that path is unchanged.

### Files in this folder

```
infra/aws/
├── README.md                          (this file)
├── taskdefs/
│   ├── orchestrator.json              ECS task definition for orchestrator
│   ├── mock-tng.json                  ECS task definition for mock-tng
│   └── browser-agent.json             ECS task definition for browser-agent
├── service-connect/
│   ├── orchestrator.json              Service Connect config (just namespace)
│   ├── mock-tng.json                  Exposes :5050 as mock-tng.tng-rise.local
│   └── browser-agent.json             Exposes :5001 as browser-agent.tng-rise.local
└── iam/
    ├── task-execution-trust.json      Trust policy for tngRiseTaskExecution
    └── task-role-bedrock.json         Inline policy for tngRiseTaskRole (Bedrock invoke)
```

The taskdef and Service Connect JSONs contain `ACCOUNT_ID` and `AWS_REGION` placeholders. The runbook below uses `envsubst` to render them at register time, which keeps the files committable without baking account-specific identifiers.

### Variables

```bash
export AWS_REGION=ap-southeast-5
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export ECR_BASE=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
export CLUSTER=tng-rise
export VPC_ID=<your-vpc-id>
export SUBNETS=<subnet-a>,<subnet-b>
export ALB_SG=<alb-security-group>           # ingress :443 from 0.0.0.0/0
export TASK_SG=<task-security-group>         # :4000 from ALB_SG, :5050 + :5001 from itself
export DOMAIN=api.<your-domain>
export ACM_CERT_ARN=<arn-of-acm-cert-for-DOMAIN>

export ANTHROPIC_API_KEY=sk-ant-...
export DASHSCOPE_API_KEY=sk-...
export OSS_ACCESS_KEY_ID=LTAI...
export OSS_ACCESS_KEY_SECRET=...
```

### One-time bootstrap

**1. ECR repos, ECS cluster, log groups, Service Connect namespace, Bedrock access**

```bash
for r in orchestrator mock-tng browser-agent; do
  aws ecr create-repository --repository-name tng-rise/$r --region $AWS_REGION
done

aws ecs create-cluster --cluster-name $CLUSTER --region $AWS_REGION

for r in orchestrator mock-tng browser-agent; do
  aws logs create-log-group --log-group-name /ecs/tng-rise/$r --region $AWS_REGION
done

aws servicediscovery create-http-namespace --name tng-rise.local --region $AWS_REGION

aws bedrock list-foundation-models --region $AWS_REGION \
  --query 'modelSummaries[?contains(modelId, `claude`)].modelId'
```

**2. Secrets**

```bash
aws secretsmanager create-secret --name tng-rise/anthropic-key      --secret-string "$ANTHROPIC_API_KEY"      --region $AWS_REGION
aws secretsmanager create-secret --name tng-rise/dashscope-key      --secret-string "$DASHSCOPE_API_KEY"      --region $AWS_REGION
aws secretsmanager create-secret --name tng-rise/oss-access-key-id  --secret-string "$OSS_ACCESS_KEY_ID"      --region $AWS_REGION
aws secretsmanager create-secret --name tng-rise/oss-access-secret  --secret-string "$OSS_ACCESS_KEY_SECRET"  --region $AWS_REGION
```

**3. IAM roles**

```bash
aws iam create-role --role-name tngRiseTaskExecution \
  --assume-role-policy-document file://infra/aws/iam/task-execution-trust.json
aws iam attach-role-policy --role-name tngRiseTaskExecution \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
aws iam attach-role-policy --role-name tngRiseTaskExecution \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite

aws iam create-role --role-name tngRiseTaskRole \
  --assume-role-policy-document file://infra/aws/iam/task-execution-trust.json
aws iam put-role-policy --role-name tngRiseTaskRole --policy-name BedrockInvoke \
  --policy-document file://infra/aws/iam/task-role-bedrock.json
```

**4. ALB, target group, HTTPS listener**

```bash
ALB_ARN=$(aws elbv2 create-load-balancer --name tng-rise-alb \
  --subnets ${SUBNETS//,/ } --security-groups $ALB_SG \
  --region $AWS_REGION --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# SSE needs more than the 60s default idle timeout.
aws elbv2 modify-load-balancer-attributes --load-balancer-arn $ALB_ARN \
  --attributes Key=idle_timeout.timeout_seconds,Value=4000 --region $AWS_REGION

TG_ARN=$(aws elbv2 create-target-group --name tng-rise-orch \
  --protocol HTTP --port 4000 --target-type ip --vpc-id $VPC_ID \
  --health-check-path /health --region $AWS_REGION \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

aws elbv2 create-listener --load-balancer-arn $ALB_ARN \
  --protocol HTTPS --port 443 --certificates CertificateArn=$ACM_CERT_ARN \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN --region $AWS_REGION

aws elbv2 describe-load-balancers --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' --output text
# Point $DOMAIN at this DNS name in your registrar / Route 53.
```

### Repeatable deploy

**5. Build and push images** (run from repo root — Dockerfiles expect that as build context)

```bash
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin $ECR_BASE

docker build --platform linux/amd64 -t $ECR_BASE/tng-rise/orchestrator:latest  -f apps/orchestrator/Dockerfile .
docker build --platform linux/amd64 -t $ECR_BASE/tng-rise/mock-tng:latest      -f services/mock-tng/Dockerfile .
docker build --platform linux/amd64 -t $ECR_BASE/tng-rise/browser-agent:latest -f services/browser-agent/Dockerfile .

docker push $ECR_BASE/tng-rise/orchestrator:latest
docker push $ECR_BASE/tng-rise/mock-tng:latest
docker push $ECR_BASE/tng-rise/browser-agent:latest
```

**6. Register task definitions** (substitutes `ACCOUNT_ID` and `AWS_REGION` placeholders at register time)

```bash
for svc in mock-tng browser-agent orchestrator; do
  envsubst < infra/aws/taskdefs/$svc.json \
    | aws ecs register-task-definition --cli-input-json file:///dev/stdin --region $AWS_REGION
done
```

**7. Create services**

Create the two private services first so orchestrator can resolve their DNS at startup.

```bash
# mock-tng (private)
aws ecs create-service --cluster $CLUSTER --service-name mock-tng \
  --task-definition tng-rise-mock-tng --desired-count 1 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$TASK_SG],assignPublicIp=ENABLED}" \
  --service-connect-configuration file://infra/aws/service-connect/mock-tng.json \
  --region $AWS_REGION

# browser-agent (private)
aws ecs create-service --cluster $CLUSTER --service-name browser-agent \
  --task-definition tng-rise-browser-agent --desired-count 1 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$TASK_SG],assignPublicIp=ENABLED}" \
  --service-connect-configuration file://infra/aws/service-connect/browser-agent.json \
  --region $AWS_REGION

# orchestrator (public via ALB)
aws ecs create-service --cluster $CLUSTER --service-name orchestrator \
  --task-definition tng-rise-orchestrator --desired-count 1 --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$TASK_SG],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=orchestrator,containerPort=4000" \
  --service-connect-configuration file://infra/aws/service-connect/orchestrator.json \
  --region $AWS_REGION
```

`assignPublicIp=ENABLED` is only needed if the subnets are public (no NAT gateway) so tasks can reach ECR and the internet for image pulls and Bedrock. If the VPC has a NAT gateway, set it to `DISABLED` and put tasks on private subnets.

**8. Re-deploy after a code change**

```bash
docker build --platform linux/amd64 -t $ECR_BASE/tng-rise/orchestrator:latest -f apps/orchestrator/Dockerfile . \
  && docker push $ECR_BASE/tng-rise/orchestrator:latest \
  && aws ecs update-service --cluster $CLUSTER --service orchestrator --force-new-deployment --region $AWS_REGION
# Same pattern for mock-tng / browser-agent.
```

### Smoke test

```bash
# Orchestrator is up and reports its LLM provider
curl https://$DOMAIN/health
# expect: {"ok":true,"provider":"bedrock","model":"..."}

# SSE chat streams (no frontend needed)
curl -N -X POST https://$DOMAIN/chat \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"sessionId":"smoke-1","message":"hello"}'

# Tail logs
aws logs tail /ecs/tng-rise/orchestrator  --since 5m --region $AWS_REGION
aws logs tail /ecs/tng-rise/mock-tng      --since 5m --region $AWS_REGION
aws logs tail /ecs/tng-rise/browser-agent --since 5m --region $AWS_REGION
```

When the smoke test passes, `https://$DOMAIN` is the value the frontend will set as `VITE_ORCHESTRATOR_URL` in Phase 2.
