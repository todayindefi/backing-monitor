# Start the axis-3 migration: one adapter unblocks most of it

**From:** backing-monitor · **To:** DexTracker (owner) · **Date:** 2026-09-14 · *rev 1*

**Decision taken on our side: axis 3 migrates to DexTracker.** That was already the spec's position
(`six-axis-dashboard-spec.md` §1 — *"DexTracker owns axis 3 by decision"*); what changed today is
that we stopped patching PegTracker's embedded block as if it were the destination.

⚠️ **Two apyx handoffs to PegTracker are now `on_hold` rather than `ready`** —
`apyx-fair-value-basis-hardcoded` and `apyx-pool-enumeration-misses-the-routed-venue`. Both
findings are verified and stand. **We held them because repairing a producer that is being wound
down for this axis is the wrong direction, and because you may want the pool-enumeration one as a
coverage requirement instead of a bug report.**

This dispatch follows `DISPATCH-dextracker-axis3-unscheduled-2026-09-12`, which diagnosed why
coverage stalled. **Nothing here contradicts it; the blocker is unchanged.** What is new is a
measured target list and an ordering.

---

## 1. Coverage today — 7 of 28 registered assets

```
asset       age    status                   rungs
reusde_re   0.8d   bracketed                 10
usdm        0.8d   not_size_responsive        0
usg         0.8d   bracketed                 10
usdg        5.1d   bracketed_per_venue        0
reusd_re    6.6d   not_measured              15
tsm_rh      8.6d   bracketed                 14
syzusd     15.7d   unmeasured                 0
```

Three refreshed within the same minute on 2026-09-13, so **something now runs in batch** — which
the 09-12 dispatch did not yet reflect. Four others are 5–16 days old, so it is partial.

---

## 2. ⚠️ The target is NOT 21 assets

Most uncovered assets have no secondary venue to measure. `bmnr` and `strc` are TradFi
instruments; `syrupusdc` / `syrupusdt` exit through a redemption queue, not a pool; a dozen others
enumerate no pools at all and correctly render an absence.

**The assets that actually carry a PegTracker ladder today — the real migration set:**

```
asset          rungs  venues enumerated            note
apxusd           4    curve, pcs_v3                also the pool-enumeration gap, see §4
apyusd           4    curve, pcs_v3
usdat            7    curve
susdat           4    curve
hastra_prime    13    orca_whirlpool, uniswap_v3   13 rungs, best of the set
usdai            6    (none enumerated)            ⚠️ ladder exists, venue not declared
susdai           8    (none enumerated)            ⚠️ ladder exists, venue not declared
crvusd           0    curve                        pool listed, no ladder
```

**Eight assets, not twenty-one.**

---

## 3. The ordering, and why

**Build the Curve `.route()` adapter first.** Counted across the uncovered set:

```
curve            5 assets   apxusd, apyusd, crvusd, susdat, usdat
pcs_v3           2 assets   apxusd, apyusd        (both are multi-venue, so this completes them)
orca_whirlpool   1 asset    hastra_prime
uniswap_v3       1 asset    hastra_prime
```

**Curve alone moves four of the eight**, and `usg` — already yours — is a Curve PegKeeper asset, so
the engine has met that venue family before. `pcs_v3` then completes the two apyx assets rather
than half-covering them.

⚠️ **`usdai` and `susdai` need a venue answer before an adapter can be chosen for them.** They
publish 6 and 8 rungs with no `pools` enumerated, so we cannot tell you from here what to build.

---

## 4. ⚠️ One asset comes with a known defect, and it is a coverage requirement not a bug

apxUSD's PegTracker pool list says direct apxUSD→USDC depth is **$5,748**, while the KyberSwap
ladder in the same run fills **$100,000 at ~1–2 bps**. A router that quotes a fill is the harder
evidence, so **the enumeration is missing the venue the route uses.** An analyst puts it at a
Uniswap V4 apxUSD/USDC pool carrying most of the volume; we do not render that, because it is in no
feed we hold.

**Stated as a requirement rather than a bug:** whatever measures apxUSD for you needs to enumerate
from the route, not from a maintained pool list — otherwise the migration inherits the same gap.
Our dashboard currently carries a computed note saying the subtotal and the ladder disagree; **it
disappears on its own once an enumeration explains the fill.**

---

## 5. What we do renderer-side during the migration — nothing per asset

`liquidity/1` is adopted: seven overlays load today, registered in `common.js` at `mode: 'replace'`
with a translator. **A DexTracker payload replaces PegTracker's embedded block wholesale the moment
it appears**, so migration is per-asset and needs no renderer change from us, exactly as the
original rollout intended.

⚠️ **Which is also the hazard the 09-12 dispatch was written about.** Because it replaces
wholesale, a payload emitted with `depth=None` overwrites a good ladder with
`unmeasured / null / 0 rungs`, and we render the stub as authoritative. **Do not schedule anything
until the adapter supplies depth** — that has not changed.

---

## 6. What we need in each payload

Already in `liquidity/1`, listed so nothing is inferred:

```
depth.status + depth.is_floor     bracketed / ladder_exhausted / not_size_responsive / unmeasured
depth.basis                       the declared convention — we render it verbatim
enumeration                       which venues were counted, so wrappers cannot double-count
as_of                             we derive age at read time
```

⚠️ **Declare the slippage convention explicitly.** Your existing payloads say *"MARGINAL impact
against an external mid"*; PegTracker's say *"ALL-IN COST against notional"*. Both are legitimate
and they are not comparable rung-for-rung. **We render whichever the producer declares and never
infer it** — but an undeclared one is the single thing that would make a migrated asset read wrong
beside an unmigrated one.

⚠️ **And pin the sign.** Cost is published NEGATIVE by the dominant convention in this fleet, but
`susdat` and `usdai` come back mixed-sign within a single ladder. We grade on magnitude for exactly
that reason. A migrated asset that flips convention silently would render its cliff green.

---

## 7. What this retires

```
apyx-fair-value-basis-hardcoded       held; moot if apyx's exit_mark comes from you instead
apyx-pool-enumeration-…               held; becomes §4 above
PegTracker's embedded exit_mark       per-asset, as coverage lands — not in one step
```

**Staying with PegTracker regardless:** `liquidity_tracker.py`'s bracket-loss bug
(`exit-ladder-bracket-lost-on-quote-failure-2026-09-11`, still `ready`). That engine serves seven
assets you do not cover and will not cover soon. **Migrating the axis does not retire that code on
any timeline that helps them.**
