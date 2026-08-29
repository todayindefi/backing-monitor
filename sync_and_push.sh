#!/bin/bash
cd /home/danger/backing-monitor

# Guard: GitHub Pages deploys ONLY from `main`. If the working tree is ever left
# on another branch (e.g. a feature branch after its PR is merged), the hourly
# data commits land where Pages never sees them and every dashboard silently
# freezes — this stranded all dashboards for ~48h starting 2026-06-15 when the
# tree was left on the merged feat/syrup-loan-health branch. Refuse loudly
# rather than push fresh data to a non-deploy branch. The dashboard_freshness
# daily digest is the backstop that surfaces it if this ever trips.
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
    echo "$(date): ERROR working tree on '$BRANCH', not 'main' — refusing to commit backing data (Pages deploys from main only). Fix: cd /home/danger/backing-monitor && git checkout main" >&2
    exit 1
fi

# Sync backing data from PegTracker
cp /home/danger/PegTracker/data/ousd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/ousd_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/frax_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/frax_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/crvusd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/crvusd_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usg_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usg_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdd_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/thusd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/thusd_critical_events.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/thusd_flow.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/thusd_nav_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/thusd_coverage_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/thusd_reserve_known_destinations.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/syrupusdc_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/syrupusdc_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/syrupusdt_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/syrupusdt_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/syrup_family.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/apxusd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/apxusd_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/apyusd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/apyusd_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/apyx_family.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/strc_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/strc_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/strategy_events.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdat_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdat_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/susdat_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/susdat_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/saturn_family.json data/ 2>/dev/null

# Per-asset peg history exports (peg_history_export.py). These back peg.history_ref.
# Only the slugs this dashboard serves are copied — the allowlist is deliberate,
# not a glob. thbill's export is a bare list rather than the {points,entries,...}
# envelope and no asset here consumes it, so it is left out.
cp /home/danger/PegTracker/data/apxusd_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/apyusd_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/crvusd_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/ousd_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/susdai_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/susdat_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/susde_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/syrupusdc_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/syrupusdt_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdai_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdat_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usde_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usds_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdm_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdm_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usde_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usde_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/susde_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/susde_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/ethena_family.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdai_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdai_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/susdai_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/susdai_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdai_family.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usds_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usds_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/susds_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/susds_backing_history.json data/ 2>/dev/null
# BMNR: PegTracker emits *_treasury.json; dashboard app.js convention is *_backing.json
cp /home/danger/PegTracker/data/bmnr_treasury.json data/bmnr_backing.json 2>/dev/null
cp /home/danger/PegTracker/data/bmnr_treasury_history.json data/bmnr_backing_history.json 2>/dev/null
# Cap (cUSD): common per-asset schema in cusd_backing.json (drives common summary/
# risk/coverage-chart) + rich shared cap_family.json (peg quotes, operator book,
# restaker coverage) consumed by js/renderers/cap.js — mirrors the ethena split.
cp /home/danger/PegTracker/data/cusd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/cusd_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/cap_family.json data/ 2>/dev/null
# Hastra PRIME / wYLDS: independent multi-source reserve monitor. The dashboard
# snapshot is only ever overwritten by a run where EVERY leg (Provenance
# balances + Solana + Ethereum supply) succeeded, so on failure it freezes at
# last-good rather than publishing a ratio with a hole in it. The last_attempt
# slot carries the failed run — hastra-prime.js reads it purely to name the
# failing leg in the staleness badge, so its absence is harmless.
cp /home/danger/PegTracker/data/hastra_prime_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/hastra_prime_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/hastra_prime_backing_last_attempt.json data/ 2>/dev/null

# Yuzu (yzUSD / syzUSD): registered 2026-08-29. Both feeds carry the full 5-axis
# schema, so the generic renderer serves them — no bespoke renderer, same path
# usds/susds take. yzusd_backing_history.json exists; syzUSD has no history file
# of its own, which is why there is no cp line for one.
cp /home/danger/PegTracker/data/yzusd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/syzusd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/yzusd_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/yzusd_peg_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/syzusd_peg_history.json data/ 2>/dev/null

# Integrate any remote changes first (e.g. dashboard claude's commits) so our
# data-only push fast-forwards. Without this, a non-fast-forward push is
# rejected, the cron silently strands data commits, and dashboards go stale.
# --autostash is REQUIRED: by this point the cp's above have left data/ dirty,
# and plain `git rebase` refuses on a dirty tree ("cannot rebase: You have
# unstaged changes") whenever origin has actually moved — which stranded ~28h
# of data updates on 2026-06-08. --autostash stashes the dirty data, replays,
# and pops it back.
git fetch origin main 2>&1
if ! git rebase --autostash origin/main 2>&1; then
    echo "$(date): ERROR rebase onto origin/main failed (conflict) — aborting, manual fix needed" >&2
    git rebase --abort 2>/dev/null
    exit 1
fi

# Frontend changes are easy to leave unpublished: local JS/index.html edits can
# pass verification while Pages still serves the previous commit. Surface them
# at every sync so the operator can publish them deliberately; do not commit
# or discard them here.
DIRTY_FRONTEND=$(git status --porcelain -- js/ index.html)
if [ -n "$DIRTY_FRONTEND" ]; then
    FRONTEND_WARNING="$(date): WARNING frontend files are dirty at sync time (js/ or index.html) — publish intentionally; sync will not auto-commit them:"
    echo "$FRONTEND_WARNING" >&2
    echo "$FRONTEND_WARNING" >> sync.log
    echo "$DIRTY_FRONTEND" >&2
    echo "$DIRTY_FRONTEND" >> sync.log
fi

# A committed renderer can still be invisible to returning browsers when its
# script URL token in index.html predates the renderer. Compare the token's
# date with the renderer's latest commit date and surface stale tokens; this
# is advisory so sync never rewrites cache-bust tokens or commits frontend
# work automatically.
TOKEN_WARNINGS=""
for RENDERER in js/renderers/*.js; do
    RENDERER_NAME=$(basename "$RENDERER")
    TOKEN=$(sed -n "s#.*js/renderers/$RENDERER_NAME?v=\([^\"']*\).*#\1#p" index.html | head -1)
    if [ -z "$TOKEN" ]; then
        continue
    fi
    TOKEN_DATE=${TOKEN%%[!0-9]*}
    COMMIT_DATE=$(git log -1 --format='%cs' -- "$RENDERER")
    TOKEN_ISO=${TOKEN_DATE:0:4}-${TOKEN_DATE:4:2}-${TOKEN_DATE:6:2}
    if [ -n "$COMMIT_DATE" ] && [ "$COMMIT_DATE" \> "$TOKEN_ISO" ]; then
        TOKEN_WARNINGS="${TOKEN_WARNINGS}$(printf '%s\n' "js/renderers/$RENDERER_NAME: latest commit $COMMIT_DATE is newer than cache token $TOKEN")"
    fi
done
if [ -n "$TOKEN_WARNINGS" ]; then
    TOKEN_WARNING_HEADER="$(date): WARNING renderer cache tokens are stale (index.html may serve cached code):"
    echo "$TOKEN_WARNING_HEADER" >&2
    echo "$TOKEN_WARNING_HEADER" >> sync.log
    printf '%s' "$TOKEN_WARNINGS" >&2
    printf '%s' "$TOKEN_WARNINGS" >> sync.log
fi

# Commit and push if changed
git add data/
if ! git diff --cached --quiet; then
    git commit -m "Update backing $(date +'%Y-%m-%d %H:%M')"
    if git push; then
        echo "$(date): Pushed updated backing data"
    else
        echo "$(date): ERROR git push failed — backing data NOT published" >&2
        exit 1
    fi
else
    echo "$(date): No changes to push"
fi

# ⚠️ Run the conformance suite ON THE SYNC, because the sync is when feed SHAPE
# changes. check_feeds.py has twelve checks, each proven by seeding a failure,
# and until now it ran when I remembered to run it — which caught the cUSD
# peg-history source vanishing only because that happened mid-task.
#
# security_analyst named the shape: "a guard nobody runs is not a guard." Their
# join hard-errors correctly on a malformed observation file and stayed broken
# for two days because nothing ran it, while three batches were filed in the
# window reasoning from hand-assembled lists.
#
# ⚠️ It REPORTS, it does not block. The data is already committed and pushed
# above by design: a shape regression must not withhold fresh figures, and a
# suite that can stop publication is a suite someone eventually disables.
if [ -f check_feeds.py ]; then
    CHECK_OUT="$(python3 check_feeds.py 2>&1)"
    echo "$CHECK_OUT" | tail -1
    if echo "$CHECK_OUT" | grep -qE '^[1-9][0-9]* failures'; then
        # Distinct marker so a scan of the log finds it without reading every run.
        echo "$(date): FEED_CHECK_FAILURE" >&2
        echo "$CHECK_OUT" | grep -E '^\s+FAIL' >&2
    fi
fi
