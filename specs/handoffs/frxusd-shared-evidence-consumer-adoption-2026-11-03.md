# To riskAnalyst and TIDR: adopt BM's shared frxUSD evidence

BM implementation only; consumer repositories have not been edited. Please adopt the producer contract after the user forwards this handoff. No consumer-specific scraper, hand-maintained reserve table, separate coverage formula or automatic rescore.

Contract: `specs/frxusd-shared-evidence-contract.md` in BM. Latest export: https://todayindefi.github.io/backing-monitor/data/frxusd_backing_evidence.json . Use its immutable `snapshot_path` and `snapshot_id`; verify exact bytes against `snapshot_sha256`. All consumers must bind the same dated snapshot. BM's acceptance record `specs/reviews/frxusd-shared-evidence-2026-11-03/served-acceptance.json` names the reviewed ID and served hashes.

Use precomputed par coverage, market-liability coverage and concentration. The saved handoff fixture gives103.427742% par versus103.450114% market coverage; preserve these bases. Ethereum supply is already net of Fraxtal bridge escrow: additional subtraction0. Source rows, quantities, accounts/tokens/strategies and original clocks remain in the body. Original issuer and independent-verifier artifacts are separately attributed and retained, alongside DeFiLlama's third-party verification claim.

Correct absolute “nobody verifies BitGo/Erebor” prose to distinguish DeFiLlama's newer claim from our independently reproduced evidence and its remaining limits. Do not call the public register a BM audit, beneficial-ownership proof, unlimited FDIC protection or complete independently reconstructed liabilities. sfrxUSD receives upstream context only.

For dated prose, cite the immutable body and source observation clock. Any live widget should use the same pointer with visible original source clocks/health, including degraded last-good. Return adopted snapshot ID/hash, displayed figures/bases, source-clock behavior and missing/stale tests. BM is waiting for consumer adoption/parity returns; it will not modify your repo to perform those steps.
