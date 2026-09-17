#!/usr/bin/env python3
"""Address-keyed backing monitor for Metronome Synth msUSD.

Never publishes a failed RPC read as zero. A run with partial chain failures is
published with the affected metrics null and explicit errors; the last wholly
successful snapshot is retained separately.
"""

import argparse
import json
import os
import shutil
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from web3 import Web3


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
OUTPUT = os.path.join(DATA_DIR, "msusd_metronome_backing.json")
LAST_GOOD = os.path.join(DATA_DIR, "msusd_metronome_backing_last_good.json")
HISTORY = os.path.join(DATA_DIR, "msusd_metronome_backing_history.json")
SLUG = "msusd-metronome"
CG_ID = "metronome-synth-usd"
DEAD = "0x000000000000000000000000000000000000dEaD"
EIP1967_IMPL_SLOT = int("360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", 16)
UA = {"User-Agent": "BackingMonitor-msUSD/1.0"}

CHAINS = {
    "ethereum": {
        "token": "0xab5eb14c09d416f0ac63661e57edb7aecdb9befa",
        "registry": "0x11eaD85C679eAF528c9C1FE094bF538Db880048A",
        "rpcs": [os.getenv("ETHEREUM_RPC_URL"), "https://ethereum-rpc.publicnode.com", "https://eth.llamarpc.com"],
        "kyber": "ethereum", "usdc": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "usdc_decimals": 6,
    },
    "base": {
        "token": "0x526728dbc96689597f85ae4cd716d4f7fccbae9d",
        "registry": "0x4372A2b9304296c06197a823f25Cf03119d2Fd82",
        "rpcs": [os.getenv("BASE_RPC_URL"), "https://base-rpc.publicnode.com", "https://mainnet.base.org"],
        "kyber": "base", "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "usdc_decimals": 6,
    },
    "optimism": {
        "token": "0x9dabae7274d28a45f0b65bf8ed201a5731492ca0",
        "registry": "0xe7C65eAEb1Ca920f0DB73cDFb4915Dd31472a6a1",
        "rpcs": [os.getenv("OPTIMISM_RPC_URL"), "https://optimism-rpc.publicnode.com", "https://mainnet.optimism.io"],
        "kyber": "optimism", "usdc": "0x0b2c639c533813f4aa9d7837caf62653d097ff85", "usdc_decimals": 6,
    },
    "plasma": {
        "token": "0x29ad7fe4516909b9e498b5a65339e54791293234",
        "registry": "0x1c1c67E52942F4dd20a7262a9d17eA2A2e16Acf3",
        "rpcs": [os.getenv("PLASMA_RPC_URL"), "https://rpc.plasma.to"],
        "kyber": None, "usdc": None, "usdc_decimals": 6,
    },
}

AMO = Web3.to_checksum_address("0x82Ed3Fc9D93112124B04B6C7B35394A5AbA8af39")
VAMSUSD = Web3.to_checksum_address("0x4C73F025a1947ec770327B9956Fc61f535F72C22")
DIRECT_AMO_TOKENS = {
    "msUSD": (CHAINS["ethereum"]["token"], 18),
    "USDC": ("0xA0b86991c6218b36c1d19d4a2e9Eb0cE3606eB48", 6),
    "USDT": ("0xdAC17F958D2ee523a2206206994597C13D831ec7", 6),
    "DAI": ("0x6B175474E89094C44Da98b954EedeAC495271d0F", 18),
    "WETH": ("0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 18),
    "frxUSD": ("0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29", 18),
    "crvUSD": ("0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E", 18),
}

ERC20_ABI = [
    {"name": "totalSupply", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint256"}]},
    {"name": "decimals", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint8"}]},
    {"name": "symbol", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "string"}]},
    {"name": "balanceOf", "type": "function", "stateMutability": "view", "inputs": [{"type": "address"}], "outputs": [{"type": "uint256"}]},
]
TOKEN_ABI = ERC20_ABI + [
    {"name": "maxTotalSupply", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint256"}]},
    {"name": "maxAmoSupply", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint256"}]},
    {"name": "isActive", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "bool"}]},
    {"name": "amo", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "address"}]},
]
REGISTRY_ABI = [
    {"name": "getPools", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "address[]"}]},
    {"name": "masterOracle", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "address"}]},
]
POOL_ABI = [
    {"name": "getDebtTokens", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "address[]"}]},
    {"name": "getDepositTokens", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "address[]"}]},
]
DEBT_ABI = ERC20_ABI + [{"name": "syntheticToken", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "address"}]}]
DEPOSIT_ABI = ERC20_ABI + [{"name": "underlying", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "address"}]}]
ORACLE_ABI = [{"name": "quoteTokenToUsd", "type": "function", "stateMutability": "view", "inputs": [{"type": "address"}, {"type": "uint256"}], "outputs": [{"type": "uint256"}]}]
VAULT_ABI = ERC20_ABI + [
    {"name": "pricePerShare", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint256"}]},
    {"name": "totalValue", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint256"}]},
    {"name": "totalDebt", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint256"}]},
    {"name": "tokensHere", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "uint256"}]},
    {"name": "token", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "address"}]},
    {"name": "getStrategies", "type": "function", "stateMutability": "view", "inputs": [], "outputs": [{"type": "address[]"}]},
]


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def connect(name: str, cfg: Dict[str, Any]) -> Tuple[Web3, str]:
    failures = []
    for url in [x for x in cfg["rpcs"] if x]:
        for attempt in range(2):
            try:
                w3 = Web3(Web3.HTTPProvider(url, request_kwargs={"timeout": 18}))
                _ = w3.eth.block_number
                return w3, url
            except Exception as exc:
                failures.append(f"{url}: {type(exc).__name__}: {exc}")
                time.sleep(1 + attempt)
    raise RuntimeError(f"{name}: all RPCs failed: {'; '.join(failures)}")


def safe_call(contract, fn: str, *args):
    return getattr(contract.functions, fn)(*args).call()


def implementation(w3: Web3, address: str) -> Optional[str]:
    raw = w3.eth.get_storage_at(Web3.to_checksum_address(address), EIP1967_IMPL_SLOT)
    if not raw or int.from_bytes(raw, "big") == 0:
        return None
    return Web3.to_checksum_address("0x" + raw[-20:].hex())


def amount(raw: int, decimals: int) -> float:
    return raw / (10 ** decimals)


def read_chain(name: str, cfg: Dict[str, Any]) -> Tuple[Dict[str, Any], set]:
    w3, rpc = connect(name, cfg)
    block = w3.eth.get_block("latest")
    token_addr = Web3.to_checksum_address(cfg["token"])
    token = w3.eth.contract(token_addr, abi=TOKEN_ABI)
    decimals = safe_call(token, "decimals")
    registry_addr = Web3.to_checksum_address(cfg["registry"])
    registry = w3.eth.contract(registry_addr, abi=REGISTRY_ABI)
    pools = safe_call(registry, "getPools")
    oracle = safe_call(registry, "masterOracle")
    synths, pool_rows = {token_addr.lower()}, []
    debt_total = 0.0
    collateral_total = 0.0
    collateral_complete = True
    for pool_addr in pools:
        pool = w3.eth.contract(pool_addr, abi=POOL_ABI)
        debts, deposits = safe_call(pool, "getDebtTokens"), safe_call(pool, "getDepositTokens")
        debt_rows, deposit_rows = [], []
        for debt_addr in debts:
            debt = w3.eth.contract(debt_addr, abi=DEBT_ABI)
            synthetic = safe_call(debt, "syntheticToken")
            synths.add(synthetic.lower())
            dec = safe_call(debt, "decimals")
            supply = amount(safe_call(debt, "totalSupply"), dec)
            try:
                sym = safe_call(debt, "symbol")
            except Exception:
                sym = None
            if synthetic.lower() == token_addr.lower():
                debt_total += supply
            debt_rows.append({"address": debt_addr, "symbol": sym, "synthetic_token": synthetic, "total_supply": supply})
        for dep_addr in deposits:
            dep = w3.eth.contract(dep_addr, abi=DEPOSIT_ABI)
            underlying = safe_call(dep, "underlying")
            dec = safe_call(dep, "decimals")
            supply_raw = safe_call(dep, "totalSupply")
            supply = amount(supply_raw, dec)
            usd = None
            if oracle.lower() != DEAD.lower():
                try:
                    quoted = safe_call(w3.eth.contract(Web3.to_checksum_address(oracle), abi=ORACLE_ABI), "quoteTokenToUsd", underlying, supply_raw)
                    usd = amount(quoted, 18)
                    collateral_total += usd
                except Exception:
                    collateral_complete = False
            else:
                collateral_complete = False
            try:
                sym = safe_call(dep, "symbol")
            except Exception:
                sym = None
            deposit_rows.append({"address": dep_addr, "symbol": sym, "underlying": underlying, "total_supply": supply, "oracle_value_usd": usd})
        pool_rows.append({"address": pool_addr, "debt_tokens": debt_rows, "deposit_tokens": deposit_rows})
    row = {
        "chain": name, "status": "ok", "token_address": token_addr,
        "registry_address": registry_addr, "block_number": block.number,
        "block_timestamp": datetime.fromtimestamp(block.timestamp, timezone.utc).isoformat().replace("+00:00", "Z"),
        "rpc_source": rpc, "decimals": decimals,
        "total_supply": amount(safe_call(token, "totalSupply"), decimals),
        "max_total_supply": amount(safe_call(token, "maxTotalSupply"), decimals),
        "max_amo_supply": amount(safe_call(token, "maxAmoSupply"), decimals),
        "is_active": safe_call(token, "isActive"), "amo": safe_call(token, "amo"),
        "implementation": implementation(w3, token_addr),
        "pool_registry": {"address": registry_addr, "master_oracle": oracle, "pool_count": len(pools), "pools": pool_rows},
        "cdp_debt_msusd": debt_total,
        "cdp_collateral_oracle_usd": collateral_total if collateral_complete else None,
        "collateral_complete": collateral_complete,
        "errors": [],
    }
    return row, synths


def read_amo(w3: Web3) -> Dict[str, Any]:
    vault = w3.eth.contract(VAMSUSD, abi=VAULT_ABI)
    vdec = safe_call(vault, "decimals")
    shares = amount(safe_call(vault, "balanceOf", AMO), vdec)
    pps = amount(safe_call(vault, "pricePerShare"), vdec)
    vault_supply = amount(safe_call(vault, "totalSupply"), vdec)
    balances = {}
    for symbol, (addr, dec) in DIRECT_AMO_TOKENS.items():
        c = w3.eth.contract(Web3.to_checksum_address(addr), abi=ERC20_ABI)
        balances[symbol] = amount(safe_call(c, "balanceOf", AMO), dec)
    return {
        "address": AMO, "vamsusd": VAMSUSD, "vamsusd_balance": shares,
        "vamsusd_price_per_share": pps, "amo_msusd_claim": shares * pps,
        "vamsusd_total_supply": vault_supply,
        "amo_share_of_vault_pct": shares / vault_supply * 100 if vault_supply else None,
        "vault_total_value": amount(safe_call(vault, "totalValue"), vdec),
        "vault_total_debt": amount(safe_call(vault, "totalDebt"), vdec),
        "vault_tokens_here": amount(safe_call(vault, "tokensHere"), vdec),
        "vault_token": safe_call(vault, "token"), "strategies": safe_call(vault, "getStrategies"),
        "direct_balances": balances,
        "external_direct_reserves_all_zero": all(v == 0 for k, v in balances.items() if k != "msUSD"),
        "classification": "self_referential_msusd_claim_not_external_backing",
    }


def market_price() -> Dict[str, Any]:
    r = requests.get("https://api.coingecko.com/api/v3/simple/price", params={"ids": CG_ID, "vs_currencies": "usd", "include_last_updated_at": "true"}, headers=UA, timeout=20)
    r.raise_for_status()
    row = r.json()[CG_ID]
    return {"price_usd": float(row["usd"]), "source": "CoinGecko", "coin_id": CG_ID,
            "as_of": datetime.fromtimestamp(row["last_updated_at"], timezone.utc).isoformat().replace("+00:00", "Z")}


def dex_pools(synth_addresses: set, price: Optional[float]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    pools, errors = [], []
    seen = set()
    for chain, cfg in CHAINS.items():
        try:
            url = f"https://api.dexscreener.com/token-pairs/v1/{chain}/{cfg['token']}"
            response = requests.get(url, headers=UA, timeout=25)
            response.raise_for_status()
            for p in response.json() or []:
                addr = (p.get("pairAddress") or "").lower()
                if not addr or (chain, addr) in seen:
                    continue
                seen.add((chain, addr))
                base, quote = p.get("baseToken") or {}, p.get("quoteToken") or {}
                token_lower = cfg["token"].lower()
                if base.get("address", "").lower() == token_lower:
                    ms_bal = float((p.get("liquidity") or {}).get("base") or 0)
                    paired, paired_bal = quote, float((p.get("liquidity") or {}).get("quote") or 0)
                    native = float(p.get("priceNative") or 0)
                    paired_usd = paired_bal * (float(p.get("priceUsd") or 0) / native) if native else None
                elif quote.get("address", "").lower() == token_lower:
                    ms_bal = float((p.get("liquidity") or {}).get("quote") or 0)
                    paired, paired_bal = base, float((p.get("liquidity") or {}).get("base") or 0)
                    paired_usd = paired_bal * float(p.get("priceUsd") or 0)
                else:
                    continue
                paired_addr = paired.get("address", "").lower()
                external = paired_addr not in synth_addresses and paired_addr not in {c["token"].lower() for c in CHAINS.values()}
                ms_value = ms_bal * price if price else None
                weight = ms_value / (ms_value + paired_usd) * 100 if ms_value is not None and paired_usd else None
                total_observed_value = (ms_value or 0) + (paired_usd or 0)
                if total_observed_value < 1000:
                    continue
                pools.append({"chain": chain, "venue": p.get("dexId"), "pool_address": p.get("pairAddress"),
                              "msusd_balance": ms_bal, "paired_asset_balance": paired_bal,
                              "paired_asset_symbol": paired.get("symbol"), "paired_asset_address": paired.get("address"),
                              "paired_asset_value_usd": paired_usd, "msusd_pool_weight_pct": weight,
                              "spot_price_usd": float(p.get("priceUsd")) if p.get("priceUsd") else None,
                              "pair_class": "external" if external else "metronome_synth_or_msusd",
                              "observed_pool_value_usd": total_observed_value, "source": url})
        except Exception as exc:
            errors.append({"scope": f"dex_pools:{chain}", "error": f"{type(exc).__name__}: {exc}"})
    return pools, errors


def kyber_quotes(price: float) -> List[Dict[str, Any]]:
    def route_summary(route):
        legs = []
        def walk(value):
            if isinstance(value, list):
                for item in value: walk(item)
            elif isinstance(value, dict):
                if value.get("exchange") or value.get("pool"):
                    legs.append({"exchange": value.get("exchange"), "pool": value.get("pool"),
                                 "token_in": value.get("tokenIn"), "token_out": value.get("tokenOut")})
                else:
                    for item in value.values(): walk(item)
        walk(route)
        return {"leg_count": len(legs), "exchanges": sorted({x["exchange"] for x in legs if x.get("exchange")}),
                "pools": sorted({x["pool"] for x in legs if x.get("pool")}), "legs": legs}
    out = []
    sizes = [1000, 10000, 50000, 100000, 1000000]
    for chain, cfg in CHAINS.items():
        for size in sizes:
            row = {"chain": chain, "size_usd": size, "quoted_as_of": utcnow()}
            if not cfg.get("kyber") or not cfg.get("usdc"):
                row.update({"status": "no_viable_route", "reason": "USDC route not configured for this chain"})
                out.append(row); continue
            try:
                amount_in = int(size / price * 10 ** 18)
                url = f"https://aggregator-api.kyberswap.com/{cfg['kyber']}/api/v1/routes"
                r = requests.get(url, params={"tokenIn": cfg["token"], "tokenOut": cfg["usdc"], "amountIn": str(amount_in)}, headers={**UA, "x-client-id": "backing-monitor"}, timeout=25)
                if r.status_code == 404:
                    row.update({"status": "no_viable_route", "http_status": 404}); out.append(row); continue
                r.raise_for_status()
                data = (r.json().get("data") or {}).get("routeSummary") or {}
                amount_out = int(data["amountOut"]) / 10 ** cfg["usdc_decimals"]
                avg = amount_out / (amount_in / 1e18)
                row.update({"status": "ok", "proceeds_usdc": amount_out, "average_execution_price": avg,
                            "price_impact_pct": (avg / price - 1) * 100,
                            "route": route_summary(data.get("route")), "router": "KyberSwap", "source": url})
            except Exception as exc:
                row.update({"status": "quote_failed", "reason": f"{type(exc).__name__}: {exc}"})
            out.append(row)
            time.sleep(0.35)
    return out


def flags(summary: Dict[str, Any], chains: List[Dict[str, Any]], amo: Optional[Dict[str, Any]], pools: List[Dict[str, Any]], quotes: List[Dict[str, Any]], errors: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    out = []
    def add(sev, code, message): out.append({"severity": sev, "code": code, "message": message})
    price = summary.get("market_price")
    if price is not None:
        for threshold, sev in [(0.80, "critical"), (0.90, "high"), (0.95, "high"), (0.99, "warning")]:
            if price < threshold: add(sev, f"price_below_{threshold}", f"Market price ${price:.4f} is below ${threshold:.2f}."); break
    share = summary.get("cdp_backed_share_pct")
    if share is not None and share < 5: add("high", "cdp_share_below_5", f"Only {share:.2f}% of supply matches msUSD CDP debt.")
    elif share is not None and share < 10: add("warning", "cdp_share_below_10", f"Only {share:.2f}% of supply matches msUSD CDP debt.")
    cov = summary.get("real_exit_coverage_gross_pct")
    if cov is not None and cov < 10: add("critical", "exit_coverage_below_10", f"Real external exit coverage is {cov:.2f}% of gross supply.")
    elif cov is not None and cov < 15: add("high", "exit_coverage_below_15", f"Real external exit coverage is {cov:.2f}% of gross supply.")
    elif cov is not None and cov < 25: add("warning", "exit_coverage_below_25", f"Real external exit coverage is {cov:.2f}% of gross supply.")
    if amo and amo.get("external_direct_reserves_all_zero") is True: add("high", "amo_direct_external_reserves_zero", "The Ethereum AMO directly holds zero USDC, USDT, DAI, WETH, frxUSD and crvUSD.")
    for p in pools:
        if p.get("msusd_pool_weight_pct") is not None and p["msusd_pool_weight_pct"] > 80:
            sev = "critical" if p["msusd_pool_weight_pct"] > 95 else "high" if p["msusd_pool_weight_pct"] > 90 else "warning"
            add(sev, "pool_msusd_weight_high", f"{p['chain']} {p['venue']} pool is {p['msusd_pool_weight_pct']:.1f}% msUSD by value.")
    for c in chains:
        reg = c.get("pool_registry") or {}
        if reg.get("pool_count") == 0: add("high", "empty_pool_registry", f"{c['chain']} PoolRegistry has no pools.")
        if str(reg.get("master_oracle", "")).lower() == DEAD.lower(): add("critical", "dead_master_oracle", f"{c['chain']} master oracle is the dead address.")
    q100 = [q for q in quotes if q["size_usd"] == 100000 and q.get("status") == "ok"]
    if q100 and max(q["average_execution_price"] for q in q100) < price * 0.95: add("high", "100k_execution_below_market", "$100K best routed execution is more than 5% below market.")
    q1m = [q for q in quotes if q["size_usd"] == 1000000 and q.get("status") == "ok"]
    if not q1m: add("high", "1m_route_unavailable", "No $1M msUSD→USDC route succeeded on any configured chain.")
    elif max(q["average_execution_price"] for q in q1m) < 0.95: add("high", "1m_execution_below_095", "$1M best routed execution is below $0.95 per msUSD.")
    if errors: add("high", "partial_data", f"{len(errors)} read or market-data component(s) failed; no healthy status may be inferred.")
    return out


def write_history(snapshot: Dict[str, Any]) -> None:
    try:
        loaded = json.load(open(HISTORY)) if os.path.exists(HISTORY) else {}
        history = loaded.get("entries", []) if isinstance(loaded, dict) else loaded
    except Exception:
        history = []
    s, a = snapshot["summary"], snapshot["asset_specific"]
    def compact_quotes(rows):
        return [{k: q.get(k) for k in ("chain", "size_usd", "status", "proceeds_usdc",
                "average_execution_price", "price_impact_pct", "quoted_as_of", "reason")}
                for q in rows]
    for old in history:
        if isinstance(old, dict):
            old["execution_100k"] = compact_quotes(old.get("execution_100k") or [])
            old["execution_1m"] = compact_quotes(old.get("execution_1m") or [])
    history.append({"timestamp": snapshot["timestamp"], "market_price": s.get("market_price"),
                    "total_supply": s.get("total_supply"), "supply_by_chain": {c["chain"]: c.get("total_supply") for c in a["chains"]},
                    "cdp_debt": s.get("cdp_debt"), "cdp_collateral_usd": s.get("cdp_collateral_usd"),
                    "cdp_backed_share_pct": s.get("cdp_backed_share_pct"), "amo_vamsusd_balance": (a.get("amo") or {}).get("vamsusd_balance"),
                    "amo_msusd_claim": s.get("amo_msusd_claim"), "third_party_supply": s.get("third_party_supply"),
                    "real_exit_liquidity_usd": s.get("real_exit_liquidity_usd"),
                    "pool_weights": {p["pool_address"]: p.get("msusd_pool_weight_pct") for p in a["dex_pools"]},
                    "execution_100k": compact_quotes([q for q in a["quotes"] if q["size_usd"] == 100000]),
                    "execution_1m": compact_quotes([q for q in a["quotes"] if q["size_usd"] == 1000000]),
                    "implementations": {c["chain"]: c.get("implementation") for c in a["chains"]}})
    cutoff = time.time() - 180 * 86400
    history = [h for h in history if datetime.fromisoformat(h["timestamp"].replace("Z", "+00:00")).timestamp() >= cutoff]
    with open(HISTORY, "w") as f:
        json.dump({"schema_version": "msusd-metronome-history/1", "asset": "msUSD (Metronome)",
                   "asset_slug": SLUG, "entries": history}, f, indent=2)


def change_flags(previous: Optional[Dict[str, Any]], current: Dict[str, Any]) -> List[Dict[str, str]]:
    if not previous:
        return []
    out = []
    def add(severity, code, message): out.append({"severity": severity, "code": code, "message": message})
    ps, cs = previous.get("summary", {}), current.get("summary", {})
    if cs.get("market_price") is not None and cs["market_price"] < .99 and ps.get("total_supply") is not None and cs.get("total_supply", 0) > ps["total_supply"]:
        add("high", "supply_rising_below_peg", "Total supply rose while market price remained below $0.99.")
    if ps.get("cdp_backed_share_pct") is not None and cs.get("cdp_backed_share_pct") is not None and cs["cdp_backed_share_pct"] < ps["cdp_backed_share_pct"] - 1:
        add("warning", "cdp_share_falling", "CDP-backed share fell by more than 1 percentage point since the prior snapshot.")
    pa = (previous.get("asset_specific") or {}).get("amo") or {}
    ca = (current.get("asset_specific") or {}).get("amo") or {}
    if pa.get("vamsusd_balance") is not None and ca.get("vamsusd_balance") is not None and abs(ca["vamsusd_balance"] - pa["vamsusd_balance"]) > 1:
        add("warning", "amo_vamsusd_balance_changed", f"AMO vamsUSD balance moved by {ca['vamsusd_balance'] - pa['vamsusd_balance']:,.2f} shares.")
    before = {c.get("chain"): c for c in (previous.get("asset_specific") or {}).get("chains", [])}
    for c in (current.get("asset_specific") or {}).get("chains", []):
        old = before.get(c.get("chain"))
        if not old:
            continue
        for field in ("max_amo_supply", "implementation", "is_active"):
            if old.get(field) != c.get(field):
                add("high", f"{field}_changed", f"{c['chain']} {field.replace('_', ' ')} changed.")
        oldr, newr = old.get("pool_registry") or {}, c.get("pool_registry") or {}
        for field in ("address", "master_oracle"):
            if oldr.get(field) != newr.get(field):
                add("critical", f"pool_registry_{field}_changed", f"{c['chain']} PoolRegistry {field.replace('_', ' ')} changed.")
    return out


def run(skip_quotes=False) -> Dict[str, Any]:
    timestamp, chain_rows, errors, synths = utcnow(), [], [], set()
    eth_w3 = None
    for name, cfg in CHAINS.items():
        try:
            row, found = read_chain(name, cfg); chain_rows.append(row); synths |= found
            if name == "ethereum": eth_w3, _ = connect(name, cfg)
        except Exception as exc:
            msg = f"{type(exc).__name__}: {exc}"
            chain_rows.append({"chain": name, "status": "error", "token_address": cfg["token"], "registry_address": cfg["registry"], "errors": [msg]})
            errors.append({"scope": f"chain:{name}", "error": msg})
    amo = None
    if eth_w3:
        try: amo = read_amo(eth_w3)
        except Exception as exc: errors.append({"scope": "ethereum_amo", "error": f"{type(exc).__name__}: {exc}"})
    try: market = market_price()
    except Exception as exc:
        market = {"price_usd": None, "source": "CoinGecko", "coin_id": CG_ID, "error": f"{type(exc).__name__}: {exc}"}
        errors.append({"scope": "market_price", "error": market["error"]})
    pools, dex_errors = dex_pools(synths, market.get("price_usd")); errors.extend(dex_errors)
    quotes = [] if skip_quotes or market.get("price_usd") is None else kyber_quotes(market["price_usd"])
    errors.extend({"scope": f"quote:{q['chain']}:{q['size_usd']}", "error": q.get("reason", "quote failed")}
                  for q in quotes if q.get("status") == "quote_failed")
    total_supply = sum(c["total_supply"] for c in chain_rows if c.get("status") == "ok") if all(c.get("status") == "ok" for c in chain_rows) else None
    cdp_debt = sum(c["cdp_debt_msusd"] for c in chain_rows if c.get("status") == "ok") if all(c.get("status") == "ok" for c in chain_rows) else None
    collateral_values = [c.get("cdp_collateral_oracle_usd") for c in chain_rows]
    collateral = sum(collateral_values) if collateral_values and all(v is not None for v in collateral_values) else None
    claim = amo.get("amo_msusd_claim") if amo else None
    third_party = max(total_supply - claim, 0) if total_supply is not None and claim is not None else None
    real_exit = sum(p.get("paired_asset_value_usd") or 0 for p in pools if p.get("pair_class") == "external")
    chain_exit = {}
    for pool in pools:
        if pool.get("pair_class") != "external":
            pool["real_exit_share_pct"] = 0
            continue
        value = pool.get("paired_asset_value_usd") or 0
        pool["real_exit_share_pct"] = value / real_exit * 100 if real_exit else None
        chain_exit[pool["chain"]] = chain_exit.get(pool["chain"], 0) + value
    chain_concentration = [{"chain": chain, "paired_asset_value_usd": value,
                            "real_exit_share_pct": value / real_exit * 100 if real_exit else None}
                           for chain, value in sorted(chain_exit.items(), key=lambda row: row[1], reverse=True)]
    summary = {"market_price": market.get("price_usd"), "premium_discount_pct": (market["price_usd"] - 1) * 100 if market.get("price_usd") is not None else None,
               "total_supply": total_supply, "cdp_debt": cdp_debt, "cdp_collateral_usd": collateral,
               "cdp_backed_share_pct": cdp_debt / total_supply * 100 if total_supply and cdp_debt is not None else None,
               "amo_msusd_claim": claim, "amo_claim_pct_of_supply": claim / total_supply * 100 if total_supply and claim is not None else None,
               "third_party_supply": third_party, "real_exit_liquidity_usd": real_exit,
               "real_exit_coverage_gross_pct": real_exit / total_supply * 100 if total_supply else None,
               "real_exit_coverage_net_of_amo_pct": real_exit / third_party * 100 if third_party else None}
    snapshot = {"schema_version": "msusd-metronome/1", "asset": "msUSD (Metronome)", "asset_slug": SLUG,
                "chain": "Ethereum + Base + Optimism + Plasma", "timestamp": timestamp,
                "summary": summary, "risk_flags": [],
                "peg": {"market_price": market.get("price_usd"), "peg_reference": 1.0,
                        "premium_discount_pct": summary["premium_discount_pct"], "as_of": market.get("as_of"),
                        "price_source": "CoinGecko metronome-synth-usd, address identity cross-checked per chain"},
                "backing": {"collateral_ratio": collateral / total_supply * 100 if collateral is not None and total_supply else None,
                            "collateral_ratio_scale": "percent", "total_backing": collateral,
                            "as_of": timestamp, "basis": "Shared Metronome pool collateral at protocol oracle values divided by gross msUSD supply; this is not ring-fenced to msUSD and excludes vamsUSD and DEX liquidity."},
                "liquidity": {"total_2pct_depth": None, "two_pct_depth_status": "unmeasured",
                              "total_tvl": real_exit, "as_of": timestamp,
                              "total_2pct_depth_note": "Executable fixed-size msUSD-to-USDC quotes are published instead of a 2% crossing."},
                "asset_specific": {"type": "metronome-msusd", "identity": {"coingecko_id": CG_ID, "tokens": {k: v["token"] for k, v in CHAINS.items()},
                    "excluded_collision": {"mainstreet_msusd": "0x4ba01f22827018b4772cd326c7627fb4956a7c00", "mento": "usdm"}},
                    "market": market, "chains": chain_rows, "amo": amo, "dex_pools": pools, "quotes": quotes,
                    "liquidity_concentration": {"by_chain": chain_concentration,
                        "largest_pool": max((p for p in pools if p.get("pair_class") == "external"),
                                            key=lambda p: p.get("paired_asset_value_usd") or 0, default=None)},
                    "methodology": {"external_backing_excludes": ["msUSD", "vamsUSD", "msUSD LP tokens", "all dynamically discovered Metronome synthetic tokens"],
                                    "gross": "All msUSD supply versus external CDP collateral and real paired-side exit assets.",
                                    "net_of_amo": "Supply less the AMO's vamsUSD-denominated claim versus the same external assets; protocol-owned LP claims cannot withdraw assets pools no longer hold."}},
                "sources": [{"kind": "rpc", "chains": [c["chain"] for c in chain_rows]}, {"kind": "market_price", "url": "https://api.coingecko.com/api/v3/simple/price"}, {"kind": "dex_enumeration", "provider": "DexScreener"}, {"kind": "executable_quotes", "provider": "KyberSwap"}],
                "freshness": {"status": "partial" if errors else "fresh", "as_of": timestamp, "chain_status": {c["chain"]: c.get("status") for c in chain_rows}},
                "errors": errors}
    snapshot["risk_flags"] = flags(summary, chain_rows, amo, pools, quotes, errors)
    return snapshot


def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--skip-quotes", action="store_true"); args = parser.parse_args()
    os.makedirs(DATA_DIR, exist_ok=True)
    try:
        previous = json.load(open(OUTPUT)) if os.path.exists(OUTPUT) else None
    except Exception:
        previous = None
    snapshot = run(skip_quotes=args.skip_quotes)
    snapshot["risk_flags"].extend(change_flags(previous, snapshot))
    tmp = OUTPUT + ".tmp"
    with open(tmp, "w") as f: json.dump(snapshot, f, indent=2)
    os.replace(tmp, OUTPUT)
    write_history(snapshot)
    if not snapshot["errors"] and not args.skip_quotes:
        shutil.copy2(OUTPUT, LAST_GOOD)
    print(json.dumps({"output": OUTPUT, "timestamp": snapshot["timestamp"], "errors": len(snapshot["errors"]), "supply": snapshot["summary"]["total_supply"]}, indent=2))


if __name__ == "__main__": main()
