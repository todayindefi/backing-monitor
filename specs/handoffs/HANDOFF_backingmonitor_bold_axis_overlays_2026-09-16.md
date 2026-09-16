---
target_repo: riskAnalyst (~/riskAnalyst)
target_claude: riskanalyst
target_files:
  - data/axes/bold_axis_basis.json
  - data/axes/bold_dependencies.json
  - data/axes/bold_contract_overlay.json
  - data/axes/bold_issuer.json
date_drafted: 2026-09-16
date_sent: 2026-09-16
status: sent
status_detail: >
  Four overlays synced and schemas/scores validate; check_feeds.py has 0 failures and desktop/mobile
  DOMs render. The sBOLD upstream/downstream classification was corrected. Follow-up requested after
  user review: split the combined collateral-set row into WETH / ETH, wstETH / Lido, and rETH /
  Rocket Pool dependency rows; keep the permanently-closed-set finding in dependencies.note rather
  than in a chip label. The staged dashboard copy has been updated, but the producer source must
  adopt the same structure so the next sync does not overwrite it.
---

# BOLD dashboard: publish the existing assessment through standard axis overlays

BOLD is about to be registered as a staged six-axis dashboard. This requests no new research or
score. Publish judgments already in `assets/bold.md`, `specs/bold-dashboard-field-spec.md`, and
`specs/bold-liquity-v2-work-state-2026-09-14.md`, informed by security_analyst's completed walk.

PegTracker supplies axes 1/2 measurements, DexTracker supplies `liquidity/1`, and security_analyst
supplies authority observations. Do not restate their observations as riskAnalyst measurements.

## Deliverables

Use schemas already adopted by backing-monitor.

### `bold_axis_basis.json` — `axis-basis/1`

Publish existing authored bases/scores for peg, backing, liquidity, dependencies, and contract where
the current schema expects them. Each basis says what it measures and does not override computed
measurement bands. Read current report values rather than copying numbers from this handoff.

Do not smuggle axis-6 prose through a score-only path. Follow the current fleet shape and document
any deliberate omission caused by the current editorial-axis rule.

### `bold_dependencies.json` — `dependencies/1`

Publish upstream entries with `name`, measured `metric` where available, `source`, and `note`:

- permanently closed WETH/wstETH/rETH collateral set;
- Chainlink ETH/USD and LST rate dependencies, including branch-retirement failure mode and
  constructor-fixed oracle addresses/staleness thresholds;
- sBOLD as material downstream, with downstream tracking explicitly declared.

Keep authority observations on axis 5. If sBOLD owner/paused state is relevant here, cross-reference
axis 5 and do not price it twice.

#### Follow-up from staged-page review — 2026-09-16

Render the three collateral paths as separate upstream entries with short names:

- `WETH / ETH`
- `wstETH / Lido`
- `rETH / Rocket Pool`

They are distinct dependencies even though all three carry correlated ETH beta. Keep Chainlink as
its own oracle entry. Move the fact that the collateral registry is permanently closed into the
block-level `note` (or the entries' longer explanatory text); it is an important structural finding,
but it is not a useful dependency-chip title.

### `bold_contract_overlay.json` — `contract-overlay/1`

Supply only the code/audit/judgment half complementing the authority walk. `authority_note` must say
it does not restate topology. Cover the existing reasoning and limits plus the bounded LQTY weekly
initiative allocator.

The walk found measured absences in core administration. Do not turn that into “no governance”:
the LQTY allocator is an undelayed authority over BOLD held by Governance, bounded away from core
administration.

### `bold_issuer.json` — `issuer/1`

Publish the editorial conclusion verbatim through `summary` and attributed facts. The field spec's
key result is a verified absence of an issuer counterparty; say what was checked and its limits.
“No issuer” must not imply no organization, team, oracle dependency, wrapper admin, or governance.

There is no verified public BOLD report URL. Publish the correct no-report/unpublished state rather
than inventing a link. If one becomes public first, use only a verified production URL.

## Cross-cutting requirements

- Identity is live BOLD `0x6440f144b7e50D6a8439336510312d2F54beB01D`, not ticker; distinguish legacy `Bold` where needed.
- `as_of` is the assessment/observation clock, not generation time.
- Preserve authored bases and limits; do not repeat current balances as timeless claims.
- Use standard envelopes and filenames already adopted by backing-monitor.
- Close with what each overlay did not establish.

## Lifecycle and verification

`drafted` becomes `sent` only when forwarded to the riskAnalyst live session. It becomes `applied`
only after backing-monitor verifies emitted JSON, syncs it, and confirms fields in the staged DOM.
A completion statement alone is not verification.
