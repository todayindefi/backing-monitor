import requests,json
from pathlib import Path
from datetime import datetime,timezone
wallet='0xe7F0FdD40472775A659C3e42bda605A88642657b';token='0x6c3ea9036406852006290770BEdFcAbA0e23A0e8'
results=[]
for url in ['https://ethereum.publicnode.com','https://eth.llamarpc.com','https://1rpc.io/eth']:
 row={'rpc':url,'observed_at':datetime.now(timezone.utc).isoformat()}
 try:
  block=requests.post(url,json={'jsonrpc':'2.0','id':1,'method':'eth_blockNumber','params':[]},timeout=15).json()['result']
  d=requests.post(url,json={'jsonrpc':'2.0','id':2,'method':'eth_call','params':[{'to':token,'data':'0x70a08231'+wallet[2:].lower().zfill(64)},block]},timeout=15).json()
  row.update(block_number=int(block,16),response=d,balance_pyusd=int(d['result'],16)/1e6)
 except Exception as e:row['error_type']=type(e).__name__
 results.append(row);print(row,flush=True)
Path(__file__).with_name('pyusd-rpc-check.json').write_text(json.dumps(results,indent=2)+'\n')
