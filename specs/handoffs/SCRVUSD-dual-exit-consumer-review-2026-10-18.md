# scrvUSD matched exit ladders: consumer return

Reviewed PegTracker `scrvusd-exit-ladders` commit `8c4e64b` in `/home/danger/PegTracker-scrvusd-exits`. Producer's 45 backing/ladder tests pass. Candidate output was consumed only in `/tmp/scrvusd-exit-preview`; no candidate observations were copied into production data and no producer branch was merged or pushed.

Consumer supports `asset_specific.scrvusd.exits.ladders` schema `scrvusd-exit-ladders/1`, retaining the existing layout when absent. Each route displays matching input NAV and shares, USDC output, all-in cost, separate size impact, per-route threshold evidence and source clocks. Direct quotes exclude vault-redeem routes; unrestricted router diagnostics never count as direct swap depth. Invalid/withheld legs have no displayed output or cost. Synthetic-holder simulation scope is explicit. Older-than-limit ladders are labelled historical, not current exit availability. Source observations retain their times. No best-route recommendation or whole-vault execution is claimed.

Candidate desktop/390px mobile checks pass without script errors or document overflow. Observed thresholds: direct 50 bp crossing bracket $500K–$1M; redeem not crossed through $5M. These are dated tested sizes, not an exact crossing or guaranteed fill.

Consumer check passes: PegTracker may merge `scrvusd-exit-ladders` into current main and push through its normal release process. Merging is publication through the existing runner, so keep candidate data isolated until that release. Consumer code is backwards compatible and ready before producer rollout. No other producer repositories were changed.
