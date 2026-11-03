import copy
import json
import pathlib
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import frxusd_defillama_evidence as m

FIXTURE = pathlib.Path(__file__).parent / 'fixtures/frxusd_defillama_2026-11-03.json'
NOW = datetime(2026, 11, 3, 9, 46, 33, tzinfo=timezone.utc)


def page(value):
    return b'<script id="__NEXT_DATA__" type="application/json">' + m.canonical(value) + b'</script>Full reserves'


class SharedEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.document = json.loads(FIXTURE.read_text())
        self.payload = self.document['props']['pageProps']['payload']
        self.issuer = json.loads((m.DATA / 'frxusd_backing.json').read_text())

    def test_fixture_parity_both_bases_and_concentration(self):
        d = m.normalize(self.payload, NOW, self.issuer)
        v = d['metrics']
        self.assertAlmostEqual(v['reserves_usd'], 98767313.04839623)
        self.assertAlmostEqual(v['liabilities_tokens'], 95494024.10939886)
        self.assertAlmostEqual(v['coverage_par_pct'], 103.42774217499459)
        self.assertAlmostEqual(v['coverage_market_pct'], 103.4501137492023)
        self.assertAlmostEqual(next(x for x in d['concentration'] if x['strategy']=='WTGXX')['pct_of_reserves'], 68.5550545048126, places=5)
        self.assertEqual(d['reconciliation']['positions'], 10)
        self.assertEqual(d['reconciliation']['accounts'], 8)
        self.assertEqual(d['reconciliation']['chain_count'], 30)

    def test_bridge_is_not_subtracted_again_and_aliases_preserved(self):
        d = m.normalize(self.payload, NOW, self.issuer)
        b = d['liabilities']['bridge_adjustment']
        self.assertEqual(b['additional_subtraction_tokens'], 0)
        self.assertAlmostEqual(b['fraxtal_escrow_tokens'], 10484949.8635046)
        self.assertAlmostEqual(sum(r['tokens'] for r in d['liabilities']['chain_rows']), d['metrics']['liabilities_tokens'])
        self.assertIn({'source_chain':'avax','chain':'avalanche','tokens':6983.15449}, d['liabilities']['chain_rows'])

    def test_identity_not_symbol_and_source_clocks(self):
        d = m.normalize(self.payload, NOW, self.issuer)
        rows = [r for r in d['positions'] if r['symbol']=='WTGXX']
        self.assertEqual(len({r['position_id'] for r in rows}), 3)
        self.assertTrue(all(r['chain']=='ethereum' for r in rows))
        self.assertEqual(d['observed_at'], '2026-11-03T09:00:07Z')
        self.assertEqual(d['oldest_position_at'], '2026-11-03T08:59:59Z')
        self.assertNotEqual(d['oldest_position_at'], d['newest_position_at'])
        self.assertIn('not a BM audit', d['limitations'][0])
        for raw, normalized in zip(self.payload['data']['assets'],d['positions']):
            self.assertEqual(raw['amount'],normalized['quantity'])
            self.assertEqual(raw['priceUsd'],normalized['price_usd'])
            self.assertEqual(raw['walletAddress'],normalized['holder_address'])
            self.assertEqual(raw['address'],normalized['token_address'])

    def test_missing_nonfinite_and_mismatched_schema_rejected(self):
        for mut in [lambda p:p['data'].pop('liabilities'), lambda p:p['data'].update(totalValueUsd=float('nan')), lambda p:p['data']['liabilities'].update(frxusdSupply=1), lambda p:p['data']['assets'][0].update(valueUsd=1), lambda p:p.update(projectId='other')]:
            p=copy.deepcopy(self.payload);mut(p)
            with self.assertRaises(m.SchemaChanged):m.normalize(p,NOW,self.issuer)

    def test_stale_and_upstream_unhealthy_are_not_freshened(self):
        with self.assertRaises(m.StaleSource):m.normalize(self.payload,NOW+timedelta(days=3),self.issuer)
        p=copy.deepcopy(self.payload);p['state']['upToDate']=False
        with self.assertRaises(m.StaleSource):m.normalize(p,NOW,self.issuer)

    def test_duplicate_alias_or_position_fails(self):
        p=copy.deepcopy(self.payload);p['data']['liabilities']['frxusdSupplyByChain']['bnb']=0
        with self.assertRaises(m.SchemaChanged):m.normalize(p,NOW,self.issuer)
        p=copy.deepcopy(self.payload);p['data']['assets'].append(p['data']['assets'][0])
        with self.assertRaises(m.SchemaChanged):m.normalize(p,NOW,self.issuer)

    def test_actual_zero_reserves_remain_zero_not_missing(self):
        p=copy.deepcopy(self.payload);p['data'].update(totalValueUsd=0,assets=[],balances={})
        d=m.normalize(p,NOW,self.issuer)
        self.assertEqual(d['metrics']['coverage_par_pct'],0)
        self.assertIn('coverage_below_par_liabilities',d['alerts'])

    def test_failure_and_schema_change_keep_same_immutable_snapshot(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp)
            for f in ['frxusd_backing.json','frxusd_backing_verification.json']:(root/f).write_bytes((m.DATA/f).read_bytes())
            good=m.refresh(root,fetch=lambda:page(self.document),now=NOW)
            self.assertEqual(good['status'],'accepted')
            artifact=root/'frxusd_evidence_snapshots'/(good['snapshot_sha256']+'.json');raw=artifact.read_bytes()
            self.assertEqual(m.digest(raw),good['snapshot_sha256'])
            for fetch in [lambda:b'changed HTML', lambda:(_ for _ in ()).throw(OSError('offline'))]:
                bad=m.refresh(root,fetch=fetch,now=NOW+timedelta(hours=1))
                self.assertEqual(bad['snapshot_id'],good['snapshot_id'])
                self.assertEqual(bad['last_success_at'],good['last_success_at'])
                self.assertEqual(bad['status'],'degraded_last_good')
                self.assertTrue(bad['served_is_last_good'])
                self.assertEqual(raw,artifact.read_bytes())
            stale=m.refresh(root,fetch=lambda:page(self.document),now=NOW+timedelta(days=3))
            self.assertEqual(stale['upstream_health'],'stale')
            snap=json.loads(raw)
            self.assertIsNone(snap['comparisons']['independent_global_coverage_pct'])
            self.assertEqual(len(json.loads((root/'frxusd_evidence_history.json').read_text())['entries']),1)

    def test_first_failure_is_unavailable_not_zero(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=m.refresh(pathlib.Path(tmp),fetch=lambda:b'broken',now=NOW)
            self.assertEqual(p['status'],'unavailable');self.assertNotIn('snapshot_id',p)



class TransportTests(unittest.TestCase):
    def test_public_api_preferred_and_html_only_on_request_failure(self):
        document=json.loads(FIXTURE.read_text())
        from unittest.mock import Mock
        api=Mock();api.json.return_value=document['props']['pageProps']['payload'];api.content=m.canonical(api.json.return_value)
        with patch.object(m.requests,'get',return_value=api) as get:
            result=m.fetch_upstream()
            self.assertEqual(result[2],'public_verification_api');self.assertEqual(get.call_count,1)
            self.assertEqual(get.call_args.args[0],m.API)
        api.raise_for_status.side_effect=m.requests.HTTPError('404')
        html=Mock();html.content=page(document)
        with patch.object(m.requests,'get',side_effect=[api,html]) as get:
            result=m.fetch_upstream()
            self.assertEqual(result[2],'embedded_next_data_fallback');self.assertEqual(get.call_count,2)


if __name__=='__main__':unittest.main()
