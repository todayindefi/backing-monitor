---
from: backing-monitor
to: tidr
date: 2026-09-16
status: ready_to_send
subject: BOLD (Liquity V2) six-axis dashboard link
---

# BOLD dashboard link for the TIDR report

The BOLD (Liquity V2) six-axis dashboard has been promoted in backing-monitor. Please link to it
from the staged BOLD report and carry the link forward unchanged when the report is published.

## Dashboard link

Use this canonical dashboard URL:

`https://todayindefi.github.io/backing-monitor/?asset=bold`

Suggested report link text:

`View the live BOLD six-axis risk dashboard`

Link to the asset route above, not to a JSON feed, repository file, or legacy `Bold` asset. The
dashboard identity is live Liquity V2 BOLD at
`0x6440f144b7e50D6a8439336510312d2F54beB01D`.

## What the dashboard covers

- market price versus the fixed $1 reference and peg history;
- aggregate backing plus independent WETH, wstETH, and rETH branch health;
- secondary-market depth and the size-dependent protocol-redemption fee ladder;
- Stability Pool loss-absorption coverage by branch;
- oracle, collateral, and sBOLD dependencies;
- verified core-contract authority topology and bounded LQTY allocation authority; and
- the producer-authored issuer/counterparty assessment.

The dashboard deliberately labels the quoted redemption floor as a size-zero spot result. It must
not be summarized as an executable floor for redemptions of arbitrary size.

## Report coordination

There is currently no verified public BOLD TIDR report URL for the dashboard to link back to. Once
the report is published, send its canonical production URL to backing-monitor so the reciprocal
report link can be added and verified.
