# GHO Axis 5 adopted in the staged dashboard — 2026-10-30

The user explicitly authorized adoption after clarifying that staging and
publication are separate. The staged GHO feed now carries structural_score
**4.0/10**, alongside unchanged Dependencies **6.0/10** and Issuer **6.5/10**.
No additional riskAnalyst acceptance is required for this staged adoption.
No canonical report, producer publishing root, public registry or schedule
was changed. Source evidence and scope limitations remain attached.

`gho-axis5-staged-adoption-2026-10-30.json` records the user authorization,
exact original assessment hash, adopted rationale, date and staging-only scope.
The original proposal and its hashes remain frozen; its old “not adopted”
status describes that historical artifact, not the current staged dashboard.
The consumer creates a separate adopted view with a current score and basis,
source/date metadata and score_adopted=true. Hash mismatch, different score
or publication scope rejects reuse of this adoption receipt.

The standard summary card retains the actual control metric (0h warning)
and now shows the Structural 4/10 chip. The Axis 5 heading also carries the
score. The detailed rationale is labelled 4.0/10 staged rather than a proposal;
obsolete pending/not-adopted statements are removed from the rendered page.

The material finding remains unchanged: a 2-of-3 Council can expand the mainnet
facilitator bucket and mint without a DAO queue. +310m is next-update headroom,
not a lifetime ceiling; repeated eligible updates can add more. The DAO delay
and guardian cancellation do not pre-veto this path. This is authorized
capability, not evidence of exploitation. All remaining SA and code gaps stay.

Validation: three Axis 5 tests (including source preservation and rejection of
6.0/publication-scope substitutions), six consumer tests, and real-browser
checks at 1280px/390px in both themes. Browser assertions cover card/header
scores, unchanged 6.0/6.5, complete rationale, no stale “not adopted” text,
retained risk qualifications, responsive layout and chart failure states.
JS syntax and diff whitespace checks pass.

Preview: http://127.0.0.1:8891/?asset=gho
Frozen receipt and display evidence:
`specs/reviews/gho-dashboard-2026-10-30/axis5-staged-adoption/`.
