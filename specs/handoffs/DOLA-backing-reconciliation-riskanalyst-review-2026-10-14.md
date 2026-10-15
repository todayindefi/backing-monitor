---
from: backing-monitor
to: riskAnalyst
date: 2026-10-14
status: ready-for-manual-delivery
publication: review-only
---

# Review DOLA independent-backing reconciliation

PegTracker has completed the requested reconciliation. Please review its economic
methodology and return a publication-ready decision on the metrics, assumptions
and qualifications; do not promote pending payloads through this handoff.

## Inputs

- `/home/danger/PegTracker/handoffs/results/dola-backing-reconciliation-2026-10-14.md`
- `/home/danger/PegTracker/handoffs/results/dola-backing-reconciliation-2026-10-14.json`
- `/home/danger/PegTracker/dola_backing_reconciliation.py`
- `/home/danger/PegTracker/tests/test_dola_backing_reconciliation.py`
- Current canonical DOLA assessment and pending editorial overlays in your repo.
- `/home/danger/backing-monitor/specs/dola-dashboard-plan.md` and
  `/home/danger/backing-monitor/specs/dola-feed-contract.md`.

The calculation is pinned to Ethereum block 26190144, October 14 at 10:28:35Z.
External prices and API enumeration have separate clocks. Nine producer tests
passed, and backing-monitor independently checked ratio arithmetic, convention
invariance and closure against the returned JSON. These checks do not validate
economic recoverability or establish independent reserves.

## Result requiring judgment

PegTracker recommends retaining `backing.collateral_ratio: null`. Under its base
assumptions, internal-first/pro-rata/external-first conventions produce 83.69%,
88.33% and 89.17% respectively. Base model uncovered is 2,775,919 DOLA, about
3.82% of reconstructed gross outside liabilities, predominantly Frontier debt.
This amount is invariant across those conventions within that scenario, not
across all assumptions. Stress raises uncovered to 2,832,162 DOLA. The pool-drain
overlay changes convention ratios further and is not a stableswap simulation.

The canonical feed remains unchanged, with null collateral ratio. No new ratio
or reconciliation field is published, and no scheduler has been installed for
this review-only probe.

## Requested review

1. Validate liability exclusions and ownership: unborrowed market/Fed balances,
   PSM inventory, Frontier cash, treasury DOLA and any omitted protocol-held
   balances. Resolve or bound the 79,532-DOLA excess of debt claims over reconstructed
   circulation and the issuer API's cached/lagging supply discrepancy. An arithmetic
   closure does not establish completeness of the denominator.
2. Review per-borrower LP/strategy look-through, internal DOLA/sDOLA cancellation,
   external recovery conventions, incentive treatment and borrower-specific excess.
   Assess whether pro rata has sufficient mechanical support to be more than a scenario.
3. Review prices, haircuts, liquidation triggers/ability and correlated exits.
   Assess the effect of untraced reUSD backing, Ethena cooldown/recovery and the
   excluded INV/invUSD collateral. Clearly separate measured units from assumed
   external recovery and any protocol or market value retained by excluded collateral.
4. Review junior eligibility and shared capital allocation. Burning junior DOLA
   extinguishes liabilities; it is not an external dollar reserve or a guaranteed
   payout. Frontier is not covered. Prevent double counting across positions/scenarios.
5. Keep bridge custody separate: 2.323M remote supply remains unreconciled, and
   remote supply clocks differ from the Ethereum escrow reads. Do not infer absence
   of custody from incomplete address coverage or describe asynchronous matches as
   fully verified bridge backing.
6. Determine whether the modelled uncovered amount, its decomposition, convention
   range, pool pledge shares and borrower concentration are suitable dashboard
   disclosures. Specify labels and limitations so a model shortfall cannot be read
   as an independently established solvency deficit or holder recovery percentage.
7. Reconcile the written backing judgment and pending backing/basis/dependency/issuer
   overlays with accepted findings. Explain any score change; do not automatically
   override measured bands or choose a ratio to fill the blank tile.

## Return deliverables

- A review handoff stating accepted, rejected and unresolved methodology points.
- An explicit decision: retain null with revised basis, or propose a named ratio
  with its denominator, netting convention, scenario, source clocks and limits.
  Keeping null is a valid completed review outcome.
- Exact approved component semantics and a proposed producer-consumer schema
  extension for backing-monitor and PegTracker. Specify evidence links and whether
  each field is measured, derived or assumed. Retain the existing primary producer.
- Updated editorial artifacts in `data/axes_pending/`, with publication still
  pending approval; record required graph companion changes if applicable.
- Required corrections for PegTracker, plus a justified refresh cadence and failure
  policy if the reconciliation becomes a scheduled producer feed. PegTracker
  estimates a three-minute/~800-read probe and proposes daily or six-hourly runs.
- Validation results and remaining limitations. Do not claim deployed validation.

Do not modify another repository, dispatch agents, install cron, promote pending
overlays, register the dashboard or publish the ratio/report through this handoff.
The owner will deliver this file manually. No dispatch has occurred.
