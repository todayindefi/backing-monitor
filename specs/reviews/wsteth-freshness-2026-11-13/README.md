# wstETH freshness repair — November 13, 2026

Fixed the normal producer failure that left the canonical Ethereum dashboard on November 12 data. A newly registered CCIP selector (`14894068710063348487`) triggered an unhandled roster exception before the analyzer could publish fresh canonical measurements.

PegTracker repair `dc00d64` retains unsupported remote legs explicitly and allows the native refresh to complete. The observed new leg is siloed and excluded from the shared unsiloed denominator. Unsupported identity/supply remain unknown; incomplete unsiloed coverage suppresses reconciliation ratios. No freshness thresholds, scores or schedules changed. The producer owner reports 25 focused checks passing; 47 full-suite failures were not established as pre-existing and remain a validation limitation.

BM normal-feed release `e27155f35967a661304aefbcf9922147ee52a28b` was pushed to main; Pages workflow `43348821060` succeeded. Only `data/wsteth_backing.json`, `data/wsteth_peg_history.json` and `data/wsteth_backing_history.json` changed in that release. No private research packet was published.

Initial repaired observation: Ethereum **26402896**, **2026-11-13 01:57:35 UTC**; producer assembly **01:57:30 UTC**. Initial served backing SHA256: `52e2cc4000886a595ccdd46ef6791f8929210b4a257af303a2f3466f1a61e088`. Existing hourly refreshes may subsequently advance these bytes.

Read-only production verification at 02:00 UTC covered 1440px desktop and 390px mobile: the freshness warning cleared, eight paired market/NAV chart points rendered, and no JavaScript errors or document overflow occurred. Frozen receipt SHA256: `bcd9ecef68031a9a4a32cd0dab139ccbcb4d5a977ca7d439ca1b5121a896d48f`.
