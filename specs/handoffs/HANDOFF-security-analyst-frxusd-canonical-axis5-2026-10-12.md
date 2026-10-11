---
target_repo: security_analyst (~/security_analyst)
target_claude: security_analyst
status: ready
from: backing-monitor
date: 2026-10-12
read_only: true
priority: high
target: topology/assets/frxusd.yaml
---

# Refresh canonical-Ethereum frxUSD Axis 5 authority evidence

Please perform a fresh, manual, observation-only authority walk for canonical frxUSD on Ethereum
and update `topology/assets/frxusd.yaml`. The existing topology is useful background, but much of it
was observed on 2026-08-23 and carries the retired-generator warning. Do not mechanically refresh
timestamps or promote unresolved legacy rows.

## Scope

Phase one is canonical Ethereum only:

- frxUSD `0xCAcd6fd266aF91b8AeD52aCCC382b4e165586E29`;
- its live proxy/implementation/admin path;
- mint, burn, freeze/thaw, pause/unpause, role-administration, and rescue powers;
- canonical custodian, redemption, or reserve-management contracts whose authority can materially
  affect holder claims or redemption availability.

Remote OFT peers, bridge executors, Fraxtal, and the other network deployments are out of scope for
this pass. Preserve existing cross-chain evidence where the shared file requires it, but do not use
it in the canonical headline. Note separately that peer configuration may create remote mint risk;
do not resolve that risk without walking those deployments in a later phase.

Current RiskAnalyst evidence suggests—but this walk must independently verify—the following:

- terminal Ethereum owner Safe `0xffffff4f3bac444b2c0ecf2a1840d018be783937`, reportedly 4-of-7;
- direct, undelayed token mint/freezer/freeze/thaw/pause/unpause powers;
- ProxyAdmin `0x0b2c3df006b2bd43cbcc60075e7a0bf314474ed6`;
- Timelock `0xb898ad2976b4d8f2e21521c9db16b7497825e503`, reportedly configured to 86,400
  seconds with a 7,200-second minimum and administered by the same Safe.

These are leads, not accepted facts. Read live contracts at one fixed block.

## Required observations

For every in-scope authority path, resolve and evidence:

- target contract, proxy type, implementation, and whether code is replaceable;
- exact callable power and present reach;
- controller, role administrator, and every intermediate authority hop;
- terminal authority model and address;
- for each Safe, live `getThreshold()` and `getOwners()` results;
- effective execution delay, enforceable minimum, who can change it, and any bypass, direct-admin,
  proposer, executor, or canceller route;
- whether the path is active, renounced, absent, bounded, or unresolved;
- reaction window and independent cancellation where supported;
- a positive control for every negative finding;
- fixed Ethereum block and UTC observation time.

Use the current `actionable-path/1` fields required by backing-monitor's
`specs/axis5-contract-admin-spec.md`: `control_state`, derived `actionable`, `execution_delay`,
`reaction_window`, `reach`, `reach_bound`, `value_at_risk_scope`, `changeability`, `terminal_kind`,
`terminal_address`, `holder_kind`, `independent_canceller`, and `delay_floor`. Publish `unresolved`
when evidence does not establish a field.

At minimum, explicitly answer:

1. Can the token implementation be upgraded, through what shortest live path, and can any actor
   bypass the nominal timelock?
2. Who can mint or burn frxUSD, are there caps or module-level bounds, and can those bounds be
   changed without delay?
3. Who can freeze, thaw, pause, or otherwise impair transfers or holder access, and is that path
   immediate?
4. Who can change role members, the ProxyAdmin owner, timelock roles, delay, or implementation?
5. Can a canonical redemption or reserve-management contract be upgraded, paused, drained, gated,
   or have fees/caps changed, and what terminal authority controls each action?
6. Which findings apply only to remote OFT/bridge deployments and therefore remain excluded from
   the canonical result?

## Deliverables and acceptance

- Commit the reviewed canonical evidence to `topology/assets/frxusd.yaml`, keeping fresh manual rows
  distinct from untouched legacy cross-chain rows.
- Add an audit note under `audits/` with traced paths, evidence, unresolved surfaces, and what the
  walk did not establish.
- Run topology, actionable-path, reader-prose, authority-layer, control-tier, YAML, and diff checks.
- Report the commit, changed paths, observation block/time, exact Safe threshold/owner reads, and
  every unresolved field to backing-monitor and RiskAnalyst.
- Do not transact, sign, change permissions, assign an Axis 5 score, or judge signer independence.
  Security Analyst owns observations; RiskAnalyst owns interpretation and scoring.

