# Syrup pair consumer review — November 11, 2026

Completed BM internal association of RiskAnalyst assessment `syrup-pair-six-axis-2026-11-11-v1`, committed in RiskAnalyst revision `8ef23dc91648d658a7344f69777b2684dee7ec6f`. Ethereum syrupUSDC is 6.0 provisional and syrupUSDT is 5.5 provisional. All 14 authored score fields agree across the committed assessment, reports and index. Historical remote-chain grades are unchanged and were not reassessed. Full-verification dates remain October 13.

Evidence version: `sha256:54e6abc3d98e5a0db31757660213ad9bc2f1821a1b156955575ee5fd443b2d5b`. Common financial pin: Ethereum 26389831, November 11 at 06:16:59 UTC; other producer observation clocks remain separate.

Private consumer receipt SHA256: `28e5e3a8f2c27dfd0ae8b2a5016745fa63b61a71041c568478bae1dbd6898292`. Association SHA256: `c20904df537e9789b8e348946a7ebef3694434bcb9e3b243c9a585120255cbe0`. Field-parity receipt SHA256: `fb81f62e3df36076b1851765fa043684ef1b43e73fc1bb55e2b21ad3bcb98882`. Frozen evidence and screenshots remain in the private review workspace.

## Served checks and remaining gaps

Read-only checks covered both assets at 1440px and 390px on staging, in light and dark modes. All six sections rendered with no JavaScript errors. The new authored version is not served: axis overlays retain October 29/28 clocks, distinct from November 11 normal backing payload clocks. Internal association acceptance does not establish deployed parity. Dedicated overall-score presentation was not verified.

Both mobile pages overflow: syrupUSDC document width 595px and syrupUSDT 600px at a 390px viewport. Desktop pages did not overflow.

The displayed accounting-derived 100% backing and small surplus must not imply independent credit backing assurance. The normal shared-strategy reader uses global manager assets rather than pool-specific claims; the pinned pool-specific reconciliation is separate. Unverified collateral valuations, payment coverage and cash realizability remain explicit gaps. LedgerLens is a technology report, not an independent assurance opinion. USDG stability scores lack matched-history calibration against this pair.

TIDR owns separate report staging. This review changed no normal producers, public dashboards, jobs or publication flags and performed no transactions. Live parity and mobile repairs remain outstanding.

## Bounded follow-up: local stage v3

Completed an isolated local stage of the accepted authored overlays, qualified loan rows and corrected financial candidate. Public staging/production and normal producer roots remain unchanged. Both assets render all six sections at 1440px and 390px, with all 14 authored fields matching per viewport, no JavaScript errors and no document overflow. Mobile assessment rows expose concise scores with expandable bases. Computed bands retain their own methods. Accounting equality and small residuals no longer imply independently verified backing; protocol flags no longer imply verified servicing.

PegTracker's bounded full producer invocation uses Ethereum block **26390336**, November 11 **07:58:35 UTC**, distinct from the assessment's 26389831/06:16:59 UTC. All 21 owner artifact hashes and 226 pinned read-only RPC records were verified. Both full offline builds succeed. Cash plus pool-owned strategy claims minus NAV is exactly zero in raw native units for both pools. Shared managers use `assetsOf(poolManager)`; loss recognition uses pool-manager `unrealizedLosses`. Shared-manager principal/interest/loss allocations remain null. Independent credit NAV remains unknown. Original loan snapshots (05:42:25/05:43:29 UTC), market and documentary observations remain dated separately. The newer accounting snapshot is a supplemental stage, not a rescored assessment.

Remaining financial gaps:

- USDC $200m loan: zero current amount versus nonzero alternate amount; field semantics, custody movements and servicing unverified.
- USDC $155m across six source readings: below-par calculations uncorroborated; repeated quantities do not establish shared or separate pledged allocations.
- USDC $33.5m WBTC loan: reader defaults to 18 decimals and has no price; this explains missing valuation, but exact token/unit/price binding remains unknown. The conditional 8-decimal interpretation is not promoted to a verified value.
- USDT $50m loan: original raw collateral amount and source clock unavailable; rounded display cannot reconstruct them.
- No matched custody or actual repayment evidence closes these gaps. Exact Maple questions are prepared, not sent.

Normal producer entrypoint pinning/rollout and public deployment remain separate acceptance steps. The legacy common authority graph retains its own older clocks; current authored explanations do not certify a refreshed graph.

Private handoff `stage-v3/handoff-v1.json` SHA256: `fc7470aa9b8db1f4a53304e699caa8a00d2b8d0dec2a7e262edfd46f6ffe03ea`; receipt `0f463d7f4cbc3ef8d6b3741e32a79559c51234d5aba586f48818d13177ce8424`; source index `4cdbdf0b90f926c262eecfcd7e8c1ce3068bc38806ca94fb0ef6c3f5aa8af465`. Shared-v1 checker exits 0 for the bounded local-stage scope. Four focused renderer tests pass. RiskAnalyst and PegTracker received the handback. No jobs, transactions, scores or production publication changed.
