# Six-portfolio BM evidence and repair return — November 2, 2026

Partial evidence return. Dashboard repairs are implemented; the complete portfolio risk refresh remains open. No authored scores or assessment dates were changed. No trades, approvals, transfers or notifications were submitted.

## Measurements and scope

`evidence-register.json` preserves each selected input, SHA-256, public URL, independent source clocks, flags, scope and ordered producer candidates. Payload generation is not source freshness; a successful HTTP fetch is not semantic acceptance. History files remain source-produced. No synthetic data was added.

| Family | Routing / coverage | Current observation and limitation |
|---|---|---|
| usdc | untracked_in_BM | No standalone BM route. Fiat issuer and venue exposure must be reviewed separately. |
| usdt | untracked_in_BM | No standalone BM route; reserve quality is not established by its use as a debt or exit token. |
| usdt0 | untracked_in_BM | No standalone BM route; chain transport and issuer exposure remain separate. |
| pyusd | untracked_in_BM | No standalone BM route. Present as debt and upstream Saturn reserve exposure; no universal exit guarantee. |
| gho | review_artifacts_only · `specs/reviews/gho-dashboard-2026-10-30/` | No production registry entry. Existing GHO review package/renderer is staged; Ethereum review does not validate Monad or Plasma GSM exits. |
| ausd | untracked_in_BM | No standalone BM route; Agora issuer evidence required, not inferred from Mento holdings. |
| usdm | registered_published · `?asset=usdm` | Measured-leg all-Mento-debt denominator differs from local USDm supply. Stable-only and Monad ReserveV2-only caveats preserved; issuer/dependency observations are October 17, not today. |
| dusd-alto | registered_unlisted · `?asset=dusd-alto` | Address-bound unlisted route. Removed September composition, swap-count and pool concentration claims; permissioned module is not a verified holder exit. No fresh event enumeration supports replacement counts. |
| frxusd | registered_published · `?asset=frxusd` | Registered route plus separate independent verifier and executable-ladder overlay. Par-value reserve conventions and issuer-reported off-chain legs remain qualified. |
| crvusd | registered_published · `?asset=crvusd` | Registered route. LLAMMA collateral is not a holder redemption reserve; captured low-CR flag retained. |
| bold | registered_published · `?asset=bold` | Registered route. CDP book and holder DEX exit are separate scopes; no active backing thresholds breached is not a full safety conclusion. |
| susde | registered_published · `?asset=susde` | Registered route. Executable market price unavailable in current feed; on-chain NAV is separate. Do not substitute NAV for market price. Euler position collateral oracle and debt still need pair-specific validation. |
| usde | registered_published · `?asset=usde` | Registered route. Current executable market price unavailable. Backing source observation and global supply scopes remain distinct; rendered evidence retained. |
| syrupusdc | registered_published · `?asset=syrupusdc` | Registered Ethereum route. Free liquidity below 2%, zero delegate cover and unresolved GraphQL collateralization disagreement preserved. Ethereum pool evidence does not establish Monad bridged-share unwind. |
| syrupusdt | registered_published · `?asset=syrupusdt` | Registered Ethereum route. Low free liquidity and zero delegate cover retained. Plasma Aave unwind is a separate chain/market question. |
| reusd-re | registered_unlisted · `?asset=reusd-re` | Existing unlisted Re route found through registry data_source reusd_re. Issuer-set share-price calculator is not reserve verification. Fluid position address is not resolved by generic asset liquidity. |
| fxsave | preview_only · `previews/fxsave/` | Existing isolated preview at previews/fxsave/?asset=fxsave. Review-only matched exit observations; no automatic promotion to a production route or new authored scores. |
| fxusd | registered_unlisted · `?asset=fxusd` | Existing unlisted route. Cache token repaired. Underlying fxUSD ladder alone does not establish fxSAVE/Morpho unwind. |
| scrvusd | registered_published · `?asset=scrvusd` | Registered route. Parent crvUSD price and ERC-4626 conversion clocks retained; two-step redemption and parent solvency distinct. |
| srusdat | untracked_in_BM | Only an issuer input found; no standalone backing/liquidity dashboard. Monad PT-srUSDat is not established by Ethereum sUSDat. |
| susdat | registered_published · `?asset=susdat` | Registry and headline corrected; explicit STRCon disclosure versus oracle-implied STRC producer disagreement. Buffer approximately 1.41%, implementation drift and discount warnings preserved; custody not verified. |
| usdat | registered_published · `?asset=usdat` | Ethereum producer measures PYUSDx unit holdings at par. Registry and obsolete $M-only methodology repaired; upstream PYUSD reserves and eligibility remain separate. No global coverage inference. |
| apyusd | registered_published · `?asset=apyusd` | Accountable attestation November 1 09:59:07Z is stale despite November 2 generation. Wrapper 100% is definitional. Visible dated source warning, current age, gross/netted ratio and current maintainer quorum added; discount flag preserved. |
| apxusd | registered_published · `?asset=apxusd` | 101.9496% attested netted ratio reconciles to 101.94965%; gross coverage is approximately 100.99047%. Netted denominator $145.23M. No ratio overwrite or reserve-loss conclusion. |
| gusdc | untracked_in_BM | No standalone BM route. Venue deployment, strategy and withdrawal evidence needed from position/protocol owners. |
| tidmm | untracked_in_BM | No standalone BM route. Private ownership/deployment and share-NAV reconciliation required; investor receipts must not be added to the same deployment capital. |

## Repair acceptance

Changed consumers: `js/renderers/apyx.js`, `js/renderers/saturn.js`, `css/portfolio-refresh.css`, `index.html` cache tokens. Static metadata: `data/assets.json`. The shared frontend changes already present at task start are excluded from the release candidate.

Apyx invariant tests cover source-clock aging independent of generation, missing source clocks, netted/gross reconciliation, disagreement and quorum fallback. Feed suite: 0 failures, 46 warnings across 36 assets after repairing the pre-existing fxUSD/fxSAVE cache tokens. Warnings are retained in the check logs and are not counted as passed measurements.

Local browser triage covers all 16 registered families at 1280px and 390px. No JavaScript page errors were observed; pre-existing mobile overflow remains on several other families (see local-browser.json). The repaired five routes have a separate clean committed-tree release candidate and served checks, recorded in release-browser.json / served-browser.json. Screenshots, text and hashes are retained beside those manifests. Only an explicitly recorded served pass constitutes publication acceptance.

## Source-owner work still required

PT exact identity and captured-size quote evidence, gross leveraged legs and address-joined lending/oracle observations are retained locally under `.private-reviews/six-portfolio-refresh-2026-11-02/`. They contain holdings and unsigned call data and are intentionally excluded from the public repository. These are not revalidated balances or transaction instructions.

FarmTracker: confirm current ownership, held PT balance and all token/strategy roles; reconcile fGHO/Boros, confidential USDT, TIDAVAY, TIDMM/Lagoon shares and receipt residuals. PendleTracker: preserve full quoted amounts, fees, token outputs and quote clocks, not only absolute price impact. PT settlement is PT → SY → apyUSD; apyUSD → apxUSD cooldown/fee/eligibility remains a separately verified step, and apxUSD → USDC another exit. No February rollover assumed.

LendingMarketTracker/FarmTracker: market collateral configuration, oracle live values/update times, LLTV/liquidation parameters, caps, cash availability and debt-side prices are not established by generic HF snapshots or an oracle status of ok. Aave pool-address joins yield several reserves and require debt/collateral token selection. Fluid reUSD/GHO exact address join returned no market; do not substitute a similarly named GHO market. Actual-size atomic unwind remains unavailable for these loops.

PegTracker: replace obsolete Apyx hardcoded basis examples and reconcile sUSDat STRCon holdings/oracle/custody model with current implementation. DexTracker/PegTracker: held-size, chain-specific unwind quote obligations remain open. Existing feed failures and unavailable states must survive any refresh.

Stake DAO/Mento LPs, K3/RockawayX/Felix/Gauntlet strategies, gUSDC, Lighter LLP, Flowdesk confidential USDT, TIDMM/Lagoon and TIDAVAY have no validated strategy-level BM exit packet from this work. Native/dust rows are not given new dashboards. These are explicit coverage gaps, not completed risk reviews.

## Primary disclosure references

- Saturn issuer: https://saturn.credit/ (PYUSDx/PYUSD and Ondo STRCon descriptions fetched November 2).
- Saturn public metrics: https://app.saturn.credit/insights/saturn-protocol (issuer-reported, not independent custody verification).
- Apyx FAQ: https://docs.apyx.fi/resources/faq (documents approximately 30-day unlock; live queue and fees remain separate contract checks).
- Pendle API identity and route observations use the existing PendleTracker client and documented core endpoints. Quote time and on-chain identity block are retained in the private packet.
