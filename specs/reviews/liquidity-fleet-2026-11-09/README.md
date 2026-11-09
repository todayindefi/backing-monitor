# Liquidity dashboard fleet audit — November 9, 2026

The reUSD repair is the reference for source visibility and bounded conclusions, not a requirement that every asset have a conventional swap curve. Audited all 36 registered dashboard views against committed BM sources. Source snapshots were captured from the actual browser consumer after normal overlay resolution; `audit-before.json` records per-view counts, clocks and known gaps. `consumer-fixtures.json` retains only public consumer-contract fields for regression checks, excluding venue inventories and raw route attachments.

## Findings and repair

Eight views have structured `depth.rungs`: reUSD-RE, reUSDe-RE, syzUSD, USG, sUSDe, BOLD, DUSD-Alto and fxUSD. Three incorrectly displayed “No exit-mark RFQ ladder” despite published observations: syzUSD (12 rows), reUSDe (6) and Alto (5). Repeated sizes across chains, a non-dollar output leg and a supply-bounded quote-only status each defeated the old size-keyed adapter. Refusing an aggregate depth remains correct; hiding the underlying observations does not.

New source-preserving details render all seven additional structured sources, including failures and invalid rows, per-chain token units/identities, sizing anchors, reference size/spread, declared impact convention, native-token-only cost, source status and quote provenance. BOLD's bespoke section now uses the same details while retaining its existing primary-redemption and headline logic. The reUSD-specific implementation remains isolated and unchanged.

Eighteen additional views use legacy quote tables: crvUSD, syrupUSDC, syrupUSDT, apxUSD, apyUSD, USDat, srUSDat, USDai, sUSDai, USDe, USDS, sUSDS, thUSD, Hastra PRIME, yzUSD, wstETH, frxUSD and sfrxUSD. Their existing tables stay in place, with expandable per-observation provenance, failures, gates, gas and expiry fields where supplied. Missing clocks remain unknown. The expansion does not certify current grid, reference, threshold refinement, stability or cash settlement.

Ten views have no generic secondary quote ladder. STRC/STRCx/MSTR/BMNR are equity/preferred views; a DeFi swap ladder is not automatically applicable. USDm exposes a fixed-price venue/capacity constraint, not a conventional impact crossing. scrvUSD has separately timed primary redemption and underlying-route evidence. msUSD-Metronome has bespoke fixed-size evidence, not a measured crossing. OUSD, USDD and CUSD have no current sized quote evidence in the merged generic block (September authored observations remain dated). These categories must not be collapsed to “zero liquidity” or blanket “complete.”

## Explicit producer gaps

Seven structured sources still declare a legacy $100 reference: USG, sUSDe, syzUSD, reUSDe, BOLD, Alto and fxUSD. The consumer flags it; no new baseline, quotes, normalization, scores or schedules are invented. reUSDe's native sUSDe output is not valued in dollars. Alto quote-only, supply/float/access bounds remain. Legacy quote tables often omit independent per-draw clocks, route identity, current threshold/refinement and stability evidence. Inventory discovery does not establish measured chain coverage.

syzUSD's source had copied reUSD descriptions naming the wrong chains and output leg. DexTracker confirmed quote bindings and invalid-row arithmetic match the syzUSD configuration; text-only repair and receipt-token output assumptions were returned and adopted through normal sync. Exact SHA256 `d80eafadf6f0fd1b78ae67f128d1ba7448c5c61713796e75034bf97fd6419442`; three manifest files verified. Original quote arrays, per-chain results, anchor and quote/address metadata are unchanged. Monad csUSDC must not silently become cash USDC. Normal producer adoption requires a returned bounded source, not a consumer hard-coded correction.

The reUSD benchmark itself remains bounded: coarse Ethereum range, invalid Base preflight and a Solana floor with unlocated crossing. “Complete presentation of published evidence” is distinct from complete market coverage, current executable capacity or settled cash access.

## Acceptance checklist

For a swap ladder, display exact asset/chain/pair, notional versus input units, output units and valuation, reference size/spread, impact convention and sign, applicable primary/secondary thresholds, full configured observations including failures, separately dated refinement/stability evidence, bracket precision/floor/termination, quote-generation versus collection/block/slot clocks, route/access/gas/expiry limits and explicit inventory-only chains. Do not sum chain books. Do not substitute a 200bps result for missing 50bps evidence. Do not convert nulls to zeros.

For fixed-price, primary redemption or asynchronous wrapper exits, expose the actual capacity/gate/queue evidence and keep share transport/conversion, withdrawal request, settlement, bridge delivery and final cash sale separate. A quote or preview is not execution. A shorter ladder after a threshold crossing is not inherently incomplete.

No authored scores, accounting marks, source quote bytes, recurring jobs, schedules, wallet reads or transactions are changed by this consumer repair. Existing unrelated working-tree changes are excluded. Local and served browser receipts are recorded alongside. OUSD's pre-existing mobile backing-table overflow was reproduced on the previous release; evidence-panel checks are separate from unrelated whole-page layout defects.

## Owner inventory return

PegTracker's bounded existing-field return was accepted after verifying ten frozen file hashes against manifest `0446100ee6fe3dc80ce05cf2a76119d69758d38ec90d6aa121632ee12681bf03`. It confirms USDai/sUSDai `quoted_at` is collector completion; the consumer now separates this reported field from source quote timestamps and does not claim provider generation. It also identifies USDat raw-tier gas/failures omitted by its compact table, a separately pinned single-size srUSDat preview-plus-swap observation (not a USD ladder), older November4 Yuzu backing exports versus newer tracker observations, and an all-in-versus-impact description inconsistency. These remain bounded source/export gaps. No records from different ladders or clocks are stitched together to fill them. Private inventory inputs remain private; only this acceptance and aggregate findings are public.
