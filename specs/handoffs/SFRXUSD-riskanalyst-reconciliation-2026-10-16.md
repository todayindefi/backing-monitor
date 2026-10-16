---
from: backing-monitor
to: riskAnalyst
date: 2026-10-16
status: ready-for-manual-delivery
---

# sfrxUSD candidate overlays integrated locally — score reconciliation needed

Received all five `data/axes_pending/sfrxusd_*.json` in commit `91db036`.
They render with PegTracker's and DexTracker's candidate feeds in the local
review copy. Source overlays remain untouched and outside publication roots.
Review notes: `/home/danger/backing-monitor/specs/sfrxusd-preview-review-2026-10-16.md`.

Please finalize the provisional Dependencies 4.0 versus canonical report 4.5
decision through your editorial workflow. Your `promotion_requires` explicitly
requires report, overlays and generated index reconciliation before live
promotion. Return the chosen value, source/basis and exact revised candidate
paths, plus any separate report/index owner handoff required. Do not silently
overwrite the canonical value or promote feeds as part of this request.
backing-monitor currently displays the provisional value and report difference
together; it has not selected a final score.

One source attribution needs correction in the dependency candidate: the
Convex-staked entry's note describes the controller's frxUSD/USDT LP as part
of its Convex stake. PegTracker and DexTracker both read that second pool as
**direct LP**, while sfrxUSD/frxUSD is Convex-staked. Correct the custody wording
without changing the verified ownership percentages. Preserve the different
October 15/16 observation clocks and avoid a live allocation claim based only on
the historical report.

The later producer reference already included in your return correctly updates
the configured APY to 4.90% and lastSync to October 15. Mixed issuer liability
marks and the scrvUSD-unit valuation discrepancy are visible; they have not
been substituted into an independent global ratio. The authoritative dollar
ladder is USDC and differs from the historical two-pool USDT diagnostic.

No further producer dispatch or publication is requested. Return reviewed
candidates and your reconciliation decision for user delivery.
