"""Read-only adapter for hash-pinned, public, accepted six-axis reports.

No research or scoring: reproduce the report's exact Ethereum grades and prose.
Never fall back to an earlier report on missing/mismatched source.
"""
import hashlib
import json
import re
from pathlib import Path
import yaml

SCORE_KEYS=('volatility','backing','liquidity','underlying','structural','issuer','overall')

def pinned(record):
    raw=Path(record['path']).read_bytes()
    if hashlib.sha256(raw).hexdigest()!=record['sha256']:
        raise ValueError('Accepted source hash mismatch: '+str(record['path']))
    return raw

def public_editorial(policy):
    if policy.get('chain_id')!='eip155:1':
        raise ValueError('Preview policy is not exact Ethereum scope')
    raw=pinned(policy['accepted_report']).decode()
    parts=raw.split('---',2)
    if len(parts)!=3:raise ValueError('Missing report frontmatter')
    front=yaml.safe_load(parts[1]);body=parts[2]
    slug=policy['asset_slug'];version=policy['assessment_version'];evidence=policy['evidence_version']
    if front.get('slug')!=slug or front.get('assessment_version')!=version or front.get('evidence_version')!=evidence:
        raise ValueError('Accepted report asset/version mismatch')
    if front.get('score_status')!='assessed':raise ValueError('Report is not assessed')
    if 'ethereum' not in front.get('chains',[]) and front.get('scope',{}).get('chain_id')!='eip155:1':
        raise ValueError('No exact Ethereum assessment scope')
    acceptance=json.loads(pinned(policy['accepted_handoff']))
    report_id=policy['accepted_artifact_id']
    matches=[a for a in acceptance['artifacts'] if a['id']==report_id]
    if len(matches)!=1 or matches[0]['sha256']!=policy['accepted_report']['sha256']:
        raise ValueError('Accepted handoff does not pin selected report')
    identity=matches[0]['scope']
    if identity.get('chain_id')!='eip155:1' or policy['address'].lower() not in [x.lower() for x in identity.get('identifiers',[])]:
        raise ValueError('Accepted handoff exact deployment mismatch')
    scores={k:front.get(k+'_score',front.get('scores',{}).get(k+'_score')) for k in SCORE_KEYS}
    if any(not isinstance(v,(int,float)) or not 0<=v<=10 for v in scores.values()):
        raise ValueError('Incomplete six-axis plus overall grades')
    expected=policy.get('expected_scores')
    if expected and scores!=expected:raise ValueError('Unexpected authored-grade change; review and repin')
    sections={}
    for match in re.finditer(r'^## (\d+)\. ([^\n]+)\n([\s\S]*?)(?=^## |\Z)',body,re.M):
        sections[int(match[1])]=match[3].strip()
    if len(sections)<6:raise ValueError('Six report sections not present')
    def text(i):return re.sub(r'^\*\*[0-9.]+\.?\*\*\s*','',sections[i]).strip()
    date=str(front.get('score_assessed',front.get('last_verified')))
    common={'producer':'riskAnalyst','asset':slug,'as_of':date,'assessment_version':version,'evidence_version':evidence,'assessment_reviewed':date}
    def score(k,i):return {k+'_score':scores[k],k+'_score_source':'riskAnalyst:authored',k+'_score_status':'assessed',k+'_score_generated_at':date,k+'_score_basis':text(i)}
    docs={
      'axis_basis':dict(common,schema_version='axis-basis/1',selected_evidence_version=evidence,
        peg=score('volatility',1),liquidity=score('liquidity',3),overall=score('overall',1)),
      'backing_overlay':dict(common,schema_version='backing-overlay/1',backing={**score('backing',2),'backing_score_display':'authored','collateral_ratio_basis':'No independent dollar collateral ratio established for this share/claim. Wrapper accounting and economic recoverability have separate perimeters.'}),
      'dependencies':dict(common,schema_version='dependencies/1',dependencies={**score('underlying',4),'upstream':[],'coverage_note':'Exact Ethereum dependency scope. Terminal recovery weights and complete downstream usage are not independently quantified. Full accepted reasoning is preserved in the scoring disclosure.','downstream_note':'Downstream usage is not enumerated in this scoped dashboard; absence is not zero.'}),
      'contract_overlay':dict(common,schema_version='contract-overlay/1',contract={**score('structural',5),'coverage_note':text(5),'method':'RiskAnalyst accepted source/control interpretation; original native clocks remain in the assessment text.','unmeasured':['Complete authority/role-history and full audit-to-deployed-build correspondence are not established by this consumer adapter.']}),
      'issuer':dict(common,schema_version='issuer/1',issuer={**score('issuer',6),'summary':text(6),'entity':front.get('issuer') or ('f(x) Protocol contributors; separate repayment obligor unestablished' if slug=='fxsave' else 'Ether.Fi SEZC (service operator); separate token repayment guarantor unestablished'),'report_url':policy['report_url'],'report_url_status':'published'}),
      'assessment':{'schema_version':'asset-assessment/1','asset':slug,'chain':'ethereum','address':policy['address'],'assessment_version':version,'evidence_version':evidence,'assessment_reviewed':date,'last_verified':str(front.get('last_verified',date)),'scores':scores,'status':'assessed','source_clocks':'Financial, exit, authority and documentary clocks remain in their own fields and report sections; score date does not refresh measurements.'},
      'evidence_review':{'schema_version':'evidence-review/1','asset':slug,'status':'accepted_public_report_adapter','assessment_version':version,'evidence_version':evidence,'source_sha256':policy['accepted_report']['sha256'],'source_scope':identity},
    }
    # Keep the full report reasoning in specifically-labelled disclosures, while
    # the dependency list remains a compact causal map. These are report nouns,
    # not new quantified exposure/grade claims.
    names=(['fxSP stability-pool claim','fxUSD collateral and peg mechanics','USDC issuer / transfer controls','Custody / gauge / strategy and payout swaps'] if slug=='fxsave' else ['eETH staking-pool accounting claim','Ethereum validator staking / slashing','Withdrawal request / validator-exit queue','ether.fi pool, oracle and operational controls'])
    docs['dependencies']['dependencies']['upstream']=[{'name':n,'metric':'Exact Ethereum dependency; weight not independently quantified','source':policy['report_url'],'unresolved':['Complete independently verified recovery and concentration mapping']}for n in names]
    docs['axis_basis']['overall']['overall_score_basis']='Exact Ethereum six-axis authored overall; higher means safer. No grade inherited by other deployments.'
    return docs
