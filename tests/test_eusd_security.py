import copy,json,sys,tempfile,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools'))
from eusd_security import project_security,selected_security,TOKEN,MAIN

def fixture():
    source={'schema_version':1,'kind':'security-reviewed-public-source-fields','component':{'chain_id':1,'token':TOKEN,'main':MAIN},'status':'bounded-review-complete-with-explicit-gaps','source_clock':{'block_number':100,'block_timestamp':'2026-11-13T00:00:00Z'},'binding_method':'Test bound observation','bindings':[{'chain_id':1,'component':'main','address':MAIN,'source_runtime_binding':{'record_code_equals_pinned_code':True,'verification_status':'match'}}],'controls':[{'id':'governance-path','values':{'timelock_min_delay_seconds':259200},'source_urls':[]}],'receipts':[{'token':'0xreceipt','plugin':'0xplugin'}],'unsupported':[{'id':'protective-role-census','status':'unsupported','detail':'Not enumerated'}]}
    product={'identity':{'token':TOKEN,'main':MAIN},'source_clock':{'block_number':200},'basket':{'holdings':[{'token':'0xreceipt','plugin':'0xplugin','current_basket_member':True}]}}
    return source,product
class Security(unittest.TestCase):
    def test_control_clock_not_renewed_by_new_financial_observation(self):
        source,p=fixture();out=project_security(source,p)
        self.assertEqual(out['source_clock']['block_number'],100);self.assertEqual(out['unsupported'],source['unsupported']);self.assertFalse(out['grades_authored'])
    def test_changed_plugin_scope_or_unbound_code_rejected(self):
        source,p=fixture();p['basket']['holdings'][0]['plugin']='0xnew'
        with self.assertRaisesRegex(ValueError,'scope differs'):project_security(source,p)
        source,p=fixture();source['bindings'][0]['source_runtime_binding']['record_code_equals_pinned_code']=False
        with self.assertRaisesRegex(ValueError,'Unbound'):project_security(source,p)
    def test_changed_selected_source_fails_visibly_without_generic_fallback(self):
        source,p=fixture()
        with tempfile.TemporaryDirectory()as d:
            Path(d,'selected.json').write_text(json.dumps(source));out=selected_security({'selected_security':{'path':'selected.json','sha256':'0'*64}},d,p)
            self.assertEqual(out['status'],'selected_source_unavailable');self.assertFalse(out['fallback_used']);self.assertNotIn('controls',out)
if __name__=='__main__':unittest.main()
