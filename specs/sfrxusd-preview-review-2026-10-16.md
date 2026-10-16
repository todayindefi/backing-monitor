# sfrxUSD local dashboard review — October 16

Preview: `http://127.0.0.1:8767/?asset=sfrxusd`.
Rebuild with `PYTHONDONTWRITEBYTECODE=1 python3 tools/prepare_sfrxusd_preview.py`.
The script copies ten candidate feeds into `/tmp/sfrxusd-dashboard-preview` and
registers the view only in that temporary copy, and emits the eligible authority
feed from its committed producer source. The live `data/assets.json` and
producer source files are unchanged. This is a frozen local review, not an
unlisted deployment or a new publishing source.

## Inputs and rendering

PegTracker supplies the base, backing history, peg history and USDC ladder from
`data/dashboard_pending/sfrxusd/`; DexTracker supplies its staged venue/ownership
feed. RiskAnalyst's five `data/axes_pending/sfrxusd_*.json` were introduced in
`91db036` and reconciled in `c62a967`. Dependencies is finalized at 4.0 in its
internal report, index and pending overlays; publication remains separately
pending. security_analyst's eligible topology was finalized in `6ec34a4` and
`0f68686`, with replay evidence and conservative inherited-input clocks.

All six sections render. Custom detail stays under its axis:

- Stability shows administered frxUSD/share PPS, a dated frxUSD/USD mark, USD
  market/reference values, configured 4.90% APY, formula totalAssets versus zero
  frxUSD held by the token, and actual parameter synchronization time.
- Backing shows dated issuer assets/net claims, 100.14212% issuer coverage,
  $54,115 surplus / 14.21bp, reconciliation and withdrawal constraints. Independent
  global coverage remains unestablished. Mixed liability marks and scrvUSD
  valuation differences remain explicit rather than replacing issuer coverage.
- Liquidity shows the $2.801M–$3M 50bp incremental-impact USDC bracket and size
  profile, distinct from the frxUSD primary payout and Curve/USDT diagnostic.
  Treasury LP ownership and nonmonotonic large-rung output are visible. Primary
  source/destination leg simulation is qualified as settlement untested. The
  view share bound and execution-simulation bound are shown separately.
- Dependencies shows the finalized authored 4.0, historical concentration basis,
  upstream links and scoped generated downstream. The public-report alignment
  requirement remains visible until its owner reconciles the external source.
- Contract combines authored code/audit evidence with seven eligible authority
  layers emitted from committed topology. The inherited Hop observation date
  conservatively limits the whole-source clock to October 15; the October 16
  commissioned block pins remain separately available. Messaging reach and
  auxiliary-minter scope retain their explicit unresolved states.
- Issuer retains the shared Frax judgment and its original evidence date.

Shared transport now preserves original ladder diagnostics/clocks alongside
adapted quotes. The loader honors the declared peg history even when the backing
history has a spot peg field; otherwise one backing sample could displace the
full price series. Chart reference-field selection supports the producer's
hourly `theoretical_price` without inventing a flat current reference.

## Validation

- `node tests/test_sfrxusd_renderer.js` passes: accounting identity, issuer versus
  independent ratio, reference units, null versus zero, escaped source text,
  separate settlements and retention of ladder/venue fields through merging.
- Existing `node tests/test_dola_renderer.js` and edited JS syntax checks pass.
- The producer's offline `validate_sfrxusd_finalization.py` rerun passes seven
  layers/ten paths, inherited clocks, retained RPC/header evidence, quorums and
  signer overlap. This does not claim a fresh live RPC reproduction. Its aggregate
  gate reports an unrelated pre-existing provenance failure, documented by the
  producer; candidate-specific schema/evidence validation passes.
- `check_feeds.py` run inside the preview reports **0 failures, 44 warnings across
  35 assets**. Warnings include inherited fleet gaps, new staged registration,
  partial embedded blocks and internal producer vocabulary in pending prose;
  overlays and browser checks address what the base-only checker cannot observe.
- Real Chromium checks at 1440px and 390px in actual body light/dark themes show
  six nonzero sections, no page overflow or uncaught JS errors. Expanded evidence
  also stays within page width. Price plotting contains 167 market and 167
  contemporaneous reference values, without a fabricated backing history trend.
- Browser negative cases pass: missing ladder removes the depth figure and
  declares unavailable quotes; missing base shows the staged pending state;
  missing custom detail declares unavailable accounting and primary-route data.
- `git diff --check` passes. Source candidate files were copied, not promoted.

Browser evidence: `/tmp/sfrxusd-{1440,390}-{light,dark}.json` and matching PNGs;
review script `/tmp/sfrxusd-browser-review.cjs`. These are temporary local evidence,
not deployed verification.

## Field coverage and remaining work

Decision-changing measurements, source clocks, incomplete coverage and adverse
states render in the default view. Detailed strategies, withdrawal limits,
liability offsets, quote profiles, simulation results and historical authority
roots use named disclosures. Raw integer encodings, low-level RPC arguments,
historical duplicate snapshots, provider internals and full pending-source
envelopes are deliberately left in source JSON rather than printed on the page.

Both requested followups are returned and integrated: RiskAnalyst's final
Dependencies decision/direct-LP custody correction and security_analyst's
eligible topology, retained evidence, source dates and documented Hop convention.
One external-owner action remains: [TIDResearch report alignment](handoffs/SFRXUSD-tidresearch-alignment-2026-10-16.md).
The source `src/content/reports/sfrxusd.md` still has Dependencies 4.5 and has not
adopted the direct-LP clarification. RiskAnalyst's promotion requirement explicitly
asks for that alignment before dashboard publication. Overall stays 4.5.

PegTracker/DexTracker production paths and all pending overlays still need their
reviewed activation before normal sync can serve them. After reconciled review
and dashboard publication approval under the existing explicit-publication rule,
register the reviewed scope/refs, activate those producer paths, regenerate Axis 5,
and verify the deployed route and scheduled freshness. No commit, push, source
promotion, live registration or deployment occurred in this preview pass.
