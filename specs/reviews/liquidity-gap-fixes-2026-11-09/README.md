# Liquidity evidence and mobile gap repairs — November 9

The first bounded repair closes evidence loss and misleading cost/clock descriptions in existing USDai/sUSDai and USDat/srUSDat outputs, and fixes the five mobile layout failures found in the fleet audit. It does not migrate old baselines or claim complete execution/cash exits.

## Changes

PegTracker source commit `22f3e6580dd594a9de455d73cb47810526806ad4` preserves every raw Saturn quote field through the normal compact projection, including gas, token output and error rows. Only these callers' cost descriptions now explicitly name total output cost against notional, including standing spread, before gas. Other callers retain their existing convention; numeric threshold/quote values are not reinterpreted by BM.

The normal projection declares provider generation separately from collector request/completion. Known USDai/sUSDai `quoted_at` completion clocks are retained as completion, never relabelled provider generation. Historical missing clocks remain null. BM consumes those producer fields directly and exposes restored gas/token output and failed rows. Gas is not deducted from output by the consumer.

Saturn's bespoke renderer bypassed the common liquidity panel. Its old four-size list hid three current USDat observations and its `out` lookup missed the published `output_usd`. It now shows every supplied size, reads the supported USD-mark output field, preserves failures, and colors signed costs by magnitude. Complete source provenance is reachable in the actual visible Saturn section. Issuer, tranche/queue/transport/settlement distinctions, authored assessments and oracle/HF explanations are preserved.

A scroll wrapper around the shared backing table and four unwrapped USG tables keeps content accessible without widening the document. Chart labels, report links and Hastra's capacity/attestation badges wrap at narrow widths. No body-level overflow hiding or removal of content. Wrappers have keyboard focus and labelled region semantics; wide tables remain horizontally scrollable.

## Source versions and clocks

Historical metadata-only replay was independently checked against its own frozen before/after version: 18 file hashes, six committed implementation bindings, every existing numeric/bool/null/clock/status/error leaf, exact raw tiers and non-liquidity core. This verifies repair semantics, not a reason to publish old measurements.

Scheduled producers had advanced. BM instead accepted the newer existing v2 normals without replay/collection, independently checking six manifest files, four source-commit bindings and lossless raw-to-compact fields. Manifest `71bad5961cd8ceb5d81bbad8a2b74e02fbcc11482ff24892eb8785505914953d`. Exact normal hashes and previous/current clocks are in `producer-acceptance.json`.

- USDai/sUSDai observations: **2026-11-09 09:46:10 UTC**. Retained successful collector completion clocks **09:45:28–35 UTC**; provider generation unknown. sUSDai retains four HTTP429 failed rungs.
- USDat/srUSDat observations: **2026-11-09 09:44:19 UTC**. Historical per-draw provider/request/completion clocks remain unknown; section assembly time is not quote generation.

Working-tree producer source bytes match the scoped commit. Normal payloads do not embed an executed build SHA, so exact runtime commit attribution is not asserted. The source commit is not pushed per owner. Raw packets are privately frozen and excluded from public surfaces; no private holdings or simulations were introduced.

## Verification and remaining gaps

Local containment checks cover all five previously overflowing pages at **320, 390, 768 and 1440px**, with no document overflow or body clipping, retained rows, labelled focusable wrappers and actual keyboard horizontal scrolling. Full local fleet regression covers 36 desktop and 13 selected mobile views. Targeted eight browser checks cover all four adopted outputs at desktop/mobile, source row counts, all-in descriptions, gas/token output, provider nulls, collector clocks and failed rows. Screenshots and local/served receipts are alongside.

Focused source/null/unit/clock/escaping tests, complete Saturn rung/failure/signed-cost tests, Saturn issuer/queue/oracle-HF/privacy tests, USDat accounting alert tests, Re ladder/metrics and Syrup regressions pass. Producer reports 122 focused tests; no full-suite pass is claimed (known unrelated producer failures were not rerun).

Still open: seven structured sources' legacy $100 references; unmeasured historical clocks, route access/expiry and independently repeated refinement/stability; receipt-token cash conversion, asynchronous queues, bridge delivery and complete settled cash paths. The selected failures remain failures. This repair changes no authored score/assessment files, recurring jobs, schedules or transactions. New routine observations are adopted as complete producer versions, not mixed with historical snapshots.
