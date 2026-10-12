#!/usr/bin/env python3
"""Reconcile Spark's Sky allocator debt with its two unlike asset readings.

BlockAnalitica `backed` is a principal/look-through basis and omits Spark's
direct sUSDS treasury balance.  This probe reads that balance independently and
publishes the arithmetic without pretending the remaining residual is profit,
idle liquidity, or missing collateral.
"""

from __future__ import annotations

import argparse
import json
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


SUSDS = "0xa3931d71877c0e7a3148cb7eb4463524fec27fbd"
SPARK_ALM_PROXY = "0x1601843c5e9bc251a3272907010afa41fa18347e"
BALANCE_OF = "70a08231"
DEFAULT_RPCS = ("https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com")


def _rpc(url: str, method: str, params: list) -> str:
    body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    req = urllib.request.Request(url, body, {"Content-Type": "application/json", "User-Agent": "backing-monitor/1.0"})
    with urllib.request.urlopen(req, timeout=20) as response:
        result = json.loads(response.read().decode())
    if result.get("error") or "result" not in result:
        raise RuntimeError(str(result.get("error") or "missing result"))
    return result["result"]


def read_susds_balance() -> tuple[float, int, str]:
    address_word = SPARK_ALM_PROXY.removeprefix("0x").lower().rjust(64, "0")
    calldata = "0x" + BALANCE_OF + address_word
    configured = [x.strip() for x in os.environ.get("SPARK_RECONCILIATION_RPCS", "").split(",") if x.strip()]
    errors = []
    for url in configured + list(DEFAULT_RPCS):
        try:
            block = int(_rpc(url, "eth_blockNumber", []), 16)
            raw = int(_rpc(url, "eth_call", [{"to": SUSDS, "data": calldata}, hex(block)]), 16)
            return raw / 1e18, block, url.split("//", 1)[-1].split("/", 1)[0]
        except Exception as exc:
            errors.append(f"{url}: {exc}")
    raise RuntimeError("all Ethereum RPCs failed: " + "; ".join(errors))


def build_reconciliation(usds: dict, susds: dict, shares: float, block: int, rpc_host: str) -> dict:
    stars = {row.get("star"): row for row in usds.get("backing", {}).get("stars", [])}
    spark = stars.get("spark") or {}
    debt = float(spark["size_usd"])
    backed = float((spark.get("mix_denominator") or {}).get("value_usd") or 0)
    nav = float(susds.get("backing", {}).get("nav_usds_per_share") or
                susds.get("asset_specific", {}).get("vault_state", {}).get("nav_usds_per_share"))
    susds_value = shares * nav
    apparent_gap = debt - backed
    combined = backed + susds_value
    residual = combined - debt
    return {
        "status": "partially_reconciled",
        "as_of": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "allocator_debt": {
            "value_usd": round(debt, 2),
            "as_of": usds.get("timestamp"),
            "source": "onchain_vat",
        },
        "external_principal_lookthrough": {
            "value_usd": round(backed, 2),
            "basis": "BlockAnalitica backed principal",
            "as_of": usds.get("timestamp"),
            "source": "blockanalitica",
            "note": "Not a net-asset valuation; excludes Spark's direct sUSDS treasury balance.",
        },
        "apparent_gap_before_direct_susds_usd": round(apparent_gap, 2),
        "direct_susds": {
            "shares": round(shares, 6),
            "nav_usds_per_share": round(nav, 12),
            "value_usds": round(susds_value, 2),
            "holder": SPARK_ALM_PROXY,
            "ethereum_block": block,
            "balance_observed_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "nav_as_of": susds.get("timestamp"),
            "source": f"onchain balanceOf via {rpc_host}",
            "classification": "reflexive_usds_claim",
        },
        "combined_observed_value_usd": round(combined, 2),
        "residual_after_direct_susds_usd": round(residual, 2),
        "residual_pct_of_allocator_debt": round(residual / debt * 100, 4) if debt else None,
        "residual_status": "unattributed_positive",
        "residual_possible_components": [
            "accumulated earnings",
            "idle liquidity inside lending vaults",
            "principal-versus-market-value differences",
            "recursive accounting differences",
            "cross-source timing",
        ],
        "note": "Direct sUSDS closes the apparent shortfall. The positive residual is published as unattributed; it is not asserted to be profit, surplus, or additional backing.",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=Path("data"))
    args = parser.parse_args()
    upath, spath = args.data_dir / "usds_backing.json", args.data_dir / "susds_backing.json"
    usds, susds = json.loads(upath.read_text()), json.loads(spath.read_text())
    shares, block, host = read_susds_balance()
    usds.setdefault("backing", {}).setdefault("star_reconciliation", {})["spark"] = build_reconciliation(
        usds, susds, shares, block, host)
    tmp = upath.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(usds, indent=2) + "\n")
    tmp.replace(upath)


if __name__ == "__main__":
    main()
