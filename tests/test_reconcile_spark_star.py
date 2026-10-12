import unittest

from tools.reconcile_spark_star import build_reconciliation


class SparkReconciliationTests(unittest.TestCase):
    def test_separates_principal_direct_susds_and_unattributed_residual(self):
        usds = {"timestamp": "u", "backing": {"stars": [{
            "star": "spark", "size_usd": 1000,
            "mix_denominator": {"value_usd": 700},
        }]}}
        susds = {"timestamp": "s", "backing": {"nav_usds_per_share": 1.1}}
        out = build_reconciliation(usds, susds, 400, 123, "rpc")
        self.assertEqual(out["apparent_gap_before_direct_susds_usd"], 300)
        self.assertEqual(out["direct_susds"]["value_usds"], 440)
        self.assertEqual(out["residual_after_direct_susds_usd"], 140)
        self.assertEqual(out["residual_status"], "unattributed_positive")
        self.assertEqual(out["direct_susds"]["classification"], "reflexive_usds_claim")


if __name__ == "__main__":
    unittest.main()
