# Higher-yield lending initial screening handbacks

RiskAnalyst authored the following provisional exact-Ethereum initial scores on November 11. These are collateral/product scopes, not vault approvals.

| Asset | Score |
|---|---:|
| PT-USD3-17DEC2026, 3Jane | 2.5 |
| PT-USDat-14JAN2027 | 3.5 |
| PT-sUSDS-26NOV2026 | 6.0 |
| PT-sUSDe-26NOV2026 | 5.5 |
| oTFY | 3.0 |
| Hastra AUTO | 3.5 |
| Native strUSD | 3.0 |
| etrUSD | 2.5 |

The 4-PT package 43a774e0e10cef45cdb2e5654b295a13b62f2316eb3e9a99346b7eee70428d1d retains 17 source objects. The first 2 identities reuse November 5; the latter 2 bounded identity/units reads use Ethereum block 26388817 at 02:52:47 UTC. USD3 is 3Jane at 056b..5ecc, distinct from Reserve. PT-sUSDS accounts in USDS and outputs DAI, USDS or sUSDS. PT-sUSDe accounts in USDe but observedSYoutput is only sUSDe. Original underlying score/verification dates are preserved. Exact wrapper/oracle/current sized exits remain unresolved.

oTFY/AUTO package e2d919bf8982179449de5ea016997266480c8c0b447bd7f59e3be1cdf29fb05e retains 27 financial objects. AUTO has 3.089626m shares and 3.191017m wYLDS internal assets matching holdings; NAV-based claims retain a separate basis. oTFY supply alone does not establish NAV or qualified-holder redemption. 77 Security files under manifest 7e68f2060fc8fc139426886d69ef3b6d0d8decd9dde2607ef30b7c91083763e5 was accepted. Offchain condition, funded cushions, complete cash exits, AUTO current roots and oracle valuation gaps remain explicit.

strUSD package 49de5ac8fa70e521dbf7499b59f46bd6a2bb3859aa65476186e4b0f9b6f1bb15 retains 17 objects and October 31 financial/authority clocks. Seven-day unstaking returns trUSD, while eligible issuer repurchase remains discretionary under the retained terms. Current portfolio NAV, liabilities and Accountable assurance are unknown.

etrUSD package 4168ef0b35899b23525e0a897ccdf2fcccccfb179d6bb4a4c6751f1286566ca9 retains 14 objects. Receipt 6f20..592d differs from strategy vault cd69..de54. Publisher TVL of $10.257928m uses explicit hardpeg assumptions; independent NAV, supply, positions, net leverage and cash queues remain null. Security existing-only 5-file inventory retains exact deployed control gaps.

All source packages, indices, review receipts and applicable shared-checker results are retained locally under .private-reviews. Original frozen package bytes were preserved. This handback publishes selected aggregate research boundaries and hashes; raw private evidence is excluded.
