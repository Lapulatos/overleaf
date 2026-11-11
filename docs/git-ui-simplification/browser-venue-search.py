import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());report={}
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page(viewport={'width':1600,'height':1000});page.set_default_timeout(30000)
 page.route('**/git-sync/**',lambda r:r.continue_() if r.request.method=='GET' else r.abort())
 page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 page.goto('http://127.0.0.1:18081/project/6aee30c179c897758e370d23');page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500)
 page.get_by_role('button',name='Venues',exact=True).click()
 search=page.get_by_label('Search venues',exact=True);expect(search).to_be_visible()
 for view in ['Card','Timeline']:
  page.get_by_role('button',name=view,exact=True).click()
  for query in ['S&P','S & P','S and P']:
   search.fill(query)
   titles=page.locator('.deadline-card .deadline-title')
   expect(titles.first).to_contain_text('S&P')
   texts=titles.all_text_contents();assert texts and all('S&P' in title for title in texts),texts
   report[view+' '+query]=texts
 page.screenshot(path=str(out/'venue-search-verified.png'));report['passed']=True;(out/'venue-search-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
