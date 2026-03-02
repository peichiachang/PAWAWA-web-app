#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"

if [ -z "$BASE_URL" ]; then
  echo "Usage: $0 <AI_API_BASE_URL>"
  echo "Example: $0 http://localhost:8080"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl not found"
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq not found. Install with: brew install jq"
  exit 1
fi

run_test() {
  local name="$1"
  local path="$2"
  local payload="$3"

  echo
  echo "==> $name"
  echo "POST ${BASE_URL}${path}"

  local response
  response="$(curl -sS -w "\n%{http_code}" \
    -X POST "${BASE_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "${payload}")"

  local http_code
  http_code="$(echo "$response" | tail -n1)"
  local body
  body="$(echo "$response" | sed '$d')"

  echo "HTTP: ${http_code}"
  echo "$body" | jq .
}

run_test "Feeding Vision" "/ai/feeding" \
'{
  "t0ImageRef": "feeding_t0_sample.jpg",
  "t1ImageRef": "feeding_t1_sample.jpg"
}'

run_test "Nutrition OCR" "/ai/nutrition-ocr" \
'{
  "imageRef": "feed_label_sample.jpg"
}'

run_test "Hydration Vision" "/ai/hydration" \
'{
  "t0ImageRef": "water_t0_sample.jpg",
  "t1ImageRef": "water_t1_sample.jpg"
}'

run_test "Elimination Vision" "/ai/elimination" \
'{
  "imageRef": "elimination_sample.jpg"
}'

echo
echo "All endpoint checks finished."
