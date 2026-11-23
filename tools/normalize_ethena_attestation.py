"""Offline monthly documentary normalization; never a live backing estimator."""
import argparse
import json
from decimal import Decimal
from pathlib import Path


def amount(value):
    value = Decimal(str(value))
    if not value.is_finite() or value < 0:
        raise ValueError("Invalid documentary amount")
    return value


def decimal_text(value):
    return format(value, "f")


def normalize(source):
    if source["schema_version"] != "ethena-monthly-intake/1":
        raise ValueError("Unsupported intake schema")
    docs = {x["id"]: x for x in source["documents"]}
    readings = source["document_readings"]
    headline = source["article_summary_usd_rounded"]
    rows = []

    def row(identifier, label, kind, value, document=None, caveat=""):
        ref = docs[document] if document is not None else None
        rows.append({
            "id": identifier, "label": label, "kind": kind,
            "amount": decimal_text(amount(value)), "unit": "USD",
            "basis": "provider_statement" if ref else "issuer_rounded",
            "source_url": ref["url"] if ref else source["article_url"],
            "document_issued_at": ref["issued_at"] if ref else None,
            "snapshot_at": source["snapshot_at"], "caveat": caveat,
        })

    for key, label, field, document in [
        ("copper", "Copper custody", "reported_value_usd", 13),
        ("ceffu", "Ceffu custody", "reported_custody_usd", 14),
        ("anchorage_ethena", "Anchorage custody", "custody_assets_usd", 15),
        ("kraken_ethena", "Kraken custody", "reported_value_usd", 16),
    ]:
        row(key, label, "custody", readings[key][field], document,
            readings[key]["limitation"])
    anchorage = readings["anchorage_ethena"]
    row("anchorage_loan", "Anchorage lending principal", "loan_principal",
        amount(anchorage["loan_principal_usdc"]) + amount(anchorage["loan_principal_usdt"]),
        15, "Excluded from Anchorage custody; secured loan claim, not cash.")
    falcon = readings["falconx_spv"]
    row("falconx_loan", "FalconX SPV lending principal", "loan_principal",
        falcon["loan_principal_usdc"], 17, falcon["limitation"])
    row("coinbase", "Issuer onchain-wallet bucket", "onchain_issuer_bucket",
        headline["coinbase_onchain"], caveat="Rounded issuer aggregate; the name does not certify Coinbase custody.")
    row("mintredeem", "Mint/redeem", "issuer_contract_bucket", headline["mintredeem"],
        caveat="Rounded historical issuer amount, not current cash.")
    row("ripple", "Ripple Prime account equity", "exchange_margin",
        readings["ripple_prime"]["account_equity_usd"], 21,
        readings["ripple_prime"]["limitation"])

    children = readings["falconx_collateral_custodians"]
    collateral_sum = sum(amount(children[k]) for k in ["anchorage_usd", "bitgo_usd", "kraken_usd"])
    if collateral_sum != amount(falcon["collateral_reported_usd"]):
        raise ValueError("FalconX collateral subletters do not reconcile")
    evm = [x.lower() for x in source["public_roster"]["evm"]]
    if len(evm) != len(set(evm)):
        raise ValueError("Duplicate disclosed EVM address")
    component_sum = sum(amount(x["amount"]) for x in rows)
    issuer_total = amount(headline["total_backing"])
    issuer_line_sum = sum(amount(headline[k]) for k in [
        "copper", "ceffu_and_unsettled", "anchorage_including_loan_principal",
        "kraken", "falconx_spv_loan_principal", "coinbase_onchain", "mintredeem",
    ])
    exchange_sum = sum(amount(x) for x in readings["binance_account_screenshots"]["usdt_equivalent_values"])
    reported_coverage = amount(headline["coverage_including_reserve_pct"])
    computed_coverage = (issuer_total + amount(headline["reserve_fund"])) / amount(headline["usde_supply"]) * 100
    return {
        "schema_version": "ethena-monthly-normalization/1",
        "version": source["version"].replace("source", "normalized"),
        "snapshot_at": source["snapshot_at"],
        "published_at": source["article_published"],
        "retrieved_at": source["retrieved_at"],
        "source_url": source["article_url"],
        "status": "documentary_scope_unreconciled",
        "source_access": "article_and_11_images_reviewed",
        "independent_authenticity_verified": False,
        "current_financial_assurance": None,
        "rows": rows,
        "excluded_security": [
            {"id": "anchorage_security", "secures": "anchorage_loan",
             "amount": decimal_text(amount(anchorage["collateral_btc_reported_usd"])),
             "unit": "USD", "additive": False, "source_url": docs[15]["url"]},
            {"id": "falconx_security", "secures": "falconx_loan",
             "amount": decimal_text(amount(falcon["collateral_reported_usd"])),
             "unit": "USD", "additive": False, "source_url": docs[17]["url"],
             "custodian_subcomponents": [
                 {"label": name, "amount": decimal_text(amount(children[key])),
                  "unit": "USD", "source_url": docs[index]["url"]}
                 for name, key, index in [("Anchorage", "anchorage_usd", 18),
                                          ("BitGo", "bitgo_usd", 19),
                                          ("Kraken", "kraken_usd", 20)]
             ], "subcomponents_sum": decimal_text(collateral_sum),
             "subcomponents_match": True},
        ],
        "ceffu_scope": {
            "custody_usd": decimal_text(amount(readings["ceffu"]["reported_custody_usd"])),
            "issuer_summary_usd_rounded": decimal_text(amount(headline["ceffu_and_unsettled"])),
            "exchange_account_usdt_equivalent": decimal_text(exchange_sum),
            "additive": False, "usd_usdt_equivalence_assumed": False,
            "note": "Different custody/account perimeters and update timing; no automatic currency equivalence, substitution or additive assets.",
        },
        "reconciliation": {
            "document_components_plus_issuer_buckets_usd": decimal_text(component_sum),
            "issuer_total_usd_rounded": decimal_text(issuer_total),
            "issuer_total_minus_components_usd": decimal_text(issuer_total - component_sum),
            "issuer_lines_without_document_margin_usd": decimal_text(issuer_line_sum),
            "issuer_total_minus_lines_usd": decimal_text(issuer_total - issuer_line_sum),
            "issuer_total_minus_lines_and_margin_usd": decimal_text(
                issuer_total - issuer_line_sum - amount(readings["ripple_prime"]["account_equity_usd"])),
            "meaning": "Arithmetic differences across statement perimeters and rounded issuer inputs, not verified missing funds, loss or proven rounding.",
        },
        "issuer_headline": {
            **headline,
            "arithmetic_coverage_from_rounded_headlines_pct": decimal_text(computed_coverage),
            "stated_minus_arithmetic_coverage_pp": decimal_text(reported_coverage - computed_coverage),
            "basis": "Historical issuer-reported rounded amounts; not independent current coverage.",
        },
        "roster": {
            "evm": evm, "evm_count": len(evm),
            "solana": source["public_roster"]["solana"],
            "independently_tracked_current": None,
            "basis": "Historical disclosure only; matching membership does not clear composition or ownership.",
        },
        "limitations": [
            "Custodian/provider assertions are not independently authenticated signatures or a complete financial audit.",
            "Copper includes unsettled amounts; Kraken includes unsettled/in-transit exceptions.",
            "Loan collateral and its custody subletters secure principal; never count both as independent backing.",
            "Ripple Prime is account equity including open-trade equity, not off-exchange custody.",
            "Live ownership, encumbrance, liabilities, provider balances and current reserve composition remain unverified.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--intake", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    normalized = normalize(json.loads(args.intake.read_text()))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(normalized, indent=2) + "\n")


if __name__ == "__main__":
    main()
