"""Copy authored USDai overlays, omitting private profile bookkeeping only."""
import json,pathlib,sys
PRIVATE_KEYS={'profile_sha256'}
def public_overlay(value):
 if isinstance(value,dict):return {k:public_overlay(v) for k,v in value.items() if k not in PRIVATE_KEYS}
 if isinstance(value,list):return [public_overlay(v) for v in value]
 return value
if __name__=='__main__':
 src,dest=map(pathlib.Path,sys.argv[1:]);data=json.loads(src.read_text())
 assert data.get('asset') in ['usdai','susdai'] and data.get('schema_version') in ['issuer/1','axis-basis/1']
 tmp=dest.with_suffix('.tmp');tmp.write_text(json.dumps(public_overlay(data),indent=2)+'\n');tmp.replace(dest)
