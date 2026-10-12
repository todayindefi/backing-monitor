import unittest

from tools.enrich_usds_feeds import enrich_susds, enrich_usds


class EnrichUsdsFeedsTests(unittest.TestCase):
    def test_preserves_pre_and_post_executive_observations(self):
        usds = {
            "schema_version": 1, "timestamp": "2026-10-12T00:00:00Z",
            "summary": {"total_supply": 100, "usds_supply": 80},
            "asset_specific": {"onchain": {"pocket_usdc": 42}, "blockanalitica": {"per_star_backed": {"spark": 25}}},
            "backing": {"total_supply": 100, "surplus_buffer_usd": -5, "stars": [{"star": "spark", "size_usd": 30}]},
            "liquidity": {},
        }
        enrich_usds(usds, {"entries": [{"timestamp": "2026-10-01T00:00:00Z", "surplus_deficit": -10}]})
        obs = usds["backing"]["executive_observations"]
        self.assertEqual(obs["pre_execution"]["timestamp"], "2026-10-08T13:49:56Z")
        self.assertEqual(obs["post_execution"]["timestamp"], "2026-10-08T14:50:16Z")
        self.assertEqual(obs["change"]["surplus_buffer_usd"], 10696222.61)
        self.assertEqual(usds["backing"]["stars"][0]["debt_share"]["value_pct"], 30.0)
        self.assertEqual(usds["liquidity"]["fixed_rate_exit_capacity"]["inventory_usd"], 42)

    def test_susds_has_integrity_adjacent_nav_share_and_two_exit_legs(self):
        usds = {"summary": {"usds_supply": 80}, "liquidity": {"fixed_rate_exit_capacity": {"inventory_usd": 42, "as_of": "t", "capacity_basis": "balance"}}}
        susds = {
            "schema_version": 1, "timestamp": "t", "summary": {"total_assets_usds": 40},
            "backing": {"integrity": {"status": "ok"}},
            "asset_specific": {"vault_state": {"nav_usds_per_share": 1.1}},
            "liquidity": {"primary_exit": {"gated": False}},
        }
        enrich_susds(susds, usds)
        self.assertEqual(susds["backing"]["share_of_usds_supply_pct"], 50.0)
        self.assertEqual(susds["backing"]["nav_usds_per_share"], 1.1)
        self.assertEqual([leg["to"] for leg in susds["liquidity"]["exit_legs"]], ["USDS", "USDC"])
        self.assertEqual(susds["backing"]["integrity"]["status"], "ok")


if __name__ == "__main__":
    unittest.main()
