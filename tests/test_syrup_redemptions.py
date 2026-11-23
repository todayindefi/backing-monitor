import importlib.util
import unittest
from unittest.mock import patch
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

    def test_secret_endpoint_is_not_exported(self):
        reader = Reader()
        reader.url = 'https://user:password@eth-mainnet.g.alchemy.com/v2/private-key?token=secret'
        result = m.observe(reader, 'syrupusdc')
        self.assertEqual(result['rpc'], 'https://eth-mainnet.g.alchemy.com')
        self.assertNotIn('private-key', str(result))
        self.assertNotIn('password', str(result))

    def test_range_caps_and_bounded_partial_scan(self):
        class SmallRangeReader(Reader):
            log_chunk_size = 10
            def rpc(self, method, params):
                if method == 'eth_blockNumber': return hex(10000)
                if method == 'eth_getLogs':
                    size = int(params[0]['toBlock'], 16) - int(params[0]['fromBlock'], 16) + 1
                    self.asserted_sizes.append(size)
                    return []
                return super().rpc(method, params)
        reader = SmallRangeReader()
        reader.asserted_sizes = []
        result = m.observe(reader, 'syrupusdc')
        self.assertEqual(reader.asserted_sizes, [10] * 8)
        self.assertEqual(result['processing_status'], 'scan_budget_exhausted')
        self.assertEqual(result['processing_scan_calls'], 8)
        self.assertGreater(result['processing_scan_from_block'], result['processing_requested_scan_from_block'])
        self.assertEqual(result['status'], 'ok')
        self.assertIsNone(result['last_processed_at'])

    def test_provider_configuration_and_log_caps(self):
        self.assertEqual(m.RPC('https://eth.drpc.org').log_chunk_size, 100)
        self.assertEqual(m.RPC('https://eth-mainnet.g.alchemy.com/v2/secret').log_chunk_size, 10)
        self.assertEqual(m.RPC('https://ethereum.publicnode.com').log_chunk_size, 1000)
        with patch.dict(m.os.environ, {'ETHEREUM_RPC_URL': 'https://example.invalid/key'}):
            self.assertEqual(m.rpc_urls()[0], 'https://example.invalid/key')
        self.assertNotIn('https://eth.llamarpc.com', m.RPCS)

if __name__ == '__main__': unittest.main()
