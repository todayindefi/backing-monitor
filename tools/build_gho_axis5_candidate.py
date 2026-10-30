#!/usr/bin/env python3
"""Bind accepted SA observations and a dated code assessment into a staged proposal."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import yaml

SA = Path('/home/danger/security_analyst/audits/gho-authority-2026-10-30')
RECEIPT = Path('/home/danger/riskAnalyst/data/reviews/gho-score-review-2026-10-30/sa-authority-receipt/receipt.json')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def verify_authority(directory, receipt_path):
    manifest = json.loads((directory/'manifest.json').read_text())
    if (manifest.get('schema_version') != 'security-authority-return/1' or manifest.get('asset') != 'gho'
            or manifest.get('producer') != 'security_analyst' or manifest.get('producer_approved') is not True
            or manifest.get('staged_only') is not True or manifest.get('numeric_score_authored') is not False):
        raise ValueError('Not the approved staged GHO authority return')
    for name, info in manifest['files'].items():
        path = (directory/name).resolve()
        if directory.resolve() not in path.parents:
            raise ValueError('Unsafe authority manifest path')
        raw = path.read_bytes()
        if sha(raw) != info['sha256'] or len(raw) != info['bytes']:
            raise ValueError('Authority evidence integrity mismatch: '+name)
    receipt = json.loads(receipt_path.read_text())
    if (receipt.get('producer') != 'riskanalyst' or receipt.get('authority_producer') != 'security_analyst'
            or Path(receipt['source_directory']).resolve() != directory.resolve()
            or receipt.get('manifest_files_verified') != len(manifest['files']) or receipt.get('manifest_mismatches') != []
            or receipt.get('structural_score') is not None or receipt.get('publication') is not False):
        raise ValueError('Authority acceptance receipt mismatch')
    topology = yaml.safe_load((directory/'topology/assets/gho.yaml').read_text())
    paths = [p for layer in topology['layers'] for p in layer.get('paths', [])]
    core = [p for p in paths if p.get('name') == 'Core issuance through direct GSM facilitator']
    if (len(core) != 1 or core[0].get('actionable') is not True or core[0].get('execution_delay') != 'none'
            or core[0].get('value_at_risk_scope') != 'core' or core[0].get('independent_canceller') is not False
            or core[0].get('n') != 2 or core[0].get('m') != 3):
        raise ValueError('Material core issuance path missing or changed')
    proof = json.loads((directory/'fork-proof.json').read_text())
    if (proof.get('initial_bucket') != [310000000 * 10**18, 310000000 * 10**18]
            or proof.get('expanded_bucket') != [620000000 * 10**18, 310000000 * 10**18]
            or proof.get('minted_to_reserve_wei') != 1 or proof.get('origin_chain_id') != 1):
        raise ValueError('Fork result differs from the bounded proposal evidence')
    return manifest, receipt, topology


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sa',type=Path,default=SA)
    parser.add_argument('--receipt',type=Path,default=RECEIPT)
    parser.add_argument('--research',type=Path,default=Path('/tmp/gho-axis5-assessment'))
    parser.add_argument('--out',type=Path,default=Path('/tmp/gho-axis5-candidate'))
    args=parser.parse_args();manifest,receipt,topology=verify_authority(args.sa,args.receipt)
    args.out.mkdir(parents=True,exist_ok=True)
    pin='2af44932a8a632fd74b44adb4c92a4b51700e25a'
    base=f'https://github.com/aave-dao/gho-origin/blob/{pin}/audits/'
    matrix=[
      {'component':'GHO token / original lending integration','report':'2022-08-12_Openzeppelin-v1.pdf',
       'scope':'Original token and Aave lending integration; 2022-11 v2 report is integration changes, not a new token-wide review.',
       'binding':'Current Ethereum token source/runtime is bound by SA; original audit commit equivalence is not established here.',
       'status':'Historical audit evidence, not current whole-system coverage'},
      {'component':'Upgradeable remote token','report':'2024-06-11_UpgradeableGHO_Certora.pdf',
       'scope':'UpgradeableGhoToken and UpgradeableERC20; upgradeability focus with existing token rules.',
       'binding':'Report revision a9647e1 was not resolved in the maintained repository during this pass; Monad/Plasma executable source closure remains an SA gap.',
       'status':'Partial; no blanket current remote-token clearance'},
      {'component':'Modular stewards','report':'2024-09-15_ModularGhoStewards_Certora.pdf',
       'scope':'Bucket, GSM, Aave and CCIP stewards plus RiskCouncilControlled; specified formal properties and manual review.',
       'binding':'Report revision 3684128 was not resolved in maintained repo; deployed BucketSteward differs from current/audited RemoteGSM tree. SA fork/controls establish authority consequences, not complete audit equivalence.',
       'status':'Four listed low/informational findings marked fixed; trusted-council assumptions do not constrain authorized minting'},
      {'component':'RemoteGSM / reserve / wrapper accounting','report':'2025-07-15_RemoteGSM_Certora.pdf',
       'scope':'Reserve, Gsm, Gsm4626, OwnableFacilitator and interfaces; manual review, July 7–15 2025. Archived PDF has a Draft watermark.',
       'binding':'Gsm4626 file is exactly equal to audit revision 6ea6b04; parent Gsm and current AccessControl reserve differ; current DirectFacilitator is not the audited OwnableFacilitator.',
       'status':'High/medium/low findings marked fixed; see separate implementation/operating-sequence qualifications'},
      {'component':'sGHO (excluded from parent GHO audit credit)','report':'2026.03.04 - Final - TokenLogic Collaborative Audit Report 1772584390.pdf',
       'scope':'Savings vault and sGhoSteward, final commit 646ab32b290b0dd34934c867a69b26579a9b3ef4.',
       'binding':'Downstream vault scope; not evidence that parent token minting or RemoteGSM ACL migrations were reviewed.',
       'status':'Excluded from GHO origin/admin coverage credit'}]
    for row in matrix:row['source']=base+row['report'].replace(' ','%20')
    findings=[
      'RemoteGSM H-01 deactivation: report marks fixed. Current source requires both used and limit to be zero before removal; use rejects zero amounts and enforces the remaining limit. This supports the stated removal invariant by static inspection; no independent stateful regression suite was run.',
      'RemoteGSM M-01 fee accrual: report calls the finding fixed through documentation/sequence guidance (7de25e9). Matched Gsm4626 has no rescueTokens override and inherited rescue does not first accrue yield. Do not describe this as an automatically patched accrual invariant. SA found no current TOKEN_RESCUER grants on the two Ethereum modules; authorized future grants remain possible.',
      '2023 GHO discount integration: official Aave postmortem describes a self-transfer balance double-count affecting borrow discounts, reports remediation via AIP 399 on December 12 2023 and no exploitation. This is integration history, not evidence that the current Council capability was exploited.',
      'October 7 2026 Aave Labs publication reports a valid low-severity GHO submission and requests a payout. Technical root cause, deployed component and patch status are not disclosed there; this review does not infer an unpatched vulnerability or a complete incident clearance.'
    ]
    code_facts=[
      'Deployed-code history: Ethereum GHO token deployment is July 15 2023. Current USDC/USDT GSM implementation deployments are October 28 2025; reserve implementation and mainnet DirectFacilitator date to January 24 2026. Deployment age is not proof of continuous unchanged proxy use; full implementation history is not reviewed.',
      'Audit coverage is component-specific: newer maintained gho-origin reports extend beyond the old seven-link catalogue. Gsm4626 file matches one audited revision; changed inheritance, AccessControl reserve and direct-facilitator code prevent a whole-deployment audit equivalence claim.',
      findings[0],findings[1],
      'Formal verification evidence covers specified steward and upgradeability properties under assumptions. No fresh prover run or complete current-system verification is claimed. Verified intended permissions do not establish that the governance trust model is safe.',
      'Current Immunefi AAVE terms list a $1m critical maximum (not the Aave marketing page’s up-to-$5m). Named active GHO subsystems include tokens, GSM/4626, stewards and remote facilitators; precise listed chain/version coverage limits apply. The terms exclude leaked-key/privileged-access and centralization risks: the authorized Council route is not insured or neutralized by this bounty.',
      findings[2],findings[3],
      'Remediation: fixed Ethereum token logic cannot be upgraded in place; administrable facilitator/bucket roles and upgradeable module/reserve/controller logic remain separate surfaces. DAO-delayed remediation cannot advance-veto an immediate Council transaction.',
      'Integration invariants reviewed by source/accepted controls: bucket level must not exceed capacity; reserve use/restore must respect per-entity accounting; wrapper conversion and accrued fees must remain consistent; bridge representations and their upgrades remain separately exposed. No end-to-end liquidation, bridge or adversarial wrapper test suite was executed.'
    ]
    basis=('Proposed 4.0/10, replacing no current score rather than mechanically restoring historical 6.0. '
           'The binding weakness is the accepted active 2-of-3 Council path into core issuance: at the eligible pinned state it can expand the full 310m facilitator capacity to 620m and then mint without a DAO queue. '
           'The additional 310m is next-update headroom, not a permanent lifetime ceiling; repeated eligible updates can increase capacity further. The one-day DAO floor and separate 5-of-9 guardian protect the queued DAO route, not this immediate Council path. '
           'Source-bound core contracts, published reviews and code-enforced per-update limits are real positives, so this is not treated as proof of active exploitation or unconstrained outsider minting. '
           'Nevertheless, intended privileged capability is a material compromise/misuse exposure. Partial audit-to-deployment coverage, operational fee-accrual remediation and remote bridge/token/role-history gaps limit code confidence. '
           'The halves are not averaged: audit history cannot offset the immediate core mint capability. This proposed score prices the combined Contract & Admin axis only; Dependencies 6.0 and Issuer 6.5 are unchanged. '
           'This is a staged Codex-authored proposal for riskAnalyst, not an accepted current numeric score or a finding of realized loss.')
    code_gaps=[
      'Current role-based reserve/direct-facilitator migration lacks complete audit-to-deployed-source equivalence in the reviewed report set; absence of a match is not absence of an audit.',
      'Inherited dependencies, full implementation history, current wrapper/pool/bridge versions and all external invariants are not exhaustively reviewed.',
      'Current low-severity submission technical details and full incident/remediation completeness are not publicly established by the reviewed sources.',
      'No independent fork rerun, formal prover execution, novel exploit audit or key-custody/organizational independence assessment is claimed.'
    ]
    gaps=topology['unmeasured']+code_gaps
    contract={'as_of':'2026-10-30T07:45:11+00:00','observed_at':'2026-10-30T07:45:11+00:00',
      'method':'SA producer-approved authority return + source-qualified code assessment candidate',
      'headline':'2-of-3 Council can expand the mainnet bucket and mint without a DAO queue',
      'headline_basis':receipt['material_interpretation'],
      'coverage_summary':'Next eligible increase adds 310m GHO capacity; repeated eligible increases can add more. Authorized capability, not evidence of exploitation. Code/score proposal remains staged.',
      'coverage_note':'SA observations and stated gaps are accepted by the riskAnalyst receipt. Code and combined-score research is authored in this session, not an independent riskAnalyst return. No all-chain safety claim.',
      'authority_note':'Council path: next eligible 310m → 620m capacity, then mint. Next-update headroom is 310m, not a lifetime ceiling. DAO one-day delay and guardian cancellation do not pre-veto this path. Authorized capability, not evidence of exploitation. Fork minted one wei to reserve; arbitrary-recipient reach is source-derived.',
      'layers':topology['layers'],'unresolved':gaps,'unmeasured':gaps,'code_facts':code_facts,
      'structural_score':None,'structural_score_status':'proposal_pending_riskAnalyst_adoption',
      'proposed_structural_score':4.0,'proposed_structural_score_basis':basis}
    result={'schema_version':'gho-axis5-assessment/1','asset_slug':'gho','producer':'Codex staged assessment for riskAnalyst',
      'authored_at':datetime.now(timezone.utc).isoformat(),'staged_only':True,'score_adopted':False,
      'authority_manifest_sha256':sha((args.sa/'manifest.json').read_bytes()),'authority_files_verified':len(manifest['files']),
      'acceptance_receipt_sha256':sha(args.receipt.read_bytes()),'authority_accepted':True,
      'contract':contract,'audit_matrix':matrix,'finding_assessment':findings,'cross_axis':'No changes to Dependencies or Issuer; no duplicated penalty for core mint authority.'}
    (args.out/'gho_axis5_assessment.json').write_text(json.dumps(result,indent=2)+'\n')
    shutil.copytree(args.research,args.out/'research',dirs_exist_ok=True)
    dest=args.out/'accepted-authority';dest.mkdir(exist_ok=True)
    for name in ['REPORT.md','HANDOFF.md','manifest.json','identities.json','fork-proof.json','fork-cancellation-proof.json','validation.json','topology/assets/gho.yaml']:
        out=dest/name;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(args.sa/name,out)
    shutil.copyfile(args.receipt,args.out/'authority-acceptance-receipt.json')
    files={str(p.relative_to(args.out)):{'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size} for p in args.out.rglob('*') if p.is_file() and p != args.out/'manifest.json'}
    (args.out/'manifest.json').write_text(json.dumps({'schema_version':'gho-axis5-candidate-manifest/1','staged_only':True,'score_adopted':False,'files':files},indent=2)+'\n')
    print(json.dumps({'out':str(args.out),'authority_files_verified':len(manifest['files']),'layers':len(topology['layers']),'paths':sum(len(l.get('paths',[])) for l in topology['layers']),'proposed_structural_score':4.0,'current_structural_score':None}))


if __name__=='__main__':main()
