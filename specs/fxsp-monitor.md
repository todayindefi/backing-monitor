# fxSP maintained vault monitor

Route: https://todayindefi.github.io/backing-monitor/vaults/fxsp/

PegTracker owns the normal `fxsp-native/1` financial product. Its existing hourly fxSAVE runner checks an independent 28,800-second fxSP attempt gate, including failed attempts. BM consumes the normal files through `tools/sync_fxsp_vault.py` in the existing hourly sync; no additional job or RPC collector is installed. Transport can add hourly latency. A full subsequent eight-hour cycle was not yet elapsed at initial release.

The consumer independently checks identity, units, accounting and basket-preview reconciliation. Intake failure preserves financial bytes and emits failed source status. The page displays original clocks, last-good/stale warnings (10-hour threshold), and polls static exports every five minutes. No observation date is renewed by a build or due check.

Share NAV is not a spot quote or total return. The share secondary market is not monitored. USDC cash, Aave receipt claims, reservations and complete cash realization remain distinct; unavailable fields stay null. Redemption previews do not establish executable capacity. Controls retain the dated November 17 accepted public scope, with parallel-path gaps. No score is assigned.

Validation: offline consumer and renderer/route suites, plus six actual desktop/tablet/mobile light/dark cases, alias/card navigation, and failure/stale/manual-preview/subsequent-poll cases. Public projection excludes private source paths and owner packets.
