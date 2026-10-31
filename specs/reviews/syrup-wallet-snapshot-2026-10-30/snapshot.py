import sys,os,json
from pathlib import Path
from datetime import datetime,timezone
from dotenv import load_dotenv
sys.path.insert(0,'/home/danger/FarmTracker')
from shared.http_utils import fetch_with_retry
load_dotenv('/home/danger/FarmTracker/.env')
key=os.getenv('DEBANK_API_KEY')
if not key: raise SystemExit('FarmTracker DeBank key unavailable')
out=Path(__file__).resolve().parent
wallets={'amm_operator':'0x2570fAF7C8A0da87d3F123B35cC722EC3fCC3e08','pyusd_custody':'0xe7F0FdD40472775A659C3e42bda605A88642657b','treasury_borrower':'0x1FcC47Ee0F19CA0f07F8b987F0aD32ac204C03a7'}
for label,address in wallets.items():
 result={'address':address,'scope':'DeBank supported chains; provider coverage is not exhaustive','source':'FarmTracker shared.http_utils / DeBank API','endpoints':{}}
 for kind,endpoint in [('protocols','all_complex_protocol_list'),('tokens','all_token_list'),('total','total_balance')]:
  url=f'https://pro-openapi.debank.com/v1/user/{endpoint}?id={address}'+('&is_all=true' if kind=='tokens' else '')
  r=fetch_with_retry(url,headers={'AccessKey':key,'Accept':'application/json'},timeout=30,retries=3,quiet=True)
  record={'observed_at':datetime.now(timezone.utc).isoformat(),'http_status':r.status_code if r is not None else None,'status':'unavailable'}
  if r is not None and r.status_code==200:
   try:
    data=r.json();record.update(status='ok',data=data)
   except ValueError:record['status']='invalid_json'
  result['endpoints'][kind]=record
 (out/(label+'.json')).write_text(json.dumps(result,indent=2)+'\n')
 print(label,{k:v['status'] for k,v in result['endpoints'].items()},flush=True)
