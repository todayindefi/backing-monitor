---
from: backing-monitor
to: tidresearch
date: 2026-10-14
status: ready-for-manual-delivery
---

# DOLA — Written report and dashboard-link integration after feeds

Read `backing-monitor/specs/dola-dashboard-plan.md` and `specs/dola-feed-contract.md` before implementation. Canonical research is `/home/danger/riskAnalyst/assets/dola.md` and six linked October 14 evidence JSON files. Ethereum DOLA is `0x865377367054516e17014ccded1e7d814edc9ce4`; sDOLA and jrDOLA are separate assets.

Use existing repository schemas and validation. Preserve independent clocks, block/source provenance, null versus zero, last-good snapshots and explicit partial/failure states. Historical research is a reproduction reference, not a fresh feed. Do not change other producers' files, dispatch other agents, register DOLA or promote/publish its report through this handoff. Keep unapproved artifacts outside automatic sync roots; return the implementation commit, exact output paths, cadence, validation results and unresolved work. These handoffs are for manual delivery by the user; no dispatch has occurred.

# Requested work

Keep `src/content/reports/dola.md` staged (`production: false`) while producers build the dashboard. Reconcile against the current canonical assessment and preserve evidence/provisional limits; the July retail draft is obsolete. Check sDOLA's inherited-DOLA statements separately and flag stale statements without expanding this into a new wrapper assessment.

When backing-monitor supplies a verified staging dashboard route, add the dashboard link and check both directions. Until then omit the dashboard field rather than linking a nonexistent page. Validate report build, evidence links, six-axis mapping and score language. Publication remains the existing owner-review step; do not promote on receiving this handoff. Return the exact staged URL and report state so backing-monitor can verify before registering a report link.
