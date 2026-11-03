from playwright.sync_api import sync_playwright
import os,json,pathlib

def main():
 base=os.getenv('ISSUER_FAMILY_URL','http://127.0.0.1:8895/');out=pathlib.Path(os.getenv('ISSUER_FAMILY_QA','/tmp/bm-issuer-family-qa'));out.mkdir(exist_ok=True);results=[]
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',headless=True,args=['--no-sandbox'])
  for width in [1280,390]:
   for asset in ['mstr','strc','strcx','apxusd','apyusd','usdat','susdat']:
    page=b.new_page(viewport={'width':width,'height':960});errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'?asset='+asset+'&issuer_family=20261103',wait_until='networkidle',timeout=60000)
    card=page.locator('[data-issuer-component="'+asset+'"]:visible');card.wait_for(timeout=20000);assert card.count()==1,(asset,card.count());text=card.inner_text();assert 'RiskAnalyst owns the unchanged score' in text
    if asset=='strcx':assert 'Backed Assets (JE) Limited' in text and 'Backed Finance AG · tokenizer' in text and 'Security Agent Services AG' in text and 'Swiss DLT-regulated' not in text
    elif asset in ['usdat','susdat']:assert 'Component legal facts were not exported' in text and 'British Virgin Islands' not in text
    elif asset=='strc':assert 'Certificate and dividend legal clocks' in text and 'preferred equity' in text
    elif asset=='apxusd':assert 'Dated reserve-asset examination' in text and '~20-day' not in text
    elif asset=='apyusd':assert '~20-day' in text;assert 'Active receipt coverage:' in page.locator('#apyx-unlock-scope').inner_text()
    if asset=='mstr':assert 'Strategy Inc' in text
    assert not errors,(asset,errors)
    card.evaluate("el=>window.scrollTo(0,el.getBoundingClientRect().top+scrollY-100)")
    box=card.bounding_box();assert box['x']>=-1 and box['x']+box['width']<=width+1,(asset,width,box);page.screenshot(path=str(out/f'{asset}-{width}.png'));results.append({'asset':asset,'width':width,'text':text,'errors':errors,'card_fits':True});page.close()
  page=b.new_page(viewport={'width':390,'height':960});page.route('**/issuer_project_evidence.json*',lambda r:r.fulfill(status=404,body='missing'));page.goto(base+'?asset=strc&issuer_missing=1',wait_until='networkidle');page.locator('[data-issuer-component="strc"]').wait_for();assert 'unavailable' in page.locator('[data-issuer-component="strc"]').inner_text();results.append({'scenario':'missing shared feed on raw STRC','status':'passed'});page.close();b.close()
 (out/'results.json').write_text(json.dumps({'base':base,'results':results},indent=2)+'\n');print('PASS14 desktop/mobile component views, exact roles/no inheritance, Apyx receipts and missing feed')

if __name__=='__main__':main()
