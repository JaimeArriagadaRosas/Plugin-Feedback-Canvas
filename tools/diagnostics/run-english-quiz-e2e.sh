#!/usr/bin/env bash
# Non-destructive, self-bootstrapping local Canvas Classic Quiz E2E.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
export PATH="/home/jaime/.nvm/versions/node/v22.23.2/bin:$PATH"
mkdir -p logs
BOOT_PID=""
BOOT_LOG="$ROOT/logs/english-quiz-autoboot.log"
fail() { echo "[E2E] ERROR: $*" >&2; exit 1; }
canvas_ready() {
  curl --silent --show-error --max-time 3 --output /dev/null --fail http://127.0.0.1:8080/login/canvas 2>/dev/null &&
  curl --insecure --silent --show-error --max-time 3 --output /dev/null --fail https://127.0.0.1:8443/login/canvas 2>/dev/null
}
echo "[E2E] Checking Canvas and the HTTPS proxy..."
if ! canvas_ready; then
  echo "[E2E] Starting Canvas through existing option 3 (no volume deletion)."
  node apps/installer/src/preboot.js --mode=3 > "$BOOT_LOG" 2>&1 &
  BOOT_PID=$!
  echo "[E2E] Startup log: $BOOT_LOG"
  READY=0
  for i in $(seq 1 300); do
    if canvas_ready; then READY=1; break; fi
    if ! kill -0 "$BOOT_PID" 2>/dev/null; then
      tail -45 "$BOOT_LOG" >&2
      fail "Option 3 exited before Canvas became ready"
    fi
    sleep 4
  done
  if [ "$READY" -ne 1 ]; then
    tail -45 "$BOOT_LOG" >&2
    fail "Canvas did not become ready within 20 minutes"
  fi
fi
echo "[E2E] Canvas HTTP and TLS ports are responsive."
docker info >/dev/null || fail "Docker daemon unavailable"
docker inspect canvas-lms-master-web-1 >/dev/null || fail "Canvas web container missing"
if [ ! -s tmp/canvas_local_users.json ]; then
  fail "Local Canvas test user credentials were not initialized by option 3"
fi
echo "[E2E] Creating/reusing an isolated quiz via the official Canvas API..."
FIXTURE="$(node tools/diagnostics/prepare-english-quiz-api.mjs)" || fail "Canvas API quiz fixture failed"
echo "$FIXTURE"
IDENTIFIERS="$(printf '%s' "$FIXTURE" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const line=s.trim().split(String.fromCharCode(10)).find(x=>x.includes("FIXTURE_READY"));if(!line)process.exit(2);const v=JSON.parse(line);console.log([v.quiz,v.assignment,v.student].join(" "))})')" || fail "Quiz fixture result missing"
read -r QUIZ ASSIGNMENT STUDENT <<< "$IDENTIFIERS"
[ -n "$QUIZ" ] && [ -n "$ASSIGNMENT" ] && [ -n "$STUDENT" ] || fail "Invalid fixture IDs"
echo "[E2E] Requesting Canvas Student Analysis for the fixture..."
node tools/diagnostics/request-quiz-student-analysis.mjs --course=1 --quiz="$QUIZ" --create-report || true
REPORT_READY=0
for i in $(seq 1 36); do
  REPORT_RESULT="$(node tools/diagnostics/request-quiz-student-analysis.mjs --course=1 --quiz="$QUIZ" 2>&1)" || true
  if printf '%s' "$REPORT_RESULT" | grep -Eq '"fileId":[0-9]+'; then REPORT_READY=1; break; fi
  sleep 5
done
if [ "$REPORT_READY" -ne 1 ]; then
  echo "$REPORT_RESULT" >&2
  fail "Canvas did not produce Student Analysis CSV"
fi
echo "[E2E] Running read-only quiz answer validation..."
node tools/diagnostics/feedback-e2e.mjs --mode=quiz-readonly --course=1 --assignment="$ASSIGNMENT" --student="$STUDENT" || fail "No verifiable student answer; Gemini was not called"
echo "[E2E] Running content preflight..."
node tools/diagnostics/feedback-e2e.mjs --mode=preflight --course=1 --assignment="$ASSIGNMENT" --student="$STUDENT" || fail "Ungraded content preflight failed"
echo "[E2E] Running exactly one Gemini qualitative generation..."
node tools/diagnostics/feedback-e2e.mjs --mode=generate --confirm=ONE_REQUEST --course=1 --assignment="$ASSIGNMENT" --student="$STUDENT"
echo "[E2E] PASS: One pending qualitative draft; Canvas grade unchanged."
echo "[E2E] Reused/started services remain running for inspection."
