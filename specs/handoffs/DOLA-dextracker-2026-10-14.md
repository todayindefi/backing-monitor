---
from: backing-monitor
to: DexTracker
date: 2026-10-14
status: ready-for-manual-delivery
---

# DOLA — Axis 3 venue inventory

Read `backing-monitor/specs/dola-dashboard-plan.md` and `specs/dola-feed-contract.md` before implementation. Canonical research is `/home/danger/riskAnalyst/assets/dola.md` and six linked October 14 evidence JSON files. Ethereum DOLA is `0x865377367054516e17014ccded1e7d814edc9ce4`; sDOLA and jrDOLA are separate assets.

Use existing repository schemas and validation. Preserve independent clocks, block/source provenance, null versus zero, last-good snapshots and explicit partial/failure states. Historical research is a reproduction reference, not a fresh feed. Do not change other producers' files, dispatch other agents, register DOLA or promote/publish its report through this handoff. Keep unapproved artifacts outside automatic sync roots; return the implementation commit, exact output paths, cadence, validation results and unresolved work. These handoffs are for manual delivery by the user; no dispatch has occurred.

# Requested work

Implement `data/liquidity/dola_liquidity.json` under `liquidity/1`. Enumerate Ethereum venues by canonical token address, verify size/custody where possible and publish exclusions, incomplete enumeration and individual clocks. Record DOLA-containing collateral/exit pool overlap without describing market debt shares as reserve weights.

Phase-one dashboard is canonical Ethereum. Remote venues can be recorded with explicit outside-scope labels; report unqueried/truncated chains and local-dollar-exit gaps. Do not overwrite PegTracker executable depth/ladder or publish a conflicting PSM primary_exit block. Confirm the disjoint-field merge with PegTracker when integrating. Proposed venue enumeration cadence is daily subject to provider budget; declare actual cadence. Test implausible, excluded, not_checked and absent venue states.
