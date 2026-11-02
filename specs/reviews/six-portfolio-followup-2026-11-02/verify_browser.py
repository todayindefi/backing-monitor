from playwright.sync_api import sync_playwright
from pathlib import Path
import json,sys,datetime,hashlib
mode=sys.argv[1] if len(sys.argv)>1 else 'release';base='https://todayindefi.github.io/backing-monitor/' if mode=='served' else 'http://127.0.0.1:8902/';out=Path('/home/danger/backing-monitor/specs/reviews/six-portfolio-followup-2026-11-02');rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',args=['--no-sandbox'])
 for width in [1280,390]:
  for dark in [False,True]:
   page=b.new_page(viewport={'width':width,'height':960});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));url=base+'?asset=apyusd&qa=followup-20261102';page.goto(url,wait_until='networkidle');page.evaluate('(v)=>document.body.classList.toggle("dark",v)',dark);note=page.locator('#apyx-unlock-scope');text=note.inner_text();details=page.locator('#panel-unlock details');assert '0.1%' in text and '2.5%' in text and 'nonlinear' in text and '3 days' in text and 'current receipt queue coverage is unavailable' in text;assert not details.get_attribute('open');assert not errors;assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');note.scroll_into_view_if_needed();name=f'{mode}-{width}-{"dark" if dark else "light"}.png';page.screenshot(path=str(out/name));rows.append({'url':url,'width':width,'dark':dark,'errors':errors,'overflow':False,'scope_note':text,'legacy_collapsed':True,'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'screenshot':name,'sha256':hashlib.sha256((out/name).read_bytes()).hexdigest()});page.close()
 b.close()
(out/(mode+'-browser.json')).write_text(json.dumps(rows,indent=2)+'\n');print(mode,len(rows),'passed')
