# Strategy / STRC November 2 filing propagation

The checked base snapshot (14:50:09 UTC) preceded the15:00 EDGAR poll that ingested accession0001193125-26-442707. Event detection worked; a normal base-producer refresh was needed. No duplicate event or news monitor was added.

The normal PegTracker producer now projects the existing event data and hash-verified DeFiAnalyst retained primary text. Activity is October26–November1, balances November1, filing November2; assembly and independent market-quote clocks remain separate. Five retained primary-source hashes were checked. Live retrieval of the November2 SEC HTML failed through web tooling; retained SEC HTML was read, not represented as a successful live fetch.

Cash132.7M and Reserve4.79B are separate. MSTR issuance164M splits65.5M BTC/98.5M Cash; STRC repurchases208.2M exceed that Cash allocation by109.7M. Preferred dividend use43.4M is not STRC-only. Remaining preferred authorization748.6M/common1B is not cash, and ATM capacity is not committed funding. The unsettled-sales footnote is retained. Historical aggregate BTC cost64.08B/average75,451 is separate from market marks. Both811 purchased and810 holdings increase remain explicitly unreconciled.

## Outstanding and model guard

The previous producer summed reported repurchases as retirements. That does not establish cancellation or exact current outstanding. The exact104,894,705 June30 base, missing-series and issuance guards, and aged-base warning are preserved. Cumulative reported repurchases23,072,543 are distinct from verified retirements. Mechanical subtraction would yield81,822,162, but that is not published as verified outstanding.

The issuer's public STRC page shows rounded8,182.2M notional, consistent at displayed precision, but does not establish the exact share register or retirement chronology. Its security/Bitcoin data clocks differ and do not supply a notional-specific observation date. June30 Note10 confirms the exact base and that no shares had been repurchased at that date. Neither establishes exact current outstanding. Current shares, retirement count, forward burden and dependent liability/runway/mNAV outputs therefore remain unavailable; independent prices, gross BTC NAV and actual filing observations remain available. Historical chart observations are preserved as history.

Sources: [November2 8-K](https://www.sec.gov/Archives/edgar/data/1050446/000119312526442707/mstr-20261102.htm), [June30 Note10](https://www.sec.gov/Archives/edgar/data/1050446/000105044626000044/mstr-20260630.htm), [issuer STRC metrics](https://www.strategy.com/strc).

## Risk interpretation and scope

A public allowlist projects RiskAnalyst's dated interpretation onto existing MSTR/STRC/STRCx/apxUSD/apyUSD/Ethereum sUSDat pages. Common-equity access resumed; cash allocation did not cover support spending and sustained rebuilding is not established. Scores and full-verification dates are preserved for all ten reports. MSTR Funding3.0/Overall3.5 and STRC Counterparty3.0/Overall3.0 remain unchanged.

STRCx custody, Apyx reserve weights/receipts, STRCon custody, Saturn/Strata queues/bridges and PT maturity require their own evidence. This filing changes no wrapper allocation or token quantity. USDat's PYUSDx route and aptUSD/alqUSD Treasury products receive no blanket STRC assignment. srUSDat and the three PT routes are retained in the owner context feed; this dashboard registry has no corresponding standalone pages, so no new dashboards were created.

## Remaining blockers

- 811 versus810 BTC: issuer explanation absent; no invented sale/loss/rounding adjustment.
- Exact current outstanding/retirement evidence and a refreshed base; dependent numerical service/valuation outputs withheld.
- Daily-dividend meeting outcome, filed/effective security terms and actual declaration need separate confirmation. The issuer page's daily-looking record/payout dates do not complete that legal chain; daily and superseded semi-monthly payments are never summed.
- Wrapper allocations, accrual/cash pass-through and srUSDat/PT surface coverage remain owned separately.

See `served-acceptance.json` for source clocks, hashes and desktop/mobile evidence. No transactions, approvals, transfers or external messages were sent.

Validation:58 relevant producer tests passed. The full producer hook had2479 passes/12 skips and five failures; the one obsolete repurchase=retirement expectation was corrected and retested in the58 passing tests. Four unrelated failures remain (crvUSD alternative basis, dependency links, syzUSD fill ratio, yzUSD pool mark); the documented hook override was used deliberately. Apyx receipt/source-basis regressions passed.

Latest manual producer refresh encountered CoinGecko429 and explicitly used the existing last-good BTC mark. Its quote observation clock is not provided, so no fresh BTC quote clock is inferred. Independent MSTR/STRC quote fetch clocks remain available.

Dashboard-wide conformance returned one unrelated stale-USDD feed failure (6.2h against6h limit) and48 warnings; this is not claimed green and no out-of-scope USDD collector was run.

Served acceptance: dashboard `881aa57e23`, producer `ffaff0e`;16 exact served code/data hashes and12 desktop/mobile views passed. Screenshots, field clocks and remaining blockers are retained in `served-acceptance.json`. Apyx receipt code and accepted release behavior remain unchanged.
