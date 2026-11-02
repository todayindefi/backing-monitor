"""Export a public, dated qualitative view of owner-reviewed Saturn evidence.

No RPC, quotes, holdings or new scheduled producer. Private quantitative evidence
is validated then omitted. This adapter is separate from live liquidity payloads.
"""
import json, pathlib, hashlib, yaml
ROOT = pathlib.Path(__file__).resolve().parents[1]
RA = pathlib.Path('/home/danger/riskAnalyst/data/reviews/six-portfolio-risk-refresh-2026-11-02/srusdat-secondary-cash-acceptance.json')
DFA = pathlib.Path('/home/danger/DeFiAnalyst/data/projects/saturn.yaml')
FA = pathlib.Path('/home/danger/farmAnalyst/.private-reviews/nonloop-exits-2026-11-02')
def build():
    accepted=json.loads(RA.read_text());canonical=DFA.read_text();profile=yaml.safe_load(canonical)
    assert 'USDat → PYUSDx → PYUSD' in canonical and 'MoonPay' in canonical
    quotes=accepted['quotes'];assert {q['chain'] for q in quotes}=={'eth','monad'}
    assert all(int(q['usdc_output_raw'])>0 and int(q['usdat_input_raw'])>0 for q in quotes)
    source=json.loads((FA/'strategy-implementation-source.json').read_text())['source_code']
    assert 'unstakeCooldown.transfer' in source and 'if (token == address(USDat))' in source
    return {'schema_version':'saturn-exit-review/1','publisher':'BM owner-review adapter','source_owners':['RiskAnalyst','DeFiAnalyst','FarmAnalyst'],
      'kind':'dated_review_not_live_route_or_eligibility_monitor','review_date':accepted['accepted_at'].split('T')[0],'accepted_at':accepted['accepted_at'],
      'issuer':{'checked':profile['profile_checked'],'pyusdx':'PYUSDx is issued by MoonPay Digital Assets Limited using M0 infrastructure.','underlying':'Underlying PYUSD is issued by Paxos. These are separate issuer and intermediary dependencies.',
       'source_url':'https://www.m0.org/press-releases/pyusdx-stablecoin-platform-crosses-100-million-in-scale','source_date':'2026-09-09'},
      'secondary_sales':{'status':'positive_dated_size_specific_quotes','observations':[{'chain':q['chain'],'block':q['block'],'source_timestamp':q['source_timestamp'],'evidence_class':'positive get_dy quote at reviewed route size; not an owner execution'} for q in quotes],
       'reading':'USDat secondary-sale liquidity was supported at the tested route size on both Ethereum and Monad. The unresolved upstream steps are srUSDat conversion or transport and withdrawal settlement; these tests did not demonstrate USDat illiquidity.',
       'limits':'Dated size-specific observations, not current capacity, delivery or a complete cash exit. Fresh quotes and authorization are required. Primary issuer redemption is a separate alternative, not a prerequisite for these secondary sales.'},
      'exit_stages':[
       {'name':'srUSDat conversion / transport','status':'unestablished_end_to_end','reading':'A supported local Monad srUSDat-to-USDat conversion remains unestablished. Strata LayerZero share transport and Saturn CCIP token migration are separate dependencies; bridge delivery is not established by a quote.'},
       {'name':'Tranche cooldown','status':'separate_configuration','reading':'A zero tranche cooldown does not mean immediate USDat delivery. A share preview or enabled tranche action is not settlement.'},
       {'name':'Underlying Saturn withdrawal queue','status':'source_supported_async_path','reading':'The reviewed strategy routes USDat withdrawal through unstakeCooldown and an asynchronous Saturn queue. Current queue eligibility and completion timing are unknown. A direct sUSDat-share output is a distinct path with its own configuration.','eligibility':'unknown','timing':'unknown'},
       {'name':'Final USDat secondary sale','status':'positive_dated_quotes_only','reading':'Ethereum and Monad USDat-to-USDC quotes support the tested sale leg. They do not establish upstream token delivery, holder funding/permissions or the final swap executing.'}],
      'valuation':{'reading':'Liquidation health factors use the protocol oracle, including its exchange-rate or NAV valuation and thresholds. NAV or exchange-rate impairment can reduce health even when a secondary quote is near par. A market discount can increase unwind cost without an immediate oracle/HF change; oracle updates can later transmit it. Both risks need separate evidence.',
        'scope':'Tranche coverage is not a lending health factor. Neither oracle/NAV coverage nor HF guarantees executable sale proceeds, queue completion or cash settlement.'},
      'coverage_gaps':['No continuous holder-route or queue eligibility/timing feed.','No demonstrated complete conversion/bridge/withdrawal/swap path.','No migration completion inferred from an announced date.']}
if __name__=='__main__':
    out=build();target=ROOT/'data/saturn_exit_review.json';target.write_text(json.dumps(out,indent=2)+'\n')
    private=ROOT/'.private-reviews/saturn-exit-display-2026-11-02';private.mkdir(exist_ok=True)
    files=[RA,DFA,FA/'strategy-implementation-source.json',FA/'RETURN.md',FA/'SALE-COMPARISON.md']
    (private/'source-receipt.json').write_text(json.dumps({'sources':[{ 'path':str(f),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in files],'public_output_sha256':hashlib.sha256(target.read_bytes()).hexdigest()},indent=2)+'\n')
    print('Public dated review exported; native amounts, account identities and private simulations omitted')
