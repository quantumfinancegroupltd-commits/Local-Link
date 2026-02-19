#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost}"
API="$BASE_URL/api"

echo "Running LocalLink smoke test against: $API"

rand() { date +%s; }

json_get() {
  python3 - "$1" "$2" <<'PY'
import json,sys
obj=json.loads(sys.argv[1])
path=sys.argv[2].split(".")
cur=obj
for p in path:
  cur=cur.get(p) if isinstance(cur,dict) else None
print(cur if cur is not None else "")
PY
}

health="$(curl -sS "$API/health")"
ready="$(curl -sS "$API/ready")"
echo "health=$health ready=$ready"
if ! echo "$health" | grep -q '"ok"'; then echo "Health check failed: $health"; exit 1; fi

# Optional: test Paystack init only when configured
# Optional: test Paystack init only when configured
USE_PAYSTACK="${USE_PAYSTACK:-}"
if [ -z "${USE_PAYSTACK}" ]; then
  if [ -n "${PAYSTACK_SECRET_KEY:-}" ] || [ -n "${PAYSTACK_WEBHOOK_SECRET:-}" ]; then
    USE_PAYSTACK="1"
  else
    USE_PAYSTACK="0"
  fi
fi

# Create buyer
BUYER_EMAIL="buyer_$(rand)@example.com"
BUYER_RESP="$(curl -sS -X POST "$API/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Buyer\",\"email\":\"$BUYER_EMAIL\",\"phone\":\"+233000000000\",\"password\":\"password123\",\"role\":\"buyer\"}")"
BUYER_TOKEN="$(json_get "$BUYER_RESP" token)"
BUYER_USER_ID="$(json_get "$BUYER_RESP" user.id)"
if [ -z "$BUYER_TOKEN" ]; then echo "Buyer register failed: $BUYER_RESP"; exit 1; fi

# Create artisan + artisan profile
ART_EMAIL="artisan_$(rand)@example.com"
ART_RESP="$(curl -sS -X POST "$API/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Artisan\",\"email\":\"$ART_EMAIL\",\"phone\":\"+233000000001\",\"password\":\"password123\",\"role\":\"artisan\"}")"
ART_TOKEN="$(json_get "$ART_RESP" token)"
ART_USER_ID="$(json_get "$ART_RESP" user.id)"
curl -sS -X POST "$API/artisans" -H 'Content-Type: application/json' -H "Authorization: Bearer $ART_TOKEN" \
  -d '{"skills":["plumber"],"experience_years":4,"service_area":"Accra"}' >/dev/null

# Full smoke: mark artisan (and later farmer) as ID-verified so quote/product steps run
if [ "${SMOKE_FULL:-0}" = "1" ] && [ -n "${SMOKE_ADMIN_TOKEN:-}" ]; then
  curl -sS -X PUT "$API/admin/users/$ART_USER_ID/id-verified" -H 'Content-Type: application/json' -H "Authorization: Bearer $SMOKE_ADMIN_TOKEN" -d '{"id_verified":true}' >/dev/null || true
fi

# Buyer posts job
JOB_RESP="$(curl -sS -X POST "$API/jobs" -H 'Content-Type: application/json' -H "Authorization: Bearer $BUYER_TOKEN" \
  -d '{"title":"Fix leaking tap","description":"Kitchen tap leaking","location":"Accra","budget":150}')"
JOB_ID="$(json_get "$JOB_RESP" id)"
if [ -z "$JOB_ID" ]; then echo "Job create failed: $JOB_RESP"; exit 1; fi

# Artisan submits quote (skipped when ID verification is required for providers)
QUOTE_ID=""
ESCROW_ID=""
SKIP_QUOTE_REASON=""
QUOTE_RESP="$(curl -sS -X POST "$API/jobs/$JOB_ID/quote" -H 'Content-Type: application/json' -H "Authorization: Bearer $ART_TOKEN" \
  -d '{"quote_amount":200,"message":"Can fix within 2 days"}')"
if echo "$QUOTE_RESP" | grep -qE 'ID_VERIFICATION_REQUIRED|ID verification required'; then
  SKIP_QUOTE_REASON="ID verification required for quote (provider gating)"
  echo "Skipping quote/accept/escrow: $SKIP_QUOTE_REASON"
else
  QUOTE_ID="$(json_get "$QUOTE_RESP" id)"
  if [ -z "$QUOTE_ID" ]; then echo "Quote submit failed: $QUOTE_RESP"; exit 1; fi

  # Buyer accepts quote
  ACC_RESP="$(curl -sS -X PUT "$API/quotes/$QUOTE_ID" -H 'Content-Type: application/json' -H "Authorization: Bearer $BUYER_TOKEN" \
    -d '{"status":"accepted"}')"
  echo "Accepted quote: $(json_get "$ACC_RESP" status)"

  # Escrow deposit intent
  if [ "$USE_PAYSTACK" = "1" ]; then
    ESCROW_RESP="$(curl -sS -X POST "$API/escrow/jobs/$JOB_ID/deposit" -H 'Content-Type: application/json' -H "Authorization: Bearer $BUYER_TOKEN" \
      -d '{"amount":60,"provider":"paystack"}')"
    ESCROW_ID="$(json_get "$ESCROW_RESP" id)"
    if [ -z "$ESCROW_ID" ]; then
      ESCROW_ID="$(json_get "$ESCROW_RESP" escrow.id)"
    fi
  else
    ESCROW_RESP="$(curl -sS -X POST "$API/escrow/jobs/$JOB_ID/deposit" -H 'Content-Type: application/json' -H "Authorization: Bearer $BUYER_TOKEN" \
      -d '{"amount":60}')"
    ESCROW_ID="$(json_get "$ESCROW_RESP" id)"
  fi
  if [ -z "$ESCROW_ID" ]; then echo "Escrow deposit failed: $ESCROW_RESP"; exit 1; fi
fi

# Create farmer + product (product create may be skipped when ID verification required)
FARM_EMAIL="farmer_$(rand)@example.com"
FARM_RESP="$(curl -sS -X POST "$API/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Farmer\",\"email\":\"$FARM_EMAIL\",\"phone\":\"+233000000002\",\"password\":\"password123\",\"role\":\"farmer\"}")"
FARM_TOKEN="$(json_get "$FARM_RESP" token)"
FARM_USER_ID="$(json_get "$FARM_RESP" user.id)"
if [ "${SMOKE_FULL:-0}" = "1" ] && [ -n "${SMOKE_ADMIN_TOKEN:-}" ]; then
  curl -sS -X PUT "$API/admin/users/$FARM_USER_ID/id-verified" -H 'Content-Type: application/json' -H "Authorization: Bearer $SMOKE_ADMIN_TOKEN" -d '{"id_verified":true}' >/dev/null || true
fi

PROD_ID=""
PROD_RESP="$(curl -sS -X POST "$API/products" -H 'Content-Type: application/json' -H "Authorization: Bearer $FARM_TOKEN" \
  -d '{"name":"Tomatoes","category":"vegetables","quantity":10,"unit":"kg","price":50,"image_url":"https://images.unsplash.com/photo-1524593166156-312f362cada0?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.1.0"}')"
if echo "$PROD_RESP" | grep -q 'ID_VERIFICATION_REQUIRED'; then
  echo "Skipping product create: ID verification required for farmer."
else
  PROD_ID="$(json_get "$PROD_RESP" id)"
  if [ -z "$PROD_ID" ]; then echo "Product create failed: $PROD_RESP"; exit 1; fi
fi

# Buyer places order (requires Paystack configured and product created)
ORDER_ID=""
if [ "$USE_PAYSTACK" = "1" ] && [ -n "$PROD_ID" ]; then
  ORDER_RESP="$(curl -sS -X POST "$API/orders" -H 'Content-Type: application/json' -H "Authorization: Bearer $BUYER_TOKEN" \
    -d "{\"product_id\":\"$PROD_ID\",\"quantity\":2,\"total_price\":100,\"delivery_address\":\"Accra\"}")"
  ORDER_ID="$(json_get "$ORDER_RESP" order_id)"
  if [ -z "$ORDER_ID" ]; then
    ORDER_ID="$(json_get "$ORDER_RESP" order.id)"
  fi
  if [ -z "$ORDER_ID" ]; then
    AUTH_URL="$(json_get "$ORDER_RESP" paystack.authorization_url)"
    if [ -z "$AUTH_URL" ]; then echo "Order create failed: $ORDER_RESP"; exit 1; fi
    echo "Paystack authorization URL returned (order created)."
  fi
elif [ "$USE_PAYSTACK" != "1" ]; then
  echo "Skipping /orders smoke step (Paystack not configured)."
elif [ -z "$PROD_ID" ]; then
  echo "Skipping /orders smoke step (no product created, ID verification may be required)."
fi

# Company (employer): register, create company profile, post job
COMP_EMAIL="company_$(rand)@example.com"
COMP_RESP="$(curl -sS -X POST "$API/register" -H 'Content-Type: application/json' \
  -d "{\"name\":\"Company\",\"email\":\"$COMP_EMAIL\",\"phone\":\"+233000000003\",\"password\":\"password123\",\"role\":\"company\"}")"
COMP_TOKEN="$(json_get "$COMP_RESP" token)"
COMP_USER_ID="$(json_get "$COMP_RESP" user.id)"
if [ -z "$COMP_TOKEN" ]; then echo "Company register failed: $COMP_RESP"; exit 1; fi

COMP_PROF_RESP="$(curl -sS -X POST "$API/corporate/company/me" -H 'Content-Type: application/json' -H "Authorization: Bearer $COMP_TOKEN" \
  -d '{"name":"Smoke Test Ltd","industry":"Retail","size_range":"1-10","location":"Accra"}')"
COMP_ID="$(json_get "$COMP_PROF_RESP" id)"
if [ -z "$COMP_ID" ]; then echo "Company profile create failed: $COMP_PROF_RESP"; exit 1; fi

CORP_JOB_RESP="$(curl -sS -X POST "$API/corporate/company/jobs" -H 'Content-Type: application/json' -H "Authorization: Bearer $COMP_TOKEN" \
  -d '{"title":"Smoke test role","description":"Minimal job for smoke test. Ten chars.","location":"Accra","employment_type":"full_time","work_mode":"onsite"}')"
CORP_JOB_ID="$(json_get "$CORP_JOB_RESP" id)"
if [ -z "$CORP_JOB_ID" ]; then echo "Corporate job post failed: $CORP_JOB_RESP"; exit 1; fi
echo "Company profile and job created: companyId=$COMP_ID corpJobId=$CORP_JOB_ID"

echo "✅ Smoke test passed."
echo "jobId=$JOB_ID quoteId=${QUOTE_ID:-} escrowId=${ESCROW_ID:-} productId=${PROD_ID:-} orderId=${ORDER_ID:-} companyId=$COMP_ID corpJobId=$CORP_JOB_ID"
[ -n "$SKIP_QUOTE_REASON" ] && echo "Note: $SKIP_QUOTE_REASON"

# Optional: delete smoke test users (soft-delete) so production doesn't accumulate test accounts
if [ "${SMOKE_CLEANUP:-0}" = "1" ] && [ -n "${SMOKE_ADMIN_TOKEN:-}" ]; then
  for uid in "$BUYER_USER_ID" "$ART_USER_ID" "$FARM_USER_ID" "$COMP_USER_ID"; do
    [ -z "$uid" ] && continue
    curl -sS -X DELETE "$API/admin/users/$uid" -H "Authorization: Bearer $SMOKE_ADMIN_TOKEN" >/dev/null || true
  done
  echo "Smoke test users soft-deleted (cleanup done)."
fi


