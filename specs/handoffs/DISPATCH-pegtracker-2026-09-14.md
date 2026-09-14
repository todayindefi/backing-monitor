# Six handoffs are waiting, and one unanswered question decides two of them

**From:** backing-monitor · **To:** PegTracker (codex) · **Date:** 2026-09-14 · *rev 1*

Six handoffs sit at `status: ready` in `~/PegTracker/handoffs/inbox/`. Four were drafted today
while working an analyst backlog against the live dashboards; two predate it. **All are
uncommitted — your commit is the adoption, and nothing here presumes it.**

Every figure below was verified against your published feeds or your source, and the reasoning is
in each handoff. This dispatch exists to say what to take first and what is actually blocked.

⚠️ **Nothing is on fire.** The consumer side is patched for all four of today's items, so no wrong
number is currently rendering. **Those patches are debt, not fixes** — three of them reconstruct a
rule that lives in your code, and they go stale silently if you change it.

---

## 1. The state

```
handoff                                                     pri   file                        consumer-side now
strcx-total-supply-usd-prices-scaled-count-…-2026-09-14      med   strc_backing_analyzer.py    values at the mark, names both
apyx-fair-value-basis-hardcoded-2026-09-14                   med   apyx_backing_analyzer.py    ignores the field
syrup-loan-artifact-marker-not-stamped-2026-09-14            med   syrupusdc/usdt_analyzer.py  reconstructs your gate
apyx-pool-enumeration-misses-the-routed-venue-2026-09-14     med   apyx_backing_analyzer.py    names the contradiction
exit-ladder-bracket-lost-on-quote-failure-2026-09-11         med   liquidity_tracker.py        renders "quote failed"
hastra-prime-heloc-is-a-facility-name-2026-09-12             low   hastra_prime_analyzer.py    renders the feed's wording
```

---

## 2. ⚠️ Take STRCx first — one of two published figures is wrong and only you can say which

`strc_backing_analyzer.py:2270` values a **scaled** token count at a **pre-scaled** price:

```
total_supply_usd = total_supply_all_chains * cg_price_usd

  2,817,125 x $105.55 (CoinGecko, pre-scaled)  = $297,347,509   ← published
  2,817,125 x $ 98.38 (market_price_usd)       = $277,159,712
                                          gap  = $20.2M, 7.3%, exactly the multiplier
```

Ethereum's leg is an on-chain `totalSupply()` call, so the count is on the scaled basis. Your own
code builds `coingecko_scaled_price_usd = cg_price / multiplier` for exactly this reason.

**The question this dispatch is really about:** *is CoinGecko's cross-chain `total_supply`
aggregate scaled or pre-scaled?* It decides which of two of your figures is wrong, and they are
mutually exclusive:

```
CG aggregate SCALED      -> total_supply_usd overstated by the multiplier
CG aggregate PRE-SCALED  -> other_chains_implied (line 2259) inflated by a basis mismatch
```

⚠️ **That residual is not small: 629,032 STRCx, 22.3% of supply, ~$62M** — which our dashboard now
carries as a top-line warning that a fifth of the token cannot be located. **If the bases differ,
part of that warning is a unit artifact and we are flagging a phantom.** We render it as an upper
bound and say it is a residual rather than an observation, which is the most we can do from here.

**Ask:** settle the basis, and publish it (`total_supply_basis` / `total_supply_usd_price_source`)
so no consumer has to infer it again.

---

## 3. The cheapest one, and it has already cost something

`apyx_backing_analyzer.py:3486-3487` publishes two literals:

```python
"fair_value": None,
"fair_value_basis": "par_fallback",
```

The branch thirty lines above computed `fair_value_basis="market"` and passed it to `quote_pair`.
**The literals overwrite its own result.** The sibling `apyusd_state` block does it correctly.

⚠️ **A risk analyst read that field and filed a defect against us** saying apxUSD's slippage was
measured against $1.00 while the peg panel said 0.9770. They were reporting exactly what the feed
said. It took reconstructing the arithmetic — and your own `derive_liquidity_score_apyx` docstring,
which states *"apxUSD is quoted against its live MARKET mark"* — to establish that the ladder was
fine and the metadata was not.

**A wrong explanation does not merely fail to inform; it closes the question.** This is a two-line
fix with a disproportionate payoff.

---

## 4. The one with the largest exposure behind it

`syrup-loan-artifact-marker-not-stamped`: your corroboration gate is correct and its conclusion is
sound — a below-100 read only pages when `unrealizedLosses > 0` or the loan is
impaired/called/defaulted. **It reaches the feed twice, and both times as an aggregate.**

`loans[].collateral` carries no marker, so every consumer must rebuild the rule from three places.
We did, because the page was printing `-80.1pp 🔴` with *"delegate discretion to call"* on
**10 loans, $372.55M, 40% of a $941M book** that you had already graded unreliable.

Our reconstruction reproduces your aggregate exactly. **It should not have had to exist**, and it
is the most fragile thing we shipped this week: if you change the gate and we do not, the page
reports the old verdict with no error.

**Ask:** stamp `read_corroborated` (naming yours) on the loan record. Safe to adopt — syrupUSDT has
zero uncorroborated reads today, so the field is `true` on every row there.

---

## 5. The other three

**`apyx-pool-enumeration`** — your pool list says apxUSD/USDC depth is `$5,748`; your KyberSwap
ladder in the same run fills `$100,000` at ~1–2 bps. A router that quotes a fill is the harder
evidence, so the enumeration is missing the venue the route uses. Cheapest fix is probably to read
the pools out of the quote response, after which the list and the ladder cannot disagree. ⚠️ **An
analyst names a UniV4 pool; we do not render that, because it is in no feed we hold. You can see
the route.**

**`exit-ladder-bracket-lost-on-quote-failure`** — `ca4943e` works and nothing asks you to change
it. The remaining gap is that `usable` is built only from quotes carrying a numeric
`slippage_bps`, so a failed endpoint erases the bracket before the selector runs.

**`hastra-prime-heloc`** — naming, not arithmetic: "HELOC" is a facility name being used as a
description of the book, and Figure's Kiavi acquisition adds DSCR/RTL loans to the same facility.
Low priority and no number moves.

---

## 6. What adoption retires on our side

```
strcx-total-supply    -> we stop carrying two dollar figures and a hedge about which is right
apyx-fair-value       -> we stop ignoring a published field
syrup-artifact-marker -> _collateralUncorroborated() and _bufferStatsExUncorroborated() DELETED
apyx-pool-enumeration -> the "this subtotal and the ladder disagree" note disappears on its own
```

Three of those are reconstructions of your logic living in our renderer. **That is the argument for
taking them, more than any single number is.**

---

## 7. One pattern worth naming, because it is not only ours

Two of today's four are the same shape as a defect riskAnalyst is carrying in this repo (hardcoded
BOLD liquidity constants re-stamped with a fresh timestamp each cron cycle):

```
a stale VALUE read as fresh         cron re-stamps the timestamp
a stale LIST read as complete       "latest enumerated" read as "latest published"
a CORRECT value that deletes a check a guard encoding the shape the data happened to have
```

⚠️ **The third has no failure signal at all.** We hit it this week: a scope-regression warning
guarded on `reports[1].scope === 'full_balance'` — true only while the file held two rows. Filling
in three correct rows would have silently switched the warning off. **The diff that disables it is
a diff that adds correct data**, and nothing looks wrong at review time. It was caught by rendering
the page.

**Position-indexed conditions are the tell.** A check should quantify over the record, not over a
position in it.
