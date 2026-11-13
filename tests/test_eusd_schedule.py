import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from install_eusd_schedule import revised,TAG
class Schedule(unittest.TestCase):
    def test_reinstall_is_idempotent_and_preserves_other_jobs(self):
        before='MAILTO="ops@example.test"\n3 * * * * /existing/job\n'
        one=revised(before,'/accepted/eusd-command');self.assertTrue(one.startswith(before));self.assertEqual(one,revised(one,'/accepted/eusd-command'));self.assertEqual(one.count(TAG),1)
    def test_untagged_collector_blocks_duplicate(self):
        with self.assertRaises(ValueError):revised('17 */2 * * * python /tools/refresh_eusd_product.py\n','/new')
    def test_multiple_owned_jobs_fail_before_any_mutation(self):
        with self.assertRaises(ValueError):revised('x '+TAG+'\ny '+TAG+'\n','/new')
if __name__=='__main__':unittest.main()
