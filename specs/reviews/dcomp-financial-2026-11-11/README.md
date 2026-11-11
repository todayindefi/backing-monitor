# Ethereum dCOMP financial screening handback

Exact Ethereum dCOMP is 0x91d14789071e5E195FFC9F745348736677De3292. Financial reads use block 26388524, November 11, 2026.

Issued dCOMP exactly equaled wrapper-held COMP at 1,820,531.178865433539246018 units. Both use 18 decimals. This represents approximately 18.2053% of COMP total supply. Morpho core custody held approximately 99.99994344% of issued dCOMP. That aggregate contract balance can span markets and direct transfers, so borrower-level pledged totals and concentration remain unknown.

Published API3 wrapper source describes 1:1 redemption into COMP and deposit whitelisting. Current deployed controls and funded execution require their own evidence. A pledged holder must satisfy lending release conditions before unwrapping. COMP market liquidation and subsequent USDC proceeds remain unmeasured.

Existing FarmAnalyst evidence preserves USDC vault lender positions, reported vault liquidity and collateral-market cash as distinct perimeters. Treasury co-supply, holder/borrower distribution, exact lending-oracle controls, sized COMP liquidation depth and independently recoverable dollar value remain null. Ten public reads decoded, both block hash rechecks passed, and documentary hashes passed. RiskAnalyst received the frozen package for assessment.

Frozen package SHA256 is `0c75e3f6474e2588d9162ca0cb17770f343eface0a5639a825fb3541974823ad`. Source-index SHA256 is `86bc60e09a823c6dc2c43cb26e187e443fd08c129c8ff045f90b6c6d5341a6b7`. Raw evidence remains in the local private review store at `.private-reviews/dcomp-financial-2026-11-11/v1`. This public receipt contains selected aggregate contract facts and the review boundary.
