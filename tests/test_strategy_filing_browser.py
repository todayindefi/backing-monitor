from playwright.sync_api import sync_playwright
import os,pathlib,json
base=os.getenv('STRATEGY_QA_URL','http://127.0.0.1:8893/');out=pathlib.Path(os.getenv('STRATEGY_QA_OUT','/tmp/bm-strategy-qa'));out.mkdir(exist_ok=True);results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',headless=True,args=['--no-sandbox'])
 for width in [1280,390]:
  for asset in ['mstr','strc','strcx','apxusd','apyusd','susdat']:
   page=b.new_page(viewport={'width':width,'height':960});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'?asset='+asset+'&strategy_filing=20261102',wait_until='networkidle',timeout=60000)
   panel=page.locator('#strategy-filing-evidence');panel.wait_for(timeout=20000);text=panel.inner_text();assert '2026-11-01' in text and 'current outstanding' in text and 'Scores and full-verification dates are unchanged' in text
   if asset in ['mstr','strc']:assert '811' in text and '810' in text and 'unreconciled' in text and '$132,700,000' in text
   else:assert 'does not measure this token' in text
   assert not errors,(asset,errors)
   page.evaluate("window.scrollTo(0,document.querySelector('#strategy-filing-evidence').getBoundingClientRect().top+scrollY-100)");box=panel.bounding_box();assert box['x']>=-1 and box['x']+box['width']<=width+1,(asset,width,box)
   page.screenshot(path=str(out/f'{asset}-{width}.png'));results.append({'asset':asset,'width':width,'text':text,'errors':errors,'card_fits':True})
   page.close()
 b.close()
(out/'results.json').write_text(json.dumps({'base':base,'results':results},indent=2)+'\n');print('PASS',len(results),'affected desktop/mobile Strategy filing views')
