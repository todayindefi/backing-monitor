# BM measurement follow-up — November 2, 2026

The private return and machine status register are under `.private-reviews/six-portfolio-refresh-2026-11-02/followup/` (gitignored). They preserve live balances, exact account/market bindings, unsigned quotes, failed eth_call/gas estimates, oracle rounds, actual-size conditional swap legs and genuine historical source observations. No trades, transfers, approvals, notifications or scores changed.

Public handoff: `specs/handoffs/six-portfolio-measurement-followup-return-2026-11-02.md`.

Dashboard change: apyUSD now identifies the measured active receipt-NFT unlock configuration and explicit receipt-monitoring gap. Legacy UnlockToken queue observations are collapsed and no longer presented as the current unlock path. Registry description and renderer cache token updated. The implementation is a dated configuration correction; ongoing measurements remain with PegTracker.

Release acceptance: `release-browser.json` and four screenshots cover desktop/mobile and light/dark. They verify the dated fee/path note, collapsed legacy monitor, no page errors and no horizontal overflow using a committed-tree release candidate. `served-browser.json` and code hashes record public acceptance when available; local acceptance alone does not establish deployment.
