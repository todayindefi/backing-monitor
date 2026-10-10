---
target_repo: PegTracker (~/PegTracker)
target_claude: pegtracker
status: completed
from: backing-monitor
to: codex
date: 2026-10-10
output: data/wsteth_backing_history.json
result_commit: c5708da2a9827e530b13eb727f4444cd5eace600
---

# Canonical wstETH: retain wrapper coverage history

The staged canonical-Ethereum dashboard has a live wrapper reconciliation but a blank collateral-
ratio history panel. This is an output gap: `wsteth_backing_analyzer.py` emits the current
`backing.coverage_pct` and peg history, but no `wsteth_backing_history.json`.

## Required producer change

1. After a successful canonical same-block reconciliation, call the shared
   `backing_history_writer.append_backing_history` with:
   - asset name `wstETH` and slug `wsteth`;
   - `backing.coverage_pct` in `percent` scale;
   - the canonical backing measurement timestamp, not process wall-clock time;
   - chain `ethereum`;
   - block number, wrapper stETH balance, represented stETH claim, wrapper supply and
     `stETHPerToken` as extra fields;
   - a basis note naming the same-block wrapper formula;
   - a coverage note stating that retention begins with the first preserved observation and does
     not imply earlier history.
2. Export `data/wsteth_backing_history.json` and add it to the wstETH runner freshness/JSON checks.
3. Keep this series canonical Ethereum only. Do not mix CCIP pools, Monad supply or bridge coverage
   into the wrapper ratio.
4. Add tests for percent scale, timestamp/block provenance, canonical-only fields, idempotent hourly
   append behaviour and the runner's required-output list.

## Honest initial seed

backing-monitor git retains 17 hourly `data/wsteth_backing.json` snapshots on 2026-10-10, beginning
at commit `1b01f95dc` and continuing through `17b0abcf7`. Each is a real measured snapshot. These
may seed the initial export by extracting only their recorded canonical backing timestamp, block and
wrapper reconciliation fields. Do not interpolate, duplicate points, or claim coverage before the
first retained snapshot. Record the seed provenance in `history_coverage`.

## Dashboard contract

The dashboard already syncs the `_backing_history` suffix and already maps `coverage_pct` to the
common collateral-ratio schema. It will clip this series to the same trailing seven-day cutoff as
the peg chart. A daily/sparse series remains 7d; neither chart may widen independently to 30d.

## Acceptance

- producer tests pass;
- a normal analyzer run updates all three wstETH artifacts: backing, peg history and backing history;
- every exported row has `collateral_ratio_scale: "percent"` and canonical Ethereum provenance;
- the earliest point is no older than the first retained measured snapshot;
- backing-monitor sync receives the file and its staged page shows peg and coverage over one 7d
  horizon.
