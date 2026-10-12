#!/usr/bin/env python3
"""Independent frxUSD reserve and liability verification.

Quantities come from fixed-block RPC reads. Valuations keep their own source
and timestamp. Missing reads remain null; they are never converted to zero.
"""

import argparse
import json
import os
import shutil
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from web3 import Web3


ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data")
OUTPUT = os.path.join(DATA, "frxusd_backing_verification.json")
HISTORY = os.path.join(DATA, "frxusd_backing_verification_history.json")
LAST_GOOD = os.path.join(DATA, "frxusd_backing_verification_last_good.json")
ISSUER_FEED = os.path.join(DATA, "frxusd_backing.json")
ETH_RPC = [os.getenv("ETHEREUM_RPC_URL"), "https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com"]
FRAXTAL_RPC = [os.getenv("FRAXTAL_RPC_URL"), "https://rpc.frax.com"]
USTB_PRICE_URL = "https://api.superstate.com/v1/price/USTB"

FRXUSD = "0xCAcd6fd266aF91b8AeD52aCCC382b4e165586E29"
FRAXTAL_FRXUSD = "0xFc00000000000000000000000000000000000001"
FRAXTAL_BRIDGE = "0x34C0bD5877A5Ee7099D0f5688D65F4bB9158BDE2"

RESERVES = [
    {"id": "wtgxx_custodian", "symbol": "WTGXX", "holder": "0x860Cc723935FC9A15fF8b1A94237a711DFeF7857", "expected_token": "0x1feCF3d9d4Fee7f2c02917A66028a48C6706c179", "discover_asset": True, "ownership": "custodian_contract"},
    {"id": "wtgxx_bitgo", "symbol": "WTGXX", "holder": "0x4FA39D8Bd268aa07A3C441F04E07c8825E2ab163", "expected_token": "0x1feCF3d9d4Fee7f2c02917A66028a48C6706c179", "discover_asset": False, "ownership": "custody_dependent_unverified_beneficial_owner"},
    {"id": "ustb_custodian", "symbol": "USTB", "holder": "0x5fbAa3A3B489199338fbD85F7E3D444dc0504F33", "expected_token": "0x43415eB6ff9DB7E26A15b704e7A3eDCe97d31C4e", "discover_asset": True, "ownership": "custodian_contract"},
    {"id": "buidl_custodian", "symbol": "BUIDL", "holder": "0xe827abf9f462ac4f147753d86bc5f91e186e4e9c", "expected_token": "0x7712c34205737192402172409a8F7ccef8aA2AEc", "discover_asset": True, "ownership": "custodian_contract"},
    {"id": "usdc_custodian", "symbol": "USDC", "holder": "0x4F95C5bA0C7c69FB2f9340E190cCeE890B3bd87c", "expected_token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "discover_asset": True, "ownership": "custodian_contract"},
    {"id": "usdb_custodian", "symbol": "USDB", "holder": "0xFE2Ea8dE262d956e852F12DE108fda57171a0a29", "expected_token": "0xeAC4269C9A01190B1400c4Dc728864e61895fdF3", "discover_asset": True, "ownership": "custodian_contract"},
]

ERC20 = [
    {"name": "balanceOf", "type": "function", "stateMutability": "view", "inputs": [{"type": "address"}], "outputs": [{"type": "uint256"}]},
    {"name": "totalSupply", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint256"}]},
    {"name": "decimals", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint8"}]},
    {"name": "symbol", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "string"}]},
]
ASSET_ABI = [{"name": "asset", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "address"}]}]


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def connect(urls: List[Optional[str]]) -> Tuple[Web3, str]:
    errors = []
    for url in [u for u in urls if u]:
        try:
            w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 20}))
            w3.eth.get_block_number()
            return w3, url
        except Exception as exc:
            errors.append(f"{url}: {type(exc).__name__}: {exc}")
    raise RuntimeError("; ".join(errors))


def at(contract, function: str, *args, block: int):
    return getattr(contract.functions, function)(*args).call(block_identifier=block)


def load_issuer() -> Dict[str, Any]:
    with open(ISSUER_FEED) as fh:
        return json.load(fh)


def issuer_asset_rows(feed: Dict[str, Any]) -> Dict[Tuple[str, str], Dict[str, Any]]:
    rows = (((feed.get("issuer") or {}).get("reserves") or {}).get("rows") or [])
    return {(str(r.get("symbol", "")).upper(), str(r.get("holder_address", "")).lower()): r for r in rows}


def navs(now: str) -> Dict[str, Dict[str, Any]]:
    out = {
        "WTGXX": {"price_usd": 1.0, "price_as_of": None, "status": "policy_stable_nav", "source": "WisdomTree WTGXX seeks to maintain $1.00 NAV; authenticated DataSpan NAV unavailable", "url": "https://www.wisdomtree.com/onchain/tokenized-funds"},
        "BUIDL": {"price_usd": 1.0, "price_as_of": None, "status": "token_design_par_value", "source": "BUIDL token par-value convention; no independent timestamped NAV endpoint configured", "url": None},
        "USDC": {"price_usd": 1.0, "price_as_of": now, "status": "par_assumption", "source": "dollar stablecoin par assumption", "url": None},
        "USDB": {"price_usd": 1.0, "price_as_of": now, "status": "par_assumption", "source": "dollar stablecoin par assumption", "url": None},
    }
    try:
        response = requests.get(USTB_PRICE_URL, timeout=20, headers={"User-Agent": "backing-monitor-frxusd/1"})
        response.raise_for_status()
        value = response.json()
        out["USTB"] = {"price_usd": float(value["price"]), "price_as_of": value["timestamp"], "status": "independent_timestamped", "source": "Superstate public USTB/USD price API", "url": USTB_PRICE_URL}
    except Exception as exc:
        out["USTB"] = {"price_usd": None, "price_as_of": None, "status": "failed", "source": "Superstate public USTB/USD price API", "url": USTB_PRICE_URL, "error": f"{type(exc).__name__}: {exc}"}
    return out


def nav_age_hours(nav: Dict[str, Any], now: datetime) -> Optional[float]:
    stamp = nav.get("price_as_of")
    if not stamp:
        return None
    try:
        return (now - datetime.fromisoformat(stamp.replace("Z", "+00:00"))).total_seconds() / 3600
    except Exception:
        return None


def read_reserves(w3: Web3, block: int, issuer: Dict[str, Any], price_map: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    issuer_rows = issuer_asset_rows(issuer)
    rows = []
    for cfg in RESERVES:
        row = dict(cfg)
        row.update({"chain": "ethereum", "block_number": block, "fetch_status": "unmeasured", "quantity": None, "value_usd": None, "error": None})
        try:
            holder = Web3.to_checksum_address(cfg["holder"])
            token_address = Web3.to_checksum_address(cfg["expected_token"])
            discovered = None
            if cfg["discover_asset"]:
                discovered = at(w3.eth.contract(holder, abi=ASSET_ABI), "asset", block=block)
                row["asset_discovered"] = discovered
                row["address_match"] = discovered.lower() == token_address.lower()
                if not row["address_match"]:
                    raise RuntimeError(f"asset() changed to {discovered}")
            token = w3.eth.contract(token_address, abi=ERC20)
            decimals = int(at(token, "decimals", block=block))
            raw = int(at(token, "balanceOf", holder, block=block))
            quantity = raw / (10 ** decimals)
            nav = price_map.get(cfg["symbol"], {})
            price = nav.get("price_usd")
            row.update({"token_address": token_address, "decimals": decimals, "raw_balance": str(raw), "quantity": quantity, "nav": nav, "value_usd": quantity * price if price is not None else None, "fetch_status": "ok"})
            issuer_row = issuer_rows.get((cfg["symbol"], cfg["holder"].lower()))
            iq = issuer_row.get("quantity") if issuer_row else None
            iv = issuer_row.get("value_usd") if issuer_row else None
            row["issuer_reconciliation"] = {
                "status": "matched" if iq is not None and abs(quantity - iq) <= max(1e-6, abs(iq) * 1e-9) else ("issuer_row_absent" if issuer_row is None else "difference"),
                "quantity_status": "matched" if iq is not None and abs(quantity - iq) <= max(1e-6, abs(iq) * 1e-9) else ("issuer_row_absent" if issuer_row is None else "difference"),
                "issuer_quantity": iq, "quantity_difference": quantity - iq if iq is not None else None,
                "issuer_value_usd": iv, "value_difference_usd": row["value_usd"] - iv if row["value_usd"] is not None and iv is not None else None,
                "value_difference_basis": "Independent observed quantity multiplied by this feed's valuation, minus the issuer API value. A non-zero value difference can be explained by NAV timestamp/source rather than quantity drift.",
            }
        except Exception as exc:
            row["fetch_status"] = "failed"
            row["error"] = f"{type(exc).__name__}: {exc}"
        rows.append(row)
    return rows


def read_liabilities(eth: Web3, eth_block: int) -> Dict[str, Any]:
    frx = eth.eth.contract(Web3.to_checksum_address(FRXUSD), abi=ERC20)
    dec = int(at(frx, "decimals", block=eth_block))
    gross = int(at(frx, "totalSupply", block=eth_block)) / (10 ** dec)
    escrow = int(at(frx, "balanceOf", Web3.to_checksum_address(FRAXTAL_BRIDGE), block=eth_block)) / (10 ** dec)
    rows = [{"chain": "ethereum", "address": FRXUSD, "status": "ok", "gross_supply": gross, "excluded_escrow": escrow, "net_circulating": gross - escrow, "block_number": eth_block}]
    fraxtal = None
    try:
        fw3, rpc = connect(FRAXTAL_RPC)
        fb = fw3.eth.get_block("latest")
        token = fw3.eth.contract(Web3.to_checksum_address(FRAXTAL_FRXUSD), abi=ERC20)
        fdec = int(at(token, "decimals", block=fb.number))
        fsupply = int(at(token, "totalSupply", block=fb.number)) / (10 ** fdec)
        fraxtal = {"chain": "fraxtal", "address": FRAXTAL_FRXUSD, "status": "ok", "gross_supply": fsupply, "excluded_escrow": None, "net_circulating": fsupply, "block_number": fb.number, "block_timestamp": datetime.fromtimestamp(fb.timestamp, timezone.utc).isoformat().replace("+00:00", "Z"), "rpc_source": rpc}
    except Exception as exc:
        fraxtal = {"chain": "fraxtal", "address": FRAXTAL_FRXUSD, "status": "failed", "gross_supply": None, "excluded_escrow": None, "net_circulating": None, "error": f"{type(exc).__name__}: {exc}"}
    rows.append(fraxtal)
    measured = sum(r["net_circulating"] for r in rows if r.get("status") == "ok")
    return {
        "rows": rows,
        "independently_measured_subtotal": measured,
        "complete": False,
        "remote_oft_status": "unmeasured",
        "remote_oft_note": "Remote OFT contract addresses and chain RPC reads are not yet independently enumerated. They are excluded from the subtotal, never assumed zero. Ethereum bridge escrow is subtracted before Fraxtal supply is added, preventing that known double count.",
        "coverage_denominator": None,
    }


def build(block: Optional[int] = None) -> Dict[str, Any]:
    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat().replace("+00:00", "Z")
    issuer = load_issuer()
    w3, rpc = connect(ETH_RPC)
    eth_block = int(block or w3.eth.block_number)
    header = w3.eth.get_block(eth_block)
    price_map = navs(now)
    reserves = read_reserves(w3, eth_block, issuer, price_map)
    liabilities = read_liabilities(w3, eth_block)
    verified_values = [r["value_usd"] for r in reserves if r.get("fetch_status") == "ok" and r.get("value_usd") is not None]
    verified_assets = sum(verified_values)
    issuer_block = issuer.get("issuer") or {}
    issuer_assets = issuer_block.get("total_assets_usd")
    issuer_liabilities = issuer_block.get("total_liabilities_usd")
    erebor = next((x for x in (((issuer_block.get("reserves") or {}).get("rows")) or []) if x.get("symbol") == "EREBOR_USD"), None)
    alerts = []
    for row in reserves:
        if row["fetch_status"] != "ok": alerts.append({"type": "rpc_or_contract_read_failed", "severity": "critical", "id": row["id"], "detail": row.get("error")})
        if row.get("address_match") is False: alerts.append({"type": "reserve_token_address_changed", "severity": "critical", "id": row["id"]})
        rec = row.get("issuer_reconciliation") or {}
        if rec.get("status") == "difference": alerts.append({"type": "issuer_reconciliation_difference", "severity": "warning", "id": row["id"], "quantity_difference": rec.get("quantity_difference"), "value_difference_usd": rec.get("value_difference_usd")})
    for symbol, nav in price_map.items():
        age = nav_age_hours(nav, now_dt)
        nav["age_hours"] = age
        nav["stale_after_hours"] = 48
        if nav.get("status") == "failed" or (age is not None and age > 48): alerts.append({"type": "nav_stale_or_failed", "severity": "critical", "symbol": symbol, "age_hours": age, "detail": nav.get("error")})
    independent_coverage = verified_assets / liabilities["coverage_denominator"] * 100 if liabilities["coverage_denominator"] else None
    lower_bound = verified_assets / issuer_liabilities * 100 if issuer_liabilities else None
    if independent_coverage is not None and independent_coverage < 100: alerts.append({"type": "independent_coverage_below_100", "severity": "critical", "coverage_pct": independent_coverage})
    if lower_bound is not None and lower_bound < 100: alerts.append({"type": "onchain_verified_assets_below_issuer_liabilities", "severity": "warning", "coverage_pct": lower_bound, "basis": "not a solvency conclusion while off-chain and unmeasured reserve lines exist"})
    issuer_coverage = issuer_block.get("coverage_ratio")
    if issuer_coverage is not None and issuer_coverage < 100: alerts.append({"type": "issuer_reported_coverage_below_100", "severity": "critical", "coverage_pct": issuer_coverage})
    if not liabilities["complete"]: alerts.append({"type": "liability_reconstruction_incomplete", "severity": "warning", "detail": liabilities["remote_oft_note"]})
    for row in liabilities["rows"]:
        if row.get("status") != "ok": alerts.append({"type": "chain_supply_read_failed", "severity": "critical", "chain": row.get("chain"), "detail": row.get("error")})
    return {
        "schema_version": "frxusd-backing-verification/1",
        "producer": "backing-monitor",
        "asset": "frxusd",
        "generated_at": now,
        "observation": {"chain": "ethereum", "block_number": eth_block, "block_timestamp": datetime.fromtimestamp(header.timestamp, timezone.utc).isoformat().replace("+00:00", "Z"), "rpc_source": rpc},
        "reserve_balances": reserves,
        "navs": price_map,
        "liabilities": liabilities,
        "coverage": {
            "onchain_verifiable_assets_usd": verified_assets,
            "onchain_share_of_issuer_assets_pct": verified_assets / issuer_assets * 100 if issuer_assets else None,
            "independent_coverage_pct": independent_coverage,
            "independent_coverage_status": "withheld_incomplete_liability_reconstruction",
            "onchain_assets_vs_issuer_liabilities_pct": lower_bound,
            "issuer_reported_assets_usd": issuer_assets,
            "issuer_reported_liabilities_usd": issuer_liabilities,
            "issuer_reported_coverage_pct": issuer_coverage,
            "offchain_unverified_assets": [{"symbol": "EREBOR_USD", "value_usd": erebor.get("value_usd") if erebor else None, "status": "offchain_unverified", "basis": "Issuer API value only; no eligible bank statement or attestation was independently verified."}],
            "unverified_or_unmeasured_gap_usd": issuer_assets - verified_assets if issuer_assets is not None else None,
        },
        "ownership": {"wtgxx_bitgo": {"address": "0x4FA39D8Bd268aa07A3C441F04E07c8825E2ab163", "balance_status": "onchain_observed", "beneficial_ownership_status": "custody_dependent_unverified", "basis": "No Frax signed-address proof or eligible BitGo account evidence is consumed by this feed."}},
        "alerts": alerts,
        "status": "partial" if any(r["fetch_status"] != "ok" for r in reserves) or not liabilities["complete"] else "ok",
        "limitations": ["Remote OFT supply is not independently enumerated, so independent global coverage is withheld.", "WTGXX BitGo beneficial ownership is not established by balanceOf.", "Erebor cash remains issuer-reported and off-chain unverified.", "WTGXX, BUIDL, USDC and USDB use stated par-value conventions rather than independent timestamped NAV APIs."],
    }


def write(payload: Dict[str, Any]) -> None:
    os.makedirs(DATA, exist_ok=True)
    tmp = OUTPUT + ".tmp"
    with open(tmp, "w") as fh: json.dump(payload, fh, indent=2); fh.write("\n")
    os.replace(tmp, OUTPUT)
    if payload.get("status") == "ok": shutil.copy2(OUTPUT, LAST_GOOD)
    history = {"schema_version": "frxusd-backing-verification-history/1", "asset": "frxusd", "entries": []}
    if os.path.exists(HISTORY):
        try:
            with open(HISTORY) as fh: history = json.load(fh)
        except Exception: pass
    entry = {"timestamp": payload["observation"]["block_timestamp"], "block_number": payload["observation"]["block_number"], "onchain_verifiable_assets_usd": payload["coverage"]["onchain_verifiable_assets_usd"], "independent_coverage_pct": payload["coverage"]["independent_coverage_pct"], "onchain_assets_vs_issuer_liabilities_pct": payload["coverage"]["onchain_assets_vs_issuer_liabilities_pct"], "issuer_reported_coverage_pct": payload["coverage"]["issuer_reported_coverage_pct"], "status": payload["status"]}
    entries = [e for e in history.get("entries", []) if e.get("block_number") != entry["block_number"]]
    entries.append(entry); entries.sort(key=lambda e: e["timestamp"]); history["entries"] = entries[-24 * 31:]
    with open(HISTORY + ".tmp", "w") as fh: json.dump(history, fh, indent=2); fh.write("\n")
    os.replace(HISTORY + ".tmp", HISTORY)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--block", type=int)
    parser.add_argument("--no-write", action="store_true")
    args = parser.parse_args()
    try:
        payload = build(args.block)
    except Exception as exc:
        payload = {"schema_version": "frxusd-backing-verification/1", "producer": "backing-monitor", "asset": "frxusd", "generated_at": utcnow(), "status": "failed", "error": f"{type(exc).__name__}: {exc}", "reserve_balances": [], "alerts": [{"type": "producer_failure", "severity": "critical", "detail": f"{type(exc).__name__}: {exc}"}]}
    if not args.no_write:
        if payload.get("status") in ("ok", "partial"):
            write(payload)
        else:
            os.makedirs(DATA, exist_ok=True)
            with open(OUTPUT + ".tmp", "w") as fh: json.dump(payload, fh, indent=2); fh.write("\n")
            os.replace(OUTPUT + ".tmp", OUTPUT)
    print(json.dumps(payload, indent=2))
    return 0 if payload.get("status") in ("ok", "partial") else 1


if __name__ == "__main__":
    raise SystemExit(main())
