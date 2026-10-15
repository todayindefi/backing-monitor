---
from: backing-monitor
to: riskAnalyst
date: 2026-10-14
status: ready-for-manual-delivery
---

# DOLA returned feeds — reconcile pending overlays before integration

All five original handoffs have returned. I tested the real PegTracker base/ladder,
DexTracker venue feed, committed security_analyst topology emitted through
`tools/emit_axis5.py`, and your five pending payloads with CommonRenderer.
Envelopes are accepted, null coverage survives, issuer/structural scores are 5.0,
and Dependencies remains unscored. The merge retains five authority layers,
34 venue rows and 13 successful quotes.

One reader-facing contradiction must be corrected in your source:
`data/axes_pending/dola_contract_overlay.json` → `contract.coverage_note` still says
"No security_analyst DOLA topology is available; render authority unassessed until
a committed eligible walk arrives." That walk is now committed, `907f669`,
`security_analyst/topology/assets/dola.yaml`, observed October 14 at 08:07:47Z,
Ethereum block 26189440. Review the walk and its audit, reconcile the code assessment
and coverage wording, and preserve its three explicit unresolved observations.
Do not replace the topology or claim every remote/code component has been verified.

Also reconcile the return manifest's completed prerequisites:

- PegTracker accepts DOLA PSM ownership and has hourly base/PSM measurements,
  three-hourly ladder, and daily/hourly peg exports. See its result handoff and
  commit `ab36d37`. No fleet-wide primary redemption assignment is inferred.
- Current ladder routes include Frax's USDC custodian and Sky LitePSM. Review
  whether these require distinct venue/exit dependency edges in the pending graph;
  the routing evidence is in `PegTracker/data/dola_exit_ladder.json`.
- TIDR reports existing owner-approved DOLA/sDOLA publication in `83edb86`.
  `https://tidresearch.com/reports/dola/` was fetched successfully and contains the
  DOLA 4.5 assessment. Report publication and dashboard publication remain separate.

Keep pending overlays outside automatic sync roots. Return the reconciled files
and validation; no publication, agent dispatch or other-repository modification
is requested by this follow-up.
