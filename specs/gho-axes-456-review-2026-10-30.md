# GHO axes 4–6 — staged evidence and presentation, 2026-10-30

The preview now has dependency, contract/admin and issuer content rather than
empty placeholder blocks. This is a source-qualified research candidate, not
an independent producer return. Current underlying, structural and issuer
scores remain null. No historical score was promoted and no public report,
registered dashboard, schedule or approved security topology was changed.

| Axis | Implemented | Remaining limits |
| --- | --- | --- |
| 4 Dependencies | Six upstream paths in the standard cards: Aave lending, facilitator concentration, waEthUSDC→USDC, waEthUSDT→USDT, CCIP/remote reserves, collateral pricing/liquidation | Paths are not exhaustive. Denominators differ and metrics are not additive; oracle-by-reserve mapping and downstream exposure are not surveyed. Current score not authored. |
| 5 Contract & Admin | Four source-qualified partial authority layers, targeted roles and controls, Ethereum and Monad block identities, catalogue audit evidence | Complete grant/revoke sets, mint/upgrade/executor paths, enforced delays/floors/cancellation and remaining chains unresolved; audit catalogue is not deployed-code coverage. Combined judgment remains unrated. |
| 6 Issuer | Current Codex-authored qualitative research field, source-labelled and explicitly unrated; identity, documented process and evidence limits; original riskAnalyst rationale preserved separately | Not an independent riskAnalyst return or a refreshed published report. Legal/regulatory status and par-redemption guarantee not established. Historical issuer 6.5 remains provenance only. |

Sources: official Aave GHO, governance and security pages; official address-book
commit `8259b4e02597dedcea2da13ebf80eaacf86f938e`; existing source-verified
PegTracker backing/reconciliation/history; original riskAnalyst report. Every
saved source has a SHA-256 and retrieval clock in the evidence manifest.

Fresh RPC: Ethereum block 26303999; Monad block 117835610. Full hashes, block
timestamps and all raw responses are in `sources/authority.json`. Token and
mainnet direct facilitator both confirm DAO executor DEFAULT_ADMIN. Token
FACILITATOR_MANAGER and BUCKET_MANAGER also confirm it. Deployer/token negative
controls return false. Enumeration reverts; these checks prove existence, not
exclusive ownership. Monad Safe is 2-of-3, Council holds reserve LIMIT_MANAGER,
GSM Steward holds CONFIGURATOR and reports an 86400-second update cooldown.
No execution delay is inferred from a cooldown or from hasRole.

The renderer no longer unconditionally overwrites loaded dependency and
contract findings with placeholders, or replaces a populated issuer panel.
The standard dependency, authority and issuer panels are reused. Historical
issuer rationale is inside the issuer provenance disclosure. Per-target names
are shown in the shared authority table so token and facilitator observations
cannot read as duplicate unidentified rows.

Browser checks found two shared presentation defects: long dependency/issuer
source URLs could overflow mobile widths, and new-schema unresolved delay
cells were green. Source URLs now wrap; unresolved delays are marked unknown,
and summary text says delays unmeasured. Changes are data-driven for the fleet.

Implementation: `tools/prepare_gho_remaining_axes.py`; consumer selection:
`tools/prepare_gho_preview.py`. Selection validates candidate/source hashes,
asset identity and review state and rejects current numeric scores in this
unapproved candidate class. The collector fails closed if positive/negative
controls or the 2-of-3 council evidence change, rather than emitting a stale
confirmation headline. It does not write eligible security topology.

Stable staged packet and concrete owner acceptance brief:
`/home/danger/riskAnalyst/data/dashboard_pending/gho-axes-456/HANDOFF.md`.
This is filed as a pending-data handoff, not a dispatched worker or owner
acceptance. The existing riskAnalyst/security briefs point to it. Producer
publication/score adoption is not implied by installing the pending packet.

Validation: two source-control tests; five consumer tests including hash
failure, historical/current score separation and source tampering; actual
browser acceptance at 1280px and 390px in both themes, including all evidence
expanded, missing/stale chart states, no page overflow and unknown delay color.
JS syntax and diff whitespace checks pass. Review archive:
`specs/reviews/gho-dashboard-2026-10-30/axes-456/`.

Rebuild:

```bash
python3 tools/prepare_gho_preview.py --state /tmp/gho-state-refresh.json --report-check /tmp/gho-report-verification.json
node tests/test_gho_browser.cjs
```


## riskAnalyst return consumed — 2026-10-30

The user supplied the completed producer review at
`riskAnalyst/data/reviews/gho-score-review-2026-10-30/`. Its manifest hashes are
verified for review.json, gho_dependencies.json and gho_issuer.json. The review
input SHA-256 equals the exact selected remaining-axes research packet
`ce713b7f68a797b81def876a9940cd978d0fa5e8522bd5acaa69087e0934b4f9`.

Dependencies **6.0** and Issuer **6.5** are now selected in the staged preview
with their current producer-authored prose and rationale preserved verbatim.
The adapter maps `score_rationale` to the standard score-basis fields and adds
the review's source/generated-at metadata, preserving original metric clocks.
The current issuer rationale replaces the in-session research summary; historical
rationale remains explicitly dated provenance. Report publication is unchanged.

Axis 5 stays null by an explicit validated return decision. The selector rejects
an attempted structural-score adoption through this two-axis return. Both the
code-half and authority-half producer review are displayed as supporting Axis 5
evidence. This does not complete a current authority walk or deployed-code review.

The source review is frozen in the preview evidence with hashes, and normal
rebuilds select it by default. Candidate observations remain distinct from
reviewed editorial axes; the selection manifest names the reviewed axes and
leaves only Contract & Admin in pending authored scores. No canonical report,
public feed, published registry or cron changes were made.

Validation: six consumer tests now include review hash tampering, input mismatch
and Axis 5 rejection. Browser checks verify both reviewed scores, the full
producer rationales, preserved six dependency paths and four authority rows,
Axis 5 withheld status, four layout/theme variants and chart failure states.
Renderer cache token: `gho.js?v=20261030f`. Frozen return adoption:
`specs/reviews/gho-dashboard-2026-10-30/score-review-adoption/`.
