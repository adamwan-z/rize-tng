# Demo runbook

This is the continuous test suite plus the pitch script. Run it every 2 hours after the 6 PM Saturday gate. Pitch dry runs use this verbatim.

## Before the run

- [ ] `.env` filled in with `LLM_PROVIDER=bedrock` (or `anthropic` if Bedrock auth flaky)
- [ ] `docker compose up` returns all 4 services healthy
- [ ] Open http://localhost:3000
- [ ] OBS recording is queued as fallback

## Run

```
1. Open http://localhost:3000

2. Greeting card appears.
   → Expect: "Hai Mak Cik! Saya Rise..."

3. Type: "Macam mana business hari ni?"
   → Expect within 5s:
     - Tool call card "analyzeRevenue" appears, spinner.
     - Tool result collapses to "siap"
     - Agent text streams in. Mentions today's RM amount, references this week vs last week (5% dip), suggests next action.
     - If alerts fire (weekly_dip_above_5pct, unusual_quiet_day), agent surfaces them briefly. Stock urgency stays qualitative ("kena restock soon"), no day-count numbers.

4. Type: "Ada grant untuk saya?"
   → Expect within 6s:
     - Tool call "matchGrants"
     - Agent describes 2 to 3 grants. Mentions TEKUN. Mentions BNM iAES uses email submission.
     - Agent asks which grant to apply for.

5. Reply: "Yang TEKUN tu lah"
   → Expect:
     - Agent says "ok let me apply for you" (Bahasa-Inggeris)
     - Tool call "runGrantAgent"
     - Browser viewport appears
     - Screenshots stream in step by step. Each step has a one-line description in Malay.
     - After 5 to 8 steps, browser stops.
     - Handoff card appears: green border, "Form dah lengkap. Sila semak dan klik Submit di sini." with "Take over and submit" button.

6. Click "Take over and submit"
   → Expect:
     - New tab opens to the TEKUN portal (or replica if live unavailable). Form pre-filled.

7. Bonus: type "Macam mana kalau email punya grant?"
   → Expect:
     - Agent recalls BNM iAES from earlier match.
     - Tool call "runGrantAgent" with grantId="bnm-iaes"
     - No browser viewport. Email handoff card instead.
     - "Buka mail client" button opens mailto:applications@bnm.gov.my with subject and body pre-filled.
```

## Failure modes and fallback

| Step fails | Action |
| --- | --- |
| `analyzeRevenue` returns nothing | Restart `mock-tng`. Re-run from step 3. |
| `matchGrants` returns empty | Inspect `packages/grants-kb/data/`. Verify the JSON parses. |
| Browser viewport stuck on "Tengah buka browser..." | Browser-agent crashed. Replay should kick in. If not, cut to OBS recording. |
| Live demo hangs more than 10s | Stop talking. Hit Ctrl+T, switch to OBS recording, narrate. |
| Bedrock auth fails | `kill orchestrator`, `LLM_PROVIDER=anthropic npm run dev`, retry. Pitch story shifts to "we deploy on both, demo on Anthropic for resilience." |

## Pre-pitch checklist (8 AM Sunday)

- [ ] Demo laptop battery > 50% or plugged in
- [ ] Tethered to phone hotspot, WiFi as backup
- [ ] OBS recording loaded and 1-key away
- [ ] Browser zoom set to 110% for visibility
- [ ] Notification suppression on
- [ ] Coffee
