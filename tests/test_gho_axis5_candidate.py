import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import yaml


def module(name, filename):
    spec=importlib.util.spec_from_file_location(name, Path(__file__).resolve().parents[1]/'tools'/filename)
    result=importlib.util.module_from_spec(spec);spec.loader.exec_module(result);return result

builder=module('axis5_builder','build_gho_axis5_candidate.py')
consumer=module('axis5_consumer','prepare_gho_preview.py')


class AuthorityAcceptance(unittest.TestCase):
    def test_hash_verification_and_changed_core_path_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'topology/assets').mkdir(parents=True)
            path={'name':'Core issuance through direct GSM facilitator','actionable':True,'execution_delay':'none',
                  'value_at_risk_scope':'core','independent_canceller':False,'n':2,'m':3}
            proof={'initial_bucket':[310000000*10**18]*2,'expanded_bucket':[620000000*10**18,310000000*10**18],
                   'minted_to_reserve_wei':1,'origin_chain_id':1}
            def prepare():
                (root/'topology/assets/gho.yaml').write_text(yaml.safe_dump({'layers':[{'paths':[path]}]}))
                (root/'fork-proof.json').write_text(json.dumps(proof))
                files={name:{'sha256':builder.sha((root/name).read_bytes()),'bytes':(root/name).stat().st_size}
                       for name in ['topology/assets/gho.yaml','fork-proof.json']}
                (root/'manifest.json').write_text(json.dumps({'schema_version':'security-authority-return/1','asset':'gho',
                    'producer':'security_analyst','producer_approved':True,'staged_only':True,'numeric_score_authored':False,'files':files}))
                (root/'receipt.json').write_text(json.dumps({'producer':'riskanalyst','authority_producer':'security_analyst',
                    'source_directory':str(root),'manifest_files_verified':2,'manifest_mismatches':[],'structural_score':None,'publication':False}))
            prepare();builder.verify_authority(root,root/'receipt.json')
            (root/'fork-proof.json').write_text('{}')
            with self.assertRaisesRegex(ValueError,'integrity mismatch'):builder.verify_authority(root,root/'receipt.json')
            path['execution_delay']='1d';prepare()
            with self.assertRaisesRegex(ValueError,'core issuance path'):builder.verify_authority(root,root/'receipt.json')
            path['execution_delay']='none';proof['minted_to_reserve_wei']=310000000*10**18;prepare()
            with self.assertRaisesRegex(ValueError,'Fork result differs'):builder.verify_authority(root,root/'receipt.json')

    def test_staged_user_adoption_preserves_source_and_rejects_different_score(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);source=root/'candidate.json';source.write_bytes(b'frozen assessment')
            candidate={'score_adopted':False,'contract':{'structural_score':None,'proposed_structural_score':4.0}}
            receipt={'schema_version':'gho-axis5-staged-adoption/1','asset_slug':'gho','authorized_by':'user',
                     'scope':'staged_dashboard_only','publication_authorized':False,'adopted_at':'2026-10-30T10:00:00Z',
                     'candidate_sha256':builder.sha(source.read_bytes()),'structural_score':4.0,'structural_score_basis':'Adopted rationale'}
            path=root/'adoption.json';path.write_text(json.dumps(receipt))
            adopted,_=consumer.adopt_axis5_in_staged_preview(candidate,source,path)
            self.assertEqual(adopted['contract']['structural_score'],4.0)
            self.assertTrue(adopted['score_adopted'])
            self.assertIsNone(candidate['contract']['structural_score'])
            self.assertEqual(source.read_bytes(),b'frozen assessment')
            receipt['structural_score']=6.0;path.write_text(json.dumps(receipt))
            with self.assertRaisesRegex(ValueError,'authorized assessment'):
                consumer.adopt_axis5_in_staged_preview(candidate,source,path)
            receipt['structural_score']=4.0;receipt['scope']='published';path.write_text(json.dumps(receipt))
            with self.assertRaisesRegex(ValueError,'authorized assessment'):
                consumer.adopt_axis5_in_staged_preview(candidate,source,path)

    def test_candidate_can_show_proposal_but_never_adopt_a_score(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'accepted-authority').mkdir()
            (root/'accepted-authority/manifest.json').write_bytes(b'{}')
            (root/'authority-acceptance-receipt.json').write_bytes(b'{}')
            candidate={'schema_version':'gho-axis5-assessment/1','asset_slug':'gho','producer':'Codex staged assessment for riskAnalyst',
                'authority_accepted':True,'score_adopted':False,'authority_manifest_sha256':builder.sha(b'{}'),
                'acceptance_receipt_sha256':builder.sha(b'{}'),'contract':{'structural_score':None,'proposed_structural_score':4.0}}
            def prepare():
                (root/'gho_axis5_assessment.json').write_text(json.dumps(candidate))
                files={str(p.relative_to(root)):{'sha256':builder.sha(p.read_bytes()),'bytes':p.stat().st_size}
                       for p in root.rglob('*') if p.is_file() and p != root/'manifest.json'}
                (root/'manifest.json').write_text(json.dumps({'schema_version':'gho-axis5-candidate-manifest/1','score_adopted':False,'files':files}))
            prepare();selected,_=consumer.select_axis5_candidate(root)
            self.assertEqual(selected['contract']['proposed_structural_score'],4.0)
            candidate['contract']['structural_score']=6.0;prepare()
            with self.assertRaisesRegex(ValueError,'adopted structural score'):consumer.select_axis5_candidate(root)


if __name__=='__main__':unittest.main()
