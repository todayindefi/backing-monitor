# Settlement and unwind evidence return — November 2, 2026

Completed the next evidence pass requested by `six-portfolio-settlement-unwind-bm-2026-11-02.md`. Accepted identity maps, first-leg checks and scoped conditional replays were reused. No approvals, signatures, transactions, proposals, transfers, deployments, notifications or scheduled jobs were submitted. No scores changed.

The authoritative 14-position matrix and raw evidence remain in the gitignored private packet:

`.private-reviews/six-portfolio-refresh-2026-11-02/settlement-unwind/`

`RETURN.md` renders the findings; `settlement-unwind-matrix.json` retains original position IDs and the five requested categories: current-state measured, conditional simulation, unsupported, owner-or-issuer input and future-state check. Account identities, held sizes, return amounts and unsigned calldata are deliberately excluded from this tracked handback.

## Results and explicit blockers

| Scope | New evidence | Remaining obligation |
|---|---|---|
| Four Euler leveraged positions | Complete existing EVC/Swapper batches pass without state overrides. Ending debt, collateral-vault shares and debt-vault shares are zero; controller removed. Nested route input/output, recipient and minimum checked. | Safe-context simulation does not establish signatures or future execution. Original API max-minus-one repayment wrapper reverted `E_RepayTooMuch`; successful batches explicitly use the deployed max all-debt sentinel. Requote and recheck current state before any separately authorized action. |
| Morpho fxSAVE/USDC | Existing deployed flash-loan adapter/bundler route passes without state overrides; actual adapter authorization true; ending debt and collateral zero. | Small fxSP/fxUSD residuals are reported separately from USDC. No historical fork funding reused. Internal router approvals occur only ephemerally inside simulation; no user approval submitted. |
| Two Lagoon Aave loops | Actual-state full repayment and withdrawal-before-repayment fail; real debt cash and allowances captured; actual e-mode retained. | No complete funded, authorized chain-specific flash/unwind adapter established. Need deployed route and callback/operator authority, or an identified actual funding source. Addressbook search does not prove no adapter exists elsewhere. Provider rejects `validation:false`; no fabricated cash workaround. |
| Fluid NFT18170 / vault162 | Correct binding and min-int full-repayment convention retained; actual-state full operation reverts `FluidVaultError(31014)`. | Existing funded authenticated swap/flash route remains missing. Allowance alone does not supply debt cash. Dust borrowing conventions preserved; failure is not evidence of insolvency. |
| Apyx PT and cash readiness | Fresh held-size PT-to-USDC and PT-to-apyUSD quotes pass explicitly hypothetical allowance-only replay; real allowance remains zero. Postexpiry accounting and rounding retained. | November5 00:00UTC /08:00Taipei is maturity, not an established claim deadline. Final index/output and downstream settlement are future evidence. Illustrative downstream quotes are not complete future-balance simulations or net day3 cash. |
| Active Apyx receipt | All1,304 issued IDs enumerated at Ethereum block26,325,457 /06:59:47UTC;184 live receipts; aggregate face liabilities equal receipt-contract apxUSD balance. Three eligible claim samples pass; one locked claim correctly reverts. | Complete current liability snapshot is not independent apxUSD reserve proof, full historical destination audit or durable producer monitoring. Final primary redemption eligibility, jurisdiction, supported RFQ/contract, fees/cutoff/SLA remain issuer inputs; precise private question returned without contact. |
| Four StakeDAO books | All four whole-wrapper balances pass LP-to-selected-coin paths, with two coin options each. Personal Safe paths atomic; Delta EOA paths two ordered actions. | Stablecoin/share output is not fiat settlement. scrvUSD remains a yield share; retirement exclusion and later vote/execution are separate obligations. |
| Monad PT-srUSDat / Saturn | Accepted exact-unit previews and Strata LayerZero share link reused. | Direct Monad USDC, complete bridge/redemption/cash route and finalized Saturn CCIP migration remain separate unestablished dependencies. No demand for future migration completion today. |

## Source clocks and validation

Successful Euler batches are pinned to Ethereum blocks26,325,480 and26,325,482; Morpho to26,325,532. Independent Euler feed/getter supplements succeed at block26,325,482, including `maxStaleness`. Supplemental reads at26,325,480 returned HTTP403 on retry: the exact-block independent clock gap is explicit, and adjacent-block observations are not substituted. Successful actual-state batches do not establish future oracle freshness. Other route/oracle output clocks and any missing independent underlying update timestamps remain separately labelled.

Private `validate_evidence.py` passes assertions for five complete debt closes and eight selected-coin paths, including ending balances and embedded Euler swap minima/recipients. `validate_return.py` passes original-ID/category coverage, evidence references, clock success/unavailable states and SHA-256 manifest integrity.

PegTracker's existing Apyx source process still needs active receipt implementation/counter, liabilities/backing, claimability, mutable parameters and explicit source/history coverage integrated. This private snapshot does not install that monitor. Current dated dashboard producer-coverage warning remains applicable; no consumer deployment or blanket cash-exit assertion is made.

Lighter's supported sleeve export is accepted separately without LLP double-counting or renewed mandate attribution. Boros access restored; TIDAVAY excluded/parked; Flowdesk decryption deferred.
