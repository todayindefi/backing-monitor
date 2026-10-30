---
title: GHO dashboard implementation and producer completion plan
date: 2026-10-30
status: Standard coverage history and scan-first layout corrected; current authored assessments and independent verification pending
---

# Scope and governing contracts

Current selection combines **backing v2 source reconciliation** with the
**standard coverage history and layout correction** in
`gho-standard-dashboard-review-2026-10-30.md`. It supersedes the initial
preview's backing-gap and missing-history statements below; the earlier
sections retain implementation and evidence history.

Implement Ethereum GHO in the existing app under `?asset=gho`, following
[the six-axis spec](six-axis-dashboard-spec.md),
[renderer rules](renderer-design-rules.md), and
[Axis 5 contract](axis5-contract-admin-spec.md). GHO token identity is
`0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f` on Ethereum.
sGHO is a distinct asset. Remote deployments need their own identities,
observation clocks, custody reconciliation and usable local exits.

The source tree already contains unrelated Avant and fxSAVE work. This change
adds only a GHO renderer entry to the existing app and a versioned script to
the existing HTML. It does not register GHO in the production asset registry.

# Implemented preview

`tools/prepare_gho_preview.py` produces `/tmp/gho-dashboard-preview` from
explicitly selected PegTracker files and, optionally, a one-off snapshot from
the existing tokenAnalyst collector. It preserves source inputs and SHA-256
receipts in the preview. All six standard axis sections remain visible.

- Peg: recorded mark, explicit $1 par reference, source-age warning, seven-day
  chart and excluded-history explanation. The projection retains 5,423
  qualified observations; 1,978 rows with ambiguous clocks and 20 invalid
  price/reference rows are excluded with reasons. These counts date this run.
- Backing: no independently established coverage or coverage history. Separate
  provisional RPC/API supply observations and a labelled, mixed-chain
  facilitator table. The API collateral ratio is deliberately not adopted.
- Exit: four observed market-sized USD quote rungs, costs versus the input
  notional, and size impact versus the producer's smallest rung. No depth
  crossing or maximum exit is inferred. Ethereum RemoteGSM diagnostics retain
  their missing-block and unverified-execution limits.
- Dependencies and Contract/Admin: current producer assessments absent, with
  specific completion requirements displayed. No old scores are inherited.
- Issuer: Aave DAO identity, an explicit missing-current-assessment state, and
  the browser-verified historical report link. No issuer summary is composed
  or attributed to riskAnalyst.

The preview is a consumer projection, not a replacement GHO backing producer.
Its `gho-preview-detail/1` is an internal review contract and is not a proposed
fleet-wide producer schema. No recurring collector or public feed was added.

# Material evidence found during refresh

Read-only invocation of the existing collector:

```bash
/home/danger/PegTracker/pegtracker_env/bin/python /home/danger/tokenAnalyst/scripts/fetch_gho_state.py --no-write > /tmp/gho-state-refresh.json
```

Collector run began at `2026-10-30T04:06:11Z`. Its Ethereum registry discovery
returned two current RemoteGSM contracts with `is_frozen=false` and
`is_seized=false`:

| Module | Address | Available underlying, in wrapper token units |
| --- | --- | ---: |
| waEthUSDC | `0x3A3868898305f04beC7FEa77BecFf04C13444112` | 0.029227 |
| waEthUSDT | `0x882285E62656b9623AF136Ce3078c6BdCc33F5E3` | 24,396,388.692988 |

These are one-off diagnostic getter results: the collector does not retain
per-call block/time identifiers, and no holder swap was simulated. Wrapped
stablecoin units are not verified dollar exit capacity. GHO reserve allocation
supports the opposite swap direction and must not be added to this liquidity.
The historical report's legacy seized addresses differ from these contracts;
its broad peg-defence conclusion requires reassessment against current scope.

TokenLogic metrics are stamped `2026-10-30T03:08:49.864329000Z`. They report
699M total supply and approximately 271.029M circulating supply; the RPC
collector also returned 699M Ethereum ERC20 supply. Definitions and clocks
remain distinct. Neither supply measure verifies underlying collateral.

The existing PegTracker quote producer sizes input as USD notional divided
by its market price. Consequently a $100,000 rung is NOT 100,000 GHO, and
`output_usd / size` is NOT proceeds against $1 token par. The preview labels
this correctly. Its current sizing mark is 0.99850861 USD/GHO.

# Canonical producer and consumer contract

| Part | Producer | Canonical output to implement or refresh |
| --- | --- | --- |
| Peg, backing and histories | PegTracker | `gho_backing.json`, `gho_peg_history.json`, `gho_backing_history.json` |
| Executable ladder | PegTracker | `gho_exit_ladder.json`, standard crossing/basis/status semantics |
| Venue inventory | DexTracker | `data/liquidity/gho_liquidity.json`, `liquidity/1` |
| Primary exit execution | Proposed PegTracker; acceptance pending | Registry-discovered module identity, inventory, wrapper conversion, fees and pinned read-only probe |
| Primary exit eligibility | riskAnalyst | Typed eligibility facts and economic/legal access limits, separate from execution |
| Backing qualification | riskAnalyst | `gho_backing_overlay.json`, standard authored-fallback gates |
| Dependencies | riskAnalyst | `gho_dependencies.json`, named upstreams, measured metrics and sources; downstream coverage |
| Authority observations | security_analyst | Producer-approved eligible `topology/assets/gho.yaml`; generated locally by the existing Axis 5 emitter |
| Code and admin judgment | riskAnalyst | `gho_contract_overlay.json`, two non-offsetting halves |
| Issuer and axis basis | riskAnalyst | `gho_issuer.json`, `gho_axis_basis.json`; current authored rationale and provenance |
| Report correction | tidresearch | Reconcile the historical report with new owner-reviewed evidence; publication status remains separate |

Every figure needs value, basis, observation clock and scope. API retrieval,
collector run time and sync time never replace a missing source timestamp.
Bridge-minted supply must not be summed into origin issuance without custody
reconciliation. Facilitator level, reserve GHO allocation, float and independent
collateral are separate quantities. A chart is permitted only for an actual
series; a partition chart requires mutually exclusive components.

Use the current scoring amendments and shared app behavior. In particular,
the Dependencies section's September 13 amendment supersedes the older
fleet-wide-unrated statement. Current authored dependency scores must come
from riskAnalyst; this preview cannot infer one from an empty exposure map.
Current issuer and contract scores are also pending. The peg band is explicitly
computed from recorded behavior, not an assessment of peg mechanism safety.

# Remaining implementation sequence

1. Deliver the scoped producer briefs in `specs/handoffs/GHO-*-2026-10-30.md`.
   They are drafts, not dispatched requests or evidence of producer agreement.
2. Obtain canonical staged feeds and producer schema acceptance. PegTracker
   remains primary backing owner; do not promote this preview adapter's
   placeholder base feed into that role.
3. Reconcile the new RemoteGSM addresses and code against official registries;
   collect block-pinned observations and holder execution probes. Refresh
   borrower collateral look-through and cross-chain supply accounting.
4. Integrate selected producer outputs through the existing overlay/ladder
   paths. Extend GHO detail panels only from agreed typed fields, preserving
   the common baseline sections and producer basis strings.
5. Retain successful measurement histories. Producers must declare cadence,
   last successful observation, last attempt and failure/partial states.
   Schedule changes require actual producer implementation and verification;
   none is implied by rebuilding this static preview.
6. Complete the six-axis acceptance review and prepare the production registry,
   script/cache wiring, feed transport and report changes as a reviewable set.
   Promotion awaits the user review gate in the governing spec.

# Reproduction and validation

```bash
python3 tools/prepare_gho_preview.py --state /tmp/gho-state-refresh.json --report-check /tmp/gho-report-verification.json
python3 -m http.server 8891 --bind 127.0.0.1 --directory /tmp/gho-dashboard-preview
python3 -m unittest discover -s tests -p test_gho_preview.py
node tests/test_gho_browser.cjs
```

Open `http://127.0.0.1:8891/?asset=gho`. Browser QA covers desktop/mobile,
light/dark, actual chart construction, expanded disclosures, missing history,
visible missing-data states and horizontal overflow. Tests reject wrong token
identity, ambiguous timestamps, invalid marks and accidental adoption of an
API coverage ratio. Report URL verification is recorded separately from the
report's historical evidence date.

The production `check_feeds.py` checks the registered fleet; it cannot certify
unregistered GHO readiness. Full acceptance remains pending canonical feeds,
current authored assessments, producer schedules and the published-vs-DOM
audit against those final inputs. Historical samples and explicit gaps are
useful review evidence, not completion of a current six-axis risk assessment.

October 30 validation: three projection invariant tests pass. Browser checks
pass at 1280px and 390px, in light/dark mode, with expanded disclosures and
the history file forced to 404. Default-visible paragraph audit found no
paragraph over 240 characters. Script syntax and `git diff --check` pass.
The fleet checker returns two existing failures: `fxsave.js` token 20261026b
and `fxusd.js` token 20261024b predate their October 28 commits. These tokens
were unchanged by this work; GHO is not registered in that fleet check.

Selected serving JSON, collector/report receipts, hashes and browser screenshots
are retained in `specs/reviews/gho-dashboard-2026-10-30/`. The 136MB complete
PegTracker history remains in the isolated preview's evidence directory; its
source hash is retained in the selection manifest rather than copying unrelated
asset histories into this repository.

# First completion pass — staged canonical backing collector

The user requested work through the missing components one by one. The first
pass implemented `/home/danger/PegTracker/gho_backing_analyzer.py` and installed
it, its tests, replay fixture, runbook and staged outputs with filesystem
approval. Work was performed directly by this session, not via a producer
dispatch. No independent owner handback or editorial assessment is implied.

Staged source directory:
`/home/danger/PegTracker/data/dashboard_pending/gho-backing/`.
The producer manifest hashes the backing feed, history and full RPC evidence.
`--backing-dir` in the preview assembler verifies those hashes and source
identity before selecting the measured backing block. It no longer shows
unpinned TokenLogic supply or mixed-chain bucket rows as its backing detail.

All Ethereum reads use block **26,303,132**, hash
`0x791c3ae71c77358c17e7e9ae71da13738f7de8d5badd7c5d45438fd646c3ba8d`,
timestamp **2026-10-30 04:18:59 UTC**. A second RPC reproduced the block identity,
699M total supply and all eight facilitator records. This is endpoint
redundancy, not independent verification of collateral.

Measured at that block:

| Component | Observation | Interpretation limit |
| --- | --- | --- |
| Issuance | Eight levels total 699M GHO; zero raw-unit delta to token supply | Issuance accounting, not reserve coverage |
| Core direct minter | 135M GHO aToken claim | GHO lending-reserve claim; borrower collateral not reconciled |
| Lido direct minter | ~46.561M GHO aToken claim | Claim includes accrual; not additional external assets |
| Horizon direct minter | ~60.002M GHO aToken claim | Claim includes accrual; not additional external assets |
| Ethereum reserve | ~281.194M idle GHO plus ~28.806M registered usage | Reproduces 310M facilitator level; reserve GHO is the token itself |
| waEthUSDT module | 24,396,388.692988 wrapper units; conversion quote 28,806,163.966197 USDT | Conversion getter, not verified withdrawal or executable dollars |
| waEthUSDC module | 0.029227 wrapper units; conversion quote 0.034829 USDC | Same execution and valuation limits |
| Other facilitator issuance | 150M GHO through three untraced paths | Remote/external attribution unresolved; not a finding of missing backing |

The output leaves total independent backing and collateral ratio null with an
explicit basis. It retains one measured supply/history point with null coverage.
It fails closed on required read, identity, reorganization or reconciliation
failure, preserving last-good feed/history and recording the failed attempt.
Same-block reruns do not add duplicate history points. Five producer tests and
four consumer projection tests pass; browser desktop/mobile and light/dark
checks pass with the new pinned backing panels.

Rebuild the selected preview:

```bash
python3 tools/prepare_gho_preview.py --state /tmp/gho-state-refresh.json --report-check /tmp/gho-report-verification.json --backing-dir /home/danger/PegTracker/data/dashboard_pending/gho-backing
```

This completes the first reproducible staged backing-measurement pass. Full
borrower and remote collateral attribution, oracle-update clock repair, canonical
peg-history export, executable exit ladder/probes and recurring activation remain
open. Dependencies, authority/code and issuer editorial work remain separate.
No live asset registration or public feed publication has occurred.

# Reconciliation pass — first-party definitions and targeted controls

Following the user's request to reconcile backing, and direction to use GHO
documentation, TokenLogic and public GitHub efficiently, this pass starts from
first-party definitions and reproduces their component tables. It does not
start a new exhaustive chain indexer. The producer module is
`/home/danger/PegTracker/gho_reconciliation.py`; its runbook is
`/home/danger/PegTracker/docs/gho-reconciliation-source-first-2026-10-30.md`.

Selected outputs and archived source inputs:
`/home/danger/PegTracker/data/dashboard_pending/gho-reconciliation-v2/`.
The prior backing collector and its initial snapshot remain unchanged.

The source-first approach resolves the previously unspecified ratio basis:

| TokenLogic field | Observation | Scope / clock |
| --- | ---: | --- |
| Pro-rata collateral | $468,870,214.15822566 | Collateral series, source date 2026-10-29 |
| Ratio denominator | 304,927,077.6001744 GHO | SAME source day, `collateral_vs_supply` |
| Reproduced ratio | 153.764702645731% | Source oracle measure; not independently realizable-dollar coverage |
| Newer headline circulation | 270,975,207.88119906 GHO | Different source observation, metrics updated 2026-10-30T04:06:34.304270000Z |
| Whole shared borrower collateral | $941,499,239.4117562 | Not all attributable to GHO; source allocation reduces it to the pro-rata numerator |

All 5,920 unique borrower/collateral rows in the source's 11-v3-market scope
reproduce their per-market collateral and debt aggregates within $0.0001.
The overall numerator reproduces to floating-point precision, and numerator /
the correct dated denominator reproduces TokenLogic's ratio. V4 observations
available in a different source scope are deliberately excluded from this
reconstruction. No newer headline denominator is substituted into the ratio.
The dashboard now displays this source figure with its source date and
oracle-valued label, retaining an unrated independent coverage state.

Date/market filters are material: unfiltered responses are capped at 5,000
rows; naive offset pagination mixed dates and yielded overlaps. That exploratory
output is not selected. Each selected market response has an explicit day,
market filter and fewer rows than its declared cap; duplicates, wrong dates,
unknown market scope or disagreement with aggregates fail selection.

The three remote reserve books each match their origin 50M allocation exactly:

| Chain | Idle GHO | Registered usage GHO | Block and UTC |
| --- | ---: | ---: | --- |
| Arbitrum | 35,106,458.135384 | 14,893,541.864616 | 519574867; 2026-10-30 04:34:50 |
| Monad | 2,499,346.238313 | 47,500,653.761687 | 117804224; 2026-10-30 04:34:54 |
| Plasma | 6,981,041.144307 | 43,018,958.855693 | 36393075; 2026-10-30 04:34:57 |

Their wrapper conversions and underlying symbol/decimals are pinned to each
chain's own block. The snapshots have separate clocks; no simultaneous global
balance sheet or additional supply from bridged representations is implied.
Original bridge-funding receipts are not replayed. Official RemoteGSM
architecture and pinned address-book identities establish the intended route;
the observed ledger comparison is kept distinct from exclusive mint attribution.

Lending-book controls now include supplier claims, treasury accrual, estimated
pending treasury fees and deficits. Core's recorded deficit is 13.575714318144955
GHO, and its comparison residual after carrying those terms is only 24,644 wei.
Prime and Horizon retain positive residuals of 19.47289078579643 and
354.0946407984555 GHO respectively, explicitly unattributed. They are neither
forced to zero nor mistaken for collateral shortfalls. Daily TokenLogic borrower
data is not claimed to be a block-pinned independent census.

Four new producer reconciliation tests pass, along with four consumer tests and
the browser's four desktop/mobile light/dark layouts plus missing-history case.
Guard cases reject denominator substitution, capped/duplicate/misdated inputs,
remote identity/accounting mismatches and non-finite financial values.
The source figure is not used to auto-score backing or change report scores.
Public feeds, registry and recurring schedules remain unchanged.

Rebuild the current selection:

```bash
python3 tools/prepare_gho_preview.py --state /tmp/gho-state-refresh.json --report-check /tmp/gho-report-verification.json --backing-dir /home/danger/PegTracker/data/dashboard_pending/gho-reconciliation-v2
```

Review evidence is frozen under
`specs/reviews/gho-dashboard-2026-10-30/backing-v2-source-reconciliation/`.
Independent liquidation valuation, a current independently complete borrower
census, original bridge funding receipts and the two small pool residuals are
remaining verification limits; source reconciliation and reserve-ledger
comparison are now complete within the stated scopes.


2026-10-30 axes 4–6 follow-up: the preview now selects a source-verified research
candidate with six dependency paths, four partial authority layers and current
qualitative issuer research. Current scores remain null and scope gaps remain
visible. See `gho-axes-456-review-2026-10-30.md`; pending producer packet:
`/home/danger/riskAnalyst/data/dashboard_pending/gho-axes-456/HANDOFF.md`.
This is filed research, not an independent owner return or public deployment.
