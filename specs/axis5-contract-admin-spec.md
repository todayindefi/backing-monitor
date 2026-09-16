---
title: Axis 5 — Smart Contract & Admin
status: DECIDED 2026-09-16 by security_analyst and riskAnalyst; migration pending
---

# Purpose and ownership

Axis 5 is one combined editorial judgment over two non-offsetting sub-assessments:

1. **Smart-contract security:** intrinsic implementation, accounting, validation, liquidation,
   invariant, integration and remediation risk when authorized actors are honest.
2. **Admin and access control:** what a compromised or malicious authority can do, how quickly,
   and with what reach.

security_analyst owns observed authority topology. riskAnalyst owns code-risk interpretation,
evidence limits, cross-axis pricing and the combined `structural_score`. The dashboard derives
headlines from structured observations; it does not author asset claims.

# Per-path authority schema

Apply these fields to every authority **path**, not only its containing layer:

```json
{
  "control_state": "absent | renounced | active | unresolved",
  "actionable": "derived boolean | unresolved",
  "execution_delay": "not-applicable | none | <duration> | unresolved",
  "reaction_window": {
    "type": "none | epoch-gated | challenge-period | notice-period | unresolved",
    "basis": "producer observation",
    "minimum_window_seconds": 0,
    "maximum_window_seconds": 0
  },
  "reach": "none | full | bounded | unresolved",
  "reach_bound": "string | null",
  "value_at_risk_scope": "core | bounded-pool | wrapper | bridge | unknown",
  "changeability": "immutable | fixed-at-construction | mutable | unresolved",
  "terminal_kind": "EOA | multisig | DAO | contract | zero-address | no-controller | unresolved",
  "terminal_address": "address | null",
  "holder_kind": "EOA | contract | null",
  "independent_canceller": "true | false | not-applicable | unresolved",
  "delay_floor": "not-applicable | none | <duration> | unresolved"
}
```

Reaction-window objects may add type-specific fields. `epoch-gated` may carry
`epoch_duration_seconds`, `increase_cutoff_offset_seconds`, `effective_epoch_offset`, and
`veto_allowed_until`.

## Derived `actionable`

```text
control_state == active AND reach in {full, bounded} AND a real actor can initiate
    => true
control_state in {absent, renounced} OR reach == none
    => false
control_state == unresolved OR reach == unresolved
    => unresolved
```

The producer may materialize `actionable` for consumers, but validation must reject a value that
contradicts the source fields.

# Vocabulary invariants

- `execution_delay: none` means an actionable path can execute immediately.
- `execution_delay: not-applicable` means no actionable controller exists.
- `renounced` means an authority surface exists but terminates at a proven unreachable holder,
  normally `terminal_kind: zero-address`.
- `absent` means no mutation route/controller exists on the walked surface and normally pairs with
  `terminal_kind: no-controller`.
- `fixed-at-construction` describes configuration provenance/changeability, not controller state.
- `reach: none` describes present controller reach. Preserve a dormant function's hypothetical
  consequence separately; do not publish it as current reach.
- A reaction window delays observation/economic effect; it is never relabelled an execution
  timelock.
- `terminal_kind` describes the authority model; `holder_kind` separately records whether the
  terminal address contains code.

# Headline algorithm

Evaluate in this order:

1. Controller existence.
2. Whether the path is actionable.
3. Reach and value-at-risk scope.
4. Execution delay.
5. Delay floor/enforceability.
6. Distinct reaction window.
7. Unresolved coverage.

Headline precedence:

1. Active undelayed core/full path.
2. Active delayed core/full path.
3. No active core path; active bounded path exists.
4. No active authority path—immutable/renounced.
5. Authority unresolved.

Minimum delay is calculated only across `actionable: true` paths, grouped or qualified by reach and
scope. Core and bounded-pool paths must never collapse into one unqualified minimum.

# Rendering and color

- **Red:** active undelayed authority with core/full reach.
- **Amber:** active undelayed bounded authority, or delayed authority with material qualifications.
- **Neutral/green:** measured absence, renunciation or immutable construction.
- **Grey:** unresolved/not assessed; never green and never red.

Render unresolved states explicitly:

- `Authority unresolved`
- `Active authority · reach unresolved`
- `Active full/bounded authority · delay unresolved`

Render absent/renounced states rather than a delay, and suppress minimum-delay calculation for them.

# Score semantics and evidence blocks

`structural_score` covers both halves. A serious weakness in either constrains the final score;
strength in one cannot erase a critical weakness in the other. Measured absence of authority can
improve the admin half, while immutability's lost remediation capacity can independently weaken the
code half.

The public axis must display two labeled evidence blocks even when it publishes only one combined
score:

- Smart-contract security
- Admin and access control

The code block must cover deployed-code age/history, audits and deployed scope, formal verification,
unresolved findings, bounty terms/effective coverage, incidents/root-cause disclosure,
upgrade/remediation options, unreviewed components and evidence limits. Audit quantity never lifts
the score automatically.

# BOLD acceptance fixture

The correct BOLD headline is:

> No core admin path  
> 4 immutable/renounced layers · 1 active bounded allocator

It carries `Structural · 8.5/10` and an amber `Allocator · no execution timelock` chip. The
allocator's epoch mechanics are a reaction window: increases close after day 6 and payout is no
earlier than the following epoch. They are not an execution timelock. The display correction does
not change the score.

The five paths classify as: core upgrades `absent`; branch wiring/authorized set `renounced`;
mint/burn/pool-transfer allowlist `renounced`; price-feed configuration `absent` and
`fixed-at-construction`; LQTY initiative allocator `active`, `actionable`, undelayed and bounded to
the Governance-held BOLD pool.

# Migration

Mechanical migration is allowed only where the old observation proves the new state. Existing
`timelock` becomes `execution_delay` only on demonstrably active paths. Old `timelock: none` on an
absent/renounced path becomes `not-applicable`. Old `reach: full|bounded` on a non-actionable path
becomes present reach `none`; preserve hypothetical function consequence separately if useful.

`value_at_risk_scope`, `reach_bound`, changeability, reaction-window mechanics and cancellation
often require review or a new walk. Do not infer them merely to complete the schema. During rollout,
legacy rows retain the old renderer and must not be interpreted under the new headline algorithm.
