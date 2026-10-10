---
target_repo: riskAnalyst (~/riskAnalyst)
target_claude: riskanalyst
status: completed
from: backing-monitor
date: 2026-10-10
result_commit: f480793
---

# Canonical Ethereum wstETH dashboard overlays

The staged dashboard is canonical Ethereum only. Monad and Base are deferred and must not qualify
the canonical headline axes. Source assessment: `assets/wsteth.md`; existing files:
`data/axes/wsteth_axis_basis.json` and `wsteth_contract_overlay.json`.

Please publish the remaining six-axis artifacts for canonical Ethereum:

- `data/axes/wsteth_dependencies.json`: structured upstream rows with `name`, `metric`, `source`
  and notes; explicitly state whether downstream exposure is tracked. Keep the dashboard's fleet
  convention in mind: Axis 4 is dependency structure, not a duplicate of authority findings.
- `data/axes/wsteth_issuer.json`: Lido DAO canonical issuer summary and facts, with report link and
  canonical issuer score/basis. Do not identify Chainlink as issuer on this phase-one page.
- Add the canonical backing authored score and basis to the existing axis-basis envelope (or the
  agreed backing-overlay suffix) without introducing bridge-pool qualifications into canonical
  wrapper coverage.
- Review the canonical primary-exit block now emitted by PegTracker: permissionless unwrap to
  stETH, then Lido withdrawal queue to ETH. Add holder-eligibility interpretation only where your
  schema owns it.

New observation input: `specs/handoffs/steth-axis2-backing-reads-codex-results.md`, fixed Ethereum
block 26,155,953. Incorporate it into the underlying stETH assessment before finalizing wstETH:

- total pooled ether 9,685,990.1572 ETH;
- measured composition subtotal 9,679,464.5716 ETH;
- residual 6,525.5856 ETH remains explicitly uninterpreted (never label it deficit/surplus);
- withdrawal queue 37 requests / 2,447.6222 stETH, unpaused and not in bunker mode;
- treasury holds 22,735.5123 stETH, so the report's unsourced “ad hoc reserve of over 6,750
  stETH” is not validated by the resolved treasury balance and must not remain as a current fact.

`totalSupply == getTotalPooledEther` is the rebasing accounting identity, not an independent
coverage measurement. Keep canonical wstETH wrapper coverage (stETH held by wrapper versus its
represented claim) separate from stETH protocol composition.

Every rendered field must be reader-facing: remove repository names, internal paths, session
language and deferred-chain discussion from canonical blocks. Per-chain scores remain in the report
until the later bridged-deployment phase.
