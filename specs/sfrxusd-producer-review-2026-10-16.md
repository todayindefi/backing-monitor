# sfrxUSD producer return review — 2026-10-16

The user confirms all four handoffs were sent. A later inspection now finds
PegTracker and DexTracker's candidates and return notes as well as the security
candidate. This supersedes the earlier missing-file findings. No dashboard or
live feed was installed by this review.

| Producer | Located result | Integration state |
| --- | --- | --- |
| PegTracker | Four candidate JSON files in `data/dashboard_pending/sfrxusd/`, new producer modules and `handoffs/results/sfrxusd-pegtracker-2026-10-16.md`. Implementation remains uncommitted in the inspected tree. | Price/backing, histories, USDC ladder and primary probe available for consumer integration review. Primary-route ownership accepted. |
| DexTracker | `data/liquidity_pending/sfrxusd_liquidity.json` and `handoffs/results/sfrxusd-venue-inventory-2026-10-16.md`. Candidate is reported uncommitted. | Venue and LP ownership feed available for integration review. |
| security_analyst | Eligible `topology/assets/sfrxusd.yaml` in `6ec34a4`, finalized evidence/source clocks in `0f68686`. | Emitted into local preview from committed HEAD; seven layers, ten paths; independent rerun of producer's offline evidence validator passes. |
| RiskAnalyst | Five pending overlays in `91db036`, reconciled in `c62a967`. | Dependencies finalized at 4.0 and internal report/index aligned; external TIDResearch report source remains 4.5. Custody wording corrected. |

Discovery included ignored files in normal/proposed candidate paths, handoff
directories, registered worktrees and sfrxUSD-named branches, plus a bounded
search of `/tmp`. Absence from these locations does not establish absence from
another checkout or an unfinished session. No other producer's working tree was
changed or messages sent.

## Price, backing and venue returns now located

All five candidate feed files parse as JSON. Basic inspection confirms share-unit
inputs and USDC outputs on successful authoritative ladder rows; the independent
global backing ratio remains null. This is preliminary consumer review, not a
rerun or endorsement of the producers' full reported test suites.

At the returned snapshot:

- Issuer coverage is 100.14212189%, with $54,115.01 surplus / 14.2122bp of claims.
  The API asset/liability row sums reconcile. The scrvUSD LP reconstruction gap
  persists, about +$13,236.
- PegTracker identifies inconsistent liability marks: the issuer uses different
  USD/share marks across gross supplies and liability offsets. Revaluing the
  issuer quantities at one PPS lowers claims by about $5,709.70. This is an
  alternative convention comparison, not an independently complete denominator.
  Keep the issuer figure and both conventions explicit; reconcile the producer's
  general '$1 face value' basis wording with this row-level finding before display.
- Configured APY is about 4.90%; parameter lastSync agrees with the security
  candidate's October 15 observation.
- The USDC ladder's 50bp incremental size-impact crossing is bracketed between
  $2.801M and $3.000M NAV input. It is not an all-in-cost or exact capacity number.
  The producer flags treasury-owned route pools and nonmonotonic large-rung output.
- Primary-route status is `legs_simulate_settlement_untested`: source Hop and
  destination redeem legs simulate with state overrides, but full message
  delivery/return settlement was not executed. Payout is frxUSD, returned through
  its OFT route; destination cash is approximately 7.309M frxUSD and the view
  share bound differs slightly from the refreshed-price execution bound.
- DexTracker supplies scoped Ethereum venues and an additive `lp_ownership`
  block, retaining downstream frxUSD/USDT ownership without presenting that pool
  as a direct sfrxUSD venue. Remote observations are outside the headline scope.
- Peg history currently has 55 served entries with coverage metadata; backing
  history has one entry. Do not imply a completed multi-day coverage trend.

The RiskAnalyst return now qualifies September lastSync and roughly 5.10% APY
as historical and carries the newer producer observations separately. It retains
final Dependencies 4.0 in `c62a967`; internal report and index now agree.
TIDResearch still needs to align its external report source. The local preview and remaining producer requests
are recorded in `sfrxusd-preview-review-2026-10-16.md`.

## Authority candidate review (historical; finalized return below)

The YAML parses and contains seven authority layers and ten paths. All authority
layer values match the producer's declared vocabulary; every path contains the
required fields listed in `specs/axis5-contract-admin-spec.md`. This was a direct
candidate check, not a claim that the producer's full gates passed: its standard
topology validators enumerate `topology/*/*.yaml`, excluding this draft location.

The observation pins are Ethereum block 26,202,298 and Fraxtal block 42,654,678.
The draft preserves the core findings: undelayed overlapping 3-of-6/3-of-5 roots,
pricing and mint powers, owner recovery of redemption assets, and incomplete
messaging/control scope. It does not establish a completed cross-chain exit.

Material update to the research baseline: the walk reports rate parameter
1,516,911,764 and Fraxtal `lastSync` 1,792,087,475, decoded independently as
**2026-10-15 18:04:35 UTC**. The September 24 parameter age and old roughly
5.10% APY in the October 15 assessment are historical. The dashboard must use
the pricing producer's current parameter observations and separate clocks;
this update alone is not independent evidence of strategy valuation.

Before treating this as an eligible Axis 5 input, obtain the following producer
return or amendments:

1. Preserve the documented Hop path as unresolved. Its `reaction_window.type`
   is `unresolved` but both time bounds are zero. Return null/omitted unknown
   bounds if supported, or an explicit schema/basis convention that prevents
   a consumer interpreting zero as a measured immediate reaction window.
2. Provide retained block-pinned RPC/storage evidence or reproducible query
   records supporting the new walk, along with the validation results actually
   covering the candidate. The committed return currently consists of the YAML
   and narrative audit. Older inherited comparison observations need their own
   source clocks and must not acquire the new walk's date.
3. Confirm eligible final-path promotion through the producer's normal review
   workflow. The serving emitter reads committed
   `topology/assets/sfrxusd.yaml`; it cannot consume this candidate by default.
   backing-monitor must not bypass that source selection to publish the draft.

Full peer/DVN/executor and auxiliary-minter coverage remain explicit limits;
they do not have to be mislabeled complete to integrate an honestly scoped walk.

## Finalized authority return

`0f68686` commits the eligible source, TSV and raw JSON replay evidence, an
offline validator and validation record. Rerunning
`PYTHONDONTWRITEBYTECODE=1 python3 audits/evidence/validate_sfrxusd_finalization.py`
passes all seven layers/ten paths, four quorum/owner-set checks, signer overlap,
rate and lastSync, pinned headers, inherited Hop evidence and source dates.
This verifies retained records and schema, not a new independent live RPC walk.

The reaction-window convention now explicitly refers only to the known direct
Hop owner call; messaging reach stays unresolved. The whole-source clock is
conservatively October 15, with October 16 commissioned pins retained separately.
The preview emitter reads this committed source with no working-tree divergence
and emits all seven Ethereum/Fraxtal layers. RiskAnalyst's older commissioned-walk
metadata still describes its prior candidate; current authority eligibility is
derived from the emitted walk, not that superseded editorial note.

The producer records its aggregate gate failing on unrelated pre-existing
untracked-file provenance, while candidate-specific validation, authority
vocabulary, control tiers and topology join pass. No unrelated files were changed.

## Next integration step

The renderer now integrates all returned parts locally. The remaining external
report alignment request is `handoffs/SFRXUSD-tidresearch-alignment-2026-10-16.md`.
Candidate activation, live registration and publication remain separate from
the completed local integration and producer-source review.
