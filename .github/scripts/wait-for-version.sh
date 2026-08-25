#!/usr/bin/env bash
# Poll a deployment until it serves the commit we just pushed, or give up.
#
# wait-for-http-200.sh answers a different question: is this HOSTNAME routable
# at all. Against a site that is already live, that is true before the deploy
# even starts, so it returns on the first attempt and the assertions behind it
# race the rollout. Measured 2026-08-25: an Open Graph image added by a deploy
# answered 404 zero point eight seconds after `wrangler deploy` returned, while
# the home-page gate had already reported "200 on attempt 1 (0s)".
#
# The stamp comes from site/src/pages/version.txt.ts and changes every commit,
# so matching it is proof that THIS version is the one answering.
#
# Usage: wait-for-version.sh <base-url> <expected-sha> [timeout-seconds]
set -euo pipefail

BASE="${1:?usage: wait-for-version.sh <base-url> <expected-sha> [timeout-seconds]}"
EXPECTED="${2:?expected commit sha is required}"
TIMEOUT="${3:-120}"
INTERVAL=5

URL="${BASE%/}/version.txt"
# Before this fix ships everywhere, the version being replaced has no
# version.txt at all, so what comes back is a whole 404 page. Print a readable
# slice of it rather than the page.
short() {
  local text="${1:-<nothing>}"
  if [ "${#text}" -gt 40 ]; then
    printf '%s...' "${text:0:40}"
  else
    printf '%s' "$text"
  fi
}

deadline=$((SECONDS + TIMEOUT))
attempt=0
served=""

while [ "$SECONDS" -lt "$deadline" ]; do
  attempt=$((attempt + 1))
  served="$(curl -sS "$URL" 2>/dev/null | tr -d '[:space:]' || echo "")"
  if [ "$served" = "$EXPECTED" ]; then
    echo "$URL serves $EXPECTED on attempt $attempt (${SECONDS}s)"
    exit 0
  fi
  echo "attempt $attempt: $URL serves '$(short "$served")', want '$EXPECTED', retrying in ${INTERVAL}s"
  sleep "$INTERVAL"
done

echo "FAIL: $URL never served $EXPECTED within ${TIMEOUT}s (last saw '$(short "$served")')"
echo "If it serves 'dev', the build ran without BUILD_SHA set -- check the build-site action."
exit 1
