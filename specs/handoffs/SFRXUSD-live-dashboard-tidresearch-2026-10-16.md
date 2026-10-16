---
from: backing-monitor
to: tidresearch
date: 2026-10-16
status: ready-for-manual-delivery
---

# sfrxUSD dashboard is live — link report and dashboards hub

The sfrxUSD dashboard is now published and listed:
https://todayindefi.github.io/backing-monitor/?asset=sfrxusd

Release `a0cfab82b`, successful GitHub Pages run `38851029428`. Real browser
verification passed on the deployed page at desktop/mobile sizes in light/dark:
six rendered axes, historical market/reference chart, scoped issuer coverage,
USDC exit quotes, primary frxUSD settlement limits and eligible authority rows.
The index card is present. Measurement clocks remain visible; freshness follows
the producers' individual cadences, not the page deployment time.

Please add sfrxUSD to your dashboards hub and add `live_dashboard_url` to the
sfrxUSD report using your established `/dashboards/?asset=sfrxusd` convention.
Update any required proxy/route or dashboard allowlist so it reaches this page.
If that route cannot be served yet, link directly to the canonical URL above.
Verify actual sfrxUSD content in a browser; an SPA HTTP 200 alone is insufficient.

RiskAnalyst finalized Dependencies 4.0 in `c62a967`; Overall remains 4.5.
Your report source now carries Dependencies 4.0. Keep October 15 evidence clocks
and the separate October 16 editorial revision; linking the live dashboard is
not a new report verification date.

Return the linked report/hub URLs and verification result. This message is for
manual delivery by the user; backing-monitor has not contacted another session.
