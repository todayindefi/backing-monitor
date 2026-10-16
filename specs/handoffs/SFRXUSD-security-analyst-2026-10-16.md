---
from: backing-monitor
to: security_analyst
date: 2026-10-16
status: ready-for-manual-delivery
---

# sfrxUSD — Ethereum, Fraxtal and primary-route authority topology

Read `/home/danger/backing-monitor/specs/sfrxusd-dashboard-plan.md` and
`/home/danger/backing-monitor/specs/sfrxusd-feed-contract.md`. Research pointers:
`/home/danger/riskAnalyst/assets/sfrxusd.md`, revised October 15, and its saved
`data/reviews/sfrxusd-2026-10-15/authority.json`, `oracle-writers.json`,
`oracle-authority.json`, `redeemer-and-controls.json` and source-verification
records. Confirm available filenames in that evidence directory. These are
starting evidence, not a substitute for your commissioned observations.

Prepare a validated topology through your established commissioning workflow,
with final intended path `topology/assets/sfrxusd.yaml`. Stage outside eligible
`topology/assets/` until reviewed; explain any commissioning or eligibility
prerequisite you cannot satisfy. backing-monitor generates Axis 5 JSON using
`tools/emit_axis5.py` from eligible committed topology; no prose score is requested.

Walk and label scope/reach for:

- Ethereum `0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6`: proxy upgrade root,
  controller/pricing setters, minter appointment and active minters. Verify
  `timelockAddress()` authority, delay and any alternate immediate path.
- Fraxtal token `0xfc00000000000000000000000000000000000008`, its ProxyAdmin,
  and mint/redeemer `0xBFc4D34Db83553725eC6c768da71D2D9c1456B55`: upgrade roots,
  owner, fee/oracle configuration and `recoverERC20` reach over the underlying.
- Pricing feed `0x1b680f4385f24420d264d78cab7c58365ed3f1ff`: enabled writers,
  implementation/update authority and pricing parameter writes. Distinguish
  response timestamp from parameter synchronization evidence.
- Documented Ethereum Hop and adapter route, including savings-token adapter
  `0x7311cea93ccf5f4f7b789ee31eba5d9b9290e126`: mint/burn, message configuration
  and upgrade paths. Declare incomplete peer/DVN/executor coverage.
- Effective Safe thresholds, ownership nesting and signer overlap across these
  roots, including relevant treasury custody. The Aave 1-of-1 Safe in the report
  is owned by the controller Safe; do not infer a single EOA compromise threshold.

Preserve chain/block, positive controls, validation and unresolved paths.
Separate configured delay from enforceable floor; a Safe's name is not proof of
timelock enforcement. Reconcile report claims with current state rather than
assuming October's observations remain current. Remote deployments beyond the
route are a coverage limit, not a claim of clean controls.

Return draft/final path, commit and eligibility status, validators run, resolved
root paths and remaining gaps. RiskAnalyst owns audit/code interpretation and
combined scoring. Do not activate publishing, register the dashboard, edit other
producers or dispatch agents. This is for manual user delivery; no dispatch has
occurred.
