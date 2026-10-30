import copy
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('axes',Path(__file__).resolve().parents[1]/'tools/prepare_gho_remaining_axes.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)


class SourceControls(unittest.TestCase):
    def test_address_resolution_requires_official_symbol_and_full_address(self):
        text='address internal constant GHO_TOKEN = 0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f;'
        self.assertEqual(m.address(text,'GHO_TOKEN'),'0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f')
        for name in ['GHO', 'GHO_RESERVE']:
            with self.assertRaises(ValueError):m.address(text,name)
        with self.assertRaises(ValueError):m.address(text.replace('0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f','0x40D1'),'GHO_TOKEN')

    def test_changed_or_unmeasured_controls_cannot_emit_confirmation(self):
        holders={'DAO executor L1':{'status':'ok','value':True},'deployer negative control':{'status':'ok','value':False},'token negative control':{'status':'ok','value':False}}
        checks={'holders':holders}
        targets={'GHO token':{role:copy.deepcopy(checks) for role in ['DEFAULT_ADMIN_ROLE','FACILITATOR_MANAGER_ROLE','BUCKET_MANAGER_ROLE']}}
        monad={'threshold':{'status':'ok','value':2},'owners':{'status':'ok','value':['a','b','c']}}
        m.validate_controls(targets,monad)
        for replacement in [{'status':'ok','value':False},{'status':'unmeasured'}]:
            bad=copy.deepcopy(targets);bad['GHO token']['DEFAULT_ADMIN_ROLE']['holders']['DAO executor L1']=replacement
            with self.assertRaises(ValueError):m.validate_controls(bad,monad)
        bad=copy.deepcopy(monad);bad['threshold']['value']=1
        with self.assertRaises(ValueError):m.validate_controls(targets,bad)


if __name__=='__main__':unittest.main()
