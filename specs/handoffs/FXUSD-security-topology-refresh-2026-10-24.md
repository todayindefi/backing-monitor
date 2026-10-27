# fxUSD authority topology refresh

User authorized dispatch October 24. Owner: security_analyst. Coordinator: backing-monitor. Use existing session; no further agents or production publication.

Refresh eligible `topology/assets/fxusd.yaml` against RiskAnalyst's October 24 internal report `/home/danger/riskAnalyst/assets/fxusd.md` and updated `data/axes/fxusd_contract_overlay.json`. Current committed topology and generated dashboard still observe September 22 and present revoked paths as active. Follow repository instructions and the eligible-store review/commit process. Own security_analyst only; do not edit backing-monitor, RiskAnalyst or tidresearch.

Verify and retain source evidence, not just report prose:

- Both collateral oracles' owner changed from Safe to the 72h timelock at block 26126801 (October 5); pendingOwner now zero. Check boundary/latest reads or reuse attributable retained verified evidence.
- WBTC pool revoked deployer EOA 0xa1d0027ca4c0cb79f9403d06a29470abc7b0a468 EMERGENCY_ROLE at block 26158898 (October 10), transaction 0x411a0c518e1f7ff73182081cf447c24fca08cf430eec9bc3db745249fc9dca17. Check hasRole and corresponding negative controls; distinguish historical and active paths.
- Main Safe 6-of-9 and emergency Safe 3-of-4 retain undelayed EMERGENCY_ROLE and oracle-pointer reach on both pools. Preserve these residual active paths; do not infer all oracle powers are delayed just because oracle owner moved.
- Verify upgrade/admin path, current timelock delay, roles, ownership and any implementation changes material to this narrow refresh. Preserve original observation dates for untouched layers, explicit unknowns and code-bound vs discretionary authority. Do not convert partial checks to a full new walk date.
- Correct old walk notes claiming pending ownership never executed or deployer never revoked. Preserve dated history where useful. Shared fxSAVE authority evidence may be reused only with explicit matching target/scope; report whether its topology also needs a source update, without broadening this task silently.

No scores are authored here. Structural5 and Overall5 are RiskAnalyst's judgments; public audit matching for the later Ethereum pool rework remains unresolved. Return eligible committed source path and commit, evidence paths/blocks/times, review status, validator commands/results and remaining unknowns. Coordinator regenerates via `tools/emit_axis5.py` and verifies the rendered table; no hand edits to emitted JSON.
