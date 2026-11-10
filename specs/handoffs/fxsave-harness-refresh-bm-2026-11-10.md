# fxSAVE — first held-asset shared-handoff refresh

User authorized selecting an asset by assessment/evidence staleness and holdings after committing the shared harness setup. Selected exact Ethereum fxSAVE `0x7743e50f534a7f9f1791dde7dcd89f7783eefc39`. Account-level selection and position data remain private; no holdings amounts belong in report/dashboard output.

Why this asset: material indexed held collateral, full RiskAnalyst verification September 22, October 21 concentration-review trigger and a retained October 26 BM preview. BOLD is older but lower indexed held exposure; larger Syrup exposure received substantive October 31/November 7 checks. This is a qualitative priority choice, not a portfolio allocation recommendation or a stale-date-only risk ranking.

Important source correction: PegTracker's current normal route is `data/fxsave/`, with a successful November 10 observation. The October 26 files in `data/dashboard_pending/fxsave/` are obsolete candidates, not evidence the scheduler failed. BM's `tools/prepare_fxsave_preview.py` still selects that pending directory and a frozen editorial commit. Refresh the consumer binding only after accepting the new owner packet; never relabel the old snapshot current.

## Scope and existing-owner workflow

- PegTracker: freeze current existing normal public evidence, share/fxSP custody reconciliation, queue, two payout legs and Morpho aggregate concentration. Distinguish observation, assembly and read-only simulation clocks; pause-state coverage remains bounded. No duplicate collector or new job.
- DexTracker: reuse current direct fxSAVE→USDC and downstream fxUSD→USDC measurements at existing standard sizes, retaining quote clocks, baseline/crossings, fee/gas limits and failures. A quote or preview is not complete executed cash settlement.
- BM: freeze and hash-verify owner returns, compare exact identity, payout units and custody/accounting; preserve historical evidence and nulls. Prepare the existing preview's source integration only after review; no production registration or silent promotion.
- RiskAnalyst: review six-axis deltas against October 21/26 and shared October 24 authority work, retaining or authoring judgments through its normal process. Request bounded DA/Security deltas only where existing current evidence cannot close a material change. Do not import fxUSD controls wholesale onto fxSAVE.
- TIDR: after RiskAnalyst review, record report update required or reviewed—no change needed, with reasons, evidence/assessment versions and original dates. Dashboard and report may retain different dated evidence versions if explicitly disclosed. No production publication is authorized here.

Financial distinctions: fxSAVE holds fxSP; fxSP pays fxUSD **and** USDC. Do not treat fxSP as fxUSD, omit a payout leg, double-count the direct USDC leg or add instant fees twice. Keep wrapper redemption, queue, underlying conversion and final cash swap separate. Private holdings were used for prioritization only, not permission for wallet transactions or private simulations.

Real harness intake is stored privately under `.private-reviews/fxsave-refresh-2026-11-10/v1/`. Its retained baseline is explicitly historical. Shared checker returned expected exit **2 WAIT**, with exact token/hash/structure checks passing and current evidence, assessment and report/dashboard acceptance pending. This is a request acceptance, not a completed refresh.

Dispatches accepted by the existing PegTracker, DexTracker, RiskAnalyst and TIDR sessions. No new collector, job, schedule, transaction or publication requested. Harness setup commit: `da20faa3c8` in backing-monitor; it is not a cross-repository source commit.
