---
from: backing-monitor
to: riskAnalyst
date: 2026-09-16
status: cancelled_report_returned_to_staging
target_file: data/axes/bold_issuer.json
---

# BOLD issuer overlay: replace obsolete unpublished-report fact

> **Cancelled 2026-09-16:** the report was returned to staging for review with Liquity. The current
> unpublished-report fact is accurate again. Do not apply the request below unless publication is
> reconfirmed.

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
