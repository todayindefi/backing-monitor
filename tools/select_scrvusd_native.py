"""Project only scrvUSD native vault accounting into a shadow consumer payload."""
import argparse
from datetime import datetime, timezone
from decimal import Decimal
from hashlib import sha256
import json
from pathlib import Path

from check_scrvusd_vaulttracker import ASSET, VAULT_ID


def select(manifest, attempt, now):
    from vaulttracker.client import VaultClient

    client = VaultClient(manifest)
    if attempt.get("status") != "passed" or attempt.get("generation") != client.generation_id:
        raise ValueError("Latest producer attempt did not qualify this generation")
    result = client.get_vault(VAULT_ID, now)
    if result["status"] != "within_policy":
        raise ValueError("Native accounting unavailable or stale")
    row = result["record"]
    accounting = row["accounting"]
    pins = [s for s in row["source_inputs"] if s["native_coherence_status"] == "native_pin"]
    assets = [a["id"] for a in row["asset_registry"]
              if (a["chain_id"], a["address"].lower(), a["decimals"]) == (1, ASSET, 18)]
    if len(pins) != 1 or len(assets) != 1 or row["subject"]["decimals"] != 18:
        raise ValueError("Expected exact Ethereum accounting and units")
    pin, = pins

    def raw(item, unit):
        value = item.get("raw")
        if (item["value_status"] != "observed" or item["decimals"] != 18 or item["asset_ref"] != unit
                or item["source_refs"] != [pin["id"]] or not isinstance(value, str)
                or not value.isascii() or not value.isdecimal()):
            raise ValueError("Unqualified native quantity")
        return int(value)

    idle, debt, total, balance, nav = [
        raw(accounting[k], assets[0]) for k in ("total_idle", "total_debt", "reported_total_assets",
                                              "direct_crvusd_token_balance", "native_nav_per_share")]
    shares = raw(accounting["effective_share_supply"], "share")
    preview = raw(row["exits"]["standard_terms"]["generic_one_share_preview"], assets[0])
    queue = accounting["controls"]["default_queue"]
    if queue["source_refs"] != [pin["id"]] or not isinstance(queue["addresses"], list):
        raise ValueError("Default queue is not source-qualified")
    if idle + debt != total:
        raise ValueError("Native accounting does not reconcile")

    def scaled(value):
        return float(Decimal(value).scaleb(-18))

    return {"vault_id": VAULT_ID, "generation": client.generation_id,
            "manifest_sha256": sha256(Path(manifest).read_bytes()).hexdigest(),
            "block": pin["block_number"], "block_hash": pin["block_hash"], "as_of": pin["block_time"],
            "retrieved_at": pin["retrieved_at"], "freshness_policy_seconds": pin["freshness_policy_seconds"],
            "nav_crvusd": scaled(nav), "preview_crvusd": scaled(preview), "effective_supply_shares": scaled(shares),
            "accounting": {"idle_crvusd": scaled(idle), "strategy_debt_crvusd": scaled(debt),
                           "total_assets_crvusd": scaled(total), "custody_crvusd": scaled(balance),
                           "custody_minus_idle_crvusd": scaled(balance - idle), "accounting_difference_crvusd": 0,
                           "status": "reconciled" if balance == idle else "unreconciled",
                           "custody_basis": "VaultTracker native custody and Yearn accounting at one Ethereum block."},
            "default_queue": queue["addresses"]}


def project(legacy, manifest, attempt, now, last_good=None, mode="shadow"):
    detail = legacy["asset_specific"]["scrvusd"]
    if legacy["chain"].lower() != "ethereum" or detail["identity"]["asset"].lower() != ASSET:
        raise ValueError("Unexpected PegTracker identity")
    detail = dict(detail)
    detail.pop("vaulttracker_native", None)
    if mode != "legacy":
        try:
            candidate = select(manifest, attempt, now)
            if last_good and candidate["block"] < last_good["block"]:
                raise ValueError("Native observation regressed")
            detail["vaulttracker_native"] = dict(candidate, selection_status="selected")
        except (ValueError, KeyError, OSError, TypeError, ImportError):
            if last_good:
                detail["vaulttracker_native"] = dict(last_good, selection_status="last_good")
    return dict(legacy, asset_specific=dict(legacy["asset_specific"], scrvusd=detail))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("legacy", "manifest", "attempt", "output"):
        parser.add_argument(name, type=Path)
    parser.add_argument("--last-good", type=Path)
    parser.add_argument("--mode", choices=("shadow", "legacy"), default="shadow")
    args = parser.parse_args()
    read = lambda path: json.loads(path.read_bytes())
    prior = read(args.last_good)["asset_specific"]["scrvusd"].get("vaulttracker_native") if args.last_good else None
    result = project(read(args.legacy), args.manifest, read(args.attempt), datetime.now(timezone.utc).isoformat(),
                     prior, mode=args.mode)
    args.output.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
