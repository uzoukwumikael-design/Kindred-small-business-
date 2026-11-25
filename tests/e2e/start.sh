#!/usr/bin/env bash
# Builds the production app against the stand-in services, starts everything, and leaves it running on http://127.0.0.1:8090
# (the preview is on 8081 and the security-header proxy on 8090). Stop it with: bash tests/e2e/stop.sh
set -e
cd "$(dirname "$0")/../.."
bash tests/e2e/stop.sh >/dev/null 2>&1 || true
export VITE_SUPABASE_URL=http://127.0.0.1:9913 VITE_SUPABASE_ANON_KEY=anon VITE_GOOGLE_AUTH=true
export VITE_CONTACT_EMAIL=hi@example.com VITE_CONTROLLER_NAME="Test Operator Ltd" VITE_DATA_REGION="EU (Ireland)" VITE_SITE_URL=http://127.0.0.1:8090
export VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA
export VITE_PLAN_NAME=Supporter VITE_PLAN_PRICE='$9 a month' VITE_PLAN_URL=https://pay.example.com/x
npx vite build > /tmp/e2e-build.log 2>&1 || { echo "BUILD FAILED"; tail -8 /tmp/e2e-build.log; exit 1; }
export SUPABASE_SERVICE_ROLE_KEY=svc CRON_SECRET=cronsecret-which-is-long-enough SITE_URL=http://127.0.0.1:8090
export TURNSTILE_SECRET_KEY=test-secret TURNSTILE_VERIFY_URL=http://127.0.0.1:9915/siteverify
export FEEDBACK_WEBHOOK_URL=http://127.0.0.1:9912/feedback ERROR_WEBHOOK_URL=http://127.0.0.1:9912/error WAITLIST_WEBHOOK_URL=http://127.0.0.1:9912/waitlist
export GEMINI_API_KEY=k GEMINI_BASE_URL=http://127.0.0.1:9911
(setsid nohup node tests/e2e/mocks.mjs > /tmp/e2e-mocks.log 2>&1 &)
(setsid nohup npx vite preview > /tmp/e2e-preview.log 2>&1 &)
for i in $(seq 1 40); do curl -s -o /dev/null http://127.0.0.1:8081/ && break; sleep 1; done
(setsid nohup node tests/e2e/proxy.mjs > /tmp/e2e-proxy.log 2>&1 &)
for i in $(seq 1 15); do curl -s -o /dev/null http://127.0.0.1:8090/ && break; sleep 1; done
curl -s -o /dev/null -w "ready on 8090: %{http_code}\n" http://127.0.0.1:8090/
