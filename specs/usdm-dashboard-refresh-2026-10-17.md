# USDM dashboard refresh — 2026-10-17

User authorized correction and production publication. Canonical assessment:
`/home/danger/riskAnalyst/assets/usdm.md`; evidence and correction handoff:
`/home/danger/riskAnalyst/specs/handoffs/usdm-reader-and-exit-corrections-2026-10-17.md`.

PegTracker remains primary backing producer. Its Ethereum sweep now includes
EUROP (six decimals, Chainlink EUR/USD) and native ETH via `eth_getBalance`,
separately from stETH. All eight assets must clear before publishing a measured
Ethereum total. Current stable-only coverage is 98.23%; gross coverage is 114.55%.
These fresh, mixed-time observations need not exactly match the report's pinned
98.23% / 114.60%. Issuer full collateral scope remains separately labelled.
Monad ReserveV2 excludes protocol-owned LP collateral and smaller operational
balances; its full-supply ratio and ex-POL ratio are not legal recovery estimates.

TradingLimitsV2 config is decoded at 15 internal decimals: Monad ceilings are
2.5M / 5M USDm. Neither remaining two-sided signed netflow headroom nor actual
at-size execution is established. DexTracker's Celo USDC custody is an inventory
bound, not slippage depth or guaranteed executable capacity. Bridge/CDP status
is unknown; separate chain measurements do not establish bridge impossibility.
The 4-of-6 admin observation is dated October 17. September authority walk dates
remain intact; the entire authority surface was not re-walked.

Old history is retained, explicitly marked as incomplete sweep scope in the
producer's export, and excluded from the coverage chart. No historical balance
restatement or trigger inference is claimed. Custodian allocation is not
reconciled for the narrower measured scope; the allocation table and pie instead
use reserve buckets that sum to the measured total.

Bespoke panels now slot inside the six axes. Dependencies are unscored and carry
metric/source attribution. Today’s issuer assessment supersedes the older
issuer-score stale alert; measured risk flags remain. Added the public report
link, current Monad explorer, and scroll containers for wide tables.

Source fixes are saved in PegTracker and RiskAnalyst. DexTracker's persistent
USDM envelope has corrected bridge and execution wording; its scheduled refresh
updates the capacity block in place. Source overlays were copied to dashboard
serving files; the existing hourly sync continues to consume those source paths.

Validation: 53 USDM producer tests, USDM consumer checks, existing DOLA/sfrxUSD/
USDat consumer checks, syntax/diff checks, and Chromium desktop/mobile rendering.
All six axes are visible, bespoke panels have axis parents, and the 390px mobile
viewport has no horizontal page overflow.
