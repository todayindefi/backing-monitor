# Shared frxUSD evidence acceptance — November3,2026

BM owns one DeFiLlama adapter alongside the existing independent verifier. No issuer/verifier producer contract is overwritten, no duplicate monitor/schedule is added, and no riskAnalyst/TIDR repository is edited. Consumer adoption remains a handoff/return gate.

## Endpoint investigation

The supplied review could not establish an API. This pass inspected DeFiLlama's public frontend build manifest and found `/api/public/verified/[slug]`. `https://defillama.com/api/public/verified/frxusd` returned200/application-json with the expected projectId/state/data payload. This is now primary; the general API documentation did not expose a documented/versioned verification route. Embedded Next.js data is only a validated fallback on primary request failure. Successful-but-malformed/stale API responses do not quietly fall back.

The upstream frontend source `/_next/static/chunks/2wuc4gm6a1r60.js` explicitly describes Fraxtal bridge-locked units as already left out of the Ethereum figure. The adapter never subtracts them again. Original chain identifiers and normalized aliases remain available. Supplied fixture totals, all ten quantities/addresses, per-position clocks,30-chain sum, par/market coverage and68.56% WTGXX concentration pass parity tests. New live API captures may differ from the handoff fixture; they retain their own bytes, source-run/row clocks and retrieval clocks rather than being forced to old figures.

## Export and behavior

See `specs/frxusd-shared-evidence-contract.md`: mutable latest pointer, content-addressed immutable JSON bodies and gzip-retained original source documents. The SHA256 basis is exact snapshot bytes; source-document hashes cover uncompressed original bytes. All three consumers share the exact snapshot and producer formulas. Reports freeze a snapshot; live widgets disclose clocks/health. Prospective history references actual source-run captures/revisions, not fabricated historical coverage.

The three classes remain `issuer_reported`, `independently_measured`, `third_party_verified`. DeFiLlama's BitGo/Erebor claims do not become a BM audit, beneficial-ownership proof, unlimited FDIC protection or independently complete liabilities. Our independent global coverage remains withheld. frxUSD upstream evidence does not verify sfrxUSD strategy backing/PPS/redemption. No scores change.

Tests:10 adapter tests plus4 existing-verifier tests passed; UI unit checks cover producer metrics, claim separation, hashes, last-good and escaping. Desktop1280/mobile390 and missing pointer, hash mismatch, stale observation and last-good views passed locally. Publication checks and screenshots are retained in `served-acceptance.json`.

## Consumer integration gate

Forward `specs/handoffs/frxusd-shared-evidence-consumer-adoption-2026-11-03.md` to riskAnalyst and TIDR. It requests the adopted snapshot ID/hash, displayed bases/clocks and failure-state checks. BM waits for their parity returns; it does not edit their reports or add their scrapers. An API/schema or freshness failure retains the prior immutable snapshot with visible degraded last-good health; without one it is unavailable.
