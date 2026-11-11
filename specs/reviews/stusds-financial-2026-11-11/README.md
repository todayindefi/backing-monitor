# Ethereum stUSDS financial screening handback

Exact Ethereum stUSDS is 0x99CD4Ec3f88A45940936F469E4bB72A2A701EEB9. Financial reads use block 26388511, November 11, 2026 at 01:51:11 UTC.

The contract held approximately 161.461m USDS against approximately 161.466m accrued share claims. Applying the published maxWithdraw accounting after accrued stake-engine debt and auction commitments produced zero unused capital. Auction Due returned zero. Cash and loans must retain their accounting perimeter when evaluating withdrawal capacity.

Both total-assets and per-share integer accrual calculations reproduced. All 21 reads decoded, the block hash recheck passed, and documentary source hashes passed. These financial observations use DA's selected published source. Exact deployed source/control verification was pending Security when this financial package was frozen.

SKY realizable collateral value, liquidation depth, borrower distribution, independently recoverable NAV, secondary exit capacity and the lending oracle basis remain explicit nulls. stUSDS supplies risk capital exposed to authorized cuts and liquidation shortfalls. RiskAnalyst received the package for assessment.

Frozen package SHA256 is `e76a484250fe3598631d941a903103375aab4fde823af729d11f8d8992f0195e`. Source-index SHA256 is `3203c20004e1e7281b716b2279d19ee07113c6a16b6ade2d08c8722940ee9b59`. Raw evidence remains in the local private review store at `.private-reviews/stusds-financial-2026-11-11/v1`. This public receipt contains selected aggregate contract facts and the review boundary.
