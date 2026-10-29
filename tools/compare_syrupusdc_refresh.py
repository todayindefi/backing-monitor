#!/usr/bin/env python3
"""Replay source/definition changes from the immutable before/after served files."""
import argparse, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def calculate(root):
 def load(phase,name):return json.loads((root/phase/('data__'+name+'.json')).read_text())
 selected=json.loads((root/'producer-selection/sources.json').read_text());served=json.loads((root/'after/sources.json').read_text())
 for name,meta in selected.items():assert meta['sha256']==served['data/'+name]['sha256'],name
 old=load('before','syrupusdc_backing')['asset_specific']['loan_book'];new=load('after','syrupusdc_backing')['asset_specific']['loan_book'];by={l['loan_addr'].lower():l for l in old['loans']};changes=[]
 for row in new['loans']:
  previous=by[row['loan_addr'].lower()]
  for key in ['principal','rate_pct','status','borrower','is_impaired','is_called','is_in_default']:assert row[key]==previous[key],(row['loan_addr'],key)
  if row.get('position_type')!=previous.get('position_type'):changes.append(dict(address=row['loan_addr'],principal=row['principal'],before=previous.get('position_type'),after=row.get('position_type'),economic_classification=row.get('economic_classification')))
 h0={e['timestamp']:e for e in load('before','syrupusdc_backing_history')['entries']};h1={e['timestamp']:e for e in load('after','syrupusdc_backing_history')['entries']};nullonly=[];changed=[]
 for timestamp in sorted(h0.keys()&h1.keys()):
  if h0[timestamp]!=h1[timestamp]:
   a=h0[timestamp].copy();b=h1[timestamp].copy()
   if a.get('classification_version') is None:a.pop('classification_version',None)
   if b.get('classification_version') is None:b.pop('classification_version',None)
   (nullonly if a==b else changed).append(timestamp)
 assert not changed,changed
 newrows=[dict(timestamp=t,classification_version=h1[t].get('classification_version')) for t in sorted(h1.keys()-h0.keys())]
 assert all(r['classification_version']==new['classification_version'] for r in newrows)
 axis=load('after','syrupusdc_axis_basis');measured=load('after','syrupusdc_backing')
 return dict(served_matches_selected_producer_files=True,source_definition_before=old.get('classification_version','unversioned heuristic'),source_definition_after=new['classification_version'],membership_changes=changes,raw_principal_rates_status_borrowers_preserved=True,overlapping_history_rows=len(h0.keys()&h1.keys()),financially_changed_overlap_rows=changed,null_classification_metadata_only_rows=len(nullonly),new_history_rows=newrows,expired_history_rows=len(h0.keys()-h1.keys()),authored_envelope_source_snapshot=axis.get('source_snapshot_as_of'),measured_source_snapshot=measured['timestamp'],authored_envelope_requires_assessment_refresh=axis.get('source_snapshot_as_of')!=measured['timestamp'],all_authored_scores_held=[8.5,6.5,7.0,5.5,4.5,5.5],overall_held=6.5,consumer_gap='Legacy liquidity sleeve grouping still infers parked cash from asset/meta; exact reviewed non-credit Treasury/LP categories must not be interpreted as immediate reserve cash.')
def main():
 p=argparse.ArgumentParser();p.add_argument('--review-dir',type=Path,default=ROOT/'specs/reviews/syrupusdc-source-refresh-2026-10-29');p.add_argument('--write',action='store_true');a=p.parse_args();out=json.dumps(calculate(a.review_dir),indent=2)+'\n';dest=a.review_dir/'source-definition-changes.json'
 if a.write:dest.write_text(out)
 else:assert dest.read_text()==out
 print('PASS served/selected hashes, raw accounting preservation, exact membership delta, unchanged overlapping financial history and prospectively versioned new rows')
if __name__=='__main__':main()
