from playwright.sync_api import sync_playwright
import os,json,pathlib
base=os.getenv('BM_QA_URL','http://127.0.0.1:8892/');out=pathlib.Path(os.getenv('BM_QA_OUT','/tmp/bm-weekly-qa'));out.mkdir(exist_ok=True);results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',headless=True,args=['--no-sandbox'])
 for width in [1280,390]:
  for asset,project in [('usdat','saturn'),('usdm','mento'),('reusd-re','re'),('reusde-re','re'),('crvusd','curve')]:
   page=b.new_page(viewport={'width':width,'height':960});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base+'?asset='+asset+'&bm_review=20261102',wait_until='networkidle',timeout=60000)
   panel=page.locator('[data-issuer-project="'+project+'"]');panel.wait_for(timeout=20000);text=panel.inner_text()
   assert 'RiskAnalyst owns the score' in text
   if asset=='usdm':assert 'Passed · execution unverified' in text and 'Executed · tracker evidence' in text
   if asset=='reusde-re':assert 'sUSDe' in page.locator('#weekly-redemption-window').inner_text()
   if asset=='crvusd':
    assert 'minted-basis sensitivity' in page.locator('#crvusd-operator-accounting').inner_text()
    assert '43%' in page.locator('#weekly-security-followup').inner_text()
   page.evaluate("window.scrollTo(0,document.querySelector('[data-issuer-project]').getBoundingClientRect().top+scrollY-100)")
   page.screenshot(path=str(out/f'{asset}-{width}-issuer.png'))
   overflow=page.evaluate('document.documentElement.scrollWidth>innerWidth');assert not overflow,(asset,width,'document overflow');box=panel.bounding_box();assert box['x']>=0 and box['x']+box['width']<=width+1,(asset,width,box);assert not errors,errors
   results.append({'asset':asset,'width':width,'issuer_text':text,'errors':errors,'overflow':overflow})
   if asset in ['usdm','reusde-re','crvusd']:
    target={'usdm':'.data-integrity-panel','reusde-re':'#weekly-redemption-window','crvusd':'#crvusd-operator-accounting'}[asset]
    if page.locator(target).count():page.locator(target).scroll_into_view_if_needed();page.screenshot(path=str(out/f'{asset}-{width}-weekly.png'))
   page.close()
 b.close()
(out/'results.json').write_text(json.dumps({'base':base,'results':results},indent=2));print('PASS',len(results),'desktop/mobile affected served views')
