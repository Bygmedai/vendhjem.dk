#!/usr/bin/env bash
# Maaler hegnene om /sporene/foresporg med curl.
#
# Standard (CI og lokal): starter Workeren under test — samme stubs som
# koer.mjs — og curl'er den. Rammer ikke produktion.
#
# Live, kun naar nogen beder om det:
#   VH_SMOKE_LIVE=1 bash vh-worker/test/smoke-hegn.sh
#   VH_SMOKE_URL=https://vendhjem.dk bash vh-worker/test/smoke-hegn.sh
# Koer IKKE live fra PR-CI. Flaget er her, fordi produktion ikke
# skal rammes af hver PR.

set -eu
FEJL=0
HER="$(cd "$(dirname "$0")" && pwd)"
PID=""
TMP="$(mktemp -d)"

ryd() {
  if [ -n "${PID:-}" ]; then kill "$PID" 2>/dev/null || true; wait "$PID" 2>/dev/null || true; fi
  rm -rf "$TMP"
}
trap ryd EXIT

sig() { printf '  %-48s %s\n' "$1" "$2"; }
fejl() { sig "$1" "FEJL $2"; FEJL=1; }

start_stub() {
  local log="$TMP/server.log"
  node "$HER/smoke-hegn-server.mjs" >"$log" 2>&1 &
  PID=$!
  local i
  for i in $(seq 1 50); do
    if grep -q '^READY ' "$log" 2>/dev/null; then
      # READY http://127.0.0.1:port id
      read -r _ BASE ID < <(grep '^READY ' "$log")
      export BASE ID
      return 0
    fi
    if ! kill -0 "$PID" 2>/dev/null; then
      echo "smoke-hegn-server døde:" >&2
      cat "$log" >&2
      return 1
    fi
    sleep 0.1
  done
  echo "smoke-hegn-server svarede ikke i tide:" >&2
  cat "$log" >&2
  return 1
}

find_id() {
  echo "$1" | grep -oE '/sporene/foresporg/[A-Za-z0-9_-]{4,64}' | head -n1 | sed 's|.*/||'
}

if [ -n "${VH_SMOKE_URL:-}" ] || [ "${VH_SMOKE_LIVE:-}" = "1" ]; then
  BASE="${VH_SMOKE_URL:-https://vendhjem.dk}"
  BASE="${BASE%/}"
  echo "── live $BASE (manuel — ikke PR-CI) ──"
  liste="$(curl -sS "$BASE/sporene")"
  ID="$(find_id "$liste")"
  if [ -z "$ID" ]; then
    echo "FEJL  ingen /sporene/foresporg/{id} på /sporene — kan ikke måle formularen" >&2
    exit 1
  fi
else
  echo "── Worker under test (ikke produktion) ──"
  start_stub
fi

echo "    id=$ID  base=$BASE"

# 1. ASCII-formular er 200 og er en formular
kode="$(curl -sS -o "$TMP/ascii.html" -w '%{http_code}' "$BASE/sporene/foresporg/$ID")"
if [ "$kode" = "200" ] && grep -q 'name="_csrf"' "$TMP/ascii.html" && grep -qi '<form' "$TMP/ascii.html"; then
  sig "ASCII foresporg er formular" "200"
else
  fejl "ASCII foresporg er formular" "kode=$kode (skal 200 + form + _csrf)"
fi

# 2. ø → 301 til ASCII. Procent-kodet, saa curl ikke afhaenger af locale.
lok="$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' "$BASE/sporene/foresp%C3%B8rg/$ID")"
kode="${lok%% *}"
maal="${lok#* }"
if [ "$kode" = "301" ] && echo "$maal" | grep -q "/sporene/foresporg/$ID"; then
  sig "ø → ASCII" "301"
else
  fejl "ø → ASCII" "fik «$lok» (skal 301 til /sporene/foresporg/$ID)"
fi

# 3. ukendt understi er 404, ikke listen
ukendt="$(curl -sS -o "$TMP/ukendt.html" -w '%{http_code}' "$BASE/sporene/findes-ikke-xyz")"
if [ "$ukendt" = "404" ] && ! grep -q 'Det, der sker på stedet' "$TMP/ukendt.html"; then
  sig "ukendt /sporene/... " "404"
else
  fejl "ukendt /sporene/..." "kode=$ukendt (skal 404, ikke listen)"
fi

# 4. POST uden CSRF er 400
post="$(curl -sS -o /dev/null -w '%{http_code}' -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "navn=SmokeHegn&mail=smoke.hegn@example.com" \
  "$BASE/sporene/foresporg/$ID")"
if [ "$post" = "400" ]; then
  sig "POST uden CSRF" "400"
else
  fejl "POST uden CSRF" "kode=$post (skal 400)"
fi

echo
if [ "$FEJL" -eq 0 ]; then
  echo "HEGN-RØG OK"
  exit 0
fi
echo "HEGN-RØG FEJLEDE"
exit 1
