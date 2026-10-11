#!/bin/bash
# Real Lighthouse run against a served production build. Never fabricate these numbers.
# Usage: run-lighthouse.sh <url> [out-dir]   (desktop + mobile presets)
set -euo pipefail
URL="${1:?url}"; OUT="${2:-artifacts/evidence/lighthouse}"; mkdir -p "$OUT"
npx --yes lighthouse@13 "$URL" --quiet --chrome-flags="--headless=new" --preset=desktop \
  --output=json --output=html --output-path="$OUT/desktop"
npx --yes lighthouse@13 "$URL" --quiet --chrome-flags="--headless=new" \
  --output=json --output=html --output-path="$OUT/mobile"
for f in desktop mobile; do
  node -e "const r=require('./$OUT/$f.report.json');const c=r.categories,a=r.audits;console.log('$f',JSON.stringify({perf:c.performance.score,a11y:c.accessibility.score,bp:c['best-practices'].score,lcp_ms:a['largest-contentful-paint'].numericValue,cls:a['cumulative-layout-shift'].numericValue,tbt_ms:a['total-blocking-time'].numericValue}))"
done
