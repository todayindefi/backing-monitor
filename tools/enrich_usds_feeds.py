#!/usr/bin/env python3
"""Add dashboard-owned USDS/sUSDS semantics after producer feed sync.

The PegTracker files remain the measurement source.  This normalizer only makes
relationships that backing-monitor renders explicit, and is intentionally
idempotent so it can run after every hourly copy.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


EXECUTIVE_OBSERVED_AT = "2026-10-08T14:50:16Z"
PRE_EXECUTIVE = {
    "timestamp": "2026-10-08T13:49:56Z",
    "surplus_buffer_usd": -60664887.94,
    "allocator_debt_usd": {
        "spark": 3754281102.07,
        "grove": 1719889475.65,
        "obex": 404163469.00,
    },
}
POST_EXECUTIVE = {
    "timestamp": EXECUTIVE_OBSERVED_AT,
    "surplus_buffer_usd": -49968665.33,
    "allocator_debt_usd": {
        "spark": 3755215361.19,
        "grove": 1723282450.14,
        "obex": 404163469.00,
    },
}


def load(path: Path) -> dict:
    with path.open() as fh:
        return json.load(fh)


def save(path: Path, value: dict) -> None:
    with path.open("w") as fh:
        json.dump(value, fh, indent=2)
        fh.write("\n")


def history_summary(history: dict, latest: float, field: str, limit: int = 24 * 30) -> dict:
    rows = [r for r in history.get("entries", []) if isinstance(r.get(field), (int, float))]
    rows = rows[-limit:]
    values = [float(r[field]) for r in rows]
    start = values[0] if values else latest
    change = latest - start
    tolerance = max(abs(start) * 0.001, 1.0)
    direction = "improving" if change > tolerance else "worsening" if change < -tolerance else "flat"
    return {
        "history_ref": "usds_backing_history.json",
        "field": field,
        "window": "last_30_days_or_available",
        "observations": len(values),
        "start_timestamp": rows[0].get("timestamp") if rows else None,
        "start_usd": round(start, 2),
        "latest_usd": round(latest, 2),
        "minimum_usd": round(min(values + [latest]), 2),
        "maximum_usd": round(max(values + [latest]), 2),
        "change_usd": round(change, 2),
        "direction": direction,
        "direction_basis": "latest minus first observation in the declared window; a less-negative buffer is improving",
    }


def enrich_usds(usds: dict, history: dict) -> None:
    usds["schema_version"] = max(2, int(usds.get("schema_version", 1)))
    backing = usds.setdefault("backing", {})
    supply = float(backing.get("total_supply") or usds.get("summary", {}).get("total_supply") or 0)
    buffer_usd = float(backing["surplus_buffer_usd"])
    backing["surplus_buffer_history"] = history_summary(history, buffer_usd, "surplus_deficit")
    backing["executive_observations"] = {
        "event": "Sky October 8 executive — September settlement cycle",
        "execution_effect_first_observed_at": EXECUTIVE_OBSERVED_AT,
        "pre_execution": PRE_EXECUTIVE,
        "post_execution": POST_EXECUTIVE,
        "change": {
            "surplus_buffer_usd": round(POST_EXECUTIVE["surplus_buffer_usd"] - PRE_EXECUTIVE["surplus_buffer_usd"], 2),
            "allocator_debt_usd": {
                key: round(POST_EXECUTIVE["allocator_debt_usd"][key] - value, 2)
                for key, value in PRE_EXECUTIVE["allocator_debt_usd"].items()
            },
        },
        "basis": "Adjacent retained hourly snapshots; timestamps are observations, not an inferred transaction timestamp.",
    }
    for star in backing.get("stars", []):
        star["debt_share"] = {
            "value_pct": round(float(star.get("size_usd", 0)) / supply * 100, 4) if supply else None,
            "denominator": "combined_usds_and_dai_supply",
            "denominator_usd": round(supply, 2),
            "source": "onchain",
        }
        star["mix_denominator"] = {
            "kind": "blockanalitica_per_star_backed_value",
            "value_usd": usds.get("asset_specific", {}).get("blockanalitica", {}).get("per_star_backed", {}).get(star.get("star")),
            "source": "blockanalitica",
            "note": "Mix percentages use the Star's BlockAnalitica-backed value, not the on-chain debt-share denominator.",
        }

    pocket = usds.get("asset_specific", {}).get("onchain", {}).get("pocket_usdc")
    usds.setdefault("liquidity", {})["fixed_rate_exit_capacity"] = {
        "venue": "LitePSM",
        "asset": "USDC",
        "inventory_usd": pocket,
        "rate": "1:1",
        "fees": {"tin": 0, "tout": 0},
        "capacity_basis": "USDC balanceOf(LitePSM pocket)",
        "as_of": usds.get("timestamp"),
        "note": "Inventory is exit capacity. The non-size-responsive quote ladder is not a depth measurement.",
    }
    usds["coverage_by_chain"] = [
        {
            "chain": "ethereum",
            "status": "measured",
            "covers": ["supply", "vow_surplus_buffer", "ilk_debt", "allocator_debt", "litepsm_usdc_inventory"],
            "as_of": usds.get("timestamp"),
        },
        {
            "chain": "other",
            "status": "not_measured",
            "covers": [],
            "note": "This feed makes no backing or exit-capacity claim for other chains.",
        },
    ]


def enrich_susds(susds: dict, usds: dict) -> None:
    susds["schema_version"] = max(2, int(susds.get("schema_version", 1)))
    backing = susds.setdefault("backing", {})
    total_assets = float(susds.get("summary", {}).get("total_assets_usds") or 0)
    usds_supply = float(usds.get("summary", {}).get("usds_supply") or 0)
    backing["share_of_usds_supply_pct"] = round(total_assets / usds_supply * 100, 4) if usds_supply else None
    backing["share_of_usds_supply_basis"] = "sUSDS totalAssets() / Ethereum USDS totalSupply()"
    backing["nav_usds_per_share"] = susds.get("asset_specific", {}).get("vault_state", {}).get("nav_usds_per_share")

    capacity = usds.get("liquidity", {}).get("fixed_rate_exit_capacity", {})
    susds.setdefault("liquidity", {})["exit_legs"] = [
        {
            "leg": 1,
            "from": "sUSDS",
            "to": "USDS",
            "mechanism": "ERC-4626 redeem()",
            "status": "measured_open" if susds.get("liquidity", {}).get("primary_exit", {}).get("gated") is False else "unresolved",
            "as_of": susds.get("timestamp"),
            "capacity": "uncapped_by_contract_probe",
        },
        {
            "leg": 2,
            "from": "USDS",
            "to": "USDC",
            "mechanism": "LitePSM fixed-rate exit",
            "status": "inventory_bounded",
            "capacity_usd": capacity.get("inventory_usd"),
            "capacity_as_of": capacity.get("as_of"),
            "capacity_basis": capacity.get("capacity_basis"),
        },
    ]
    susds["coverage_by_chain"] = [
        {
            "chain": "ethereum",
            "status": "measured",
            "covers": ["totalSupply", "totalAssets", "USDS_balanceOf", "NAV", "redeem_simulation"],
            "as_of": susds.get("timestamp"),
        },
        {"chain": "base", "status": "contract_known_backing_not_measured", "covers": []},
        {"chain": "arbitrum", "status": "contract_known_backing_not_measured", "covers": []},
        {"chain": "optimism", "status": "contract_known_backing_not_measured", "covers": []},
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    args = parser.parse_args()
    usds_path = args.data_dir / "usds_backing.json"
    susds_path = args.data_dir / "susds_backing.json"
    usds = load(usds_path)
    susds = load(susds_path)
    history = load(args.data_dir / "usds_backing_history.json")
    enrich_usds(usds, history)
    enrich_susds(susds, usds)
    save(usds_path, usds)
    save(susds_path, susds)


if __name__ == "__main__":
    main()
