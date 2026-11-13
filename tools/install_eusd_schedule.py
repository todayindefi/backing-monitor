#!/usr/bin/env python3
"""Install exactly one authorized eUSD job; preserve unrelated user crontab bytes."""
import argparse,hashlib,json,shlex,subprocess
from datetime import datetime,timezone
from pathlib import Path
from refresh_eusd_product import validate_generation,atomic
TAG='# bm-eusd-canonical-v1'
ROOT=Path(__file__).resolve().parents[1]

def revised(before,command):
    lines=before.splitlines(keepends=True)
    own=[x for x in lines if TAG in x]
    if len(own)>1:raise ValueError('Multiple eUSD jobs require explicit reconciliation')
    if any('refresh_eusd_product.py'in x and TAG not in x and not x.lstrip().startswith('#')for x in lines):raise ValueError('Existing untagged eUSD collector; refuse duplicate schedule')
    kept=''.join(x for x in lines if TAG not in x)
    if kept and not kept.endswith('\n'):kept+='\n'
    return kept+'17 */2 * * * '+command+' '+TAG+'\n'

def main():
    p=argparse.ArgumentParser();p.add_argument('--state-dir',type=Path,required=True);p.add_argument('--install',action='store_true');p.add_argument('--enable-quotes',action='store_true');a=p.parse_args();state=a.state_dir.resolve();validate_generation(state/'public-data')
    script=ROOT/'tools/refresh_eusd_product.py';config=ROOT/'config/eusd_product.json'
    if a.enable_quotes and not json.loads(config.read_text()).get('quote_collection_authorized'):raise ValueError('Quote cutover not authorized')
    quote_flag='--collect-quotes'if a.enable_quotes else '--skip-live-quotes'
    command='/usr/bin/flock -n '+shlex.quote(str(state/'refresh.lock'))+' /usr/bin/timeout 1200 /usr/bin/python3 '+shlex.quote(str(script))+' --config '+shlex.quote(str(config))+' --state-dir '+shlex.quote(str(state))+' '+quote_flag+' --publish-staging >> '+shlex.quote(str(state/'refresh.log'))+' 2>&1'
    old=subprocess.run(['crontab','-l'],capture_output=True,text=True)
    if old.returncode and 'no crontab'not in old.stderr.lower():raise RuntimeError('Cannot inspect existing crontab; no mutation performed')
    before=old.stdout;after=revised(before,command)
    if not a.install:print(json.dumps({'status':'validated_dry_run','job':after.splitlines()[-1],'unrelated_jobs_preserved':True}));return
    state.mkdir(exist_ok=True,parents=True);(state/'crontab-before.txt').write_text(before)
    subprocess.run(['crontab','-'],input=after,check=True,text=True,capture_output=True)
    observed=subprocess.run(['crontab','-l'],check=True,capture_output=True,text=True).stdout
    if observed!=after:raise RuntimeError('Installed schedule differs from reviewed crontab')
    receipt={'installed_at':datetime.now(timezone.utc).isoformat(),'interval_seconds':7200,'cron':'17 */2 * * *','timezone':datetime.now().astimezone().tzname(),'tag':TAG,'command':command,'source_root':str(ROOT),'script_sha256':hashlib.sha256(script.read_bytes()).hexdigest(),'crontab_before_sha256':hashlib.sha256(before.encode()).hexdigest(),'crontab_after_sha256':hashlib.sha256(after.encode()).hexdigest(),'unrelated_jobs_preserved':True,'live_quotes_enabled':a.enable_quotes,'scope':'Reserve Ethereum eUSD canonical backing and isolated staging-data branch only'}
    atomic(state/'schedule-installed.json',receipt);print(json.dumps(receipt))
if __name__=='__main__':main()
