#!/usr/bin/env bash
# Real Canvas QA only. Requires prestarted isolated Canvas with synthetic users.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT" || exit 2
: "${QA_ADMIN_USER:?Defina QA_ADMIN_USER (cuenta sintética)}"
: "${QA_PROFESSOR_USER:?Defina QA_PROFESSOR_USER (cuenta sintética)}"
: "${QA_STUDENT_USER:?Defina QA_STUDENT_USER (cuenta sintética)}"
: "${QA_LOGIN_PASSWORD:?Defina QA_LOGIN_PASSWORD en el entorno, nunca en Git}"
export QA_CANVAS_URL="${QA_CANVAS_URL:-https://localhost:8443}"
export QA_SCREENSHOT_DIR="${QA_SCREENSHOT_DIR:-$ROOT/logs/qa-headless}"
mkdir -p "$QA_SCREENSHOT_DIR"
STAMP="$(date +%Y%m%dT%H%M%S)"
REPORT="$QA_SCREENSHOT_DIR/report-$STAMP.csv"
FAILURES=0
run() {
  local name="$1"; shift
  if timeout 180 "$@" > "$QA_SCREENSHOT_DIR/$STAMP-$name.log" 2>&1; then
    printf '%s,pass\n' "$name" >> "$REPORT"
    printf 'PASS %s\n' "$name"
  else
    local result=$?
    printf '%s,fail(%s)\n' "$name" "$result" >> "$REPORT"
    printf 'FAIL %s (ver log)\n' "$name"
    FAILURES=$((FAILURES+1))
  fi
}
for item in "admin:$QA_ADMIN_USER" "professor:$QA_PROFESSOR_USER" "student:$QA_STUDENT_USER"; do
  role="${item%%:*}"
  user="${item#*:}"
  for scenario in reload clear_cookies tampered_cookie parallel_tabs; do
    # El alumno sintético no necesita permiso sobre el curso de ejemplo.
    if [[ "$role" == student ]]; then scenario=login_only; fi
    run "$role-$scenario" env QA_LOGIN_USER="$user" QA_SCENARIO="$scenario" QA_EVIDENCE_PREFIX="$STAMP-$role-$scenario" node tools/diagnostics/qa_canvas_sessions_headless.mjs
    if [[ "$role" == student ]]; then break; fi
  done
done
if [[ "${QA_CHECK_LTI:-true}" == true ]]; then
  run lti-admin env QA_LOGIN_USER="$QA_ADMIN_USER" QA_EVIDENCE_PREFIX="$STAMP-lti-admin" node tools/diagnostics/qa_canvas_lti_headless.mjs
  run lti-professor env QA_LOGIN_USER="$QA_PROFESSOR_USER" QA_EVIDENCE_PREFIX="$STAMP-lti-professor" node tools/diagnostics/qa_canvas_lti_headless.mjs
fi
echo "Suite headless terminada. Fallos: $FAILURES. Resultados: $REPORT"
test "$FAILURES" -eq 0
