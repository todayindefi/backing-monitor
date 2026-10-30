#!/usr/bin/env python3
"""Collect staged GHO axes 4–6 evidence, never masquerading as owner approval."""
import argparse
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import requests
from web3 import Web3

PIN = '8259b4e02597dedcea2da13ebf80eaacf86f938e'
BASE = f'https://raw.githubusercontent.com/aave-dao/aave-address-book/{PIN}/src/'
DOCS = 'https://aave.com/docs/ecosystem/gho'
GOV = 'https://www.aave.com/docs/ecosystem/governance'
SECURITY = 'https://aave.com/security'
ROOT = Path(__file__).resolve().parents[1]


def now():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows = []; self.href = None; self.text = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.href = dict(attrs).get('href'); self.text = []
    def handle_data(self, data):
        if self.href:
            self.text.append(data)
    def handle_endtag(self, tag):
        if tag == 'a' and self.href:
            self.rows.append((' '.join(' '.join(self.text).split()), self.href)); self.href = None


class Reader:
    def __init__(self, url, chain):
        self.url = url; self.rows = []; self.codec = Web3().codec
        if int(self.rpc('eth_chainId', []), 16) != chain:
            raise ValueError('Wrong chain')
        self.head = self.rpc('eth_getBlockByNumber', ['latest', False]); self.tag = self.head['number']
        self.as_of = datetime.fromtimestamp(int(self.head['timestamp'], 16), timezone.utc).isoformat()
    def rpc(self, method, params):
        response = requests.post(self.url, json={'jsonrpc':'2.0','id':1,'method':method,'params':params}, timeout=20)
        response.raise_for_status(); payload = response.json()
        self.rows.append({'method':method,'params':params,'response':payload,'retrieved_at':now()})
        if 'error' in payload or 'result' not in payload:
            raise ValueError('RPC call failed')
        return payload['result']
    def call(self, address, sig, types=(), values=(), outputs=('uint256',)):
        try:
            data = Web3.keccak(text=sig)[:4] + self.codec.encode(types, values)
            raw = self.rpc('eth_call', [{'to':Web3.to_checksum_address(address),'data':'0x'+data.hex()},self.tag])
            value = self.codec.decode(outputs, bytes.fromhex(raw.removeprefix('0x')))
            def clean(x):
                if isinstance(x, bytes): return '0x'+x.hex()
                if isinstance(x, (list, tuple)): return [clean(v) for v in x]
                return x
            return {'status':'ok','value':clean(value[0] if len(value)==1 else value)}
        except Exception as exc:
            return {'status':'unmeasured','error_type':type(exc).__name__}
    def pin(self):
        assert self.rpc('eth_getBlockByNumber', [self.tag,False])['hash'] == self.head['hash'], 'Reorg'


def address(text, name):
    match = re.search(r'\b'+re.escape(name)+r'\s*=\s*(?:\w+\()?\s*(0x[a-fA-F0-9]{40})', text)
    if not match: raise ValueError('Missing official address '+name)
    return Web3.to_checksum_address(match[1])


def role_checks(reader, target, candidates, role_name='DEFAULT_ADMIN_ROLE'):
    role = reader.call(target, role_name+'()', outputs=('bytes32',))
    if role['status'] != 'ok':
        return {'role':role,'holders':{}}
    raw = bytes.fromhex(role['value'][2:])
    return {'role':role, 'enumeration':reader.call(target,'getRoleMemberCount(bytes32)',('bytes32',),(raw,)),
            'holders':{name:reader.call(target,'hasRole(bytes32,address)',('bytes32','address'),(raw,actor),('bool',))
                       for name,actor in candidates.items()}}


def validate_controls(targets, monad):
    for name, target in targets.items():
        checks = [target['DEFAULT_ADMIN_ROLE']]
        if name == 'GHO token':
            checks.extend(target[role] for role in ['FACILITATOR_MANAGER_ROLE', 'BUCKET_MANAGER_ROLE'])
        for check in checks:
            for candidate, expected in [('DAO executor L1', True), ('deployer negative control', False), ('token negative control', False)]:
                if check['holders'].get(candidate) != {'status': 'ok', 'value': expected}:
                    raise ValueError('Authority control changed or failed; do not emit the confirmation headline')
    if (monad['threshold'] != {'status':'ok','value':2} or monad['owners'].get('status') != 'ok'
            or len(monad['owners'].get('value', [])) != 3):
        raise ValueError('Council shape changed; update evidence wording before selection')


def build_dependencies(backing, composition):
    b = backing['asset_specific']['gho_backing']; stamp = b['as_of']
    source = b['gsm_reserve']['source_url']
    def dep(name, metric, note, url=DOCS, observed=stamp):
        return {'name':name,'metric':metric,'note':note,'source':f'{url} · observed {observed}', 'as_of': observed,
                'link':url,'link_type':'external'}
    supply=b['issuance']['total_supply_gho']
    lending=sum(row['level_gho'] for row in b['issuance']['facilitators'] if 'Minter' in row['label'])
    largest=max(b['issuance']['facilitators'], key=lambda r:r['level_gho'])
    rows=[dep('Aave lending markets', f'{lending:,.0f} GHO origin issuance',
              'Core, Lido and Horizon lending claims depend on pool accounting and collateral liquidation; issuance is not independently realizable backing.',source),
          dep('Facilitator allocation concentration',f'{100*largest["level_gho"]/supply:.2f}% of origin issuance',
              f'Largest facilitator allocation / {supply:,.0f} Ethereum supply. This is issuance concentration, not collateral concentration.',source)]
    for module in b['gsm_reserve']['modules']:
        rows.append(dep(module['wrapper_symbol']+' → '+module['asset_symbol'],
                        f'{module["converted_asset_units"]:,.6f} {module["asset_symbol"]} conversion quote',
                        'Module-held ERC-4626 wrapper adds Aave pool and underlying stablecoin issuer risk. Conversion quote is not executed withdrawal or a share of whole-GHO backing.',source))
    remote=b['reconciliation']['remote_reserves']['rows']
    rows.append(dep('Chainlink CCIP and remote-chain reserves', f'{sum(r["origin_allocation_gho"] for r in remote):,.0f} GHO origin allocation',
                    'Arbitrum, Monad and Plasma reserves have separate chain clocks. Original bridge funding receipts are not replayed. This is not additional supply.',
                    'https://governance.aave.com/t/remotegsm-upgrade-enabling-l2-gsms-for-gho/24240',
                    observed=min(r['as_of'] for r in remote)))
    rows.append(dep('Collateral prices and liquidation execution','6 source collateral categories',
                    'TokenLogic pro-rata oracle collateral contains ETH/BTC correlated assets, stablecoins, AAVE, RWA and DeFi. No category is independent of its oracle, wrapper and liquidation path. Complete oracle-by-reserve mapping remains unmeasured.',
                    b['reconciliation']['analytics']['source'], observed=composition['entries'][-1]['source_date']))
    # Preserve the source-model denominator and date rather than inventing whole-GHO shares.
    return {'as_of':stamp,'upstream':rows,'downstream_tracked':False,
            'coverage_note':'Six measured/identified dependency paths; not an exhaustive inventory. Metrics have different scopes and must not be added. Downstream exposure is not surveyed. Current authored underlying_score awaits riskAnalyst review.',
            'source_collateral_as_of':composition['entries'][-1]['source_date'],
            'underlying_score':None}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,default=Path('/tmp/gho-axes-456'))
    parser.add_argument('--backing',type=Path,default=Path('/home/danger/PegTracker/data/dashboard_pending/gho-reconciliation-v2/gho_backing.json'))
    parser.add_argument('--coverage',type=Path,default=Path('/home/danger/PegTracker/data/dashboard_pending/gho-coverage-history/gho_reported_coverage_history.json'))
    args=parser.parse_args(); args.out.mkdir(parents=True,exist_ok=True)
    sources=[]
    def save(name, raw, url):
        path=args.out/'sources'/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
        sources.append({'file':str(path.relative_to(args.out)),'url':url,'sha256':sha(raw),'retrieved_at':now()})
        return raw.decode()
    def fetch(name,url):
        response=requests.get(url,timeout=25);response.raise_for_status();return save(name,response.content,url)
    books={name:fetch(name,BASE+name) for name in ['GhoEthereum.sol','GhoMonad.sol','GovernanceV3Ethereum.sol']}
    for name,url in [('gho.html',DOCS),('governance.html',GOV),('security.html',SECURITY)]:
        fetch(name,url)
    backing=json.loads(save('backing.json',args.backing.read_bytes(),'PegTracker staged canonical source'))
    coverage=json.loads(save('coverage.json',args.coverage.read_bytes(),'PegTracker source-qualified history'))
    report_path=Path('/home/danger/riskAnalyst/assets/gho.md')
    report=save('riskanalyst-gho.md',report_path.read_bytes(),'riskAnalyst/assets/gho.md')
    html=(args.out/'sources/security.html').read_text();links=Links();links.feed(html)
    audit_links=list(dict.fromkeys((label,url) for label,url in links.rows if 'GHO' in label and any(word in label for word in ['Audit','Review','Assessment'])))
    eth=Reader('https://ethereum-rpc.publicnode.com',1)
    token=address(books['GhoEthereum.sol'],'GHO_TOKEN');direct=address(books['GhoEthereum.sol'],'GHO_DIRECT_FACILITATOR_MAINNET_GSMS')
    executor=address(books['GovernanceV3Ethereum.sol'],'EXECUTOR_LVL_1')
    candidates={'DAO executor L1':executor,'deployer negative control':'0x3765a685a401622c060e5d700d9ad89413363a91','token negative control':token}
    targets={}
    for label,target in [('GHO token',token),('Mainnet direct facilitator',direct)]:
        targets[label]={'address':target,'DEFAULT_ADMIN_ROLE':role_checks(eth,target,candidates)}
        code=eth.rpc('eth_getCode',[target,eth.tag]);targets[label]['code_hash']=Web3.keccak(hexstr=code).hex()
        targets[label]['code_bytes']=(len(code)-2)//2
    for role in ['FACILITATOR_MANAGER_ROLE','BUCKET_MANAGER_ROLE']:
        targets['GHO token'][role]=role_checks(eth,token,candidates,role)
    mon=Reader('https://rpc.monad.xyz',143);book=books['GhoMonad.sol']
    council=address(books['GhoEthereum.sol'],'RISK_COUNCIL');reserve=address(book,'GHO_RESERVE');gsm=address(book,'GSM_USDC');steward=address(book,'GHO_GSM_STEWARD')
    monad={'council':council,'threshold':mon.call(council,'getThreshold()'),
           'owners':mon.call(council,'getOwners()',outputs=('address[]',)),
           'reserve_limit_manager':role_checks(mon,reserve,{'Risk Council':council},'LIMIT_MANAGER_ROLE'),
           'gsm_configurator':role_checks(mon,gsm,{'GSM Steward':steward},'CONFIGURATOR_ROLE'),
           'steward_cooldown_seconds':mon.call(steward,'MINIMUM_DELAY()'),
           'limit_gho':mon.call(reserve,'getLimit(address)',('address',),(gsm,))}
    eth.pin();mon.pin()
    evidence={'ethereum':{'block':eth.head,'as_of':eth.as_of,'targets':targets,'rpc':eth.rows},
              'monad':{'block':mon.head,'as_of':mon.as_of,'checks':monad,'rpc':mon.rows}}
    save('authority.json',(json.dumps(evidence,indent=2)+'\n').encode(),'Block-pinned read-only Ethereum and Monad RPC')
    validate_controls(targets, monad)
    layers=[]
    for label,target in targets.items():
        check=target['DEFAULT_ADMIN_ROLE']['holders'].get('DAO executor L1',{})
        active=check.get('status')=='ok' and check.get('value') is True
        layers.append({'authority_layer':'asset-permission','chain':'ethereum','observed_at':eth.as_of,
                       'target_name':label,'topology':'DAO' if active else 'unresolved','keys':['DEFAULT_ADMIN_ROLE'],
                       'timelock':'unresolved','timelock_floor':'unresolved','reach':'full' if active else 'unresolved',
                       'paths':[{'name':'DAO executor L1','holder':executor,'terminal_kind':'DAO',
                                 'control_state':'active' if active else 'unresolved','actionable':True if active else 'unresolved',
                                 'execution_delay':'unresolved','delay_floor':'unresolved','reach':'full' if active else 'unresolved',
                                 'reach_bound':None,'value_at_risk_scope':'core','changeability':'mutable',
                                 'independent_canceller':'unresolved','terminal_address':executor,'holder_kind':'contract',
                                 'hand_walk':'Targeted hasRole checks only; role grant/revoke history and the full execution path are not closed.'}]})
    for name,target,checks in [('Monad reserve limit manager',reserve,monad['reserve_limit_manager']),('Monad GSM configurator',gsm,monad['gsm_configurator'])]:
        holder,check=next(iter(checks['holders'].items()),('unresolved',{}));active=check.get('value') is True and check.get('status')=='ok'
        layers.append({'authority_layer':'asset-permission','chain':'monad','observed_at':mon.as_of,'target_name':name,
                       'topology':'multisig' if active else 'unresolved','keys':[name], 'timelock':'unresolved','timelock_floor':'unresolved',
                       'reach':'bounded' if active else 'unresolved',
                       'paths':[{'name':holder,'control_state':'active' if active else 'unresolved','actionable':True if active else 'unresolved',
                                 'execution_delay':'unresolved','delay_floor':'unresolved','reach':'bounded' if active else 'unresolved',
                                 'reach_bound':'Monad GSM / reserve parameter path; not an Ethereum core authority',
                                 'value_at_risk_scope':'bounded-pool','changeability':'mutable','terminal_kind':'multisig',
                                 'independent_canceller':'unresolved','terminal_address':council,'holder_kind':'contract',
                                 'reaction_window':{'type':'unresolved','basis':'Steward MINIMUM_DELAY is an update cooldown; not proof of an execution timelock.'}}]})
    code_facts=[f'Official Aave security catalogue lists {len(audit_links)} GHO audit/review links. Catalogue presence does not establish coverage of the current deployed RemoteGSM or wrapper bytecode. Source: {SECURITY}',
                'Aave publishes an Immunefi core bounty up to $5m. Exact current GHO/RemoteGSM scope, exclusions and effective coverage are not established here.',
                'Code deployment age, current bytecode-to-audit mapping, unresolved findings, incident completeness and remediation paths still require the code-risk owner review. No absence-of-incident claim is made.']
    for label,url in audit_links[:3]:code_facts.append(label+' — '+url)
    unresolved=['Role holder sets are not closed by targeted hasRole checks; reconstruct grants and revocations before claiming exclusivity.',
                'Complete core mint/burn/facilitator grant paths, executor timing, guardian cancellation and enforceable delay floors remain unresolved.',
                'Only Ethereum token/direct-facilitator and selected Monad parameter paths were probed. Arbitrum, Plasma, bridges and other GSM authority paths are not walked.',
                'Current code-risk judgment and combined structural_score are not supplied by this observation package.']
    contract={'as_of':eth.as_of,'observed_at':eth.as_of,'method':'block-pinned read-only RPC candidate',
              'headline':'Ethereum DAO admin roles confirmed; Monad Council 2-of-3 confirmed; execution delays unresolved',
              'authority_note':'Ethereum executor holds token DEFAULT_ADMIN, FACILITATOR_MANAGER and BUCKET_MANAGER roles. Deployer and token negative controls return false. On Monad, Council is 2-of-3 and holds reserve LIMIT_MANAGER; GSM Steward holds CONFIGURATOR and reports an 86,400-second update cooldown. A cooldown is not an execution timelock.',
              'coverage_summary':'Partial Ethereum + Monad observations; current combined assessment unrated.',
              'coverage_note':'Candidate observations collected by backing-monitor; not an approved security_analyst topology. Full authority walk and riskAnalyst code assessment remain outstanding.',
              'layers':layers,'code_facts':code_facts,'unmeasured':unresolved,'unresolved':unresolved,'structural_score':None}
    # Preserve producer-authored issuer text verbatim and keep its OLD assessment date.
    match=re.search(r'^\| Issuer \| 6\.5 \|[^|]*\| (.*?) \|$',report,re.M)
    if not match:raise ValueError('Could not identify authored issuer rationale')
    issuer={'as_of':now(),'entity':'Aave DAO','badge':'Aave DAO','issuer_score':None,
            'issuer_score_status':'not_assessed',
            'summary':"GHO is governed by Aave DAO. Current Ethereum checks confirm the DAO executor holds token administration and facilitator/bucket-management roles. The documented governance process provides public proposals and voting, alongside delegated steward powers. These are shared governance dependencies rather than independent issuer diversification. This research pass does not establish a legal guarantor, regulatory status or a holder right to redeem at par; the issuer score remains unrated.",
            'summary_source':'Codex-authored research candidate for riskAnalyst, 2026-10-30. Sources: official Aave GHO/governance documentation and block-pinned role checks. Not an independent owner return or a refreshed published report.',
            'report_url':'https://tidresearch.com/reports/gho/','report_url_status':'published',
            'assessment_refresh_status':'research_candidate_unrated','historical_issuer_score':6.5,
            'historical_assessment':{'as_of':'2026-09-23T00:00:00Z','summary':match[1],
                                     'source':'riskAnalyst/assets/gho.md; verbatim historical rationale, not a current assessment'},
            'facts':['Issuer identity: Aave DAO. Official GHO documentation: '+DOCS,
                     'Aave documents delegated steward limits and update cooldowns. Documented policy is not a measurement of every live authority path: '+GOV,
                     'Historical issuer score 6.5/10 is retained as provenance only; it is not promoted to a current score.']}
    result={'schema_version':'gho-remaining-axes/1','asset_slug':'gho','producer':'backing-monitor evidence candidate',
            'generated_at':now(),'staged_only':True,'owner_approved':False,
            'dependencies':build_dependencies(backing,coverage),'contract':contract,'issuer':issuer,
            'authority_checks':{'ethereum_targets':targets,'monad':monad},'audit_catalogue':audit_links}
    raw=(json.dumps(result,indent=2,allow_nan=False)+'\n').encode();(args.out/'gho_remaining_axes.json').write_bytes(raw)
    manifest={'schema_version':'gho-remaining-axes-manifest/1','staged_only':True,'owner_approved':False,
              'files':{'gho_remaining_axes.json':{'sha256':sha(raw),'bytes':len(raw)}},'sources':sources,
              'generator_sha256':sha(Path(__file__).read_bytes())}
    (args.out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'out':str(args.out),'dependencies':len(result['dependencies']['upstream']),'authority_layers':len(layers),
                      'audit_links':len(audit_links),'ethereum_block':int(eth.tag,16),'monad_block':int(mon.tag,16),'owner_approved':False}))


if __name__=='__main__':main()
