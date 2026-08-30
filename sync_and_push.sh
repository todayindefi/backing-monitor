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
# ============================================================================
# ⚠️ WAS 76 HAND-TYPED cp LINES. A new analyzer output silently never reached the
# dashboard until someone appended a line — the symptom is always "the data is in
# PegTracker and nothing is on the page." It blocked Ethena until 4975b236, and
# cUSD's peg history broke today when its source was retired upstream and the
# line stayed behind.
#
# ⚠️ A bare glob is the WRONG fix: PegTracker's data dir holds 39 files matching
# registered slugs that must NOT be published — `_last_good` snapshots and
# `_oft_audit` diagnostics. So this enumerates BLOCK TYPES (short, stable, and
# the thing a new producer actually adds) crossed with REGISTERED SLUGS (read
# from assets.json, so registering an asset wires its whole file set at once).
#
# Adding an axis producer is now one word in SUFFIXES, not N lines.
# ============================================================================
SUFFIXES="_backing _backing_history _peg_history _critical_events _flow \
          _nav_history _coverage_history _reserve_known_destinations _family \
          _treasury _treasury_history _backing_last_attempt \
          _liquidity _contract _dependencies _issuer _backing_overlay"

SLUGS=$(python3 -c "import json;print(' '.join(a['slug'].replace('-','_') for a in json.load(open('data/assets.json'))))")

# ⚠️ ONE SOURCE ROOT WAS THE OTHER HALF OF THE SAME BUG. Declaring `_liquidity`,
# `_contract` and `_dependencies` in SUFFIXES made the sync READY for a new axis
# producer only in the sense that the NAME was expected — the loop still looked
# in PegTracker's data dir and nowhere else, while every other producer writes in
# its own repo. So "a new producer's file copies with no change here" was true of
# the suffix and false of the path.
#
# It bit immediately and silently: DexTracker shipped data/liquidity/syzusd_liquidity.json
# at 12:03 with a commit message asserting "backinmonitor's sync already lists
# {slug}_liquidity.json as a block type, so this copies without a change there."
# It does not. Wrong repo, and a subdirectory besides. The file reached nothing
# for hours and the assertion was never run. ⚠️ A claim about another repo's
# behaviour is the least-verified line in any commit message.
#
# Roots are searched in order and a later one WINS, so a collision is reported
# rather than resolved silently — two producers claiming one block is a pipeline
# question, not something a cp should decide at 3am.
SOURCE_ROOTS="/home/danger/PegTracker/data \
              /home/danger/DexTracker/data/liquidity \
              /home/danger/riskAnalyst/data/axes"

for slug in $SLUGS; do
    for suf in $SUFFIXES; do
        found=""
        for root in $SOURCE_ROOTS; do
            src="$root/${slug}${suf}.json"
            [ -f "$src" ] || continue
            if [ -n "$found" ]; then
                echo "$(date): SYNC_COLLISION ${slug}${suf}.json in both $found and $root — using $root" >&2
            fi
            cp "$src" data/
            found="$root"
        done
    done
done

# Files whose names are not <registered-slug><suffix> — family rollups shared by
# several assets, and the Strategy event log. These stay explicit because there
# is no slug to derive them from.
for f in apyx_family.json cap_family.json ethena_family.json frax_backing.json frax_backing_history.json saturn_family.json strategy_events.json syrup_family.json; do
    [ -f "/home/danger/PegTracker/data/$f" ] && cp "/home/danger/PegTracker/data/$f" data/
done

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
