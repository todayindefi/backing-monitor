import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('redemptions', Path(__file__).resolve().parents[1] / 'tools/refresh_syrup_redemptions.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class Reader:
    url = 'mock'
    def __init__(self):
        self.blocks = []
    def rpc(self, method, params):
        if method == 'eth_blockNumber': return '0x100'
        if method == 'eth_getBlockByNumber': return {'timestamp': '0x70000000'}
        if method == 'eth_getLogs': raise ValueError('history unavailable')
        raise AssertionError(method)
    def call(self, address, selector, block, argument=''):
        self.blocks.append(block)
        return {'481c6a75': [1], '82fe535a': [2], '38d52e0f': [3],
                '313ce567': [6], '3a98ef39': [2000000], '07a2d13a': [2400000],
                '18160ddd': [10000000], '70a08231': [600000], 'e10d29ee': [5, 8]}[selector]

class TestRedemptions(unittest.TestCase):
    def test_single_block_and_history_failure(self):
        reader = Reader()
        r = m.observe(reader, 'syrupusdc')
        self.assertEqual(set(reader.blocks), {'0x100'})
        self.assertEqual(r['status'], 'ok')
        self.assertEqual(r['pool_cash'], .6)
        self.assertEqual(r['queued_assets'], 2.4)
        self.assertEqual(r['cash_coverage_pct'], 25)
        self.assertAlmostEqual(r['additional_funding_needed'], 1.8)
        self.assertEqual(r['queue_supply_pct'], 20)
        self.assertEqual(r['processing_status'], 'unavailable')
        self.assertIsNone(r['last_processed_at'])
    def test_empty_queue_and_excess_cash(self):
        self.assertIsNone(m.metrics(12, 0, 0, 100)['cash_coverage_pct'])
        self.assertEqual(m.metrics(12, 0, 0, 100)['additional_funding_needed'], 0)
        self.assertEqual(m.metrics(12, 10, 10, 100)['cash_coverage_pct'], 120)

if __name__ == '__main__': unittest.main()
