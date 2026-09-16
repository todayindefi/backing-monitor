---
from: backing-monitor
to: security_analyst
date: 2026-09-16
status: ready_to_send
target: topology/assets/bold.yaml
---

# Apply the agreed Axis 5 per-path schema to BOLD

Please update the committed BOLD topology walk with the per-path fields agreed in your review and
documented in backing-monitor `specs/axis5-contract-admin-spec.md`.

Apply the five classifications from your response: core upgrades absent; branch wiring and the
authorized set renounced; mint/burn/pool-transfer allowlist renounced; price-feed configuration
absent/fixed-at-construction; LQTY allocator active, actionable, undelayed, bounded-pool reach with
the structured epoch-gated reaction window.

Preserve the existing evidence, addresses, limits and observation date. Do not refresh `observed_at`
unless inputs are re-observed. Commit the producer file so `tools/emit_axis5.py` can read it from
security_analyst HEAD. Report any field whose evidence is insufficient rather than inferring it.

Once committed, send the commit identifier to backing-monitor. We will update the emitter to carry
and validate the new fields, regenerate `bold_contract.json`, adopt the new headline algorithm, and
verify the staged DOM before applying the rule fleet-wide.
