---
from: backing-monitor
to: PegTracker
status: backing-collector-implemented-staged-in-session; remaining brief not dispatched
date: 2026-10-30
---

# GHO canonical measurement feeds

October 30 update: the user asked to work through remaining feeds one by one.
This session implemented and tested `PegTracker/gho_backing_analyzer.py` directly,
with filesystem installation approval. Staged outputs are in
`PegTracker/data/dashboard_pending/gho-backing/`; the collector runbook is
`PegTracker/docs/gho-backing-staged-2026-10-30.md`. This is a direct session
implementation, not a dispatched worker or an independent producer handback.
Issuance, three lending-reserve claims and Ethereum GSM wrapper inventory are
block-pinned; independent collateral coverage remains unresolved. Peg-history
export, oracle clock repair, full ladder, execution probes and recurrence below
remain outstanding. No public serving feed, registry or cron was changed.

User requested a refreshed GHO six-axis dashboard. Read
`specs/gho-dashboard-plan.md`, the current six-axis dashboard standard and the
producer's current peg/ladder contracts. This brief records required work;
no producer acceptance, dispatch or completion is claimed.

Provide staged canonical `gho_backing.json`, peg/backing histories and
`gho_exit_ladder.json`. Reuse the existing GHO row/history; resolve actual
oracle update age rather than substituting row write time. The row's
`contract_address` identifies an oracle, not the GHO token. Preserve chart gaps
and reject or explicitly qualify timezone-ambiguous history.

Enumerate live facilitator addresses/caps/levels at a pinned block, reconcile
origin supply and bridge custody, and trace actual collateral/debt backing.
Keep issuance allocation, float and independently realizable collateral
separate. Publish null coverage with a reason if it cannot be established.
Do not copy TokenLogic's 1.537647 ratio without establishing its numerator,
denominator and attribution.

Proposed primary execution ownership: accept or qualify registry-discovered
Ethereum RemoteGSM inventory, wrapper conversion, fees, status and read-only
holder probes. Current diagnostics found modules `0x3A3868898305f04beC7FEa77BecFf04C13444112`
and `0x882285E62656b9623AF136Ce3078c6BdCc33F5E3`, unlike the report's
legacy seized pair. Re-resolve identities; remote chains remain separate.
Execution observations and riskAnalyst eligibility answer different questions.

Preserve USD market-sized rung semantics, token amounts, all-in reference,
own-spot impact and current crossing/status/floor/bracket conventions. No TVL
substitution or inferred maximum from the largest quoted rung. Return staged
files, a source manifest, command/runbook, failure behavior, history retention
and proposed cadence. Keep candidates outside automatic publication roots.
