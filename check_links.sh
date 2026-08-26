#!/usr/bin/env bash
# Verify every complete outbound link in js/ and index.html resolves publicly.
#
# Why this exists: a link into a PRIVATE GitHub repo returns 404 to an
# unauthenticated reader in exactly the same way a typo does, and nothing on the
# rendered page distinguishes the two. Three such links shipped and sat live —
# two into todayindefi/riskAnalyst, one into todayindefi/biz — because they
# resolve fine for anyone logged in, which is everyone who ever reviewed them.
#
# Run unauthenticated, the way a public reader hits the page.
#
# What counts as a failure: 404/410 on a COMPLETE url. That is the private-repo
# and typo signal. Deliberately NOT failures:
#   - urls ending in / = ? & : these are concatenation bases in JS
#     (e.g. 'https://arbiscan.io/address/' + addr), not links a reader clicks.
#   - bare origins with no path: preconnect/dns-prefetch hints, which 404 on a
#     plain GET by design (https://fonts.googleapis.com) while working fine as
#     resource hints. The real stylesheet url alongside them IS checked.
#   - 403 / 429 : bot protection (sec.gov, solscan, tronscan, yahoo). These
#     work in a browser. They are reported as UNVERIFIED, never as broken —
#     a check that cries wolf gets ignored, which is how the 404s survived.
#
# Not wired into sync_and_push.sh on purpose: it makes external network requests
# and would be noisy and rate-limit-prone hourly. Run before shipping renderer
# copy that adds or changes a link.
#
# Usage: ./check_links.sh          (exit 1 only if a complete link is dead)
set -uo pipefail
cd "$(dirname "$0")"

# THREE surfaces carry reader-facing links, and each one has hidden a dead link
# that the other two would not have caught:
#   js/, index.html   — renderer copy
#   data/assets.json  — repo-owned; the header "Full report" link. Both
#                       private-repo links lived here, invisible to a renderer grep.
#   data/*.json       — PegTracker-synced backing feeds carry issuer.report_url,
#                       rendered by common.js:751 as the "Report →" chip. Five
#                       "-retail" slugs were 404 here while assets.json held the
#                       correct ones for the same assets.
# Scan all three. A link surface that is not scanned is a link surface that rots.
# From the feeds, take only READER-FACING urls — keys ending in _url (report_url,
# filing_url, ...). Backing feeds also carry analyzer plumbing (rpc endpoints,
# *_api_base under data_sources) that no reader ever clicks; those are bases, not
# links, and failing on them would be the cry-wolf noise this check exists to avoid.
URLS=$( { grep -rhoE 'https?://[^"'"'"' )]+' js/ index.html;
          python3 - <<'PY'
import json, glob
out = set()
def walk(o, key=''):
    if isinstance(o, dict):
        for k, v in o.items():
            walk(v, k)
    elif isinstance(o, list):
        for i in o:
            walk(i, key)
    elif isinstance(o, str) and o.startswith('http') and key.endswith('_url'):
        out.add(o)
for f in glob.glob('data/*.json'):
    try:
        walk(json.load(open(f)))
    except Exception:
        pass
print('\n'.join(sorted(out)))
PY
        } | sed 's/[.,]$//' | sort -u)

DEAD=0; TOTAL=0; UNVERIFIED=0; SKIPPED=0
DEAD_LIST=""; UNVER_LIST=""

while IFS= read -r url; do
    [ -z "$url" ] && continue
    case "$url" in
        */|*=|*\?|*\&|*:) SKIPPED=$((SKIPPED + 1)); continue ;;
    esac
    # Bare origin (scheme://host with no path) — a resource hint, not a link.
    if ! printf '%s' "$url" | sed -E 's#^https?://[^/]+##' | grep -q .; then
        SKIPPED=$((SKIPPED + 1)); continue
    fi
    TOTAL=$((TOTAL + 1))
    CODE=$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 20 \
           -A 'Mozilla/5.0 (link-check)' "$url" 2>/dev/null)
    case "$CODE" in
        2*|3*) ;;
        404|410)
            DEAD=$((DEAD + 1))
            DEAD_LIST="${DEAD_LIST}  HTTP ${CODE}  ${url}"$'\n' ;;
        *)
            UNVERIFIED=$((UNVERIFIED + 1))
            UNVER_LIST="${UNVER_LIST}  HTTP ${CODE}  ${url}"$'\n' ;;
    esac
done <<< "$URLS"

[ -n "$UNVER_LIST" ] && { echo "UNVERIFIED (bot-protected or transient — check by hand if newly added):"; printf '%s' "$UNVER_LIST"; }

if [ "$DEAD" -gt 0 ]; then
    echo "DEAD LINKS:"; printf '%s' "$DEAD_LIST"
    echo "FAIL: $DEAD of $TOTAL complete links return 404/410 to a public reader."
    exit 1
fi
echo "OK: $TOTAL complete links resolve ($UNVERIFIED unverified, $SKIPPED concatenation bases skipped)."
