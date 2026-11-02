# Structured issuer evidence and weekly reconciliation — November 2, 2026

DeFiAnalyst owns sourced project/entity facts. RiskAnalyst retains issuer scores, rationale and score-decision clocks. govAnalyst owns governance collection. The dashboard joins exact component mappings and keeps documentary evidence separate from measured authority and balances.

## Publication contract

`tools/build_issuer_project_evidence.py` reads SQLite in read-only mode during the existing sync. `config/issuer_project_publication.json` allows this reviewed Saturn/Mento/Re/Curve pilot: public-source records are individually fingerprinted. Default-private DB rows are not automatically published because their sources are public. New or edited private rows require renewed publication review; public-designated rows may flow normally. No database, private notes, account balances, bridge funding, private simulations or research worklogs are exported.

`data/issuer_project_evidence.json` contains the public projection. Original field/source/profile clocks remain distinct from projection generation. Missing files and unknown records fail visibly. Component-scoped facts never inherit across sibling tokens. Verified, extracted and searched-not-found retain their source status; unknown never becomes an issuer-score penalty. Financial statements, reserve attestations and contract audits are distinct.

The existing Issuer surface adds core entities/roles/jurisdictions, holder rights, legal/access/financial/control fields, material developments and coverage. Passed votes are not execution; execution labels require an execution clock and transaction source. Events never automatically promote facts or scores. Missing/stale governance coverage does not mean no activity. Only the visible existing issuer panel receives the card, including bespoke Saturn views.

## Weekly adoption

- Re scores remain 5.5 with original decision dates. BVI issuer and Cayman licensed reinsurer remain separate. Withdrawn attachment-point modelling and historical $20M scenario cannot appear as current contractual cushion.
- reUSDe October request/claim terms and sUSDe payout come from producer fields. Eligibility, remaining capacity and actual settlement remain unknown. First-window observations remain historical.
- Curve reUSDe→sUSDe depth is one marginal token-to-token leg. Its raw exchange-rate baseline is not a USD discount. Independently dated sUSDe USD valuation and downstream execution remain missing.
- USDm retains measured all-reported-debt ratios; API/wallet scope difference is unreconciled, with unexplained residual unmeasured. V3 documentation alone cannot restate the denominator. Official API methodology includes legacy reserve-backed FX liabilities, separately from CDP debt; USDm collateral must not be counted twice.
- crvUSD deployed supply now uses deployed operator issuance, with minted and excluded idle separately reconciled. Minted-basis CR is a sensitivity, not realized insolvency. YieldBasis share uses current deployed figures. Zero PK debt/burn capacity does not erase other defense channels.
- Accepted RiskAnalyst bounded security follow-up is displayed from its producer fields: expanded restricted eDAO powers, 43% policy setting and remaining verifier/destination chronology limits. No score/full-verification clock advances.

## Explicit publication/source gaps

1. The initial uncommitted-topology gate was subsequently closed by the owner. Existing BM commit `5952ca5d44` adopts the committed bounded security topology and preserves per-layer clocks. The dated overlay follow-up remains separate from older untouched observations. Ultimate verifier-owner governance and Arbitrum/Sonic/Taiko destination chronology remain open; no duplicate full review is requested.
2. Accepted Curve execution receipts exist in DeFiAnalyst's return, but canonical imported governance rows still omit normalized execution clocks/hashes. The pilot labels these as execution reported/evidence incomplete until owner feed repair. Destination execution and current authority remain separate.
3. Mento live Reserve-backed/CDP denominator and LP-versus-wallet residual reconciliation require producer measurements. Existing measured figures are not silently replaced.
4. Re live claimant entitlement/settlement and complete USD exit route remain unestablished. Component-specific public issuer/holder-rights coverage must be completed by DeFiAnalyst rather than borrowing sibling-token facts.

See `source-clocks.json` and `served-acceptance.json` for exact clocks, public file hashes, served URLs and desktop/mobile acceptance. Producer semantics tests preserve observation clocks and summary amounts; no transactions, collectors, approval calls or Telegram sends were invoked.

## Validation limitation

PegTracker full hook suite: 2477 passed, 12 skipped, four failures outside these scoped changes (`test_crvusd_backing_alternatives`, dependency links, syzUSD fill ratio, yzUSD pool price). All53 relevant USDm tests and the three semantic clock/history tests passed. The scoped producer commit deliberately used the hook's documented `SKIP_TESTS=1` escape hatch; the broader suite is not represented as green. Producer commits: PegTracker `f4db68c`, DexTracker `7f1bab1`, both pushed.
