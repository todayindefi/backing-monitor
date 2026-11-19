import copy,hashlib,json,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from public_dashboard_projection import public_projection
from preview_assessment import resolve_source

class PublicProjectionTests(unittest.TestCase):
    def test_source_ids_preserve_measurement_hash_clocks_and_nulls(self):
        raw={'timestamp':'original-clock','amount_raw':'123456789012345678901234','cash':None,'source_sha256':'a'*64,'nested':[{'source':'/home/danger/DexTracker/data/dashboard_pending/fxsave/direct_ladder.json'}]}
        before=copy.deepcopy(raw);out=public_projection(raw)
        self.assertEqual(raw,before)
        self.assertEqual(out['nested'][0]['source'],'dextracker:data/dashboard_pending/fxsave/direct_ladder.json')
        for k in ('timestamp','amount_raw','cash','source_sha256'):self.assertEqual(out[k],raw[k])
        self.assertEqual(out,public_projection(out))
    def test_scheduler_command_not_exported(self):
        entry='17 */3 * * * /bin/bash /home/danger/DexTracker/data/dashboard_pending/fxsave/run.sh >> /home/danger/DexTracker/data/dashboard_pending/fxsave/producer.log 2>&1'
        out=public_projection({'cron_entry':entry,'as_of':'original','log':'/home/danger/DexTracker/data/dashboard_pending/fxsave/producer.log'})
        self.assertEqual(out['cron_entry'],'17 */3 * * *')
        self.assertEqual(out['cron_entry_record_sha256'],hashlib.sha256(entry.encode()).hexdigest())
        self.assertEqual(out['as_of'],'original');self.assertNotIn('/home/',json.dumps(out));self.assertNotIn('/bin/bash',json.dumps(out))
    def test_unknown_local_path_fails_closed(self):
        with self.assertRaises(ValueError):public_projection({'source':'/home/another/unreviewed/packet.json'})
        with self.assertRaises(ValueError):public_projection({'source':'file:///tmp/private-data.json'})
    def test_private_owner_context_not_laundered_into_source_id(self):
        for raw in [{'visibility':'private'},{'private_holdings':[]},{'publication_approved':False},{'source':'/home/danger/backing-monitor/.private-reviews/a.json'}]:
            with self.assertRaises(ValueError):public_projection(raw)
    def test_logical_policy_resolves_without_public_host_path(self):
        p=resolve_source('riskanalyst:assets/fxsave.md')
        self.assertEqual(p.name,'fxsave.md');self.assertEqual(p.parent.name,'assets')
        with self.assertRaises(ValueError):resolve_source('riskanalyst:../private.json')
    def test_committed_public_groups_and_config_are_path_free(self):
        paths=[*Path('data').glob('fxsave_*.json'),*Path('data').glob('weeth_*.json'),*Path('previews/fxsave/data').glob('fxsave_*.json'),Path('config/fxsave_preview_sources.json'),Path('config/weeth_preview_sources.json')]
        for p in paths:
            data=json.loads(p.read_text());self.assertEqual(data,public_projection(data),str(p))
if __name__=='__main__':unittest.main()
