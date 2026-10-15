---
from: backing-monitor
to: PegTracker
date: 2026-10-15
status: ready-for-manual-delivery
---

# Correct USDAT accounting and implementation alerts at the producer

The Ethereum USDAT feed still emits a critical accounting divergence because
`totalAssets()` is compared with all reserve holdings, and implementation drift
because `USDAT_IMPL_PUBLISHED` still names `0x17cAC25c…E52E`.
Both diagnoses are obsolete for the reviewed implementation
`0x496a4A33b6181F4536203488d9a05AC1429E702c`.

Evidence: TIDR's `/home/danger/tidresearch/public/evidence/saturn/usdat-reassessment-2026-10-14.json`,
also public at `https://tidresearch.com/evidence/saturn/usdat-reassessment-2026-10-14.json`;
source bundle `/home/danger/riskAnalyst/data/research/usdat-technical-2026-10-14/`;
Saturn's current `https://github.com/saturn-organization/saturn-dollar`.
The reassessment matched runtime to Sourcify and the main USDat file to Adevar
audit-final commit `26507265ea099ebe807a27144e73352510e9e076`.

`MultiMint.totalAssets()` counts alternative assets, excluding primary PYUSDx.
`_pyusdxBacking()` computes `totalSupply - totalAssets` (floored at zero), not
division by `totalAssets`. `isAllowedAsset(PYUSDx)=false` is expected for the
primary asset. Zero alternative assets is not rejected backing, missing money
or a failed redemption denominator. USDAT is not an ERC-4626 vault.

Please update `saturn_backing_analyzer.py` and its field contracts:

1. Verify and adopt the current implementation baseline while retaining upgrade
   history; preserve meaningful future-implementation, proxy-admin and authority alerts.
2. Separate primary PYUSDx backing from alternative asset accounting. Stop comparing
   all holdings against the alternative-only accessor as a completeness/defect check.
   Distinguish measured balances, contractual accounting and economic reserve verification.
3. Publish implementation-scoped accounting semantics and evidence provenance so
   downstream consumers need no fixed-version correction. Unknown implementations
   remain unassessed; failed reads remain unknown rather than zero.
4. Retire or relabel misleading `accounting_divergence_*`, `contract_total_assets_usd`,
   PYUSDx `not_contract_allowlisted` tags and ratio-basis strings through a coordinated
   schema transition. Do not make historical accessor changes look like reserve losses.
5. Keep independent coverage, custody, eligible-holder primary exit and bridge
   reconciliation qualified. Token-unit holdings at par are not verified ultimate
   dollars or a universally executable redemption route.
6. Add tests: all-PYUSDx/zero-alternatives is normal; primary plus alternative balances
   use the correct accounting model; unknown implementation and failed reads remain
   flagged; genuine reserve shortfalls, pause and depeg alerts still fire.

backing-monitor has prepared a narrowly version-scoped reader correction that
removes the two obsolete flag messages and explains accessor scope. It leaves raw
producer files and scores unchanged. Return exact new fields, validation, cadence
and implementation commit so the temporary consumer correction can be retired.
No agent dispatch or other-repository modification is requested. Manual delivery only.
