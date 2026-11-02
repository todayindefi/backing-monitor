from playwright.sync_api import sync_playwright
from pathlib import Path
import json,datetime,hashlib,sys
root=Path('/home/danger/backing-monitor')
out=root/'specs/reviews/six-portfolio-refresh-2026-11-02'
label=sys.argv[1] if len(sys.argv)>1 else 'local'
base='https://todayindefi.github.io/backing-monitor/' if label=='served' else ('http://127.0.0.1:8899/' if label=='release' else 'http://127.0.0.1:8898/')
slugs=['apxusd','apyusd','usdat','susdat','dusd-alto'] if label in ['served','release'] else [a['slug'] for a in json.loads((out/'evidence-register.json').read_text())['families'] if a['registry']]
results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',headless=True,args=['--no-sandbox'])
 for slug in slugs:
  for width in [1280,390]:
   page=b.new_page(viewport={'width':width,'height':960});errors=[]
   page.on('pageerror',lambda error:errors.append(str(error)))
   url=base+'?asset='+slug+'&qa=20261102'
   try:
    response=page.goto(url,wait_until='networkidle',timeout=45000)
    page.wait_for_timeout(800)
    text=page.locator('body').inner_text();(out/f'{label}-{slug}-{width}.txt').write_text(text)
    screenshot=out/f'{label}-{slug}-{width}.png'
    page.screenshot(path=str(screenshot),full_page=slug in ['apxusd','apyusd','usdat','susdat','dusd-alto'])
    result={'slug':slug,'width':width,'url':url,'http_status':response.status,'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'page_errors':errors,'overflow':page.evaluate('document.documentElement.scrollWidth > innerWidth'),
            'asset_visible':page.locator('#asset-view').is_visible(),'error_visible':page.locator('#error-view').is_visible(),
            'screenshot':screenshot.name,'sha256':hashlib.sha256(screenshot.read_bytes()).hexdigest(),
            'stale_warning': 'STALE Accountable attestation' in text,'basis_visible':'101.94965%' in text and '100.99047%' in text,
            'wrapper_caveat':'100% share-accounting ratio is definitional' in text,
            'threshold_updated':'bridge-admin Safe (3-of-7)' in text,
            'saturn_disagreement':'Source scope disagreement' in text,
            'obsolete_usdat_methodology':'USDat treasury holds $M and USDC' in text}
    if slug in ['apxusd','apyusd']:
     result['repair_acceptance']=all([result['stale_warning'],result['basis_visible'],result['threshold_updated'],not errors,result['asset_visible']]) and (slug!='apyusd' or result['wrapper_caveat'])
    elif slug=='susdat':result['repair_acceptance']=result['saturn_disagreement'] and not errors
    elif slug=='usdat':result['repair_acceptance']=not result['obsolete_usdat_methodology'] and not errors
    results.append(result)
    print(slug,width,'errors',errors,'overflow',result['overflow'],'repair',result.get('repair_acceptance'),flush=True)
   except Exception as error:results.append({'slug':slug,'width':width,'url':url,'failure':str(error)})
   page.close()
 b.close()
(out/f'{label}-browser.json').write_text(json.dumps(results,indent=2)+'\n')
