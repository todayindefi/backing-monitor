# frxUSD independent backing verification

Producer: `frxusd_backing_verifier.py`, run at the start of the existing hourly
`sync_and_push.sh` schedule.

Outputs:

- `data/frxusd_backing_verification.json` (`frxusd-backing-verification/1`)
- `data/frxusd_backing_verification_history.json`

The current artifact separates four evidence classes:

1. `reserve_balances`: fixed-block Ethereum `balanceOf` observations, with the
   custodian's live `asset()` checked against the expected token address.
2. `navs`: valuation source, source timestamp, status and staleness for each
   token. USTB uses Superstate's public USTB/USD price endpoint.
3. `coverage`: independently observed on-chain asset value, issuer-reported
   assets/liabilities/coverage, and explicitly off-chain or unverified assets.
4. `liabilities`: Ethereum supply net of Fraxtal bridge escrow plus independently
   read Fraxtal supply. Remote OFT supply remains unmeasured.

`independent_coverage_pct` is null until global liabilities are independently
complete. `onchain_assets_vs_issuer_liabilities_pct` is a clearly labelled hybrid
lower-bound comparison and must not be presented as independent coverage.

Every address/chain read carries its own status. A failed read publishes null
with an error and alert, never zero. Erebor remains `offchain_unverified` until
an eligible bank statement or attestation is integrated. The BitGo WTGXX balance
is observed on-chain, while beneficial ownership remains
`custody_dependent_unverified` absent signed-address or account evidence.

Alerts cover token-address changes, failed contract/RPC reads, stale or failed
timestamped NAVs, quantity reconciliation differences, incomplete liability
reconstruction, and issuer or independently complete coverage below 100%.

