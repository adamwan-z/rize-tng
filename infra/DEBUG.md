# Demo-day debug runbook

When something breaks on stage, work this list top to bottom. Each section
shows: symptom → quick check → fix.

## Endpoints reference

| Layer | URL | Health check |
| --- | --- | --- |
| Frontend (CloudFront) | `https://d3p8teo5grni0d.cloudfront.net/` | Page loads |
| Orchestrator (via CloudFront) | `https://d3p8teo5grni0d.cloudfront.net/health` | Returns `ok:true` |
| Orchestrator (direct AWS) | `http://18.136.128.59:4000/health` | Returns `ok:true` |
| Browser-agent (Alibaba KL) | `http://47.250.172.167:5001/health` | Returns `ok:true` |
| Mock-tng (Alibaba, private) | `http://mock-tng:5050` (in-network) | `docker exec browser-agent curl mock-tng:5050/data/lotus-catalog.json` |

## 30-second triage

Run from your laptop:

```bash
curl -s https://d3p8teo5grni0d.cloudfront.net/ -o /dev/null -w "%%{http_code}\n"
curl -s https://d3p8teo5grni0d.cloudfront.net/health
curl -s http://47.250.172.167:5001/health
```

If any layer is down, jump to the matching section.

---

## Symptom → diagnosis table

| Chat says ... | Cause | Section |
| --- | --- | --- |
| "Alamak, ... security token ... expired" | AWS STS expired | [STS refresh](#sts-refresh) |
| "Alamak, ... inference profile ..." | Wrong Bedrock model ID | [Inference profile](#inference-profile) |
| "404 Not Found" (nginx) | Frontend calling wrong URL | [Frontend rebuild](#frontend-rebuild) |
| "Failed to fetch" (browser console) | CloudFront → orchestrator path broken | [Network](#network) |
| "Lotus catalog unreachable" | mock-tng not reachable from browser-agent | [Browser-agent stack](#browser-agent-stack) |
| "TimeoutError" / "BrowserType.launch" | Playwright issue on Alibaba box | [Browser-agent stack](#browser-agent-stack) |
| Spinner forever, no events | SSE blocked, orchestrator hung | [Orchestrator restart](#orchestrator-restart) |

---

## STS refresh

**Most common demo-day failure.** Hackathon STS expires every 1-2 hours.

1. Get fresh creds from the AWS hackathon console (the "Credentials" link on the role login page)
2. SSH to AWS box and run:

```bash
ssh ubuntu@18.136.128.59
export AWS_ACCESS_KEY_ID="ASIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_SESSION_TOKEN="..."
sudo -E bash /tmp/refresh.sh
```

If `/tmp/refresh.sh` is missing (box was rebooted), SCP it from laptop:
```bash
scp /Users/adamwan/Desktop/tng-rize/infra/aws/refresh-orchestrator-creds.sh ubuntu@18.136.128.59:/tmp/refresh.sh
```

Verify: `curl http://localhost:4000/health` returns `ok:true`. Demo flow should work within 5 seconds.

**Pre-demo discipline**: refresh STS just before going on stage. You get ~12hr of safety margin.

---

## Inference profile

If chat says "Invocation of model ID ... isn't supported. Retry with ... inference profile":

```bash
ssh ubuntu@18.136.128.59
sudo sed -i 's|^BEDROCK_MODEL_ID=.*|BEDROCK_MODEL_ID=global.anthropic.claude-sonnet-4-6|' /root/orch.env
sudo docker restart orchestrator
```

The `global.` prefix is the cross-region inference profile. Bare model IDs don't work for Anthropic on Bedrock.

---

## Frontend rebuild

If chat shows nginx's "404 Not Found", the deployed frontend doesn't have `VITE_ORCHESTRATOR_URL` baked in.

1. Verify `apps/web/.env` has the right line:
   ```
   VITE_ORCHESTRATOR_URL=http://18.136.128.59:4000
   ```
2. Rebuild + redeploy:
   ```bash
   cd /Users/adamwan/Desktop/tng-rize/apps/web && npm run build
   scp -r dist root@47.250.172.167:/opt/web/
   ssh root@47.250.172.167 "docker restart web"
   ```
3. Hard-refresh the page (Cmd+Shift+R).

---

## Network

Symptoms: browser DevTools shows `Failed to fetch` or 5xx on `/chat`.

- `curl https://d3p8teo5grni0d.cloudfront.net/health` from your laptop. If 5xx, CloudFront → EC2 path is broken; SSH the AWS box and check `sudo docker logs orchestrator`.
- If `curl` works but the chat doesn't, hard-refresh the page (Cmd+Shift+R) — old cached JS may still be hitting the wrong URL.
- If CloudFront returns 504, check the EC2 instance is running: `aws ec2 describe-instances --instance-ids i-0b3dea7b8ac604c2b` (region ap-southeast-1).

---

## Browser-agent stack

Symptoms: Lotus / grant flow fails with catalog or browser launch error.

```bash
ssh root@47.250.172.167
docker ps   # both browser-agent and mock-tng must be Up
docker logs browser-agent --tail 50
```

Common fixes:
- One container missing → `bash /root/redeploy-browser-agent.sh`
- Network broken → `docker network create tng 2>/dev/null; docker restart mock-tng browser-agent`

---

## Orchestrator restart

Spinner forever / no SSE events / chat hangs:

```bash
ssh ubuntu@18.136.128.59
sudo docker logs orchestrator --tail 100   # check for stack traces
sudo docker restart orchestrator
sleep 5
curl http://localhost:4000/health
```

If logs show repeating Bedrock errors, refresh STS.

---

## Pre-demo checklist (10 min before stage)

- [ ] `curl` all three health endpoints from laptop (frontend / orchestrator / browser-agent)
- [ ] Refresh STS creds and run refresh-orchestrator-creds.sh
- [ ] Send a test message in chat — full grant flow round-trip
- [ ] Open DevTools to confirm no mixed-content warnings
- [ ] Have your terminal cheat-sheet open: SSH into both boxes ready to paste

## Hard reset (last resort, ~10 min)

If everything is wedged and you have time:

```bash
# Alibaba: restart browser-agent stack
ssh root@47.250.172.167 "docker restart mock-tng browser-agent"

# AWS: restart orchestrator stack
ssh ubuntu@18.136.128.59 "sudo docker restart mock-tng orchestrator"

# Wait 10 sec, then test
sleep 10
curl https://d3p8teo5grni0d.cloudfront.net/health
curl http://47.250.172.167:5001/health
```

If a `terraform destroy` happened in panic, the recovery is `terraform apply` from
each `infra/{aws,alibaba}/` folder. Both modules are idempotent. Estimate
~15 min full rebuild.
