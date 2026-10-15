---
from: backing-monitor
to: PegTracker
date: 2026-10-15
status: ready-for-manual-delivery
publication: review-only
---

# Apply riskAnalyst's DOLA reconciliation review

The methodology review has returned. Please implement the required corrections
and return a revised review artifact; keep the live `collateral_ratio` null and
do not publish the submitted 2.776M model gap or convention ratios as verified
coverage, deficit or holder recovery.

Read the complete decisions and acceptance requirements:

- `/home/danger/riskAnalyst/specs/handoffs/DOLA-backing-reconciliation-riskanalyst-review-return-2026-10-14.md`
- `/home/danger/riskAnalyst/specs/dola-backing-reconciliation-review-contract.md`
- `/home/danger/riskAnalyst/data/research/dola-backing-methodology-review-2026-10-14.json`
- `/home/danger/riskAnalyst/data/research/dola-backing-component-decisions-2026-10-14.json`
- `/home/danger/riskAnalyst/tests/test_dola_backing_methodology_review.py`

The review accepts collection shape and selected arithmetic, but finds substantive
failure-handling, denominator and recovery limitations. Its counterexamples should
be reproduced and converted into meaningful producer regression tests.

## Required corrections

1. Refuse or mark partial unknown debt: the current `any(p['_debt'] for p in unread)`
   accepts `None` as falsy and can still emit numeric scenarios. Preserve missing
   critical inputs explicitly and never substitute zero or silent API fallback.
2. Validate independent market/borrower discovery and completeness; deduplicate
   addresses/pairs and include markets outside cached API-positive discovery.
3. Archive raw units, decimals, conversions, zero-debt collateral rows, RPC evidence
   and block hash. Key pools by address and retain enough input data for replay.
4. Separate inventory balances from ownership and liability-exclusion policies.
   Resolve or qualify treasury/Frontier supplier claims, the 79,532-DOLA residual
   and issuer circulation differences; do not credit unexplained debt excess as reserves.
5. Align formula documentation and implementation; distinguish par-equivalent
   assumptions from market DOLA recovery. Account for or explicitly withhold
   liquidation fee/close-factor/trigger/oracle and wrapper-withdrawal dependencies.
6. Correct junior execution guards, capital depletion and repayment transitions.
   Do not describe generic shortfall allocation as executable protection or a token burn.
7. Trace or quarantine ultimate reUSD/internal claims, stale/unpriced assets and
   issuer-correlated collateral. Keep composition sensitivity separate from AMM simulation.
8. Keep asynchronous bridge comparisons partial; missing correspondence is not
   evidence of unbacked or additional independent liabilities.

The full review is authoritative for detail. Where archive access or ownership
evidence is unavailable, return a precise unresolved state rather than an assumed
result. Do not make closure residual or convention invariance a completeness badge.

## Return and integration boundary

Return corrected code/tests, archived source evidence and a dated methodology
handoff listing resolved versus unresolved review points. Identify which component
observations are ready for adoption and which scenario outputs remain withheld.
The proposed `dola-reconciliation/1` object needs producer-consumer agreement before
entering the canonical feed; do not silently adopt or modify other repositories.

Keep artifacts outside automatic sync roots pending review/publication approval.
Daily collection is proposed only after corrections and schema adoption; no cron,
asset registration, promotion, agent dispatch or publication is requested here.
The user will deliver this handoff manually. Nothing has been dispatched.
