import importlib.util
from pathlib import Path
from datetime import datetime, timezone, timedelta
import unittest

spec = importlib.util.spec_from_file_location('adaptive', Path(__file__).resolve().parents[1] / 'tools/adaptive_exit_ladder.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


class Adaptive(unittest.TestCase):
    def run_curve(self, crossing, **kwargs):
        calls = []
        def quote(size):
            calls.append(size)
            return {'output_usd': size * (1 - .005 * (size - 1000) / (crossing - 1000))}
        result = m.adaptive_ladder(quote, **kwargs)
        self.assertLessEqual(len(calls), 7)
        self.assertEqual(len(calls), len(set(calls)))
        return result, calls

    def test_thin_medium_and_deep_brackets_have_tested_endpoints(self):
        for crossing in [10000, 700000, 4000000, 15000000]:
            with self.subTest(crossing=crossing):
                result, calls = self.run_curve(crossing)
                block = result['depth_50bps']
                self.assertEqual(block['status'], 'bracketed')
                lo, hi = block['bracket']
                self.assertIn(lo, calls)
                self.assertIn(hi, calls)
                self.assertLessEqual(-result['quotes'][str(lo)]['slippage_bps'], 50)
                self.assertGreater(-result['quotes'][str(hi)]['slippage_bps'], 50)
                self.assertEqual(block['depth_usd'], lo)
                self.assertFalse(block['is_floor'])

    def test_floor_at_declared_cap_is_not_a_crossing(self):
        result, calls = self.run_curve(1000000000)
        self.assertEqual(result['adaptive_policy']['stop_reason'], 'notional_ceiling')
        self.assertEqual(result['depth_50bps']['depth_usd'], 50000000)
        self.assertTrue(result['depth_50bps']['is_floor'])

    def test_failure_consumes_budget_and_does_not_become_crossing(self):
        for fail_at in [1, 3]:
            calls = []
            def quote(size):
                calls.append(size)
                return {'error': 'rate_limited'} if len(calls) == fail_at else {'output_usd': size}
            result = m.adaptive_ladder(quote)
            self.assertEqual(len(calls), fail_at)
            self.assertEqual(result['adaptive_policy']['requests_used'], fail_at)
            self.assertEqual(result['depth_50bps']['status'], 'quote_failed')
            self.assertIsNone(result['depth_50bps']['bracket'])
            if fail_at == 1:
                self.assertIsNone(result['depth_50bps']['depth_usd'])

    def test_fresh_memory_selects_sizes_but_never_reuses_quotes(self):
        now = datetime.now(timezone.utc)
        old = {'timestamp': (now - timedelta(hours=1)).isoformat(),
               'depth_50bps': {'bracket': [500000, 1000000]}}
        result, calls = self.run_curve(700000, previous=old, now=now)
        self.assertEqual(calls[:3], [1000, 500000, 1000000])
        self.assertTrue(result['adaptive_policy']['warm_start_used'])
        old['timestamp'] = (now - timedelta(hours=4)).isoformat()
        result, calls = self.run_curve(700000, previous=old, now=now)
        self.assertEqual(calls[:2], [1000, 100000])
        self.assertFalse(result['adaptive_policy']['warm_start_used'])

    def test_material_nonmonotonicity_withholds_depth(self):
        outputs = iter([1000, 99000, 316228])
        result = m.adaptive_ladder(lambda size: {'output_usd': next(outputs)})
        self.assertEqual(result['adaptive_policy']['stop_reason'], 'non_monotonic')
        self.assertIsNone(result['depth_50bps']['depth_usd'])


if __name__ == '__main__':
    unittest.main()
