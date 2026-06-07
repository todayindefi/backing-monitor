#!/bin/bash
cd /home/danger/backing-monitor

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
# BMNR: PegTracker emits *_treasury.json; dashboard app.js convention is *_backing.json
cp /home/danger/PegTracker/data/bmnr_treasury.json data/bmnr_backing.json 2>/dev/null
cp /home/danger/PegTracker/data/bmnr_treasury_history.json data/bmnr_backing_history.json 2>/dev/null

# Integrate any remote changes first (e.g. dashboard claude's commits) so our
# data-only push fast-forwards. Without this, a non-fast-forward push is
# rejected, the cron silently strands data commits, and dashboards go stale.
git fetch origin main 2>&1
if ! git rebase origin/main 2>&1; then
    echo "$(date): ERROR rebase onto origin/main failed (conflict) — aborting, manual fix needed" >&2
    git rebase --abort 2>/dev/null
    exit 1
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
