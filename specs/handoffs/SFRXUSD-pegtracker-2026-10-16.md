---
from: backing-monitor
to: PegTracker
date: 2026-10-16
status: ready-for-manual-delivery
---

# sfrxUSD — prices, strategy backing, dollar exit ladder and primary-route probe

Read `/home/danger/backing-monitor/specs/sfrxusd-dashboard-plan.md` and
`/home/danger/backing-monitor/specs/sfrxusd-feed-contract.md` before implementing.
Baseline: `/home/danger/riskAnalyst/assets/sfrxusd.md`, revised October 15, and
its saved `data/reviews/sfrxusd-2026-10-15/` evidence/derivation. The published
report is `tidresearch/src/content/reports/sfrxusd.md`. The old August report
and old configuration prose contain superseded mechanism claims.

Build canonical `sfrxusd_backing.json`, backing/peg histories and
`sfrxusd_exit_ladder.json` in PegTracker. A tracker configuration already exists
in `asset_config_usd.json`; inspect usable observations/history before claiming
all prices are new work. Ethereum is
`0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6`. Recheck live identity and code.

Requested measurement:

1. Market USD/share versus administered frxUSD/share PPS, converted with an
   independently timestamped frxUSD/USD mark or an explicitly declared $1
   convention. Fix the local-redemption description in the config. Emit the
   shared `peg` block and historical coverage; no fabricated history.
2. Frax sfrxUSD balance-sheet API and same-block strategy reads: net liability
   offsets, external owned assets, 100%-scale issuer coverage, surplus and row
   reconciliation; Aave V4, Fraxlend, Gearbox and Curve/Convex positions; direct
   cash versus claims; LP look-through, scrvUSD conversion and discrepancies.
   Keep incomplete independent global coverage null with its own reason.
3. Live Ethereum exit ladder ending in **USDC**, generic share-unit
   `input_amount`, explicit NAV notional, reference token marks, all-in and
   incremental costs, successes/failures and threshold bracket. The existing
   adapter assumes `output_usdc`; do not relabel USDT/frxUSD as USDC. Preserve
   the research USDT route/frxUSD intermediate as separately labeled diagnostics
   where supported. Return a schema amendment if USDC routing is unavailable.
4. **Please accept primary redemption measurement ownership for sfrxUSD, or
   return the concrete blocker.** Probe disabled Ethereum entrypoints and the
   documented Hop/Fraxtal path read-only. Read mint/redeemer cash/share bound,
   fee/configuration, price feed, parameter lastSync and timestamp behavior.
   Distinguish destination inventory from confirmed cross-chain capacity and
   an independent valuation. No trades, approvals or bridge transfers.

Proposed cadence is hourly base/reference/probe and three-hourly quotes; confirm
actual supported cadence and stale-input handling. Return exact candidate paths,
schema amendments, commit, validation/reconciliation results, scheduling plan,
primary-route ownership acceptance and unresolved observations. Keep candidates
under `data/dashboard_pending/sfrxusd/` or your approved nonpublishing location
until reviewed. Do not activate publishing or register the dashboard. Do not edit
other producer repositories or dispatch other agents. This handoff is for user
delivery; backing-monitor has sent no message or launcher invocation.
