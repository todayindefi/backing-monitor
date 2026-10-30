---
from: backing-monitor
to: PegTracker; DexTracker
status: implemented-and-GHO-probed-in-session; fleet-integration-pending; not-dispatched
date: 2026-10-30
---

# Adaptive 50 bps exit ladder

User authorized the generic spec update, implementation and handoffs. See the
new adaptive ladder subsection in `specs/six-axis-dashboard-spec.md`.

PegTracker candidate: `adaptive_exit_ladder.py` (source mirrored at
backing-monitor `tools/adaptive_exit_ladder.py`). Pure algorithm plus a standalone
USD/KyberSwap runner. Five normal requests, six if needed, seven hard maximum.
No retries or provider fallback in this runner; failures count. Reference $1k,
initial $100k, ×10 expansion, $50m configurable cap, geometric midpoint
refinement. Fresh same-identity bracket may seed sizes, never reuse evidence.
Budget/cap exhaustion yields bracket or floor, not fabricated exact 50bps depth.
Seven requests are an upper bound, not a guarantee of a quote within 5bps.

GHO staging was executed this session. Outputs and source clocks are retained
in `data/dashboard_pending/gho-adaptive-50bps/gho_exit_ladder.json`. The run
located $22,360,680 (20.7321bps) to $33,437,015 (974.3896bps), with seven calls.
The route becomes very costly at the upper size. This is a broad bracket, not
an exact crossing. Do not run another immediate batch merely to evade the
per-refresh budget; the next scheduled refresh can requote around this bracket.
Primary redemption and eligibility remain unmeasured.

PegTracker remaining adoption:
- Integrate the generic policy into the normal quote/cache/export path behind
  an explicit per-asset policy version. GHO first; preserve identity checks.
- Preserve the <=7 OUTBOUND request budget across retries, fallback providers,
  direct pool search and any bisection, rather than applying seven per provider.
- USD runner is implemented; ETH/WETH needs a fresh USD conversion and explicit
  sizing clock before enabling. Configure bounds for thin markets.
- Emit depth_50bps, all attempted rows/errors/clocks, measured lower/upper
  endpoints, actual bps, policy/version/budget/stop, all-in outputs and basis.
- Keep existing two_pct_depth history separate; do not relabel 2% data as 50bps.
- Check old cache policy version before reuse. Deploy/migrate deliberately;
  this standalone candidate does not change fleet cron or serving feeds.

DexTracker remaining alignment:
- Reuse this request-budget and shape contract for its crossing work. Its
  current broader grid plus bisection is not seven-call compliant by assumption.
- Preserve venue inventory, exclusions and route attribution. A fresh sharper
  crossing can replace the bracket only under the existing freshness rule.
- Do not spend a second ladder budget as an undisclosed retry within one refresh.

No external owner message has been sent. This is a repository handoff, not an
owner acceptance or a claim of fleet deployment. GHO independent backing v2
remains deferred and is unrelated to this liquidity change.
