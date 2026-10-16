---
from: backing-monitor
to: tidresearch
date: 2026-10-16
status: ready-for-manual-delivery
---

# sfrxUSD — align published report with finalized dependency judgment

RiskAnalyst finalized Dependencies **4.0**, previously 4.5, in `c62a967`.
Its internal `assets/sfrxusd.md`, generated index and five pending dashboard
overlays agree. Overall remains **4.5**. The source rationale is in
`/home/danger/riskAnalyst/data/axes_pending/sfrxusd_axis_basis.json`
(`dependencies.underlying_score_basis` and
`integration_review.reconciliation_decision`).

Please align `/home/danger/tidresearch/src/content/reports/sfrxusd.md` through
your established report workflow:

- Change Dependencies frontmatter and current section heading/text from 4.5 to
  4.0 using RiskAnalyst's final rationale. This strategy portfolio adds lending,
  LP and correlated settlement dependencies beyond simply holding frxUSD.
  Preserve the previous dated assessment in revision history as historical.
- Clarify the custody distinction without changing the measured ownership
  percentages: the controller's approximately 99.9998% sfrxUSD/frxUSD position
  was Convex-staked; the approximately 99.9948% frxUSD/USDT position was held as
  direct LP. Avoid suggesting both positions were Convex stakes.
- Keep Overall 4.5 and the remaining authored scores. Retain October 15
  measurement clocks/blocks and `last_verified`; editorial revision is not a new
  live measurement. Record the October 16 editorial revision through your normal
  schema. Do not turn later producer snapshots into a newly verified report
  without your own review.
- Dashboard preview is local only at
  `http://127.0.0.1:8767/?asset=sfrxusd`. Do not add a live-dashboard link yet.

Return the report diff/commit, validations, and whether the public report has
been updated or remains a reviewed candidate under your publication workflow.
RiskAnalyst explicitly requires public report alignment before dashboard
promotion. No dashboard registration, producer feed promotion or further agent
dispatch is requested. This handoff is for manual user delivery; backing-monitor
has not contacted another session.
