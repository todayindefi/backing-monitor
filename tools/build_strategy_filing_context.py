"""Public allowlist of RiskAnalyst's dated Strategy judgment and dependency scope."""
import datetime,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=pathlib.Path('/home/danger/riskAnalyst/data/reviews/strategy-8k-2026-11-02/results.json')
def build():
 r=json.loads(SOURCE.read_text())
 return {'status':'available','source_owner':'riskAnalyst','accession':r['accession'],'filing_date':r['filing_date'],'balances_as_of':r['balances_as_of'],'interpretation':r['score_decision'],'downstream_scope':r['downstream_scope'],'scores_and_full_dates_unchanged':True,'generated_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
if __name__=='__main__':
 try:d=build()
 except (OSError,KeyError,ValueError):d={'status':'unavailable','reason':'Owner interpretation unavailable; no inferred judgment'}
 p=ROOT/'data/strategy_filing_context.json';tmp=p.with_suffix('.tmp');tmp.write_text(json.dumps(d,indent=2)+'\n');tmp.replace(p)
