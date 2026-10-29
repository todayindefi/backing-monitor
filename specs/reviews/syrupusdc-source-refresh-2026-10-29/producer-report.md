# syrupUSDC source refresh — October 29, 2026

Producer-owned reconciliation completed locally with unresolved collateral/custody and bridge limits explicitly preserved. This is the evidence package for BM/riskAnalyst; it is not proof of downstream synchronization or public report publication. No automatic scores changed. No transactions, swaps, bridges, cron changes, BM/riskAnalyst edits, or external publication commands were performed.

## Common outputs, generations and hashes

The instrumented normal USDC producer generated 2026-10-29T01:48:44Z; the normal family publisher generated the first corrected family at 2026-10-29T01:49:04Z. The already-running ordinary scheduler subsequently produced USDC 2026-10-29T01:49:29Z, USDT 2026-10-29T01:50:29Z and family 2026-10-29T01:50:32Z. No scheduler was stopped or altered. `before/` remains the original capture; `after/` retains the instrumented backing/family, while its history already includes the subsequent normal row; `latest-normal/` retains the later standard common inputs. Each file's own clock is authoritative. Raw instrumented HTTP evidence pertains to the earlier run, not every request made by the separate scheduler.

Exact latest-normal delivery copies (paths below are standard producer outputs; immutable copies are in `data/reconciliation/syrupusdc-2026-10-29/latest-normal/`):

| Standard file | SHA-256 |
|---|---|
| `data/syrupusdc_backing.json` | `dafcac81879fcc6b738b4253825fa31713c97026dab033160eea8b1ed2f821ce` |
| `data/syrupusdc_backing_history.json` | `bcaec74878c6327713b66f012c4f39f57419c0af0f78f8cb661fcd214e45cf4f` |
| `data/syrupusdc_backing_last_good.json` | `201596b8ea7cdb522688d0042e03095f8da55767e790d0f7a799436a826c8e8a` |
| `data/syrupusdt_backing.json` | `cebb9fa992515c5d9c5f8eb561955dc2ca2893b655b400f692a5f9b6ad6031ba` |
| `data/syrup_family.json` | `1d437fd300b53841c92b85265338c1a6c83cbaecc010748673062466b8f5ff30` |

The USDT file is included because the normal family publisher consumes/promotes both siblings; its address review and zero-hook evidence were not transferred to USDC. The family's pool-generation clocks remain separate. Later routine generations may naturally supersede these hashes; use the frozen copies for this review.

## Versioned economic membership and denominators

`issuer_economic_usdc_v1_2026-10-29` replaces USDC's legacy asset/initial-level heuristic for new observations. `syrupusdc_position_review.json` contains exact reviewed loan/borrower pairs, required strategy metadata, issuer retrieval time/hash and metadata review time/hash. Each published row has category, source, review version/date, metadata observation time and assurance. Credit requires a reviewed issuer credit-table address and matching borrower; non-credit strategies require a reviewed exact address/borrower and current matching Maple `loanMeta.type`. New/mismatched addresses or strategy metadata remain unknown; an asset label alone never grants membership.

The issuer table's 24 exact loan links were matched to chain-enumerated borrowers. Its Treasury table discloses PYUSD custody `0xe7F0FdD40472775A659C3e42bda605A88642657b`; the loan mapping uses exact `tBills` metadata and the reviewed borrower. USTB and USDtb are also explicitly reviewed `tBills` addresses, although absent from the current visible Treasury allocation table; their category is address-specific metadata assurance, not independently established issuer allocation or custody. Six exact `amm` loans are DEX LP strategies. Their principal is not immediately withdrawable cash. A shared EOA balance is not a per-loan asset allocation and must not be summed repeatedly across positions.

| Denominator | Before | Corrected current |
|---|---:|---:|
| All enumerated active principal | $934,871,515.69 | $934,871,515.69 |
| Credit-classified principal | $898,721,510.69 | $898,721,505.69 |
| Non-credit strategy principal | $36,150,005.00 | $36,150,010.00 |
| Unknown principal | Not separately declared | $0.00 |

The sole membership change in the current 33-position snapshot is the $5 USDtb address from heuristic loan to non-credit Treasury strategy. There are now 24 credit positions and nine non-credit strategies. All raw principals, borrower addresses, rates and protocol status flags match the before snapshot; all-position principal still reconciles exactly to manager principalOut with zero residual. All-position concentration is labelled `all_enumerated_active_position_principal`; credit-only concentration is `classified_credit_principal`, with exact members/exclusions. Credit-only top-1 22.25%, top-3 53.97%, HHI 1388; borrower addresses are not independently identified firms.

Exact current membership (source C = issuer exact credit-loan link plus enumerated borrower; M = exact reviewed address/borrower plus current Maple metadata; full provenance is in the review JSON and backing rows):

| Loan address | Borrower | Principal USD | Old bucket → current category | Source |
|---|---|---:|---|---|
| `0x7f110947d89204D674C38eb0ed97F82CE5005fD6` | `0x09b845bbe555eaeE93D9Ed882964eE0371286B8a` | 200,000,000.00 | loan → credit | C |
| `0x3b7498a4226ea5e396cfD80a2983cf9CA17af7Dd` | `0x198aEC3c39578d5a08c3A4304B63aD65440c529A` | 115,000,000.00 | loan → credit | C |
| `0x0e8D86711f251b66a76B3366c5490D8b8a30Bb34` | `0x36929250627c61977490a3919833a1429ceBCa97` | 100,000,000.00 | loan → credit | C |
| `0xD2443e039C46A6360eBb2A70001a6CC2Db8831B9` | `0x198aEC3c39578d5a08c3A4304B63aD65440c529A` | 70,000,000.00 | loan → credit | C |
| `0x13841F8e11E896171FEc4Af87d6F8Fb8F2935772` | `0x8669F3189Ea2318d28C7183A971d65E0C352f1e9` | 55,003,266.13 | loan → credit | C |
| `0x0D7c66D08Cd2D36578eE8aacF5A9BbFeF2C67733` | `0x8669F3189Ea2318d28C7183A971d65E0C352f1e9` | 41,606,747.71 | loan → credit | C |
| `0x63ea10531e976A7890f7EaEF80F51dA5498f9287` | `0x24B12457d3a68ECa9Daca48F0628276592bEbCDD` | 33,500,000.00 | loan → credit | C |
| `0xBD331e5Fd515e3CE4bdaDCCBEfa0eebc05e2fb3f` | `0x24B12457d3a68ECa9Daca48F0628276592bEbCDD` | 33,500,000.00 | loan → credit | C |
| `0x7669d26440804FBc7Af8D8E660083e80176Ce9a5` | `0xB62446A8981E7AfC02094eac3140ffeCEA54D505` | 30,000,000.00 | loan → credit | C |
| `0x3ac7badB967dc12D5423a472B3bBfFf082903043` | `0x282B6ccaC8B7e062B73Bbf0369e8CEF9A895b30c` | 25,000,000.00 | loan → credit | C |
| `0x771312B001924D1ed1e33271f87F348201FA5c61` | `0x282B6ccaC8B7e062B73Bbf0369e8CEF9A895b30c` | 25,000,000.00 | loan → credit | C |
| `0x3414D94A1A9adF0C2b728259790e05A3dfecDED8` | `0x282B6ccaC8B7e062B73Bbf0369e8CEF9A895b30c` | 25,000,000.00 | loan → credit | C |
| `0x279318948929e0dfdc1ED0798178E6BB70CBFBDE` | `0xb99a2c4C1C4F1fc27150681B740396F6CE1cBcF5` | 25,000,000.00 | loan → credit | C |
| `0x3b44e1345D2e8F8948048828a803E25b8E8bc7e7` | `0x282B6ccaC8B7e062B73Bbf0369e8CEF9A895b30c` | 25,000,000.00 | loan → credit | C |
| `0xeB1284bf810631eFa9AC913944095b5d8180D9F5` | `0x338220179A129B5BE38dBAEd6cd2Ef9754089b5C` | 25,000,000.00 | loan → credit | C |
| `0xc638Be14409fFb09B1b8542B6dE5c7F30AdbAB8a` | `0x1FcC47Ee0F19CA0f07F8b987F0aD32ac204C03a7` | 16,150,000.00 | liquidity → treasuries | M |
| `0x508A98BdF318Ba77B7B7248A75ADBd657F24bc02` | `0xF1EDD9ef78C6A1C46d70dFe107Adc3c819BBb480` | 15,774,099.38 | loan → credit | C |
| `0xC9076B977d5c8dc650ec33d3b86Fd242b7E7342b` | `0xF1EDD9ef78C6A1C46d70dFe107Adc3c819BBb480` | 15,653,892.47 | loan → credit | C |
| `0x8047833dD69D87107c084eAb603E59B49ca42d35` | `0x2e9e44852fFb2A9EDb5cb15262d31DA9b2AA189d` | 10,000,000.00 | loan → credit | C |
| `0x5EFFe8fc2340123Cb36bbdD8c6F548ba67a1C0F8` | `0x2570fAF7C8A0da87d3F123B35cC722EC3fCC3e08` | 10,000,000.00 | liquidity → dex_lp | M |
| `0xeb9aCf026fcD39A580A80A232cED1361d50201f6` | `0xB62446A8981E7AfC02094eac3140ffeCEA54D505` | 10,000,000.00 | loan → credit | C |
| `0xC0a93f14694692c780caAd027B6c0e6F81477D26` | `0xE4aB1f386c44fF7A88C5741C909b8C0a2aAC50bb` | 8,225,000.00 | loan → credit | C |
| `0x663F33d60708497a0876eD8D65474009bE65dbee` | `0x2570fAF7C8A0da87d3F123B35cC722EC3fCC3e08` | 4,000,000.00 | liquidity → dex_lp | M |
| `0x0430665A6E0CE5141b1cC42607d79632125CBBaC` | `0xC24b928b8F28eC560200Bd46bFb84C1b7ae8F4A5` | 3,775,000.00 | loan → credit | C |
| `0xDe0A6EFA52324155A64AA5a4943CDA066b77F8B5` | `0x7642E44C3701dB847b5f866D71D977BDaB757EF2` | 3,683,500.00 | loan → credit | C |
| `0x43D2329DBd53F801eE8CEee3E86bd0882F244a07` | `0x2570fAF7C8A0da87d3F123B35cC722EC3fCC3e08` | 3,500,000.00 | liquidity → dex_lp | M |
| `0xFDCaDF36B0658609BA628F1373df6590e5A35d05` | `0x44D3c37eb8C974770737108Ac55dB868d8a54d49` | 1,500,000.00 | loan → credit | C |
| `0xf695EADe6c9C3CBc88ef58d1Af730d3B4D2533eB` | `0x44D3c37eb8C974770737108Ac55dB868d8a54d49` | 1,500,000.00 | loan → credit | C |
| `0xEbE55691bbd4a708e01C25d009D9cF9Dd228cb3F` | `0x2570fAF7C8A0da87d3F123B35cC722EC3fCC3e08` | 1,000,000.00 | liquidity → dex_lp | M |
| `0x0831b4E1414Eec6c92c2d616eD87a8094A40efe2` | `0x2570fAF7C8A0da87d3F123B35cC722EC3fCC3e08` | 1,000,000.00 | liquidity → dex_lp | M |
| `0x5D8839Ef73532E035F7f9AD3049Be5D4Ff170CA9` | `0x2570fAF7C8A0da87d3F123B35cC722EC3fCC3e08` | 500,000.00 | liquidity → dex_lp | M |
| `0x00079d18BAb17Acb57EaD11A18Fc58002A0cb110` | `0x1FcC47Ee0F19CA0f07F8b987F0aD32ac204C03a7` | 5.00 | loan → treasuries | M |
| `0x24Ed27b2Bc7848b88570f32066a5f5B9a37B07FA` | `0x1FcC47Ee0F19CA0f07F8b987F0aD32ac204C03a7` | 5.00 | liquidity → treasuries | M |

## Credit coverage and the seven low readings

Credit denominator is $898,721,505.69; 23/24 credit rows have finite numeric collateral, covering $865,221,505.69 of principal with $1,087,678,000.46 of calculated collateral in the latest normal generation. Missing numeric valuation: $33.5M WBTC loan `0x63ea10531e976A7890f7EaEF80F51dA5498f9287`. Full credit collateral ratio is **null**, completeness **false**. Numeric values do not verify custody. The family likewise keeps credit-only collateral total and ratio null; it uses exact per-pool membership, exclusion lists and classification versions, never aggregate-minus-strategy collateral arithmetic.

Matched evidence is retained in `collateral-investigation.json`, original issuer HTML/derived text and GraphQL bodies, plus instrumented producer requests/responses. The following are the seven prior low-reading addresses, still unresolved, using the instrumented generation's own prices. The issuer page was retrieved at 2026-10-29T01:42:19.078419+00:00; these are different observation clocks and the issuer displays rounded values.

| Exact loan | Principal USD | GraphQL currentAssetAmount raw | Decimals | Producer current CR | assetAmount at same producer price USD | Issuer displayed collateral |
|---|---:|---:|---:|---:|---:|---|
| `0x7f110947d89204D674C38eb0ed97F82CE5005fD6` | 200,000,000 | 161677336387 | 8 | 65.31% | 391,850,632.77 | BTC $393.45M 196.7% |
| `0x7669d26440804FBc7Af8D8E660083e80176Ce9a5` | 30,000,000 | 7679015848 | 8 | 20.68% | 38,510,883.44 | BTC $38.67M 128.9% |
| `0x3ac7badB967dc12D5423a472B3bBfFf082903043` | 25,000,000 | 2250000773 | 8 | 7.27% | 31,160,029.35 | BTC $31.29M 125.1% |
| `0x771312B001924D1ed1e33271f87F348201FA5c61` | 25,000,000 | 2250000773 | 8 | 7.27% | 31,160,029.35 | BTC $31.29M 125.1% |
| `0x3414D94A1A9adF0C2b728259790e05A3dfecDED8` | 25,000,000 | 2250000773 | 8 | 7.27% | 31,160,029.35 | BTC $31.29M 125.1% |
| `0x3b44e1345D2e8F8948048828a803E25b8E8bc7e7` | 25,000,000 | 2250000773 | 8 | 7.27% | 31,160,029.35 | BTC $31.29M 125.1% |
| `0xeB1284bf810631eFa9AC913944095b5d8180D9F5` | 25,000,000 | 9775062982411813923000 | 18 | 91.30% | 45,673,020.84 | ETH $46.03M 184.1% |

These seven rows total $355M principal. BTC is scaled by 1e8, ETH by 1e18; prices and raw `assetAmount`, `currentAssetAmount`, `initialAssetAmount`, `initialLevel` are retained. Issuer values appear consistent with the larger `assetAmount`, while the existing producer explicitly values `currentAssetAmount`. The differences are not one common decimal multiplier (roughly 3×, 6×, 17× and 2× by address), and small price-clock differences do not explain them. This is evidence of a field/scope disagreement, not proof that either field represents actual current collateral custody. **No raw field or valuation was replaced with the issuer's higher number.** Matched custodian allocations and valuation methodology are absent. No verified loss and no safe collateral buffer is inferred.

Latest reported aggregate: $1,612,240,614.25, 172.46%. Latest available row sum: $1,103,828,001.16 across 25/33 rows; difference $508,412,613.09. The instrumented run's available row sum was $1,108,066,656.82. Aggregate `collateralValue` is divided by 1e6 USD and `collateralRatio` by 1e6 percent; AUM time-series Amount.usd instead uses 1e8 and a daily observation clock. These scopes must not be blended. Issuer UI credit-table collateral (~$1.59B / 24 loans), poolV2 aggregate, 33-row producer book and available numeric subset are distinct. GraphQL supplies no aggregate valuation time/allocation proving reconciliation. Aggregate-versus-row mismatch remains explicitly unresolved.

Removed the unsupported “likely collateral-amount data artifact; PCR authoritative” inference. Existing concurrent protocol-flag severity routing is retained, but zero unrealizedLosses/accounting PCR cannot establish safe custody, disprove a shortfall, or allocate pool losses to a specific loan. Current producer risk wording states that limitation.

The Network Firm LedgerLens summary is retrievable: combined syrupUSDC **and** syrupUSDT, last verified October 27, 2026 01:00 UTC, displayed total ~$2.11B. The standard output now names its retrievability and combined scope. Per-pool allocation, per-loan attestation and matching to these producer aggregates remain unverified. It is not a per-USDC collateral certificate.

## Registry and chain coverage

Maple's current per-asset registry lists canonical Ethereum plus Solana, Arbitrum, Base, Monad, Ink, Tempo, Robinhood and Arc. Normal coverage now includes all nine. All reads succeeded in this observation; `chains_unavailable=[]` is an observation result, not a promise of future access. Registry/RPC documentation and raw request/response evidence are retained. New mainnet endpoint identities were checked via chainId (Tempo 4217, Robinhood 4663, Arc 5042). Public RPC details were taken from their official documentation, not guessed testnet endpoints: [Tempo](https://docs.tempo.xyz/quickstart/connection-details), [Robinhood](https://docs.robinhood.com/chain/connecting/), [Arc](https://docs.arc.network/arc/references/connect-to-arc).

Instrumented supply observations (six decimals; EVM totalSupply at the reported block, decimals read separately; cross-chain clocks not synchronized):

| Chain | Token | Native shares | Block |
|---|---|---:|---|
| ethereum | `0x80ac24aA929eaF5013f6436cdA2a7ba190f5Cc0b` | 797,359,203.126013 | Canonical vault snapshot / Solana context retained in raw RPC |
| monad | `0xab6E5a0C3799d020C790d34F7b2c02639e238AF7` | 96,925,574.798208 | 117485164 |
| solana | `AvZZF1YaZDziPY2RCK4oJrRVrbN3mTD9NL24hPeaZeUj` | 65,329,450.403555 | Canonical vault snapshot / Solana context retained in raw RPC |
| arc | `0x0dC6b79F3c3854E4d74514fD4d29BE6c96Beee39` | 45,143,668.279239 | 28400460 |
| arbitrum | `0x41CA7586cC1311807B4605fBB748a3B8862b42b5` | 470,652.457071 | 519225886 |
| base | `0x660975730059246A68521a3e2FBD4740173100f5` | 213,466.338642 | 53224571 |
| tempo | `0x20c0000000000000000000008191667423F70E67` | 886.105126 | 46377492 |
| robinhood | `0xC6a4854eeB493224d5f9485E12Dd3A81f22EEE14` | 0.018000 | 100536343 |
| ink | `0x3c23e6FB09064e9A64829Fa8FEe27Ad19A27Bfa9` | 0.000110 | 59740084 |

Ethereum totalSupply remains the canonical observation **including bridge locks**, not canonical-minus-remotes. Remote minted supplies are representation observations. Additive supply USD totals, resident percentages and cross-chain reconciliation percentage are null; reconciliation and resident decomposition remain false. Even successful enumeration of every registered chain does not establish replacement-pool authority, lock balances, migration state, in-flight-message liabilities or synchronized bridge reconciliation. The generic reconciliation fix also preserves the pre-existing USDT unknowns. Plasma is absent from the USDC registry section, not borrowed from the USDT deployment universe.

## Canonical fields, histories and validation

Canonical CoinGecko market peg remains paired to theoretical NAV from PegTracker latest; accounting NAV was not substituted. KyberSwap/Ethereum/sell-to-USDC market-notional eight-rung quotes remain identical to the saved latest source. Normal family enrichment adds the existing fill-ratio/cost-convention/depth metadata, without replacing amounts or changing cost definitions. The retained quote time is October 29 01:33:04Z, distinct from backing/family generation clocks. There is no USDC route/hook re-assurance or replacement liquidity series in this task.

`before/backing_history.json` and original backing history are retained. The 30-day export has 720 rows after the normal concurrent producer append, with 718 overlapping timestamps unchanged in all pre-existing fields, two new normally generated rows carrying the USDC classification version, and two expired rows outside the rolling window retained in the original archive. The instrumented older export added null version metadata to legacy rows; it did not apply new membership retrospectively. Current code leaves the version absent for older rows lacking it. No per-loan collateral history exists here and no classified history was fabricated or backfilled. Consumers must segment on classification_version; old unversioned rows retain the heuristic definition. Definition and bridge-decomposition changes also apply prospectively to new family outputs.

Validation commands/results:

- `python3 -m pytest -q tests/test_syrupusdc_source_refresh.py tests/test_syrup_economic_classification.py tests/test_syrup_multichain_supply.py tests/test_syrup_loan_corroboration_marker.py tests/test_syrup_staging_publish.py tests/test_syrup_liquidity_schema.py tests/test_syrup_strategy_reads.py tests/test_syrup_loan_discovery.py`: **47 passed**, one existing websockets deprecation warning. The virtualenv interpreter lacked pytest; system python3 supplied the working test environment. An initial missing-address synthetic-row failure was fixed before the passing run.
- `python3 data/reconciliation/syrupusdc-2026-10-29/run_producer.py`: completed standard USDC producer, validation and history append. Raw instrumented HTTP captures are in `sources/run/` (239 requests). HTTP 429/400 responses, Chainlink XRP reversion and unavailable USDtb/WBTC prices are retained; fallback source outcomes and missing valuation remain explicit. Logs redact credential-bearing endpoint paths; request metadata retains only endpoint hosts and public query bodies.
- `python3 syrup_family_analyzer.py`: published both normal backing inputs and family, using genuine input clocks. No fresh sibling generation was manufactured; the later sibling generation was the pre-existing scheduler.
- `python3 data/reconciliation/syrupusdc-2026-10-29/validate_package.py`: passed principal/rate/status preservation, exact denominators/membership, null incomplete coverage, canonical peg/quote preservation, published numeric score preservation and historical overlap checks. Follow-up assertions also validated the latest-normal generation and family.

Observed standard score fields stay issuer_score 5.5 and liquidity band_score 1; age metadata advances normally. Authored six-axis/overall scores outside this producer were not edited or re-scored. No proof of actual exit fills, primary request-to-fill latency, full credit custody or final bridge settlement is claimed.

## Actual serving and downstream boundary

Latest direct public backing retrieval at 2026-10-29T01:51:38.997715+00:00 returned generation **2026-10-29T00:44:01Z**, classification marker `None`; SHA-256 `fbe3ebb9688ad50ec80cef6470210038f6820491e8a753cc9ff8703d4f3b5ee0`.

Latest direct public family retrieval at 2026-10-29T01:51:39.873016+00:00 returned generation **2026-10-29T00:44:43Z**, classification marker `USDT issuer_economic_v2_2026-10-28; USDC legacy heuristic unreviewed; mixed definitions, not issuer family economic ground truth`; SHA-256 `7d23a8fde9903c178a48b0ae81daeb16dec4abe4aa743e79018851b152f49834`.

Actual public backing/history, family, authored axis basis and DexTracker venue overlay responses were archived in `sources/`. The public backing still lacks the new USDC version at the recorded check, so local producer completion is not downstream completion. BM must select/sync the reviewed normal common outputs, verify its renderer uses credit_coverage without an aggregate fallback and labels all-position versus credit denominators, then independently check actual serving. riskAnalyst can regenerate its shared-source evidence and TIDR can handle report publication. Those external writes are excluded by this handoff and were not performed. No silent historic re-score or USDT hook transfer is authorized by this package.

Review files: `syrupusdc_backing_analyzer.py`, `syrup_position_classification.py`, `syrupusdc_position_review.json`, scoped additions to `syrup_multichain_supply.py` / `syrup_family_analyzer.py`, and `tests/test_syrupusdc_source_refresh.py`. Pre-existing unrelated edits were preserved. Full file/response SHA-256 inventory: `data/reconciliation/syrupusdc-2026-10-29/manifest.json`; raw evidence, before/after/latest-normal captures, logs, validation result and matched investigation are retained beside it. Completion refers to this bounded producer assignment; collateral allocation, custody and bridge assurance remain unresolved.
