---
target_repos: PegTracker (~/PegTracker)
target_claude: pegtracker
date_drafted: 2026-10-01
status: DRAFT — for backing-monitor owner review before sending
severity: >
  Low. Two ladders you already measure never reach the per-asset feed the dashboard reads, so two
  pages render an unrated axis 3 over a live measurement. Both assets are comfortable, so a reader
  loses little beyond "measured" being shown as "not measured". Cheap to fix, not urgent.
---

# Axis 3 — two measured ladders are stranded, and three assets have no entry

## 1. What we measured, in your own files

`liquidity_tracker.py` ran at 10:32Z and 13:09Z today and succeeded (log: `OK: 36`, `No route: 0`).
For these two the ladder is present in `data/peg_tracker_latest_usd.json` and **absent** from the
per-asset `{slug}_backing.json` `liquidity` block that backing-monitor consumes:

```
asset       config                   ladder in peg_tracker_latest_usd.json
syrupUSDT   track_liquidity: true    8 rungs to $1M, measured 2026-10-01T13:09:32Z
OUSD        track_liquidity: true    4 rungs to $100K, measured 2026-10-01T10:32:43Z
```

Both carry `total_2pct_depth: None`, no `two_pct_depth_status`, and no `depth_50bps` block — so the
rungs exist and the crossing is never computed. On our side both render as no depth figure, no band,
and an unrated axis.

Your own `slippage_bps`, signed, impact basis:

```
syrupUSDT   $1,000 0.0   $100K -0.4   $500K -2.0   $1M -4.0   -> 0.5% depth is a FLOOR at >=$1M
OUSD        $1,000 0.0   $10K -0.6    $50K -1.2    $100K -2.2 -> FLOOR at >=$100K
```

⚠️ **Both are comfortable, and that is why this is filed as low.** Neither page is hiding a risk; the
cost is that a live measurement reads as an absence, and that an unrated axis on a healthy asset
spends the reader's attention for nothing.

⚠️ **The CAUSE is our inference, not a measurement.** We can see the rungs in one file and not the
other; we have NOT read whichever analyzer writes those two `_backing.json` files, and we are not
asserting where the gap is. Please locate it rather than take our framing — a wrong explanation is
worse than a wrong number, because it closes the question.

## 2. Three assets with no config entry

`asset_config_usd.json` has no entry we could find for:

```
thUSD (Theo)    Ethereum + Arbitrum + Stable   both chains are KyberSwap-covered
cUSD (Cap)      Ethereum                       covered. NOTE: distinct from the cUSDC entry
                                               already in the config
USDD            Tron + Ethereum + BNB Chain    only the Ethereum leg is in KYBERSWAP_CHAINS;
                                               Tron and BNB are not
```

If you want them laddered, the per-asset cost is the three fields you already use
(`token_address`, `decimals`, `sell_into`) plus the flag. **We are not supplying the addresses** —
they are not in our repo, and a token address guessed by a renderer is exactly the class of fact
that should come from the producer that can verify it on-chain.

USDD is a partial: an Ethereum-leg ladder would be honest only if labelled as one leg, since most of
its supply is not on a covered chain. Your call whether that is worth publishing or misleading.

## 3. What we are NOT asking for

- **No `as_of` bump** anywhere. If a ladder is already stamped, leave the stamp alone.
- **No new threshold work.** The 50 bps blocks you shipped this week are what we wanted and they are
  rendering; this is only about assets that have no block at all.
- **No schema change.** The two stranded assets need the shape you already publish for the other 15.

## 4. How we would verify it landed

A `depth_50bps` block (or `total_2pct_depth` + status + bracket) appearing in
`syrupusdt_backing.json` and `ousd_backing.json` under `liquidity`. Our side needs no change — the
renderer already serves 15 assets off that shape, so the dashboards light up on the next sync with no
code from us.

## 5. ⚠️ msUSD (Metronome) was in an earlier draft and is REMOVED — it was never yours

Worth recording because the mistake is instructive. msUSD looked like the urgent case: your ladder
measures it at **−12.6 bps at $10K and −74.2 at $50K**, a 0.5% crossing bracketed inside
[$10K, $50K], against a page showing nothing. Two reasons it does not belong here:

1. **`msusd_metronome_backing.json` is written by backing-monitor's OWN analyzer**
   (`msusd_metronome_backing_analyzer.py`), not by anything in PegTracker. It explicitly sets
   `two_pct_depth_status: "unmeasured"` and notes *"Executable fixed-size msUSD-to-USDC quotes are
   published instead of a 2% crossing"* — and those quotes are in its own `asset_specific.quotes`.
   So there are two live sources for this asset's depth and the gap is entirely on our side.
2. **The asset is not held and is not a published dashboard** (owner, 2026-10-01), so the work is
   low priority regardless of who owns it.

⚠️ The general check for whoever adds the next asset: before filing a gap against a producer,
confirm who WRITES the consuming file. A ladder measuring successfully in a tracker log is not
evidence any dashboard can see it, and the file that cannot see it is not necessarily theirs.
