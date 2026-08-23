#!/usr/bin/env bash
# Poll a URL until it answers 200, or give up.
#
# A freshly deployed Worker is not routable the instant `wrangler deploy`
# returns: a hostname that has never been used needs DNS and, on a new
# *.workers.dev subdomain, a certificate. Smoke-testing immediately is a race,
# so wait for the condition instead of assuming it already holds.
#
# Usage: wait-for-http-200.sh <url> [timeout-seconds]
set -euo pipefail

URL="${1:?usage: wait-for-http-200.sh <url> [timeout-seconds]}"
TIMEOUT="${2:-90}"
INTERVAL=5

deadline=$((SECONDS + TIMEOUT))
attempt=0

while [ "$SECONDS" -lt "$deadline" ]; do
  attempt=$((attempt + 1))
  status="$(curl -sS -o /dev/null -w '%{http_code}' "$URL" 2>/dev/null || echo 000)"
  if [ "$status" = "200" ]; then
    echo "$URL answered 200 on attempt $attempt (${SECONDS}s)"
    exit 0
  fi
  echo "attempt $attempt: $URL returned $status, retrying in ${INTERVAL}s"
  sleep "$INTERVAL"
done

echo "FAIL: $URL never returned 200 within ${TIMEOUT}s"
echo "A brand-new Worker hostname can take longer than this to become routable."
echo "If this is the first deploy of this hostname, re-run the job."
exit 1
