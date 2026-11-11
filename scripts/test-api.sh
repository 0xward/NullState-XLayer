#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
WALLET="${WALLET:-0x1111111111111111111111111111111111111111}"
WEEK_ID="${WEEK_ID:-202627}"

printf '\n[1/3] Vault status\n'
curl -sS "${BASE_URL}/api/vault/status?walletAddress=${WALLET}&weekId=${WEEK_ID}" | jq

printf '\n[2/3] Vault submit (wrong code)\n'
curl -sS -X POST "${BASE_URL}/api/vault/submit" \
  -H 'Content-Type: application/json' \
  -d "{\"walletAddress\":\"${WALLET}\",\"weekId\":${WEEK_ID},\"code\":\"9999\"}" | jq

printf '\n[3/3] Leaderboard\n'
curl -sS "${BASE_URL}/api/leaderboard" | jq
