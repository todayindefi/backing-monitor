# scrvUSD: comparable swap and redemption ladders

Owner: PegTracker. Consumer: backing-monitor, scrvUSD axis 3. Prepared for the user to send; no external message sent.

The dashboard now separates direct scrvUSD→USDC swaps from scrvUSD→crvUSD redemption followed by a crvUSD→USDC quote. Current swap evidence is only `market_crosscheck`; it is labelled a small corroborative quote, not measured capacity. Existing redeem observations are retained. Please add comparable producer-owned ladders for both routes.

- Quote both routes at identical scrvUSD share inputs, derived from dated dollar NAV for standard USD notionals. Publish actual input shares and input NAV USD, rather than assuming nominal crvUSD units equal dollars. Existing crosscheck `size_usd_nominal=1000` uses roughly 1000 crvUSD of shares, so it must not be represented as exactly $1000 dollar NAV.
- Direct route: quote scrvUSD→USDC across standard sizes, retain provider, route/pools where available, settlement token, output, per-rung clock, failures and gas exclusions. Existing crosscheck alone is not a ladder.
- Redeem route: simulate ERC-4626 redemption for those same shares, then quote the actual crvUSD output to USDC. Retain pinned block/time, owner/sender/receiver, owner balance and maxRedeem, each leg's status and clocks. The existing 1M failure is an insufficient-test-owner-shares result, not vault capacity. Use sufficient owner inventory if available; otherwise leave the primary leg unestablished and label the quote underlying-only.
- Publish dollar NAV and its vault/parent source clocks per observation. All-in cost bps = `(1 - USDC_output / input_NAV_USD) * 10000`, with USDC=$1 assumption explicit. Positive is a cost; negative is a premium. Publish additional size impact separately with its reference and convention. Do not relabel nominal crvUSD-par discount as NAV cost or size impact.
- Reject stale, missing, mismatched or failed legs from combined success and capacity. Last-good quotes retain original clocks. Explicit clock/skew limits and withheld reasons are required. No fabricated observations or unreviewed archive backfill.
- Publish tested floor versus measured crossing honestly; no whole-vault capacity or best-route claim from an owner-scoped bound. A best-route comparison requires matched inputs and sufficiently close clocks.
- Propose an additive schema under `asset_specific.scrvusd.exits` or an existing reviewed ladder block, preserving current fields. Return example outputs and tests for successful paired legs, failed redemption with valid underlying quote, insufficient owner inventory, stale/skewed clocks, failed swap and last-good handling. Keep candidates isolated until consumer verification.

No direct producer-repository edits or new scheduler are requested by this consumer change. Existing hourly refresh can transport the reviewed additive output.
