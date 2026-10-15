# DOLA local preview review — October 14

Local route: `http://127.0.0.1:8766/?asset=dola`.
Review copy: `/tmp/dola-dashboard-preview`. Rebuild with
`PYTHONDONTWRITEBYTECODE=1 python3 tools/prepare_dola_preview.py` and serve it using
the command in that script's docstring. This copy includes pending editorial feeds;
it is not an automatic sync source. The actual asset registry remains unchanged.

## Producer reconciliation

Read riskAnalyst's `specs/handoffs/DOLA-riskanalyst-reconciliation-return-2026-10-14.md`.
The refreshed pending overlays acknowledge the committed authority walk and
include Frax custodian, Sky LitePSM and Circle settlement exit dependencies.
The five envelopes still declare `publication_status: pending_approval`.
Source notes preserve historical input clocks and the three unresolved authority
observations. The written DOLA report is already published; dashboard state is separate.

## Consumer changes

- DOLA detail presents supply definitions, per-market debt, LP components in token
  units, junior capital/eligibility and PSM simulation. Independent coverage stays
  null; primary PSM reserve assets are distinct from opposite-direction DOLA inventory.
- The shared summary now reads the same depth bracket as the axis body. DOLA's
  primary-exit state is adapted from its measured PSM block rather than described
  as undeclared. Depth bands remain measured secondary-market bands, distinct
  from the written report's combined exit score.
- Structured dependency metrics render their values, denominator and clocks;
  they no longer stringify to `[object Object]`. DOLA's generated downstream array
  is adapted to the legacy reader contract, showing its tracked sDOLA dependency.
- Per-path authority rendering honors `execution_delay` before legacy `timelock`.
  The direct mint path displays 2d, bounded operational paths display no delay,
  and missing path delay remains unmeasured rather than immediate.
- Standalone exit provenance retains its producer and filename when merged with
  venue inventory. The displayed ladder is not attributed to the base backing file.
- The peg chart breaks across producer-declared coverage gaps, including the
  historical 14-month gap. Actual observations retain their original values and
  dates; no prices are interpolated through the gap.
- Source labels wrap on narrow screens; market breakdowns and extended methods
  use disclosures while unresolved coverage and pending junior activation remain visible.

## Validation

`node tests/test_dola_renderer.js`, syntax checks for the three edited JavaScript
files and `git diff --check` passed. riskAnalyst's reconciled feed and consumer tests
also passed against this repository's shared renderer.

Real Chromium review at 1440px and 390px used `tools/visible_text_check.js` and
measured visible axis boxes. All six sections have nonzero dimensions. The
secondary exit summary shows $3.5M–$3.6M, PSM reserves show 0 USDS versus 200,000
DOLA inventory, LP components retain token denominations, and pending junior
markets remain visible. No page overflow or uncaught JavaScript error occurred.
The canonical Ethereum registry scope emits four Ethereum authority layers;
the unscoped producer source has five, including separately qualified Fantom.

Browser failure cases passed: missing base feed shows staged pending instead of
a load failure; missing detail shows accounting unavailable and PSM not integrated;
missing ladder removes the measured depth/healthy band rather than retaining a
fabricated exit figure.

Temporary browser evidence: `/tmp/dola-integration-review/browser-desktop.json`,
`browser-mobile.json`, `desktop.png` and `mobile.png`. These are local preview checks,
not deployed verification. The preview serves frozen copies of producer snapshots;
rebuild it to pick up subsequent source refreshes.

## Remaining publication work

The sparse-history review additionally switches DOLA's chart to the producer's
recent hourly `observations` array, explicitly excluding unattributed 2025 daily
archive points. The chart labels the observed count/start and uses hourly ticks.
Browser inspection confirms two October 14 points and no 2025 archive in that plot.
This changes chart presentation only; backing coverage remains unresolved/null.

Review the concrete preview and approve pending-overlay promotion and the unlisted
dashboard deployment through the existing publication workflow. Then register
DOLA with the reviewed scope/ladder/report metadata, confirm source sync and the
emitter, deploy and check the real route. TIDR can add its dashboard link after
the route and rendered data are verified. No commit, push, overlay promotion,
asset registration or deployment occurred in this preview pass.
