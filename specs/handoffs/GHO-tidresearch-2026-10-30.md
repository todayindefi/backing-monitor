---
from: backing-monitor
to: tidresearch
status: draft-not-dispatched
date: 2026-10-30
---

# GHO report reconciliation

The public `/reports/gho/` was browser-verified on October 30. It still
describes the historical seized Ethereum GSMs and an eight-facilitator supply
snapshot. The current read-only tokenAnalyst collector discovers newer
Ethereum RemoteGSMs, including wrapped-USDT inventory. Refer to
`specs/gho-dashboard-plan.md` for the diagnostic values and their limits.

After canonical measurement and riskAnalyst returns, reconcile all dated
updates with the main report body: module identities, holder exit mechanisms,
supply definitions, facilitator composition, authority and remote-chain scope.
Retain historical findings as dated observations rather than silently deleting
them. Do not infer a new risk score from module liveness or token supply.

Return a staged report candidate with current evidence, source clocks and
publication status. This draft has not been sent and does not authorize
publication or imply the existing report has been refreshed.
