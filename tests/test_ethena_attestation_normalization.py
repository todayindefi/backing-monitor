import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("ethena_normalize", ROOT / "tools/normalize_ethena_attestation.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class NormalizationTests(unittest.TestCase):
    def setUp(self):
        self.source = json.loads((ROOT / "config/ethena_attestation_intake_2026_10.json").read_text())

    def test_principal_security_and_residual_perimeters(self):
        result = MODULE.normalize(self.source)
        rows = {r["id"]: r for r in result["rows"]}
        self.assertEqual(rows["anchorage_ethena"]["amount"], "580905724")
        self.assertEqual(rows["anchorage_loan"]["amount"], "146000000")
        self.assertEqual(rows["falconx_loan"]["kind"], "loan_principal")
        self.assertEqual(result["excluded_security"][1]["subcomponents_sum"], "418831520.74")
        self.assertEqual(result["reconciliation"]["issuer_total_minus_components_usd"], "17015301.80")
        self.assertFalse(result["ceffu_scope"]["usd_usdt_equivalence_assumed"])
        self.assertEqual(result["snapshot_at"], "2026-10-21T23:59:00Z")
        self.assertEqual(result["roster"]["evm_count"], 12)
        self.assertIsNone(result["roster"]["independently_tracked_current"])
        self.assertNotIn("/home/", json.dumps(result))
        self.assertNotEqual(result["issuer_headline"]["stated_minus_arithmetic_coverage_pp"], "0")

    def test_bad_collateral_sum_is_rejected(self):
        self.source["document_readings"]["falconx_collateral_custodians"]["bitgo_usd"] += 1
        with self.assertRaisesRegex(ValueError, "do not reconcile"):
            MODULE.normalize(self.source)

    def test_duplicate_roster_case_is_rejected(self):
        self.source["public_roster"]["evm"].append(self.source["public_roster"]["evm"][0].upper())
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            MODULE.normalize(self.source)

    def test_invalid_amount_is_not_zero(self):
        for value in ["NaN", "-1", "Infinity"]:
            with self.assertRaises(ValueError):
                MODULE.amount(value)


if __name__ == "__main__":
    unittest.main()
