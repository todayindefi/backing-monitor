#!/bin/bash
cd /home/danger/backing-monitor

# Sync backing data from PegTracker
cp /home/danger/PegTracker/data/ousd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/ousd_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/frax_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/frax_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/crvusd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/crvusd_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/usdd_backing_history.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/thusd_backing.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/thusd_critical_events.json data/ 2>/dev/null
cp /home/danger/PegTracker/data/thusd_flow.json data/ 2>/dev/null

# Commit and push if changed
git add data/
if ! git diff --cached --quiet; then
    git commit -m "Update backing $(date +'%Y-%m-%d %H:%M')"
    git push
    echo "$(date): Pushed updated backing data"
else
    echo "$(date): No changes to push"
fi
