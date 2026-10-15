---
from: backing-monitor
to: riskAnalyst
date: 2026-10-14
status: ready-for-manual-delivery
---

# DOLA — Axes 4/6, Axis 2 qualification and Axis 5 code/score

Read `backing-monitor/specs/dola-dashboard-plan.md` and `specs/dola-feed-contract.md` before implementation. Canonical research is `/home/danger/riskAnalyst/assets/dola.md` and six linked October 14 evidence JSON files. Ethereum DOLA is `0x865377367054516e17014ccded1e7d814edc9ce4`; sDOLA and jrDOLA are separate assets.

Use existing repository schemas and validation. Preserve independent clocks, block/source provenance, null versus zero, last-good snapshots and explicit partial/failure states. Historical research is a reproduction reference, not a fresh feed. Do not change other producers' files, dispatch other agents, register DOLA or promote/publish its report through this handoff. Keep unapproved artifacts outside automatic sync roots; return the implementation commit, exact output paths, cadence, validation results and unresolved work. These handoffs are for manual delivery by the user; no dispatch has occurred.

# Requested work

Refresh `data/axes/dola_dependencies.json`: current envelope October 1 uses July 1 collateral evidence. Model October 14 LP/strategy dependencies, retain backing versus venue edges and unresolved coverage, avoid representing internal DOLA claims as independent reserves. Rebuild downstream edges through the existing graph generator.

Prepare `dola_backing_overlay.json`, `dola_contract_overlay.json`, `dola_issuer.json` and eligible `dola_axis_basis.json` using existing schemas. Carry provisional assessment status and explain unresolved net economic coverage. Code/audit assessment is yours; authority observations belong to security_analyst and remain separate. The six research scores are not automatically dashboard bands; do not override measured scoring or score dependencies contrary to fleet policy. Distinguish deprecated-product exploits from FiRM code, treasury promises from funded recourse, and governance delay from immediate Fed/oracle controls.

Review PegTracker's proposed DOLA PSM assignment and accounting/display contracts. Confirm activation and capital protection using current evidence, not a frozen October 19 statement. Report remains staged; keep unapproved overlays in `data/axes_pending/` until publication is authorized.
