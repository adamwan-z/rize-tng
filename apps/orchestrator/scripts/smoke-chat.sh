#!/usr/bin/env bash
# Drive POST /chat with the runbook scenarios. Eyeball the SSE output.
# Prereq: mock-tng on :5000, orchestrator on :4000, ANTHROPIC_API_KEY set.

set -e

BASE="${ORCHESTRATOR_URL:-http://localhost:4000}"

call() {
  local sid="$1"
  local msg="$2"
  echo "===> sid=$sid msg=$msg"
  curl -sN -X POST "$BASE/chat" \
    -H 'Content-Type: application/json' \
    -d "{\"sessionId\":\"$sid\",\"message\":\"$msg\"}" \
    | head -c 4000
  echo -e "\n"
}

# Scenario 1: cashflow query (multi-tool)
call "smoke-1" "macam mana cashflow hari ini?"

# Scenario 2: follow-up to stockout (memory must work)
call "smoke-1" "okay buatkan supply list"

# Scenario 3: emotional venting (no tool call expected)
call "smoke-2" "tak guna lah business ni"

# Scenario 4: out-of-scope (defer expected)
call "smoke-3" "boleh saya buka kedai baru?"
