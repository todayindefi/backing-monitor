# PegTracker: bounded source-prose follow-up after BM adoption

BM adopted f91c718 normal yzUSD/syzUSD output. Corrected amounts and separate clocks accepted; parser completion is not external backing/cash verification. No source-repository files modified.

Remaining source wording gap: syzUSD liquidity.primary_exit.gated_note retains “onward redemption is not [open]”, “KYC-gated and accredited-only” and “BINDING LEG: venue depth, not redemption”, although onward.gated=null and onward.gated_basis=unmeasured. Please align this note with explicit stage fields through the normal producer. Distinguish the dated wrapper eth_call/control-address probe from holder-specific onward eligibility, funding, delivery and executable cash proceeds. Do not infer a binding leg where the onward step remains unmeasured.

BM consumer now preserves producer primary-exit fields against a venue inventory overlay and derives a neutral stage-status caption instead of the conflicting legacy note. Raw data remains byte-for-byte owner output. No new simulation/transaction requested. Own-token LP, fUSDnr and Solana debt/bridge gaps remain open; expose their status as supported fields if/when refreshed by the responsible owner.
