# Ethena live-source repair — October 29, 2026

Completed the scoped producer repair. Standard USDe, sUSDe and family outputs have been regenerated and reviewed locally. BM sync and verification of the actual served files remain pending; no BM or riskAnalyst files were modified.

## Repair and definitions

- `ethena_issuer_source.py` collects the issuer's `/api/collateralization/status`, retaining exact response bodies, SHA-256, request/retrieval clocks, source timestamp, endpoint and issuer-reported provenance. Non-finite/missing amounts, nonpositive denominator/backing, future timestamps and status observations older than six hours are rejected. Coverage arithmetic is recomputed each run. This is **issuer reporting, not independent offchain custody verification**.
- Coverage retains the issuer's same-snapshot USD denominator in `summary.issuer_supply_usd`. USDe `summary.total_supply` now uses independently measured Ethereum canonical totalSupply, labelled **USDe tokens**. It includes adapter-locked supply; remote chain supply is a decomposition, never an addition. Source metadata and cross-check expose the differing observation clocks and discrepancy; the within-0.5% check is a diagnostic tolerance, not proof of custody.
- sUSDe headline shares and legacy vault-state shares now use the same-block hourly vault result. NAV is USDe/share; assets are USDe. The legacy `staked_usde_usd`/`usde_staked_usd` fields remain null because no executable USD valuation was established; family `usde_staked_usde` carries the actual underlying quantity. Missing executable market prices remain null, rather than substituting par, NAV or an oracle/index mark. Existing source quotes remain in the canonical liquidity block.
- Issuer collateral breakdown has no source timestamp; the positions tree has a separate timestamp. Both raw views and clocks are retained separately, with no forced same-snapshot allocation. Custody breakdown is empty/unknown for this new source. FarmTracker wallets, onchain Reserve Fund and dated attestation subsets retain their existing separate scopes; none is summed into a fabricated total. Family stays explicitly `partial`, including when headline status is available.
- Prospective backing-history retention now appends acquired rows directly to the standard per-asset files. It preserves all original rows without rolling deletion, records the definition break and separate supply/backing/vault clocks, and writes missing market prices/deviations as null. Canonical USDe supply can be retained even if the issuer backing feed fails; independent sUSDe NAV can be retained without complete USDe backing. No missing October 14–29 observations were fabricated.
- Fee-switch checks now use execution time for the requested trailing 14-day window, publish actual observed endpoints and point counts, and require fresh, valid samples with no gaps over six hours and no mixed source definitions. Missing/stale/incomplete inputs withhold both the current mean and milestone verdict. The cheap guard is reevaluated when reading the daily cache. The live producer also repairs only that block in the standard daily file; `computed_at` and the NAV/oracle/mint-redeem blocks remain unchanged. No governance activation claim is made; the threshold source remains explicitly secondary reporting.
- Public measurement RPC metadata retains hosts only, removing credential-bearing paths/query strings; nested provider errors are sanitized on output. Private operational logs were not included in the evidence package.
- USDe's **legacy 200bps primary threshold is preserved**, with additive metadata explicitly noting the stable-valued **50bps convention** and the pending separate definition review. sUSDe's direct-USDC 50bps ladder is preserved. No old two-leg $3.30M crossing was transplanted; no provider, source quote, cost convention, authored score, verification date, cron, transaction, role or downstream publication was changed.

## Reviewed observation

Reviewed generation: **2026-10-29T07:02:10Z** (15:02 Taipei).

| Observation | Value / clock |
|---|---|
| Issuer status source timestamp | 2026-10-29T05:59:28Z |
| Issuer status retrieved | 2026-10-29T07:01:31.868228Z |
| Issuer backing | $4,560,198,405.35 |
| Issuer Reserve Fund | $62,059,526.94 |
| Issuer supply denominator | $4,542,907,916.34008 in issuer USD units |
| Coverage excluding / including RF | 100.3806% / 101.7467% (published rounded ratios) |
| Canonical USDe supply | 4,543,971,515.530076 USDe |
| Independent supply block / time | Ethereum 26,296,767 / 07:01:23Z |
| Supply discrepancy versus older issuer snapshot | +1,063,599.189996 USDe-equivalent (~0.0234%); different clocks |
| sUSDe shares / assets | 951,705,614.5658604 shares / 1,194,804,931.2529356 USDe |
| sUSDe NAV | 1.255435412974809 USDe/share at the same block |
| Separate positions tree timestamp | 2026-10-29T05:01:37Z (raw Unix timestamp retained) |
| Collateral composition timestamp | unavailable; retrieval is not source time |
| Fee-switch | `insufficient_history`; mean and milestone null |
| Actual retained current-window samples | 07:00:29Z–07:02:10Z, two acquired rows; not a 14-day average |

Two live acquisitions were performed to validate the final wiring. Each standard history now has **2,182 rows**, preserving its original **2,180-row prefix** exactly as parsed. Original byte-for-byte history files are archived as `original-*_backing_history.json` in the evidence directory. The acquisition gap remains visible.

## Validation and reproducibility

- **55 targeted tests passed**, including seeded stale histories, missing values, uncovered windows, definition breaks, invalid issuer amounts/clocks, null-share overwrites, denominator scope, raw-history prefix preservation, no fabricated market prices, independent daily clocks and RPC redaction.
- Standard Ethena validator: **85 passes, zero failures, one warning**. The warning explicitly records unknown allocation and unverified independent offchain custody; it is not hidden by successful issuer acquisition. Validation was invoked without Telegram or validator-state mutation.
- `python3 docs/evidence/ethena-live-source-repair-2026-10-29/verify.py` passes offline checks of retained history prefixes, actual gaps, raw-body hashes, issuer arithmetic, canonical/vault summary equality, fee verdict withholding, unchanged other daily blocks and host-only RPC metadata.
- `git diff --check` passes for the scoped code. The full repository suite was not rerun; existing unrelated work remains outside this repair. Score comparisons against BM's independently retained October 29 review show every numeric authored/derived score unchanged; age metadata naturally advances.

All reviewed standard outputs are copied in [the evidence package](evidence/ethena-live-source-repair-2026-10-29/). [Before hashes](evidence/ethena-live-source-repair-2026-10-29/before.json), [after hashes and code hashes](evidence/ethena-live-source-repair-2026-10-29/after.json), [test log](evidence/ethena-live-source-repair-2026-10-29/targeted-tests.log), [validator result](evidence/ethena-live-source-repair-2026-10-29/standard-validation.json), [score comparison](evidence/ethena-live-source-repair-2026-10-29/score-comparison.json).

| Standard file | Before SHA-256 | Reviewed after SHA-256 |
|---|---|---|
| `usde_backing.json` | `b41dd4aad6cb5e1c65df0cc49c8c28b0c33d0fda1fa1e747931465db7366a8e7` | `02cb2a909b3a7c3b47f5067fef72a508ee67e60ebbc75716a2c75c7cb4ea0fb5` |
| `susde_backing.json` | `631103446ff20149ce3a2fba445ec733f659af83401afe28ab2adfc9c02f687c` | `60f7b7b0c586db6e0c3528c55b5be30ca1d96a20422e431f2d0c37c848762fb4` |
| `ethena_family.json` | `a3086eaf49922d9036cde744e803aa0af67b11b7bdb5c507fa2918fab411bc25` | `6e18c76eb70a747f6950e2abcb7a2c15474004a2e22956cdddc33b76059fe97a` |
| `usde_backing_history.json` | `f147c2d68c6635d031bffcbd716a6cc1ae1dfa6b2807f23bcadc21d74af4660d` | `a0726174749120d585362138e4a66c50061eb92584bc9d3ab36e0dba7a3a40a7` |
| `susde_backing_history.json` | `42e980dc54f7e3a50ec2e543b69f4958d8c8076a5a64c39ed4162aa5fc375df9` | `717a111d6deb17f4d8eef2111e79d8d65d94c574008251663b94b60c5d1906b2` |
| `ethena_measurements_daily.json` | `6f974d8577853a7a150b75287d13203e0ad7d661c2938f4fec3dbf41c2327466` | `356fd0204fb3dc27df72f874866d55f355ef1bcb25d653e6d047666ebe1b0a15` |

The shared `backing_history.json` and separate peg-history files changed hashes while unrelated scheduled producers continued running. This repair does not write them. Their whole-file hashes therefore cannot be called unchanged; [recorded hashes](evidence/ethena-live-source-repair-2026-10-29/preserved-series.json) disclose that limitation. The shared DB's USDe/sUSDe last entries remain October 14, and prospective canonical exports are the per-asset backing-history files. Original per-asset histories are preserved in full in this package. No concurrent updates were reverted.

## BM handback and unresolved gaps

BM should independently review and sync the standard `data/usde_backing.json`, `susde_backing.json`, `ethena_family.json`, both backing histories and `ethena_measurements_daily.json`. Verify **actual served hashes**, source-definition/provenance, canonical supply units, issuer coverage denominator, fee-switch unavailable status, unchanged source quote/cost definitions and visible allocation unknowns against the reviewed package. If producer generations have advanced, compare like-for-like clocks rather than expecting these frozen hashes to match a later observation. `ethena_issuer_raw.json` and the evidence package provide source auditability, not a replacement financial series.

Still unresolved: independently verified current offchain custody/full allocation; same-time reconciliation of issuer composition and positions; actual market execution and primary fill latency; a complete new 14-day fee-switch history; and the legacy USDe 200bps-versus-50bps definition decision. Exact first failure time of the retired LlamaRisk endpoint was not established, and is not inferred from the final October 14 history row. The source outage and acquisition break remain explicitly documented. Six-hour freshness/gap limits are producer data-quality guards, not issuer promises or governance rules.

This work did **not** establish solvency from independent custody evidence, current governance activation, complete bridged-chain measurement, executable prices from oracle marks, or public BM serving of these repairs. No risk reassessment or score change is claimed.
