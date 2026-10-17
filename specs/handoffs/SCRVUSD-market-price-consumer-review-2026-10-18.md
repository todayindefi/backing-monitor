# scrvUSD market-price consumer review — 2026-10-18

Reviewed PegTracker commit `1fb514ef53be4ab260e6da1010d0207cd818b82f` and candidate observations in `data/review_pending/scrvusd_market_price` using an isolated backing-monitor preview. No candidate data copied into production data.

Consumer checks pass. Dashboard compares USD market price with USD NAV, labels market and vault observation clocks separately, and explicitly qualifies the parent mark timestamp as the crvUSD feed run time rather than the provider observation time. Missing or withheld comparisons remain unavailable. Summary wording now supports either old or candidate feeds.

The seven-day market chart requires two paired observations and excludes earlier unpaired NAV rows. The candidate has one paired observation, so the chart explicitly explains insufficient history. A temporary browser-only two-point fixture verified both market prices and contemporaneous USD NAV references, including a constant reference; no fabricated observations were stored. No widening to older history.

Validation: PegTracker 31 tests passed; backing-monitor renderer assertions passed; feed adapter 4 tests passed; desktop browser had no page errors; mobile document width 390px matched viewport. Same-unit positive/negative deviations and withheld comparisons checked.

The central PegTracker peg row still mixes USD price and crvUSD/share; this review does not approve that row. Parent provider-price observation timestamps remain unavailable. Neither limitation should be described as solved by the wrapper dashboard.

Repository-state discrepancy: return instructions described an unmerged branch, but read-only verification found the reviewed commit on both local main and remote refs/heads/main. No producer merge or push was performed during this review. Consumer changes are ready for publication separately.
