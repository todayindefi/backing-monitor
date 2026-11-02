from playwright.sync_api import sync_playwright
import json,pathlib,os
base=os.environ.get('SATURN_REVIEW_URL','http://127.0.0.1:8891/');out=pathlib.Path(os.environ.get('SATURN_REVIEW_QA','/tmp/saturn-review-qa'));out.mkdir(exist_ok=True);results=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',headless=True,args=['--no-sandbox'])
 for width in [1280,390]:
  for slug in ['usdat','susdat']:
   page=b.new_page(viewport={'width':width,'height':960});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(base+'?asset='+slug+'&saturn_review=20261102b',wait_until='networkidle',timeout=60000)
   panel=page.locator('#saturn-exit-review');panel.wait_for();page.wait_for_function("document.querySelector('#saturn-exit-review').textContent.includes('MoonPay Digital Assets Limited')")
   text=panel.inner_text();assert 'both Ethereum and Monad' in text and 'Queue eligibility: unknown' in text and 'not a lending health factor' in text
   assert 'Paxos-issued' not in page.locator('body').inner_text()
   panel.scroll_into_view_if_needed();box=panel.bounding_box();assert box['x']>=-1 and box['x']+box['width']<=width+1,box
   page.screenshot(path=str(out/f'{slug}-{width}.png'),full_page=True)
   page.evaluate("window.scrollTo(0, document.querySelector('#saturn-exit-review').getBoundingClientRect().top + scrollY - 100)")
   page.screenshot(path=str(out/f'{slug}-{width}-viewport.png'))
   results.append({'asset':slug,'width':width,'review_text':text,'document_overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth'),'errors':errors})
   assert not errors,errors;page.close()
  page=b.new_page(viewport={'width':width,'height':960})
  page.route('**/saturn_exit_review.json*',lambda r:r.fulfill(status=404,body='missing'))
  page.goto(base+'?asset=usdat',wait_until='networkidle',timeout=60000);assert 'Dated exit review unavailable' in page.locator('#saturn-exit-review').inner_text();page.close()
  page=b.new_page(viewport={'width':width,'height':960});page.goto(base+'?asset=apyusd&saturn_regression=1',wait_until='networkidle',timeout=60000)
  page.locator('#apyx-unlock-scope').wait_for();text=page.locator('#apyx-unlock-scope').inner_text();assert 'Active receipt coverage:' in text
  assert not page.locator('#saturn-exit-review').count();results.append({'asset':'apyusd','width':width,'receipt_text':text,'status':'existing_release_preserved'});page.close()
 b.close()
(out/'results.json').write_text(json.dumps({'base':base,'results':results},indent=2)+'\n');print('PASS desktop/mobile Saturn issuer/exit review, source clocks, unavailable fallback and Apyx release regression')
