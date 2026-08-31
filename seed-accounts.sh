#!/usr/bin/env bash
# Seed the demo login accounts (idempotent — re-run any time after the stack is up).
# Dashboard (web) login: 9435100100 / sih2026   (role: admin)
# App (phone) login:      9435100200 / sih2026   (role: driver)
API="${1:-http://localhost:8080}/api/v1"

curl -s -X POST "$API/auth/register" -H "content-type: application/json" \
  -d '{"full_name":"NER Admin","phone":"9435100100","password":"sih2026","role":"admin","home_state":"Assam"}' >/dev/null
curl -s -X POST "$API/auth/register" -H "content-type: application/json" \
  -d '{"full_name":"Ramesh Driver","phone":"9435100200","password":"sih2026","role":"driver","home_state":"Assam"}' >/dev/null

echo "Seeded accounts:"
echo "  Dashboard (admin):  phone 9435100100  password sih2026"
echo "  App (driver):       phone 9435100200  password sih2026"
