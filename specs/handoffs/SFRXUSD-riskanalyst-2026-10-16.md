---
from: backing-monitor
to: riskAnalyst
date: 2026-10-16
status: ready-for-manual-delivery
---

# sfrxUSD — dependencies, backing qualification, code assessment and issuer

We are preparing the dashboard from your October 15 `assets/sfrxusd.md` and
saved `data/reviews/sfrxusd-2026-10-15/` evidence. Read
`/home/danger/backing-monitor/specs/sfrxusd-dashboard-plan.md` and
`/home/danger/backing-monitor/specs/sfrxusd-feed-contract.md`; return substantive
accounting or display corrections before integration. TIDR's current sfrxUSD
report is already `production: true`; dashboard promotion is a separate step.

Prepare reviewed candidates in `data/axes_pending/` for:

- `sfrxusd_dependencies.json` (`dependencies/1`): Aave/Fraxlend/Gearbox lending,
  external LP exposures and underlying token risks, frxUSD reserve dependence,
  Frax-correlated collateral, Fraxtal and messaging/oracle infrastructure. Use
  normal upstream resolution and edge kinds; recompute generated downstream
  links through your graph tool. Separate solvency exposures from exit venues;
  the wrapper's own pricing/admin powers belong in Axis 5.
- `sfrxusd_backing_overlay.json` where needed: net-liability interpretation,
  own-token LP offsets, thin reported surplus, incomplete global inventory and
  beneficial-ownership evidence, and unresolved scrvUSD conversion. Current
  strategy measurements belong to PegTracker. Do not promote issuer coverage
  into independent global coverage or inherit frxUSD's backing score.
- `sfrxusd_contract_overlay.json` (`contract-overlay/1`): deployed-code and
  ChainSecurity audit scope, unverified audit-to-version linkage, administered
  PPS, concrete authority reach and combined structural judgment. Use the new
  security_analyst walk when returned; retain scope/source age for older evidence.
- `sfrxusd_issuer.json` (`issuer/1`): shared Frax issuer context, accountability,
  recourse and limitations, without an independent wrapper uplift.
- `sfrxusd_axis_basis.json` (`axis-basis/1`): confirm the October 15 mapping
  6.5 stability / 5.0 backing / 5.0 liquidity / 4.5 dependencies / 3.5 contract
  / 5.0 issuer, overall 4.5, or provide a subsequently revised assessment. The
  Dependencies section of the live six-axis spec reflects fleet scored behavior;
  emit the normal underlying score/basis. Respect authored versus computed
  eligibility; report scores cannot silently override measured bands. Redemption
  stays within Axis 3 and overall remains authored envelope metadata.

Please review the proposal for PegTracker to own the sfrxUSD primary redemption
probe: Ethereum disabled calls, Hop/Fraxtal route, destination inventory/share
bound, fee and oracle parameter age. We will show frxUSD payout separately from
the dollar exit ladder. A chain of successful quotes is not proof of primary
settlement or independently available reserve liquidity.

Return exact staged/final paths, commit, source/evidence clocks, schema validation,
score eligibility/basis, and unresolved gaps. Keep unapproved candidates outside
automatic sync roots. Do not activate publishing, change report production flags,
register the dashboard, edit other producers or dispatch agents. This is for
manual user delivery; backing-monitor has sent no message or launcher command.
