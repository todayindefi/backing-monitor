from playwright.sync_api import sync_playwright
import json,os,pathlib

def main():
 base=os.getenv('FRXUSD_EVIDENCE_URL','http://127.0.0.1:8894/');out=pathlib.Path(os.getenv('FRXUSD_EVIDENCE_QA','/tmp/bm-frxusd-evidence-qa'));out.mkdir(exist_ok=True)
 pointer=json.load(open('data/frxusd_backing_evidence.json'));snapshot=json.load(open(pointer['snapshot_path']));metrics=snapshot['third_party_verified']['metrics'];results=[]
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',headless=True,args=['--no-sandbox'])
  for width in [1280,390]:
   page=b.new_page(viewport={'width':width,'height':960});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'?asset=frxusd&shared_evidence=20261103',wait_until='networkidle',timeout=60000);card=page.locator('#frxusd-shared-evidence');card.wait_for();text=card.inner_text();assert f"{metrics['coverage_par_pct']:.2f}%" in text and f"{metrics['coverage_market_pct']:.2f}%" in text;assert pointer['snapshot_id'] in card.text_content();assert 'not our audit' in text and 'already netted' in text and 'sfrxUSD' in text;assert not errors,errors
   page.evaluate("window.scrollTo(0,document.querySelector('#frxusd-shared-evidence').getBoundingClientRect().top+scrollY-100)");box=card.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width+1;page.screenshot(path=str(out/f'frxusd-{width}.png'));results.append({'width':width,'text':text,'errors':errors,'card_fits':True});page.close()
  for failure in ['missing','hash_mismatch','last_good','stale']:
   page=b.new_page(viewport={'width':390,'height':960})
   if failure=='missing':page.route('**/frxusd_backing_evidence.json*',lambda r:r.fulfill(status=404,body='missing'))
   elif failure=='hash_mismatch':page.route('**/frxusd_evidence_snapshots/*.json',lambda r:r.fulfill(status=200,body='{}'))
   elif failure=='last_good':
    altered={**pointer,'served_is_last_good':True,'status':'degraded_last_good','upstream_health':'fetch_failed'};page.route('**/frxusd_backing_evidence.json*',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps(altered)))
   else:page.add_init_script('const originalNow=Date.now;Date.now=()=>originalNow()+3*86400000;')
   page.goto(base+'?asset=frxusd&shared_failure='+failure,wait_until='networkidle',timeout=60000);card=page.locator('#frxusd-shared-evidence');card.wait_for();text=card.inner_text();assert ('unavailable' in text if failure in ['missing','hash_mismatch'] else 'Last-good snapshot retained' in text if failure=='last_good' else 'source observation stale' in text),failure;results.append({'scenario':failure,'status':'passed'});page.close()
  b.close()
 (out/'results.json').write_text(json.dumps({'base':base,'snapshot_id':pointer['snapshot_id'],'results':results},indent=2)+'\n');print('PASS desktop/mobile shared metrics/hash parity and missing/hash/stale/last-good views')


if __name__ == '__main__':
 main()
