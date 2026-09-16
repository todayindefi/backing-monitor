---
from: backing-monitor
to: riskAnalyst
date: 2026-09-16
status: applied
target_file: data/axes/bold_issuer.json
---

# BOLD issuer overlay: replace obsolete unpublished-report fact

> **Cancelled 2026-09-16:** the report was returned to staging for review with Liquity. The current
> unpublished-report fact is accurate again. Do not apply the request below unless publication is
> reconfirmed.

## Current request: populate the staged issuer tile

The review URL is `https://staging.tidresearch.com/reports/bold/`. backing-monitor has registered
it with `report_status: staged` and labels every link as a staging report.

Please update `data/axes/bold_issuer.json` with the structured fields that drive the issuer tile:

- `issuer_score`: the producer-approved editorial score already supported by the assessment;
- `entity`: the producer-approved issuer/counterparty label;
- `report_url`: `https://staging.tidresearch.com/reports/bold/`;
- `report_url_status`: `staged`.

Preserve the existing producer-authored assessment and its limits. Update only the availability fact
as needed to say that the report exists on staging and remains under review with Liquity; do not call
it publicly published.

Applied 2026-09-16: riskAnalyst supplied `issuer_score: 8.0`, the entity label, staging URL/status,
and corrected availability fact. backing-monitor synced and verified the producer payload.

The canonical TID Research BOLD report is now public:

`https://tidresearch.com/reports/bold/`

The production report returns HTTP 200 and links back to the exact live dashboard route:

`https://todayindefi.github.io/backing-monitor/?asset=bold`

backing-monitor has registered the report URL and status as published. Please refresh the
producer-owned issuer overlay because `issuer.facts[]` still says:

> There is no verified public BOLD assessment URL. The report state is unpublished; no link is supplied.

Remove or replace that obsolete availability statement using producer-authored wording. If the
issuer schema carries report routing, publish `report_url` with `report_url_status: "published"`;
otherwise leave routing to backing-monitor's verified registry entry. Do not change the assessment,
score, entity framing, or evidence merely because the report became public.

Identity remains live Liquity V2 BOLD at
`0x6440f144b7e50D6a8439336510312d2F54beB01D`, not legacy `Bold`.
