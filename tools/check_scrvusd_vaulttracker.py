#!/usr/bin/env python3
"""Compare a same-pin VaultTracker scrvUSD shadow to the existing consumer."""
import argparse
from decimal import Decimal
import json
from math import ulp
from pathlib import Path

VAULT_ID = "eip155:1:0x0655977feb2f289a4ab78af67bab0d17aab84367"
ASSET = "0xf939e0a03fb07f59a73314e73794be0e57ac1b4e"
FIELDS = {
    "reported_total_assets": "total_assets_crvusd",
    "direct_crvusd_token_balance": "custody_crvusd",
    "total_idle": "idle_crvusd",
    "total_debt": "strategy_debt_crvusd",
    "effective_share_supply": "effective_supply_shares",
    "native_nav_per_share": "nav_crvusd",
    "generic_one_share_preview": "preview_crvusd",
}


def compare(client, baseline):
    legacy = baseline["asset_specific"]["scrvusd"]
    if baseline["chain"].lower() != "ethereum" or legacy["identity"]["asset"].lower() != ASSET:
        raise ValueError("Wrong baseline chain or underlying")
    result = client.get_vault(VAULT_ID, client.manifest["generated_at"], allow_stale=True)
    report = {"vault_id": VAULT_ID, "generation": client.generation_id,
              "baseline_block": legacy["block"], "status": "blocked"}
    record = result.get("record")
    if not record:
        return dict(report, reason="Exact VaultTracker record unavailable")
    asset_refs = {a["id"] for a in record["asset_registry"]
                  if (a.get("chain_id"), a.get("address", "").lower(), a.get("decimals")) == (1, ASSET, 18)}
    if record["subject"]["decimals"] != 18 or not asset_refs:
        raise ValueError("Wrong share or asset units")
    pins = [s for s in record["source_inputs"] if s.get("native_coherence_status") == "native_pin"
            and s["block_number"] == legacy["block"]
            and s["block_hash"].lower() == legacy["block_hash"].lower()]
    if len(pins) != 1:
        return dict(report, reason="Matching native block and hash required")
    pin = pins[0]
    values = {**legacy, **legacy["accounting"]}
    evidence = dict(record["accounting"])
    evidence["generic_one_share_preview"] = record.get("exits", {}).get("standard_terms", {}).get("generic_one_share_preview")
    comparisons = {}
    for field, key in FIELDS.items():
        item = evidence.get(field) or {}
        raw = item.get("raw")
        if (not isinstance(raw, str) or not raw.isascii() or not raw.isdecimal()
                or item.get("value_status") != "observed" or item.get("decimals") != 18 or item.get("source_refs") != [pin["id"]]
                or item.get("asset_ref") not in ({"share"} if field == "effective_share_supply" else asset_refs)):
            comparisons[field] = {"status": "unverified"}
            continue
        amount = Decimal(raw).scaleb(-18)
        selected = values[key]
        # The legacy feed divided native integers using binary floating point.
        # Bound conversion and serialization error in ULPs; zero debt stays exact.
        tolerance = Decimal.from_float(2 * ulp(float(selected))) if selected != 0 else Decimal(0)
        delta = abs(amount - selected)
        comparisons[field] = {"status": "match_to_published_precision" if delta <= tolerance else "mismatch",
                              "delta": str(delta), "tolerance": str(tolerance)}
    controls = record["accounting"].get("controls", {})
    queue = controls.get("default_queue") or {}
    addresses = queue.get("addresses")
    queue_status = "unverified"
    if isinstance(addresses, list) and queue.get("source_refs") == [pin["id"]]:
        queue_status = "match" if addresses == legacy["controls"]["queue"] else "mismatch"
    implementation = controls.get("implementation_address")
    implementation_match = (controls.get("source_refs") == [pin["id"]]
                            and isinstance(implementation, str)
                            and implementation.lower() == legacy["controls"]["implementation"].lower())
    passed = (all(v["status"] == "match_to_published_precision" for v in comparisons.values())
              and queue_status == "match" and implementation_match)
    return dict(report, status="shadow_parity" if passed else "blocked",
                native_block_time=pin["block_time"], comparisons=comparisons, default_queue=queue_status, implementation_match=implementation_match)


if __name__ == "__main__":
    from vaulttracker.client import VaultClient

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("generation", type=Path)
    parser.add_argument("baseline", type=Path)
    args = parser.parse_args()
    result = compare(VaultClient(args.generation),
                     json.loads(args.baseline.read_bytes(), parse_float=Decimal))
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result["status"] == "shadow_parity" else 2)
