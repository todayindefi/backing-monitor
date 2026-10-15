# DOLA presentation contract (proposed v1, 2026-10-14)

Send this file with each manual handoff and `dola-dashboard-plan.md`. These additive
fields are implemented by the local renderer; producers must confirm the contract
or return amendments before integration. Existing shared axis schemas remain authoritative.
No illustrative numbers below are live observations.

PegTracker's base feed carries `asset_slug: "dola"`, canonical identity, timestamp,
`peg` and `backing` using the existing shared contracts. Require
`backing.collateral_ratio: null` and a basis while independent backing is unresolved.
Custom detail lives under `asset_specific.dola`:

```json
{
  "schema_version": "dola-detail/1",
  "accounting": {
    "as_of": "measurement UTC timestamp",
    "source": "producer/source identifier",
    "basis": "Supply and debt definitions, coverage limitations",
    "coverage_status": "unresolved",
    "coverage_basis": "Why independent economic coverage cannot be established",
    "ethereum_supply_dola": null,
    "circulating_supply_dola": null,
    "firm_debt_dola": null,
    "firm_collateral_tvl_usd": null,
    "bad_debt_dola": null,
    "dola_lp_debt_share_pct": null,
    "ethena_linked_debt_share_pct": null,
    "markets": [
      {"name": "market name", "debt_dola": null, "debt_share_pct": null}
    ]
  },
  "psm": {
    "as_of": "measurement UTC timestamp",
    "source": "RPC/source identifier",
    "contract_address": "current verified app PSM address",
    "reserve_symbol": "USDS",
    "reserves": null,
    "dola_inventory": null,
    "sale_simulation_status": "not_measured",
    "basis": "Reserve units, fees, controller, simulation method/block and failure cause"
  },
  "junior": {
    "as_of": "measurement UTC timestamp",
    "source": "RPC/source identifier",
    "assets_sdola": null,
    "assets_dola_equivalent": null,
    "firm_debt_coverage_pct": null,
    "basis": "Conversion-rate clock, bounded coverage and eligibility conditions",
    "markets": [
      {"name": "market name", "status": "unresolved", "activation_at": null}
    ]
  }
}
```

Numbers must be JSON numbers in the named units; missing measurements remain null.
Percentage fields use 0–100 units. `reserves` is token units of `reserve_symbol`.
The versioned detail block must never carry schema-example placeholder strings.
Attach more precise component clocks/blocks as needed; `as_of` must not silently
date heterogeneous reads. The renderer prints source/basis and the block's clock.
Producer `risk_flags` carry decision-changing warnings through the shared renderer.

`coverage_status` and simulation/market statuses are producer-authored strings,
escaped and rendered verbatim. A changed state must change the payload. No browser
calculation converts current time into a junior activation assertion.

PegTracker's standalone exit ladder uses the current frxUSD ladder envelope with
`asset_slug: "dola"`, `chain: "ethereum"`, `sell_into: "USDC"`, `measured_at`,
quote window, cost conventions, `headline` and `rungs`. Per-rung generic
`input_amount` is DOLA token units; `output_usdc` is USDC units. Preserve raw amounts,
status, `size_usd`, `size_impact_bps`, `all_in_cost_bps`, route data and failed-rung
evidence. The adapter uses `input_amount` first and retains `input_frxusd` solely
for existing frxUSD compatibility. DexTracker supplies venue fields independently.

No registry entry or public feed is installed by preparing this contract. Integrate
approved feeds, verify merges and stage DOLA after producer return; keep the written
report's production flag separate from dashboard staging.
