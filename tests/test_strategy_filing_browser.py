"""Check the served producer/review identity, six inherited views and excluded USDat."""
from playwright.sync_api import sync_playwright
import os,pathlib,json
base=os.getenv('STRATEGY_QA_URL','http://127.0.0.1:8916/').rstrip('/')+'/'
out=pathlib.Path(os.getenv('STRATEGY_QA_OUT','/tmp/bm-strategy-qa'));out.mkdir(parents=True,exist_ok=True)
results=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/home/danger/.cache/puppeteer/chrome/linux-154.0.8037.57/chrome-linux64/chrome',headless=True,args=['--no-sandbox'])
 try:
  for width in [1280,390]:
   for asset in ['mstr','strc','strcx','apxusd','apyusd','susdat','usdat']:
    page=browser.new_page(viewport={'width':width,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+'?asset='+asset,wait_until='networkidle',timeout=60000)
    source=page.evaluate("async()=>{let b=await(await fetch('data/strc_backing.json')).json(),c=await(await fetch('data/strategy_filing_context.json')).json();return {base:b,context:c}}")
    data,context=source['base'],source['context'];f=data['mstr_view']['digital_credit_framework']['filing_update'];panel=page.locator('#strategy-filing-evidence')
    if asset=='usdat':
     assert panel.count()==0,'USDat must not inherit STRC context';results.append({'asset':asset,'width':width,'excluded':True,'errors':errors});page.close();continue
    panel.wait_for(timeout=20000);text=panel.inner_text();current=context.get('status')=='available'and context.get('accession')==f['accession']and context.get('balances_as_of')==f['balances_as_of']
    if asset in ['mstr','strc']:
     for value in [f['filing_date'],f['balances_as_of'],str(f['btc_purchased']),str(f['btc_holdings_delta']),f['btc_reconciliation']]:assert value in text,(asset,value)
     assert 'not STRC alone' in text and 'retirement' in text.lower()
     if current:assert context['interpretation']in text
     else:assert 'Current owner interpretation unavailable' in text
    elif current:
     assert f['balances_as_of']in text and 'does not measure this token' in text
    else:assert 'dependency context unavailable' in text
    assert data['tradfi']['strc_dividend']['outstanding_shares']is None
    assert data['tradfi']['strc_dividend']['annual_dividend_obligation_usd']is None
    if asset=='mstr':
     balance=page.locator('.panel').filter(has=page.get_by_text('Balance sheet snapshot',exact=True)).first.inner_text()
     assert 'USD Reserve'in balance and 'USD Cash (general)'in balance and '2026-08-09'in balance and '2026-06-30'in balance
     body=page.locator('#asset-specific-panels').inner_text();assert 'Historical funding designation: USD Cash'in body and 'not this week’s funding attribution'in body
     if data['tradfi']['mnav']['value']is None:assert 'Regime unavailable (mNAV unmeasured)'in body and 'Live (mNAV' not in body
    assert not errors,(asset,errors)
    box=panel.bounding_box();assert box['x']>=-1 and box['x']+box['width']<=width+1,(asset,width,box)
    panel.screenshot(path=str(out/f'{asset}-{width}.png'))
    if asset=='mstr':page.locator('.panel').filter(has=page.get_by_text('Balance sheet snapshot',exact=True)).first.screenshot(path=str(out/f'mstr-balance-{width}.png'))
    results.append({'asset':asset,'width':width,'accession':f['accession'],'balances_as_of':f['balances_as_of'],'current_owner_review':current,'text':text,'errors':errors,'card_fits':True});page.close()
 finally:browser.close()
(out/'results.json').write_text(json.dumps({'base':base,'results':results},indent=2)+'\n');print('PASS',len(results),'Strategy filing desktop/mobile views and exclusions')
