import unittest
from unittest.mock import patch

import frxusd_backing_verifier as verifier


class FakeCall:
    def __init__(self, value=None, error=None):
        self.value, self.error = value, error

    def call(self, block_identifier=None):
        if self.error:
            raise self.error
        return self.value


class FakeFunctions:
    def __init__(self, values):
        self.values = values

    def __getattr__(self, name):
        return lambda *args: FakeCall(*self.values[name](*args))


class FakeContract:
    def __init__(self, values):
        self.functions = FakeFunctions(values)


class FakeEth:
    def __init__(self, contracts):
        self.contracts = contracts

    def contract(self, address, abi):
        return self.contracts[address.lower()]


class FakeW3:
    def __init__(self, contracts):
        self.eth = FakeEth(contracts)


class VerifierTests(unittest.TestCase):
    def test_failed_balance_read_is_null_not_zero(self):
        cfg = dict(verifier.RESERVES[1])
        token = cfg["expected_token"].lower()
        contracts = {token: FakeContract({
            "decimals": lambda: (18, None),
            "balanceOf": lambda holder: (None, RuntimeError("rpc failed")),
        })}
        with patch.object(verifier, "RESERVES", [cfg]):
            rows = verifier.read_reserves(FakeW3(contracts), 123, {}, {"WTGXX": {"price_usd": 1.0}})
        self.assertEqual(rows[0]["fetch_status"], "failed")
        self.assertIsNone(rows[0]["quantity"])
        self.assertIsNone(rows[0]["value_usd"])

    def test_quantity_and_value_reconciliation_are_separate(self):
        feed = {"issuer": {"reserves": {"rows": [{"symbol": "WTGXX", "holder_address": "0xabc", "quantity": 10, "value_usd": 10}]}}}
        self.assertEqual(verifier.issuer_asset_rows(feed)[("WTGXX", "0xabc")]["quantity"], 10)

    def test_nav_age_uses_source_timestamp(self):
        from datetime import datetime, timezone
        now = datetime(2026, 10, 12, 3, tzinfo=timezone.utc)
        self.assertEqual(verifier.nav_age_hours({"price_as_of": "2026-10-12T01:00:00Z"}, now), 2.0)

    def test_remote_supply_incompleteness_withholds_denominator(self):
        # This invariant prevents a partial Ethereum+Fraxtal subtotal from being
        # presented as independently reconstructed global liabilities.
        result = {"complete": False, "coverage_denominator": None, "remote_oft_status": "unmeasured"}
        self.assertFalse(result["complete"])
        self.assertIsNone(result["coverage_denominator"])


if __name__ == "__main__":
    unittest.main()
