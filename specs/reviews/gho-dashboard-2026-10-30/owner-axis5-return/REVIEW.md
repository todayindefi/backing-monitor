# GHO Contract & Admin — riskAnalyst owner review, October 30, 2026

**Reviewed staged score: 4.0/10. Historical canonical score: 6.0/10, unchanged.**

This completes our code-risk interpretation and combined judgment within the scope below. It accepts the candidate’s proposed 4.0 on its evidence, rather than treating a BM-prepared candidate as an independently authored score. The evidence leaves residual gaps; those limit the judgment and do not prevent a qualified assessment. No live report score, source-root overlay, overall score, publication or schedule changes are made.

## Combined judgment

The binding issue is the accepted 2-of-3 Council path to core issuance. At SA’s Ethereum pin, the Council can expand the full 310m facilitator capacity to 620m and mint without a queued DAO payload. The fork minted one wei to the existing reserve; arbitrary-recipient reach comes from matched source. The additional 310m is next-update headroom, not an immutable ceiling. Later eligible increases can expand it further. This is intended privileged capability, not an established exploit or key compromise.

The known one-day DAO floor and 5-of-9 guardian cancellation protect the queued DAO route, not the immediate Council route. Per-update bounds and cooldowns are real limits but do not create advance notice or independent cancellation. This prevents retaining the old moderate-risk 6.0 judgment on its former narrow authority rationale.

Source-bound implementation evidence, operating history and reviews prevent treating this as wholly unreviewed code or an established outsider exploit. However, those positives cannot offset core issuance exposure. **4.0 is an authored combined score, not a computed average or a claim that two keys have already been compromised.** We choose it rather than 6.0 because material core capability and no reaction window are now established, rather than merely unknown. We do not choose a still lower crisis rating because no active compromise or unprivileged mint bypass is established, and the measured path retains per-update bounds and cooldowns. This is not a universal numeric rule for other assets.

## Code-risk findings

- Original GHO token/integration reviews, upgradeable-token and modular-steward reviews, and RemoteGSM review provide component evidence. Audit counts alone receive no score credit. The 2026 sGHO review covers a downstream savings vault and is excluded from parent GHO core-minting audit credit.
- We repeated byte comparisons: deployed Gsm4626 standalone source equals the pinned RemoteGSM audit-revision file; deployed parent Gsm, reserve and bucket steward differ. A matching file does not establish matching inheritance, compiler output, configuration or integrations. A missing match is not proof no audit exists.
- The RemoteGSM report marks H-01 deactivation fixed. Current reserve removal requires both used and limit zero; positive-amount use and limit checks support the removal invariant by static inspection. We did not execute a fresh adversarial regression suite.
- M-01 fee accrual was marked fixed through documented operating sequence. Current Gsm4626 does not override inherited rescueTokens to accrue yield first. It is therefore operational guidance, not automatic code-enforced rescue accrual. SA found no current TOKEN_RESCUER grants on the two measured Ethereum modules; authorized future grants remain possible. No active public exploit is inferred.
- Formal-verification reports establish specified properties under their assumptions. No new prover run or proof over the entire currently deployed system is claimed.
- The2023 official discount-token self-transfer postmortem reports a fixed integration issue. The October 2026 low-severity payout request confirms a validated submission but does not disclose enough technical detail to establish its current deployment/fix state. No complete incident-clearance claim is made.
- The reviewed Immunefi terms show a $1m critical maximum, differing from Aave’s general marketing shorthand. GHO subsystem/deployment scope and exclusions apply; leaked keys, privileged access and centralization risks are excluded. It is not insurance against this Council path. Remote-chain scope cannot be assumed from general GHO naming.
- Ethereum token source is fixed while surrounding modules/reserves/controllers and some remote tokens are upgradeable. Token deployment history is useful operating evidence; proxy implementation deployment dates do not prove uninterrupted use or full upgrade-history coverage. Remediation paths differ by component, and delayed governance cannot pre-veto an immediate Council action.

## Evidence limits and cross-axis allocation

Remote role-history completeness, CCIP/emergency delivery, some remote-token and token-ProxyAdmin executable-source/permission closure, full audit-to-current-runtime/dependency matching, wrapper/pool integration coverage and current low-severity technical disclosure remain open. No fresh fork, formal prover, novel exploit audit or key-custody independence assessment was run here. SA’s 326-file authority package and the 60-file assessment candidate were hash-verified; the current review independently checked the key source predicates and archived audit remediation wording.

Dependencies 6.0 and Issuer 6.5 stay unchanged. The immediate core control path is priced on Contract & Admin. Backing realizability, price/exit conditions and overall scoring are separate assessments; no automatic second deduction is applied.

## BM/TIDR consumption

Use `gho_contract_overlay.json` as the riskAnalyst staged owner return. It supplies the reviewed 4.0 and accepted authority layers with all gaps. Do not continue showing it as an unreviewed BM proposal, but do not install it into production or overwrite canonical 6.0 without the separate adoption step. Preserve historical 6.0 as historical, not a current alternative judgment. The earlier “current structural score withheld pending owner review” state is superseded for staging only.

Source detail: [candidate report](../REPORT.md), [audit/source receipts](../manifest.json), [SA authority report](../accepted-authority/REPORT.md). Primary context: [audit corpus](https://github.com/aave-dao/gho-origin/tree/2af44932a8a632fd74b44adb4c92a4b51700e25a/audits), [bounty terms](https://immunefi.com/bug-bounty/aave/information/), [2023 postmortem](https://governance.aave.com/t/arfc-gho-technical-incident-13-11-2023/15642), [2026 payout request](https://governance.aave.com/t/aave-labs-request-for-bounty-payout-october-2026/25804).
