#!/usr/bin/env bash
# End-to-end smoke test against a RUNNING Crewfest instance (this script does not
# start the server — start it yourself, then point BASE_URL at it).
#
# Usage:
#   BASE_URL=http://localhost:3001 ADMIN_USERNAME=admin ADMIN_PASSWORD=... \
#     ./scripts/smoke-e2e.sh
#
# Exercises: /health -> first-run setup or login -> create a shift + position ->
# submit a public application (DE + EN) -> confirm it shows up in /admin ->
# PDF export -> CSV export. Exits non-zero with a specific message on the first
# failure. Reused as-is by the GitHub Actions "test" and "docker" jobs, and can be
# run the same way against a VPS deployment.
#
# CSRF gotcha (see src/app.ts -> hono/csrf): Hono's csrf() middleware 403s any POST
# with a form content-type unless the request carries a matching Origin header (or a
# same-origin Sec-Fetch-Site, which curl never sends). Every POST below therefore
# sets `-H "Origin: $BASE_URL"` — drop that header and every POST here breaks.

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:3001}"
# Also doubles as the account this script creates via /setup on a fresh instance,
# when GET /setup returns 200 (no admin exists yet).
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-smoke-test-password-not-for-production}"

WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/crewfest-smoke.XXXXXX")"
COOKIE_JAR="$WORKDIR/cookies.txt"
TMP_BODY="$WORKDIR/body"
TMP_HEADERS="$WORKDIR/headers"
trap 'rm -rf "$WORKDIR"' EXIT

STEP=0

step() {
  STEP=$((STEP + 1))
  echo "--- [$STEP] $1 ---"
}

fail() {
  echo "FAIL [$STEP]: $1" >&2
  echo "     response body (first 500 bytes): $(head -c 500 "$TMP_BODY" 2>/dev/null | tr '\n' ' ')" >&2
  exit 1
}

ok() {
  echo "OK   [$STEP]: $1"
}

# GET $1, body -> $TMP_BODY, headers -> $TMP_HEADERS, prints the HTTP status code.
http_get() {
  curl -s -D "$TMP_HEADERS" -o "$TMP_BODY" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -w '%{http_code}' "$BASE_URL$1"
}

# POST $1 (remaining args passed through to curl, e.g. --data-urlencode k=v).
# Sends the Origin header required to pass CSRF (see file header comment above).
http_post() {
  local path="$1"
  shift
  curl -s -D "$TMP_HEADERS" -o "$TMP_BODY" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H "Origin: $BASE_URL" -X POST -w '%{http_code}' "$BASE_URL$path" "$@"
}

# Case-insensitively reads header $1 from the last response's $TMP_HEADERS.
header_value() {
  grep -i "^$1:" "$TMP_HEADERS" | tail -1 | sed 's/^[^:]*: *//' | tr -d '\r\n'
}

# ─── 1. Health check ──────────────────────────────────────────────────────────
step "GET /health"
code=$(http_get "/health")
[ "$code" = "200" ] || fail "expected HTTP 200, got $code"
grep -q '"status":"ok"' "$TMP_BODY" || fail "unexpected /health body"
ok "health check green"

# ─── 2. First-run setup, or an existing admin from ADMIN_USERNAME/ADMIN_PASSWORD ──
step "GET /setup"
code=$(http_get "/setup")
if [ "$code" = "200" ]; then
  step "POST /setup (create admin account)"
  code=$(http_post "/setup" \
    --data-urlencode "username=$ADMIN_USERNAME" \
    --data-urlencode "password=$ADMIN_PASSWORD" \
    --data-urlencode "confirm=$ADMIN_PASSWORD")
  [ "$code" = "302" ] || fail "expected 302 redirect after account creation, got $code"
  loc=$(header_value "Location")
  case "$loc" in
    *account_created*) ;;
    *) fail "unexpected redirect target after /setup: '$loc'" ;;
  esac
  ok "admin account '$ADMIN_USERNAME' created via /setup"
elif [ "$code" = "404" ]; then
  ok "admin already exists (created at boot from ADMIN_USERNAME/ADMIN_PASSWORD) — logging in directly"
else
  fail "unexpected status for GET /setup: $code"
fi

# ─── 3. Login ──────────────────────────────────────────────────────────────────
step "POST /admin/login"
code=$(http_post "/admin/login" \
  --data-urlencode "username=$ADMIN_USERNAME" \
  --data-urlencode "password=$ADMIN_PASSWORD")
[ "$code" = "302" ] || fail "login failed, expected 302, got $code"
loc=$(header_value "Location")
[ "$loc" = "/admin" ] || fail "unexpected login redirect target: '$loc'"
ok "logged in as '$ADMIN_USERNAME', session cookie stored"

step "GET /admin (session cookie works)"
code=$(http_get "/admin")
[ "$code" = "200" ] || fail "expected 200 on authenticated /admin, got $code"
ok "admin dashboard reachable"

# ─── 4. Create a position, then a shift with capacity in it ───────────────────
step "POST /admin/shifts/settings/positions/new"
code=$(http_post "/admin/shifts/settings/positions/new" \
  --data-urlencode "name=smoke_test_position" \
  --data-urlencode "label=Smoke Test Bar" \
  --data-urlencode "min_level=1" \
  --data-urlencode "default_capacity=1" \
  --data-urlencode "sort_order=1")
[ "$code" = "302" ] || fail "expected 302 after creating position, got $code"
ok "position created"

step "GET /admin/shifts/settings (resolve new position id)"
code=$(http_get "/admin/shifts/settings")
[ "$code" = "200" ] || fail "expected 200, got $code"
POSITION_ID=$(grep -oE '/admin/shifts/settings/positions/[0-9]+/edit' "$TMP_BODY" | head -1 | grep -oE '[0-9]+')
[ -n "$POSITION_ID" ] || fail "could not find the newly created position's id on the settings page"
ok "position id resolved: $POSITION_ID"

step "POST /admin/shifts/settings/new"
code=$(http_post "/admin/shifts/settings/new" \
  --data-urlencode "date=2026-08-01" \
  --data-urlencode "type=day" \
  --data-urlencode "start_time=10:00" \
  --data-urlencode "end_time=18:00" \
  --data-urlencode "sort_order=1" \
  --data-urlencode "color=#6366f1" \
  --data-urlencode "cap_${POSITION_ID}=2")
[ "$code" = "302" ] || fail "expected 302 after creating shift, got $code"
ok "shift created (with capacity in the new position)"

# ─── 5. Public application form (DE default, then EN) ─────────────────────────
step "POST /apply (default language)"
APPLICANT_TS="$(date +%s)"
APPLICANT_LASTNAME="Testerson-${APPLICANT_TS}"
APPLICANT_EMAIL="smoke-test-${APPLICANT_TS}@example.invalid"
code=$(http_post "/apply" \
  --data-urlencode "first_name=Smoke" \
  --data-urlencode "last_name=$APPLICANT_LASTNAME" \
  --data-urlencode "email=$APPLICANT_EMAIL" \
  --data-urlencode "experience_text=exp_none")
[ "$code" = "302" ] || fail "expected 302 after applying, got $code"
loc=$(header_value "Location")
case "$loc" in
  /apply/success*) ;;
  *) fail "unexpected redirect after /apply: '$loc'" ;;
esac
ok "application submitted ($APPLICANT_EMAIL)"

step "GET /apply?lang=en (English translation present)"
code=$(http_get "/apply?lang=en")
[ "$code" = "200" ] || fail "expected 200, got $code"
grep -q "Crew Application" "$TMP_BODY" || fail "expected English marker string 'Crew Application' not found"
ok "English translation confirmed"

# ─── 6. Crew visible in admin ──────────────────────────────────────────────────
# The crew table renders first_name/last_name, not email — search for the name.
step "GET /admin (applicant visible)"
code=$(http_get "/admin")
[ "$code" = "200" ] || fail "expected 200, got $code"
grep -q "$APPLICANT_LASTNAME" "$TMP_BODY" || fail "applicant '$APPLICANT_LASTNAME' not visible in /admin"
ok "applicant visible in admin crew table"

# ─── 7. PDF export ──────────────────────────────────────────────────────────────
step "GET /admin/export/pdf-shifts"
code=$(http_get "/admin/export/pdf-shifts")
[ "$code" = "200" ] || fail "expected 200, got $code"
content_type=$(header_value "Content-Type")
case "$content_type" in
  application/pdf*) ;;
  *) fail "unexpected Content-Type for PDF export: '$content_type'" ;;
esac
magic=$(head -c 4 "$TMP_BODY")
[ "$magic" = "%PDF" ] || fail "PDF body does not start with the %PDF magic bytes (got: '$magic')"
ok "PDF export valid (Content-Type + %PDF magic bytes, $(wc -c <"$TMP_BODY" | tr -d ' ') bytes)"

# ─── 8. CSV export ──────────────────────────────────────────────────────────────
step "GET /admin/export/csv"
code=$(http_get "/admin/export/csv")
[ "$code" = "200" ] || fail "expected 200, got $code"
content_type=$(header_value "Content-Type")
case "$content_type" in
  text/csv*) ;;
  *) fail "unexpected Content-Type for CSV export: '$content_type'" ;;
esac
[ -s "$TMP_BODY" ] || fail "CSV export body is empty"
ok "CSV export valid"

echo ""
echo "All smoke checks passed against $BASE_URL"
