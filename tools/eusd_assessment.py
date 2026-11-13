"""Read-only exact eUSD assessment identity mapping; no grade adoption or writes."""
import hashlib,json,re
from pathlib import Path
from shared_asset_evidence import canonical,validate
MAPPING_VERSION='reserve-eusd-assessment-identity/1'
TOKEN='0xa0d69e286b938e21cbf7e51d71f6a4c8918f482f'

def select_eusd_assessment(evidence_path,evidence_version,assessment_path,assessment_sha256):
    """Verify immutable bytes first, then allow only this exact slug/component pair."""
    if not re.fullmatch(r'sha256:[a-f0-9]{64}',evidence_version):raise ValueError('Invalid evidence version')
    if not re.fullmatch(r'[a-f0-9]{64}',assessment_sha256):raise ValueError('Invalid assessment source hash')
    eb=Path(evidence_path).read_bytes();ab=Path(assessment_path).read_bytes()
    if 'sha256:'+hashlib.sha256(eb).hexdigest()!=evidence_version:raise ValueError('Evidence hash mismatch')
    if hashlib.sha256(ab).hexdigest()!=assessment_sha256:raise ValueError('Assessment hash mismatch')
    e=json.loads(eb);a=json.loads(ab);validate(e);i=e['identity']
    if (i.get('project'),i.get('component'),i.get('chain'),type(i.get('chain_id')),i.get('chain_id'),str(i.get('token','')).lower())!=('reserve-protocol','reserve-eusd','ethereum',int,1,TOKEN):raise ValueError('Wrong canonical eUSD project/component/chain/token')
    if (a.get('schema_version'),a.get('owner'),a.get('asset'),a.get('chain'),str(a.get('token','')).lower())!=('shared-asset-assessment/1','RiskAnalyst','eusd','ethereum',TOKEN):raise ValueError('Wrong exact authored eUSD identity')
    if 'chain_id'in a and (type(a['chain_id'])is not int or a['chain_id']!=1):raise ValueError('Wrong authored chain ID')
    if 'project'in a and a['project']!='reserve-protocol':raise ValueError('Wrong authored project')
    if 'component'in a and a['component']!='reserve-eusd':raise ValueError('Wrong authored component')
    if a.get('evidence_version')!=evidence_version:raise ValueError('Assessment evidence binding mismatch')
    if not a.get('assessment_version'):raise ValueError('Missing authored assessment version')
    receipt={'schema_version':'eusd-assessment-compatibility/1','mapping_version':MAPPING_VERSION,'identity':{'project':'reserve-protocol','component':'reserve-eusd','asset_slug':'eusd','chain':'ethereum','chain_id':1,'token':TOKEN},'evidence_version':evidence_version,'assessment_version':a['assessment_version'],'assessment_source_sha256':assessment_sha256,'assessment_canonical_content_id':'sha256:'+hashlib.sha256(canonical(a)).hexdigest(),'binding_status':'proposed_pending_normal_adoption','status':'candidate_compatible_pending_adoption','authored_bytes_modified':False,'scores_applied':False,'publication_performed':False}
    return e,a,receipt
