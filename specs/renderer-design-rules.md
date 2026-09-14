---
title: What to render, and how to key it
repo: backing-monitor
status: LIVING. Written 2026-09-14 from one day's defects, all of which had the same cause.
---

# The question this answers

*"Why is apxUSD's dependency detail so much richer than sUSDat's, which is better, and how do we
stay useful without the dashboards becoming impossible to maintain?"*

⚠️ **The useful axis is NOT rich-versus-sparse.** It is **keyed on a published field** versus
**keyed on knowledge that lives in a person's head.** Every defect found on 2026-09-14 — across
four renderers, two repos and one analyzer — was the second kind.

---

# 1. Why apxUSD and sUSDat legitimately differ

**This is upstream capability, not a design choice, and it should not be "fixed" by levelling
them.**

```
apxUSD   STRC exposure PARTLY ON-CHAIN    STRCx in a Gnosis Safe -> balanceOf verifiable
                                          analyzer fetches a live STRC quote to cross-check
                                          -> Stress Lens can re-price against an INDEPENDENT source

sUSDat   STRC exposure ENTIRELY OFF-CHAIN  an oracle-marked claim, 99% of backing
                                          -> nothing to verify against
                                          -> page says "ATTESTED, NOT MEASURED"
```

✅ **The Saturn analyzer declares the gap rather than faking it:**
`ltv_band.comment: "LTV-band data requires a Strategy NAV input; defer until that source is
identified"`. **That is the correct behaviour and should not be read as an omission to close by
building a panel.**

⚠️ **The difference a reader should take from the two pages is exactly this: apxUSD can check its
mark, sUSDat cannot.** Same upstream, different verifiability. **Levelling the presentation would
hide the most decision-relevant fact about sUSDat.**

---

# 2. ⚠️ The evidence — one day, one cause

**Everything that broke was keyed on hardcoded knowledge:**

```
_isLoanAsset closed name list      WBTC + USDtb missing   $25M counted on BOTH sides of a split
guard on dcs.as_of                 field does not exist   stamp never rendered, not once
_BTC_NO_ACTIVITY_FOOTNOTE          footnote does not exist 6 days of BTC data silently missing
guard on reports[1].scope          position-indexed       would have vanished as data improved
apyx_wolf_attestations.json        hand-maintained file   false "Stale 119d" against an audit firm
executed_usd != null ? x : 0       missing read as zero   "executed $0" beside "$1.05B remaining"
common.js "against $1 nominal par" stale description      wrong about a producer's own convention
```

**Everything that worked is self-maintaining:**

```
shared-upstream table     keyed on "any upstream linking to ?asset=strc"
on-chain-verifiable badge keyed on on_chain_pct being published at all
NAV decline stats         computed from the SAME array the chart plots
buffer step detector      classifies from share_supply + nav; refuses the label when they disagree
parse-failure counter     appeared with the failures and DELETED ITSELF when they were fixed
producer basis strings    rendered verbatim; they update themselves
```

⚠️ **The parse-failure counter is the cleanest case.** Built 2026-09-14 to declare that two filings
had not parsed; PegTracker fixed the parser hours later; **the warning retired itself with no
edit.** A hand-written note would still be on the page.

---

# 3. The rules

**R1 — Key on the presence of a published field, never on a list of assets.**
A renderer that must be edited when a new asset or collateral type appears is already wrong. The
`_isLoanAsset` list misfiled a $25M loan for months because nobody edits a list they cannot see
failing.

**R2 — Render the producer's own basis string verbatim; never paraphrase it.**
`collateral_ratio_basis`, `slippage_bps_basis`, `stale_effect`, `two_pct_depth_basis` all exist.
Paraphrasing produced *"against $1 nominal par"* for a convention that is actually all-in against
notional — wrong, and wrong in a way nobody could see.

**R3 — Compute context from the same array the chart plots.**
Then the prose and the picture cannot disagree, and no figure can go stale. Used for the sUSDat NAV
declines, the buffer range, and the redemption classifier.

**R4 — Prefer a classifier to a conclusion.**
*"Shares fell while NAV did not, therefore a redemption"* stays true next week. *"This was a
redemption"* is true once. ⚠️ **A conclusion inherited from a peer is the same thing: adopting it
is running their check, not checking it.**

**R5 — A missing field is not zero, and an absence is renderable.**
`|| 0` turned a dropped `executed_usd` into a self-contradicting row. Render "not published this
run", or derive and SAY it is derived.

**R6 — Declare absence with its reason, and let it retire itself.**
Never hide a gap, and never hand-write one either — derive it from the condition so it disappears
when the condition does.

**R7 — ⚠️ The fix is not done when the reported instance is closed.**
Twice on 2026-09-14 the same defect sat in the neighbouring field: the undated `$5.10B` beside a
stamped one, and the sUSDat buffer pill beside the tile I had just fixed for hiding its caveat.
**The second instance arrives with the credibility of having just been fixed.**

---

# 4. Applying it to the sUSDat gap

⚠️ **Do NOT build Saturn a Stress Lens.** That is a bespoke panel carrying knowledge, and bespoke
panels are where this day's defects clustered.

✅ **Ask PegTracker to publish the STRC mark sUSDat is using, plus the live-quote cross-check they
already fetch for apyx.** One field, an existing data source, and then the generic machinery
renders the comparison — and a reader learns something new: **does the oracle mark track the traded
price, and by how much does it lag?**

Checked by hand on 2026-09-14: `offchain_strc_usd_implied` moved **+0.103% at 13:47** against
STRC's **+0.193% at 14:45** — responsive, arguably leading our own STRC snapshot, which polls less
often. ⚠️ **That should be a field, not something a session greps for once.**

**One upstream field beats one bespoke panel, and it makes the two dashboards comparable instead of
differently-shaped.**
