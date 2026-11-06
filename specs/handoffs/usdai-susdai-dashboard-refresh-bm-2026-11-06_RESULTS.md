# USDai / sUSDai dashboard review and repairs — November6

Initial review state, before the user's subsequent commit/push authorization: implemented locally; live HTTP checks showed the earlier renderer and06:46UTC feeds. Desktop/mobile visual acceptance is **blocked**: CUA inventory returned no browsers; no screenshot or visual pass is claimed. Static/unit checks pass, but this is not a claim of fully verified rendered conformance.

The user subsequently authorized commit and push. Scoped publication carries the renderer, transport, targeted tests and these review artifacts; normal data outputs were already included by the existing backing sync. Renderer checks also pass against the committed shared common renderer, avoiding a dependency on unrelated local shared-renderer edits. Post-push served-hash verification is recorded separately from the initial review artifacts.

## What was wrong and repaired

- The bespoke renderer hid all six canonical axis sections and appended its own page beneath them. It now places content inside the existing axes, preserves standard dependency/code/issuer panels and their source clocks, and provides six-axis navigation. Family accounting lives in a labelled disclosure under Backing; authority observations live under Contract & Admin.
- Liquidity now uses the existing common consumer, retaining the complete published ladder,50bps floor/bracket, primary-route scope, venue inventory and provenance. Removed unsupported hard-coded “no CEX”, “thin approaching$500k” and blanket upgrade “exit window” claims.
- Peg/NAV tracking remains **Arbitrum**, per user confirmation. USDai has market-price history against$1; sUSDai retains the price/redemption/deposit band chart. Signed price-vs-reference is derived from the displayed named reference, separately from unsigned band-distance/rating inputs.
- PegTracker fixed the normal signed-band emitter and conflicting ladder prose. The reviewed06:46Z sUSDai premium/discount was negative0.038890%, previously incorrectly positive as an unsigned magnitude. Historical magnitude was retained; no fabricated signed backfill. BM selected the next normal hourly observation,07:46Z, rather than restamping the reviewed earlier observation.
- Backing displays source/review dates separately. sUSDai now visibly distinguishes implied credit/accounting from missing loan-quality/payment verification. Reported loan marks are not independently recoverable principal; escrow is not free redemption cash. No synthetic100% sUSDai collateral history is created.
- Supporting methodology, historical model and family detail are retained intact in labelled disclosures. Material warnings, unresolved primary eligibility/capacity and authority reach remain visible. Missing family data no longer synthesizes48h/3of3 or a “Fresh” API claim.
- Current family scheduled-operation target/earliest execution remain visible; neither purpose/execution nor a sufficient holder exit window is inferred. Separate dated code/audit review remains intact.

## Significant-chain liquidity, source-owned

DexTracker's normal public-safe `chain-exit-observations/1` outputs drive display recommendations. No hard-coded TVL threshold or chain research snapshot is embedded in renderer code.

| Asset | Primary displayed liquidity chains | Qualified context |
|---|---|---|
| USDai | Arbitrum | Plasma venue inventory exists, but quote output turns over severely; Ethereum indexer identity mismatch and no-route observations remain unknown, not zero liquidity. |
| sUSDai | Ethereum and Arbitrum | Plasma has smaller/incomplete route evidence;100k observed clearing sample is not a capacity limit. |

Arbitrum and Ethereum sUSDai significant routes have **coarse2.5m–10m sample intervals**, not refined50bps crossings. Preserve `precision_established=false`, interior unknowns and observed-sample/floor wording. Plasma pool TVL is not cash-exit capacity. No cross-chain depth sum, guaranteed minimum, expiry, execution or primary-redemption availability inferred. Denomination uses its original dated Arbitrum NAV source; this does not prove remote redemption rights/value.

Normal venue inventory remains `liquidity/1` inventory-only. The shared merge was explicitly tested to preserve PegTracker's existing depth when adding this disjoint inventory. The new separate chain sidecar does not replace Arbitrum peg/NAV or the existing finer Arbitrum ladder. Added `_chain_liquidity` to the existing transport suffix list; no schedule changes or separate recurring job.

## Freshness and backing/payment limits

Selected normal backing/family observation: **2026-11-06T07:46:07Z**, Arbitrum block **521727331**. Issuer API `updated_at`, each quote receipt/provider clock and authored-grade/review clocks remain separate in their source fields. Earlier reviewed API clock was06:29:59Z, backing06:46:03Z; those remain historical facts, not currentized by copying.

USDai supply denominator covers the producer's declared Arbitrum/Base/Ethereum/Plasma set, explicitly named on the page. This is not a claim of verification for every potential new deployment. Market scalar feed still lacks an independent upstream timestamp; the page declares that absence rather than treating file time as a fresh trade.

**Aggregate accounting is current; independently verified credit/payment evidence is not established.** Current aggregate feeds do not supply a reconciled current per-loan principal/arrears/impairment ledger, scheduled-versus-settled payment receipts, funded loan-specific DSRA, current independent GPU recoverability/valuation or enforceable recovery coverage. Those remain explicit gaps, not newly measured defaults/losses. NAV changes and residual `implied_deployed_loans` do not fill them. Do not count planned sCHIP protection, policy votes, GLX listings or announced CHR support as funded and settled evidence.

Contract/code overlays remain dated September9; dependency overlay October1; original issuer overlay September10, with separate November4 structured documentary adoption. Documentary work does not refresh measurement or authored judgments. No grade was authored or intentionally changed. A current family implementation getter does not recertify the old audited implementation or full authority graph.

RiskAnalyst was notified of the loan-data gap and located contradictory legacy wording calling loan-level diligence optional because aggregates “cover backing.” It has corrected that wording in its own repository; no sibling files were changed by BM. No completed new financial/payment package was supplied during this review, and no duplicate collection/job was commissioned.

## Producer coordination and evidence

Owner request: `specs/handoffs/usdai-susdai-dashboard-refresh-owners-2026-11-06.md`.

- PegTracker: `specs/handoffs/usdai-susdai-market-metadata-return-2026-11-06.md`, correction receipt in `audits/usdai-market-metadata-2026-11-06/`.76 owner tests pass. Only producer-owned metadata was corrected in the reviewed observation; later normal measurement kept its original timestamp. No history rewrite, job or producer publication requested.
- DexTracker: source-frozen handback/manifest in `data/exit_evidence/usdai-family/2026-11-06/`.19 source-file hashes and four normal output hashes verified;58 owner tests pass. Four normal public-safe files adopted. Local filesystem paths were excluded before adoption; no private holdings or simulations are published.
- BM adoption receipts and before/current-served comparisons: `specs/reviews/usdai-dashboard-2026-11-06/{adopted-feeds,served-before,served-after-check,verification}.json`.

Validation: `node tests/test_usdai_renderer.js`, JavaScript syntax, shell syntax and whitespace checks pass. Tests cover axis placement and preservation of owner panels, inventory-vs-depth ownership, signed comparison, true unknowns, no fictional sUSDai ratio/history, price chart$1 reference, primary/credit gaps, chain recommendations/quote limitations and scheduled-operation visibility. Eleven adopted normal feed hashes match the receipt. Browser/visual checks remain blocked as stated above.

Changed paths: `js/renderers/usdai.js`, `sync_and_push.sh`, `tests/test_usdai_renderer.js`, `data/{usdai,susdai}_{backing,backing_history,liquidity,chain_liquidity}.json`, `data/usdai_family.json`, and this task's handoff/review artifacts. Existing other dirty files remain untouched. No onchain actions, signatures, approvals, transfers, new monitoring jobs, score changes or production deployment by BM.
