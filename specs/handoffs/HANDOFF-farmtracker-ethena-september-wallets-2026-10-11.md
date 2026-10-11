---
id: farmtracker-ethena-september-wallets-2026-10-11
from: backing-monitor
to: FarmTracker
status: ready
priority: high
date_drafted: 2026-10-11
output: FarmTracker's normal Ethena reserve-wallet export consumed by PegTracker
---

# Track the seven reserve wallets added by Ethena's September attestation

PegTracker integrated Ethena's September 27 attestation in `cc92deb`. Its scheduled feed now
correctly reports a scope gap: $1.91B tracked on-chain versus $2.62B attested. This is not a backing
shortfall. FarmTracker's export lacks seven disclosed accounts.

Add these exact addresses to the canonical Ethena reserve-wallet set:

```
0x1a52abd3de0caceb71c5871386bec4f6eb80cc8e
0x3e9924b65eb75d05b7448305e66d1f490e70623d
0x61e614ec5e2f282ca42f313afacb45738ddacdae
0xa13fee3e98808fe0ab4ae86509c6a068b3d24174
0xb127f6f301de26c72a4f4b65f2f15e12fae31e0b
0xc1f00a3b50cbf62d91a0bed27e978eaed0470e58
4FaQc6QZ5skFjcDF64mKcXRhtCCsnArZcr1xumPNrbtN
```

Source: Ethena, “Custodian Attestations of Assets Backing USDe: September,” snapshot
2026-09-27 23:59 UTC, published 2026-10-10:
https://ethena.fi/blog/custodian-attestations-of-assets-backing-usde-september-3

Acceptance:

- Track six EVM accounts and the Solana account with chain-correct readers.
- Preserve per-wallet fetch status; an unreadable wallet is unmeasured, never zero.
- Publish the refreshed canonical wallet export on the normal schedule.
- Reconcile the exported roster exactly to the 12-address attestation set.
- Do not force the measured total to equal the attested bucket; report any remaining difference as
  scope/timing divergence.
- Return the commit, scheduled-run timestamp, output path, and per-wallet status to PegTracker and
  backing-monitor.
