---
title: Session handoff — six-axis dashboard frame, and the reUSD/reUSDe build
repo: backing-monitor
date: 2026-08-30
status: six-axis frame SHIPPED and live · reUSD/reUSDe NOT started, staging approved
audience: the next backing-monitor session
---

# What this covers

Two threads, in the order they matter: **the six-axis frame is live on all 25 assets**, and
**reUSD/reUSDe dashboards are approved to be built in staging and are not started.**

Read the "traps" section before touching anything. Most of it is things that were re-derived
wrongly once already.

---

# 1. The six-axis frame — SHIPPED (`c0a5ec270`, plus follow-ups)

```
1 Peg / Stability     2 Backing            3 Liquidity & Exit
4 Dependencies        5 Contract & Admin   6 Issuer
```

⚠️ **This is a REORDER, not five-plus-one.** The dashboard previously ran
`1 Peg · 2 Liquidity · 3 Backing · 4 Dependencies · 5 Issuer`. **Positions 2 and 3 swapped**, axis 5
is new, Issuer moved to 6. Anything citing an old axis number is stale.

**Why 5 and 6 are SPLIT, not merged** (an "Issuer & control" merge was proposed by this repo, approved
by the user, then reversed on riskAnalyst's argument): they fail independently — USDat runs 4-of-6
behind 72h at token level while a **3-of-6 with NO timelock owns the CCIP pools** — and the evidence
is of different kinds. ⚠️ **The argument that settled it came from building the panels: axis 5's own
methodology line said "assessed in the full report rather than scored live here" while the panels
under it were on-chain reads.** One score spanning a checkable axis and a subjective one cannot be
checked.

## Ownership — one producer per axis (user decision)

```
1 Peg               PegTracker         working
2 Backing           PegTracker         working
3 Liquidity & Exit  DexTracker         DECIDED; their user directed it; aggregator port merged
                                       (a30808b). Not emitting {slug}_liquidity.json yet.
4 Dependencies      riskAnalyst        ACCEPTED by their user, upstream only, downstream deferred.
                                       ⚠️ NOT STARTED, no timeline. PegTracker's block still serves.
5 Contract & Admin  security_analyst   schema converged; ⚠️ their user has NOT authorised the walk
6 Issuer            riskAnalyst        working, via risk-feed. Relay through PegTracker to be dropped.
```

⚠️ **Axis 5 renders UNRATED with the reason on the page and this is correct, not a gap to close.**
`contract_score` exists for **0 of 146 assets** in the risk feed; it exists only at PROTOCOL level
where it means smart-contract SECURITY (audit quality — Aave V3 = 9.0). **A protocol scoring 9.0 on
audits can still hold a bare EOA upgrade key, which is exactly what axis 5 is for.** The 25
stablecoins need axis 5 AUTHORED by riskAnalyst; the 22 vault-shares map from `structural_score`.

**Why axis 3 could not be split but 4/5/6 can:** axis 3 scores the WORSE of {venue depth, primary
redemption} — a COMPARISON, needing both operands on one clock, one basis, one convention. A split
needs something to compute the min(), and that something re-stamps and picks a basis.
pegtracker-f9: *"the no-assembler rule and a split axis 3 are the same decision made twice in
opposite directions."* Axes 4/5/6 are facts-plus-judgment and split cleanly.

## Pipeline shape (decided, partially built)

**One producer per axis, each publishing `{slug}_<axis>.json` in its own repo, the sync copying per
block, NO ASSEMBLER.** ⚠️ **The no-assembler rule exists because an assembler RE-STAMPS** — one file
timestamp over six clocks says "fresh" over a two-day-old block.

- ✅ **Transport ready.** `sync_and_push.sh` now derives its copy list from **block types × registered
  slugs** (`f9f4f7dca`), replacing 76 hand-typed `cp` lines. `_liquidity`, `_contract` and
  `_dependencies` are pre-declared, so a new producer's file copies with no change here.
  ⚠️ A bare glob would be WRONG — PegTracker's data dir holds 39 files matching registered slugs that
  must not be published (`_last_good`, `_oft_audit`).
- ❌ **NOT BUILT: the renderer merge.** Preferring `{slug}_<axis>.json` over the embedded block,
  per-field, with the source named on the page. **This is the next build step and nothing can land
  without it.** It is independent of every producer.
- **Pilot when built: yzUSD/syzUSD, not a new asset** — a live page gives a before/after diff, a new
  page gives nothing to compare against.

## Field conventions settled this session

- **`as_of`, block-level, ISO-8601 UTC with Z.** ⚠️ **NOT a stored `age_hours`** — a stored age is
  stale by construction (`price_age_hours: 0.012` once appeared identically on four unrelated assets
  because it measured the RUN). The renderer computes age from `as_of`.
- **`name`, not `label`**, on dependency entries. The fallback was dropped (`128830119`) once
  producers aligned — a consumer accepting both spellings entrenches the divergence.
- **Depth statuses:** `bracketed` · `ladder_exhausted` · `quote_failed` · `not_size_responsive`.
  ⚠️ `not_size_responsive` must NOT render or rate like a floor — USDS publishes $50M with
  `is_floor: true` because every rung $1M–$50M returned identical 0.00bps (a fixed-rate PSM swap).
  Rendered as a floor it would make the one asset whose depth was NOT measured the deepest on the
  dashboard.
- **Axis-3 convention: MARGINAL impact against an EXTERNAL mid**, mid's source and age published.
  Fixed at the spec, not per producer, because coverage migrates asset-by-asset. ⚠️ The same ladder
  classifies `ladder_exhausted` under total and `bracketed [$100k,$250k]` under marginal.
  **The external mid is PegTracker's `peg.market_price` — so axis 1 is a declared input to axis 3.**

---

# 2. reUSD / reUSDe — APPROVED for staging, NOT STARTED

**User decision: build in STAGING, promote reports AND dashboards to production together when
finished.** The report side is tidr's to action; riskAnalyst is relaying.

## Staging mechanism — built and verified (`21a91706e`)

`staged: true` in `data/assets.json`:
- omits the asset from the index grid (nothing links to an unfinished page)
- the page still renders at `?asset=<slug>`
- ⚠️ **the page carries a STAGED banner declaring itself.** The banner is the point: omission stops
  LINKING, it does not stop the URL working, and **an unlinked URL is still a URL.**

**Nothing is staged today** — the flag is absent from every asset, so it is inert.

## ⚠️ SLUG — decide before registering, this is the blocking item

```
reUSD  (Re Protocol)  0x5086bf35…   WE HOLD, ~$207M Ethereum leg    → proposed slug reusd-re
reUSD  (Resupply)     0x57aB1E00…   different issuer, CDP stable    → NOT in scope
reUSDe (Re Protocol)  0xdDC0f880…   mezzanine tranche               → proposed slug reusde-re
```

⚠️ **Bare `reusd` must resolve to NOTHING.** It already 404s (no such file). **The risk is someone
later registering plain `reusd`** and silently claiming the ambiguous name. Slugs match riskAnalyst's
report filenames.

## What exists and what does not

```
✅ axes 4, 5, 6   riskAnalyst can supply now from assets/reusd-re.md and reusde-re.md.
                  Axis 5 for reUSD is ALREADY WALKED — security_analyst
                  topology/assets/reusd-re.yaml.
❌ axes 1, 2, 3   need a producer feed that DOES NOT EXIST. PegTracker holds only
                  reusd_re_health_alert_state.json.
```

**Lead the reUSD page with the axis-5 finding:** a **2-day timelock that PROTECTS THE CODE AND NOT
THE SUPPLY, with the SAME THREE KEYS holding both.** That is `distinct_authority_count` in its purest
form — two gates that are one gate.

**Axis 6 is NOT independent between the two assets** — same issuer (Resilience BVI Ltd., BVI FSC), so
two pages showing the same issuer score is correct, not duplication.

## Design answers already given to riskAnalyst

1. ⚠️ **Issuer-written NAV: render it with the WRITE PATH named in `peg.nav_basis`**, not just the
   endpoint. reUSD's NAV is admin-written on SharePriceCalculator; reUSDe's has NO on-chain accessor
   at all (`nav()`, `getNAV()`, `totalAssets()`, `pricePerShare()`, `convertToAssets()`,
   `exchangeRate()` all revert) and comes from `api.re.xyz`.
2. **An issuer API IS acceptable as an axis-1 source**, on two conditions: it carries a checkable
   `market_price_as_of`, and `market_price_source` distinguishes it from an on-chain read.
3. **The $77M vs $20M tranche-capacity contradiction: publish both, pick neither**, per PegTracker's
   `market_price_cross_check` precedent. ⚠️ **Axis 2 goes unrated while a denominator is contested by
   3.85×** — that is not a measurement.

⚠️ **CORRECTION I got wrong, do not repeat it:** I assumed reUSDe's market price came from the issuer
API, making the deviation definitional (the apyUSD "100.0% by construction" precedent) and the axis
unratable. **It does not.** There is a real Curve venue
(`0x43b98EEA5C689F0036918f590a4B55f22D853734`, reUSDe/sUSDe twocrypto), so the deviation is a market
view against an issuer mark — **a real measurement my precedent would have wrongly unrated.**

**Render it with the DENOMINATOR CHAIN named** — "reUSDe priced in sUSDe on one Curve pool; NAV from
the issuer's API" — **and a volume figure beside it**, because volume is what tells a reader what the
deviation is worth. Single venue + collapsed volume + cross-currency pair is the syzUSD profile with
an extra denominator.

---

# 3. Traps — these were each got wrong once

⚠️ **The twocrypto `balance_ratio` trap is LIVE and unfixed.** `common.js` renders a `Balance` column
as `balance_ratio × 100`. Four assets publish one (apxusd, apyusd, crvusd, usg). **For a Curve
twocrypto pool the token split IS the exchange rate, not imbalance** — so the column would report an
FX rate as an imbalance finding. Nothing in the feed distinguishes stableswap from twocrypto: no
`pool_type`, no basis on the ratio. **A reUSDe/sUSDe pool cannot go through that column as it
stands.** Needs `pool_type` or `balance_ratio_basis` from the producer; do not guess from a pair
string.

⚠️ **Upstream shares do NOT partition.** yzUSD's 16 legs sum to **108.53%** — a levered leg's
collateral and its borrowed asset can both appear. The panel says so (`aef71f751`). Never render them
as a pie or stacked bar.

⚠️ **16 legs are 10 counterparties, and the grouping UNDERSTATES.** The panel surfaces repeated name
prefixes (`Maple ×3 · Ethena ×2 · …`, `3e486bfbb`) — Maple is 20.67% across three unflagged rows. But
the prefix names the **issuer of the underlying**, not every counterparty: two `PT_` legs totalling
6.25% attribute entirely to Agora and Sky while the wrapping protocol has no row (`e0f91883a`).
**Do not fix by parsing `PT_`** — that is a world-knowledge assertion, and a leg carries no protocol
field or address to recover it from.

⚠️ **A config map records what someone WIRED, not what EXISTS.** `KYBERSWAP_CHAINS` lacked Monad and
Plasma, and "no aggregator on those chains" was repeated to three sessions before anyone called the
API. **KyberSwap serves both.** One curl disproved it.

⚠️ **Never anchor a measurement to the thing being measured.** A router quoting against its own mid
reads ~0bps however mispriced it is. On syzUSD, **194 of 201bps were basis, not slippage.**

⚠️ **Obviousness is the cue.** Nobody skips a check they think is needed. Treat *"this is obviously
true"* as the moment to run the one command. Six corrections in one session between two repos, every
one obvious-looking, **not one caught by the person who wrote it.**

---

# 4. Handoffs to producers — FILE-BASED, not messages (user directive)

**PegTracker, DexTracker and security_analyst handoffs all go through the codex file protocol.**
A message to a wrapped session is lost completely — pegtracker-f9's session wrapped mid-thread and a
`SendMessage` to dextracker bounced with *"No agent named 'dextracker' is reachable."*

```
security_analyst   handoffs/ + agent-handoff + tools/codex-dispatch.sh   (the original)
PegTracker         same, already present, pinned session exists
DexTracker         ported this session; pinned session bootstrapped 01a050f7-…
```

**Flow:** write `handoffs/inbox/<id>.md` with `status: ready`, `from: claude`, `to: codex`, and an
`output:` path → `./agent-handoff codex --id <id>` → verify.

⚠️ **NEVER declare `handoffs/results/` as the deliverable path** — that belongs to the launcher and
holds the worker's chat message. The real work goes to `output:`.
⚠️ **`completed` is the WORKER's claim, not acceptance.** Two dispatches this session: the first
reported *"external mids resolve from {slug}_backing.json"* in its chat summary while its own report
said it had deliberately NOT changed the code. **Verify by running, not reading.**
⚠️ **The user's standing rule: show the handoff file and the exact command BEFORE dispatching.**

---

# 5. Open items, and who owns each

```
NEXT AND MINE   the renderer merge — prefer {slug}_<axis>.json per-field, source named.
                Nothing lands without it.
MINE            balance_ratio / twocrypto basis — needs a producer field; spec it.
MINE            reUSD axes 1–3 feed spec into PegTracker's handoffs/inbox/ once
                riskAnalyst supplies 4/5/6. Show the user before dispatching.
USER            register reusd-re (staged) — not done, deliberately.
riskAnalyst     axis 4 build (not started), axis 5 scores for 25 stablecoins (no date),
                reUSD 4/5/6 content, tidr report staging
security_analyst  axis-5 walk authorisation from their user
DexTracker      emit {slug}_liquidity.json; enumeration + redemption handover from PegTracker
PegTracker      pct_sums_to / is_partition on dependencies; as_of on the 14 feeds lacking it;
                peg.note on Yuzu still says "Market price from CoinGecko" and is now false
```

**Health at handoff: `check_feeds.py` 0 failures / 4 warnings across 25 assets, tree clean,
everything pushed.**
