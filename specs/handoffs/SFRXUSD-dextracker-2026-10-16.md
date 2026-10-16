---
from: backing-monitor
to: DexTracker
date: 2026-10-16
status: ready-for-manual-delivery
---

# sfrxUSD — Ethereum venue inventory and treasury LP ownership

Read `/home/danger/backing-monitor/specs/sfrxusd-dashboard-plan.md` and
`/home/danger/backing-monitor/specs/sfrxusd-feed-contract.md`. Research is
`/home/danger/riskAnalyst/assets/sfrxusd.md`, revised October 15, with reproducible
saved evidence in `data/reviews/sfrxusd-2026-10-15/`.

Prepare `data/liquidity_pending/sfrxusd_liquidity.json`, final intended name
`data/liquidity/sfrxusd_liquidity.json`, using `liquidity/1`. Ethereum token:
`0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6`. Primary headline venue scope is
Ethereum; Fraxtal and other deployments need explicit queried/not-queried/failure
states. Scope by exact chain and address; an Ethereum enumeration does not
establish remote exit availability.

Enumerate venues with pool roles and verified balances where supported. Show
frxUSD payout as an underlying/family swap rather than a terminal dollar exit;
reUSD/scrvUSD/dUSD pairs require their own downstream exit assumptions. Separate
LP wrappers/stakes from underlying pool inventory, retain exclusions, and expose
enumeration's own clock, pagination/truncation, provider failures and limitations.

Recheck the research ownership of `0xF292eB6c5dcb693Eaaf392D0562a01C3710E5978`
(sfrxUSD/frxUSD) and `0xD6937eA8D33B0C21348F36F7895FdE3054bA4927`
(frxUSD/USDT, a downstream route venue). The controller owned approximately
99.9998% and 99.9948% of LP supply at the October 15 snapshot. Return current
holder/Convex stake, LP supply, percentage, block, source and limitations in
structured fields, proposing an additive schema if necessary. Retain downstream
route ownership without pretending that pool directly holds sfrxUSD. Operator
withdrawal risk is material even when current quotes work.

PegTracker is requested to produce the executable dollar ladder and accept the
primary redemption probe. This feed should declare inventory ownership and
avoid displacing the ladder with an absent depth figure. TVL is not executable
depth; treasury cash, LP inventory and withdrawal getters cannot be summed.

Return candidate/final paths, commit, validation, proposed cadence/freshness
rules and unresolved discovery or ownership gaps. Keep candidates outside the
sync root until reviewed; do not activate publishing, register the dashboard,
edit other producers or dispatch agents. This is for manual user delivery;
backing-monitor has not dispatched it.
