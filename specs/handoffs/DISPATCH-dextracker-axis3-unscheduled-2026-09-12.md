# Axis 3 is stalled: five assets, 4–13 days old, and a cron line would make it worse

**From:** backing-monitor · **To:** DexTracker (owner decision required) · **Date:** 2026-09-12 · *rev 3*

Axis 3 stays with DexTracker — that is settled and this dispatch argues for it. The problem is
that nothing computes depth on a schedule, so five assets are running days stale. **The obvious
fix, adding a crontab entry, would destroy the measurements it was meant to refresh.** That is
the single most important thing in this document.

Every claim below was verified against source or published data. Estimates, and the judgement
about what does and does not generalise, are DexTracker's own and are attributed.

---

## 1. The state

DexTracker supplies five assets on the dashboard. None is refreshed on a schedule.

```
asset       age     status          rungs   what the dashboard does today
syzusd      12.9d   never measured    0     refused — falls back to PegTracker's live 8-rung ladder, $200K
reusde_re    8.9d   bracketed        18     sole source — kept and marked stale, no fallback exists
usg          6.0d   bracketed        15     in use — falls back to PegTracker within hours
usdm         5.1d   floor             8     in use — sole source, will be kept and marked, not replaced
reusd_re     3.9d   not measured     15     in use — falls back to PegTracker at 7 days
```

The other 16 assets run on PegTracker, refreshed every three hours.

That 16/5 split was never designed. The agreed rollout was per-asset — PegTracker publishes until
DexTracker covers an asset — and coverage stopped at five because depth measurement was never
automated. PegTracker's 17 ladders are not a competing claim; they are a transitional state that
never ended.

---

## 2. ⚠️ Why adding a cron line destroys data

`liquidity_payload.py` is an **assembler, not a measurer**. It takes depth as an argument it
cannot compute, and its CLI entry point never supplies one.

```
main()            calls build_liquidity_payload(slug, enumeration, depth_basis=…, primary_exit=…)
                  — no depth, no rungs, no quoted_pools
      ↓
the gate          if depth and publishable:      with depth=None this is ALWAYS False
      ↓
else branch       emits status "unmeasured", depth_usd null, rungs []
      ↓
write_payload     overwrites the existing file — real rungs replaced by a stub, silently
```

**What a daily cron would do today:** blank `usg` (15 rungs), `reusde_re` (18), `reusd_re` (15),
`tsm_rh` (14), `usdm` (8) and `usdg` — all within a day. The dashboard would render the result as
authoritative, because DexTracker's block replaces PegTracker's wholesale.

This was tested, not assumed. The DexTracker session ran the CLI path for `usg` into a scratch
directory and got `unmeasured / null / 0 rungs` against the `bracketed / $677,124 / 15 rungs` on
disk. **The cron line was requested by our side and correctly refused.**

**The missing piece is not a schedule.** It is a `.route()` adapter per venue type, so the
existing ladder engine can run unattended. Depth today comes from a person doing bespoke
measurement per asset and feeding the result in — which is why the file dates are scattered
across a fortnight.

---

## 3. The ladders themselves are good

Where DexTracker has been run, the output is measurably better than the alternative. This is the
case for keeping the axis rather than handing it to the producer that merely happens to be
scheduled.

```
asset       DexTracker                        PegTracker, same asset
usg         15 rungs · bracket $15 WIDE       8 rungs · bracket $250,000 wide
reusde_re   18 rungs · bracket <$1 wide       no ladder at all
usdm         8 rungs · floor                  no ladder at all
```

Underneath sits `aggregator_quotes.py`: a source-agnostic ladder engine with an adjudication
layer covered by 13 tests named for real defects — a route flip (−6bps at $4.0076M, −290bps at
$4.0078M), a fixed-rate venue quoting 0bps at every size, a self-referential anchor,
quote-failure distinguished from no-liquidity. **That layer is the expensive part and it is
already built.** It also caught phantom pools returning 0.0000bps from $1k to $100M.

PegTracker's own assessment, volunteered against its own claim on the axis: *"my basis discipline
is weaker than DexTracker's schema, not stronger."* The concrete form — three different slippage
references live across its estate, none declared anywhere until yesterday.

---

## 4. The anchor gate — both fixes shipped, one limitation remains

**State as of 2026-09-12, `liquidity_payload.py` / `_resolve_self_referential`.** This section has
already moved twice while being written, so it is dated rather than described as "current" — if
you are reading it later, check that function rather than trusting this page.

**Two defects were found and both are fixed.** Neither needs approval; they are recorded because
they explain why the two payloads on disk are not trustworthy.

**Fix 1 — the gate accepted silence.** `depth_is_publishable` used
`not basis.get("self_referential")`, and `not None` evaluates True, so a **missing** key passed a
gate whose own docstring demands independence be *"affirmatively established, not merely
un-denied."* It now requires exactly `False`.

**Fix 2 — the anchor computed its own answer and ignored the upstream declaration.**
`peg_market_anchor` decided self-referentiality by prefix-matching the source against
`peg_tracker:kyberswap` / `:router:` / `:aggregator:`. In DexTracker's own words, now the
docstring on `_source_prefix_suggests_self_reference`: *"It recognises routed marks and nothing
else … It cannot see source EQUALITY, which is the property that actually matters."* With fix 1 in
place and fix 2 outstanding, both known-bad assets would have **affirmatively declared
independence** through a gate finally doing its job — worse than the silence fix 1 closed.

It now prefers PegTracker's `peg.market_price_self_referential`, via `_resolve_self_referential`.
Independence requires **both** to agree (`declared or heuristic`): an upstream `False` cannot
unsay a local router match, an upstream `True` always wins, a declaration present but not boolean
fails closed, and `routed_mark` deliberately ignores the declaration because it describes
`peg.market_price` — a different number from the cross-check's routed mark. Anchors now carry
`self_referential_determination` and `self_referential_basis` for provenance. Suite 255 → 263.

The live table, after both fixes:

```
asset    resolved   via                      upstream   gate verdict
usdm     True       upstream_declaration     True       REFUSES
usg      True       upstream_declaration     True       REFUSES
syzusd   False      source_prefix_heuristic  —          passes
```

⚠️ **The residual limitation, which the fix does not close.** The fallback heuristic still cannot
see source equality, so for any asset where PegTracker does not declare the field, a venue-native
mark reads as independent. `syzusd`'s `geckoterminal_pool` is exactly that case and is unchanged.

⚠️ **And the upstream rule needed a second pass of its own.** PegTracker's source-equality rule
originally compared strings **exactly**, which cleared `thusd` — whose mark is
`geckoterminal_pools_volume_weighted` while its exit mark quotes `geckoterminal` and carries that
very number as `fair_value`. Same apparatus, two spellings. Now fixed as a provider-form
comparison (`liquidity_tracker.mark_provider`), and **the fleet result is three assets, not two:
`thusd`, `usdm`, `usg`.** A cross-check this side using string equality had missed it too.
`hastra_prime` resolves cleanly under the provider form (`geckoterminal` vs `uniswap`) and is not
affected.

✅ **One design point from PegTracker worth having.** Their `is_self_referential()` returns
**None** when either source is unknown — unmeasured, not a clean bill of health. A rule returning
`False` on missing data would hand the newly-strict gate an affirmative pass built from ignorance,
which is the same shape as the defect fix 2 closed. The two rules are complementary rather than
overlapping: the prefix heuristic knows an aggregator-routed mark shares the ladder's route; the
provider rule catches venue-level identity no prefix list would enumerate. Neither is a superset.
`mark_provider` is available to port, though the upstream declaration is cheaper and cannot drift
from the producer that knows.

⚠️ **The live consequence, now sharper.** usdm's `$500,430` and usg's `$677,124` are still on
disk and still rendering, because the gate runs at build time and does not retroactively change
files. **The anchor path now refuses both the moment those payloads are rebuilt** — which the
adapter work in §5 would do. If usdm's depth is withheld, its dashboard tile goes empty: usdm is
the sole source for its asset, so the dashboard keeps the overlay rather than falling back.
**That should be a decision, not a side effect of a rebuild.**

*(The dashboard reads both producers' claims independently and attributes each, so nothing above
changes what a reader currently sees: usdm and usg both carry "anchored to the venue being
measured" with the declaring producer's own basis.)*

---

## 5. The work — adapters, then the guard, then the cron

Order matters and is DexTracker's own. **The cron is last, never first.**

**1. Two `.route()` adapters.** Mento `getAmountsOut` on Celo, and Curve `get_dy` single-pool.
Reusing the ladder engine unchanged. DexTracker's estimate: **3–5 working days** for both.

⚠️ **That estimate covers `usdm` and `reusde_re` — the two sole-source assets — and nothing
else.** An earlier revision of this document attached it to "all five assets"; that claim was not
DexTracker's and they have declined to have their number read as covering it.

⚠️ **`usg` is not a plain adapter and is not costed.** Its ladder splits input across two Curve
PegKeeper pools in proportion to live USG inventory and values both outputs at $1, while
`build_routed_ladder` calls `client.route()` once per size. That needs an aggregating client or
handling above the engine. It is the one piece of the five that is not "wrap an existing quote
method", and **no estimate has been given for it.** `syzusd` and `reusd_re` route through the
existing aggregator and need wiring rather than a new adapter.

**2. The refuse-to-downgrade guard.** Proposed by DexTracker: `write_payload` refuses to overwrite
a payload holding real rungs with a 0-rung stub, and exits non-zero. This is the safety net that
would have caught the bad cron request — and step 3 is precisely when a scheduled job could start
silently downgrading things.

**3. Then the cron — daily or twice daily.** Minutes of work once steps 1 and 2 make it safe.
Daily is explicitly sufficient for this axis. Alongside it, declare the cadence in the payload as
`refresh_cadence` so readers can see it.

**Already cleared on the other side.** PegTracker shipped `peg.market_price_as_of` for `usdm` and
`usg`, each with a basis naming what dates it — usdm's is the Mento `getAmountOut` quote's own
observation time; usg's is the analyzer run clock, explicitly labelled as *bounding* the age
rather than dressed up as a venue mark. The anchor no longer blocks usdm's automation.

⚠️ **One expectation to set.** Automating `usdm` converts a stale floor into a *fresh floor*, not
into a located crossing — its Mento pool is oracle-priced and stayed inside the threshold through
500,000 USDm. `reusde_re` is where the automation delivers a genuine bracket. Nobody should expect
a number that will not appear.

---

## 6. Holding pattern — no time pressure

The dashboard side is shipped and carrying the interim, so a stale overlay can no longer quietly
outrank a live feed:

- **Past 7 days an overlay is refused** and the base feed renders instead — wholesale, never a
  per-field merge.
- **Unless it is the sole source**, in which case it is kept and marked, because replacing a stale
  measurement with nothing is worse for a reader than a stale one that says so.
- **A declared `refresh_cadence` renders beside the age** — "refreshes daily · 5d old" — so
  lateness reads as lateness. Silent until a producer declares one; deliberately not hardcoded,
  since that would be a claim about someone else's crontab that goes stale when they change it.
- **Self-referential anchors are surfaced**, attributed to whichever producer declared the flag,
  quoting their reasoning rather than summarising it.

Once the cron runs, none of those markers fire and the guard becomes the backstop it was meant to
be rather than a load-bearing part of the page.

---

## The ask

Approve the three steps in order — **adapters, guard, cron**. Both anchor fixes in §4 are already
shipped and need nothing.

Two decisions come with it:

- **Scope.** The 3–5 day estimate buys `usdm` and `reusde_re`. `syzusd` and `reusd_re` need
  wiring onto the existing aggregator. **`usg`'s multi-pool aggregation is uncosted** — decide
  whether it is in or out before the work starts, rather than discovering it partway.
- **The two payloads on disk.** usdm's `$500,430` and usg's `$677,124` were built through the
  broken gate and the fixed anchor path now refuses them. Rebuilding is what empties usdm's
  dashboard tile. That is a deliberate call about showing nothing versus showing a figure known to
  be anchored to its own venue.

Everything is scoped and both sides agree on the shape; the only thing missing is a decision that
belongs to DexTracker's owner rather than to either session.

**Longer-term direction, for context rather than approval:** axis 3 migrates fully to DexTracker
over time. That is where the convention problem actually gets solved — one producer means one
slippage convention, and today three are live across the page with a single column rendering all
of them.
