---
target_repos: PegTracker (~/PegTracker)
target_claude: pegtracker
date_drafted: 2026-10-01
status: DRAFT — for backing-monitor owner review before sending
severity: >
  Not a measurement defect. Three ladders you ALREADY measure today never reach the per-asset feed
  the dashboard reads, so three pages render no exit information at all. One of them is thin enough
  that the silence is the dangerous direction.
---

# Axis 3 — three measured ladders are stranded, and three assets have no entry

## 1. What we measured, in your own files

`liquidity_tracker.py` ran at 10:32Z and 13:09Z today and succeeded (log: `OK: 36`, `No route: 0`).
For these three the ladder is present in `data/peg_tracker_latest_usd.json` and **absent** from the
per-asset `{slug}_backing.json` `liquidity` block that backing-monitor consumes:

```
asset             config                     ladder in peg_tracker_latest_usd.json
syrupUSDT         track_liquidity: true      8 rungs to $1M, measured 2026-10-01T13:09:32Z
OUSD              track_liquidity: true      4 rungs to $100K, measured 2026-10-01T10:32:43Z
msUSD_Metronome   track_liquidity: true      4 rungs to $100K, measured 2026-10-01T10:32:20Z
```

All three carry `total_2pct_depth: None`, no `two_pct_depth_status`, and no `depth_50bps` block — so
the rungs exist and the crossing is never computed. On our side the three render as no depth figure,
no band, and an unrated axis.

⚠️ **The CAUSE is our inference, not a measurement.** We can see the rungs in one file and not the
other; we have NOT read whichever analyzer writes those three `_backing.json` files, and we are not
asserting where the gap is. Please locate it rather than take our framing — a wrong explanation is
worse than a wrong number, because it closes the question.

## 2. Why msUSD is the one to do first

Impact-basis ladders, your own `slippage_bps`, signed:

```
syrupUSDT    $1,000 0.0   $100K -0.4   $500K -2.0   $1M -4.0     -> 0.5% depth is a FLOOR at >=$1M
OUSD         $1,000 0.0   $10K -0.6    $50K -1.2    $100K -2.2   -> FLOOR at >=$100K
msUSD        $1,000 0.0   $10K -12.6   $50K -74.2   $100K -158.6 -> 0.5% crossing BRACKETED [$10K, $50K]
```

msUSD cannot sell $50,000 inside half a percent. Our page currently says nothing at all about its
liquidity, which reads as "no concern found" rather than "not measured". The other two are
comfortable and their absence costs a reader little; this one is the reason the dispatch exists.

## 3. Three assets with no config entry

`asset_config_usd.json` has no entry we could find for:

```
thUSD (Theo)         Ethereum + Arbitrum + Stable    both chains are KyberSwap-covered
cUSD (Cap)           Ethereum                        covered. NOTE: distinct from the cUSDC entry
                                                     already in the config
USDD                 Tron + Ethereum + BNB Chain     only the Ethereum leg is covered by
                                                     KYBERSWAP_CHAINS; Tron and BNB are not
```

If you want them laddered, the per-asset cost is the three fields you already use
(`token_address`, `decimals`, `sell_into`) plus the flag. **We are not supplying the addresses** —
they are not in our repo, and a token address guessed by a renderer is exactly the class of fact
that should come from the producer that can verify it on-chain.

USDD is a partial: an Ethereum-leg ladder would be honest only if labelled as one leg, since most of
its supply is not on a covered chain. Your call whether that is worth publishing or misleading.

## 4. What we are NOT asking for

- **No `as_of` bump** anywhere. If a ladder is already stamped, leave the stamp alone.
- **No new threshold work.** The 50 bps blocks you shipped this week are what we wanted and they are
  rendering; this is only about assets that have no block at all.
- **No schema change.** The three stranded assets need the shape you already publish for the other
  15, nothing new.

## 5. How we would verify it landed

A `depth_50bps` block (or `total_2pct_depth` + status + bracket) appearing in
`syrupusdt_backing.json`, `ousd_backing.json` and `msusd_metronome_backing.json` under
`liquidity`. Our side needs no change — the renderer already serves 15 assets off that shape, so the
dashboards light up on the next sync with no code from us.

⚠️ The check that would have caught this earlier, for whoever adds the next asset: a ladder
measuring successfully in the tracker log is **not** evidence that any dashboard can see it. The two
files are written by different code paths and only one of them is synced.
