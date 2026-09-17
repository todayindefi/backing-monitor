---
title: BOLD dashboard — review against the design rules
repo: backing-monitor
status: REVIEW, 2026-09-17. Built and published by another session; this reviews it against
  specs/renderer-design-rules.md. Nothing changed yet.
---

# Verdict

✅ **The build avoided every trap flagged in `specs/bold-dashboard-plan.md` — including the one the
plan itself got wrong.** The panel is titled *"Redemption mechanics — spot is not size execution"*:
the floor is labelled SPOT with the fee ladder beside it, which was the single most likely thing to
go wrong and did not.

```
fee ladder rendered · floor labelled SPOT · 3-branch table · shutdown_time surfaced
Stability Pool per branch · LP-wrapper exclusions with the producer's reason string
two-BOLD address resolved · reconciliation invariant · two-exit split
scoring withheld: "Preview only. No liquidity score is inferred from a coarse 50 bp bracket."
```

⚠️ **Two findings. One ours (R5). One upstream and larger.**

---

# 1. ✅ R1 — passes, and it is the best thing in the renderer

`bold.js` reads `asset_specific.alert_thresholds` and hardcodes no bands:

```js
var t = a.alert_thresholds || {};
t.branch_cr_less_than_ccr_plus_pp   t.stability_pool_coverage_pct_lt
t.abs_reconciliation_gap_pct_gt
```

**Grepping for hardcoded 35 / 110 / 120 / 150 / 160 / 0.1 / 1.5 returns nothing.** Every defect
closed in the 09-14 sweep was a hardcoded list or guard; **BOLD is keyed from day one.**

⚠️ It went **bespoke** (171 lines) against the plan's recommendation. On the evidence that call was
fine — small file, keyed on published fields, genuinely BOLD-shaped content. **Bespoke was risky
because bespoke is where defects cluster, not because bespoke is wrong.**

---

# 2. ⚠️ R5 VIOLATION — `|| 0` on three thresholds, and it silently disables two checks

```js
var headroom = Number(t.branch_cr_less_than_ccr_plus_pp || 0)
var spFloor  = Number(t.stability_pool_coverage_pct_lt || 0)
var limit    = Number(t.abs_reconciliation_gap_pct_gt || 0)
```

**A missing field is not zero.** Here the fallback does not merely mislabel — **it changes what the
page checks**, in both directions:

```
threshold missing  ->  headroom 0   EVERY branch passes the CR-headroom check
threshold missing  ->  spFloor  0   NO branch is ever below the Stability Pool floor
                                    ⚠️ wstETH's live 31.75% warning would SILENTLY VANISH
threshold missing  ->  limit    0   EVERY reconciliation gap exceeds it — always alarms
```

⚠️⚠️ **The "check that cannot fail" family in its purest form** — two guards that silently pass and
one that always fires, from one idiom, **invisible at review time because the thresholds are present
today.**

**Fix:** an absent threshold is an absent check. Render *"threshold not published"* rather than
comparing against zero. R5 + R6 together, and cheap.

---

# 3. ⚠️⚠️ UPSTREAM — the depth block contradicts itself three ways

**Not a renderer defect. `data/bold_liquidity.json` (DexTracker), as of 2026-09-16T23:45Z.**

**(a) The bracket ignores its own rung.** Threshold −200 bps:

```
      1,000,000     −58.1 bps   clears
      8,000,000  −4,212.4 bps   CROSSED   ← smallest crossed rung published
     10,000,000  −5,225.1 bps   CROSSED
     20,000,000  −7,616.9 bps   CROSSED

published bracket    1,000,000 -> 10,000,000   width 9,000,000
bracket from rungs   1,000,000 ->  8,000,000   width 7,000,000
```

⚠️ **A consumer recomputing from the published rungs gets a TIGHTER answer than the producer.** The
$8M probe appears after $10M in the array — a refinement probe the bracket was never recomputed
against.

**(b) `is_floor` contradicts its own basis.**

```
depth.is_floor   false
depth.basis      "…`depth_usd` is the LOWER bound (a size that cleared), not the crossing
                  itself, and is flagged as a floor."
```

⚠️ `is_floor` is what consumers key on — `common.js` renders `total_2pct_depth_is_floor` — so a
lower bound is exposed as a located depth.

**(c) `refinement` contradicts `bracket`.**

```
refinement.status                   "refined"
refinement.stopped_on               "precision_obligation_met"
bracket.meets_precision_obligation  false
basis                               "refinement did not reproduce on re-quote"
```

✅ Three declarations disagreeing inside one block, each individually well-written. **The R2b family
one level up: the prose and the fields drifted apart.**

⚠️ **ANSWERING THE STANDING QUESTION — NO, THE LADDER IS NOT FIXED.**
`meets_precision_obligation: false`, bracket width still **$9M**, true crossing somewhere in
**$1M–$8M**.

---

# 4. ⚠️ R2b — the page does not render `depth.basis`

The depth card shows `$1.0M · bracketed at -200 bps · tested through $20.0M` and **not** the basis
string saying `depth_usd` is a lower bound.

✅ *"bracketed"* does signal imprecision and the word "floor" appears elsewhere, so this is mild.
⚠️ **But given (b), the basis string is the only place the truth is written down — and it is the one
thing not rendered.**

**Fix:** render `depth.basis` under the depth card, as the shared ladder does for
`slippage_convention`.

---

# 5. Order

```
1  ours        R5: absent threshold = absent check              ✅ DONE 1319c3adf
2  ours        render depth.basis under the depth card          ✅ DONE 1319c3adf
3  DexTracker  handoff filed 2026-09-17, uncommitted:
               bold-depth-block-three-internal-contradictions-2026-09-17.md
```

⚠️ **The R5 guard was TESTED, not just shipped.** It is silent on the live feed, because all three
thresholds are published today — so it was verified by stripping them from a live payload and
re-rendering: the "Not checked" notices appear, the reconciliation card goes neutral, and **no warn
cell is coloured**. Without that step a guard that never fires and a guard that does not work look
identical.

⚠️ **Do NOT "fix" the bracket here by recomputing from the rungs.** It would be right today and
would silently diverge the moment DexTracker changes its refinement rule. **Render what they
publish, and say when it disagrees with itself.**
