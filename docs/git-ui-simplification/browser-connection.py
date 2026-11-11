import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());report={}
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page(viewport={'width':1600,'height':1000});page.set_default_timeout(30000)
 page.route('**/git-sync/**',lambda r:r.continue_() if r.request.method=='GET' else r.abort())
 page.route('**/project/6aee30c179c897758e370d23/git-sync',lambda r:r.fulfill(status=200,json={'connected':False}))
 page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 page.goto('http://127.0.0.1:18081/project/6aee30c179c897758e370d23');page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500)
 panel=page.locator('.git-sync-panel')
 if not panel.is_visible():page.get_by_role('tab',name='Git history & sync',exact=True).click()
 expect(panel.get_by_label('Repository URL',exact=True)).to_be_visible()
 for width in [320,520]:
  panel.evaluate('(e,w)=>{e.style.width=w+"px";e.style.maxWidth=w+"px"}',width)
  box=panel.locator('.git-connection-panel').bounding_box();url=panel.get_by_label('Repository URL',exact=True).bounding_box();select=panel.get_by_label('Branch',exact=True).bounding_box();refresh=panel.get_by_role('button',name='Refresh branches',exact=True).bounding_box();connect=panel.get_by_role('button',name='Connect repository',exact=True).bounding_box()
  assert url['x']-box['x']>=15;assert box['x']+box['width']-url['x']-url['width']>=15
  assert abs(select['y']-refresh['y'])<1;assert abs(select['height']-refresh['height'])<1;assert abs(url['height']-connect['height'])<1
  assert panel.locator('.git-connection-panel').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
  report[str(width)]={'padding':url['x']-box['x'],'inputHeight':url['height'],'selectHeight':select['height'],'refreshHeight':refresh['height']}
  panel.screenshot(path=str(out/f'connection-{width}.png'))
 page.route('**/git-sync/remote-branches?*',lambda r:r.fulfill(status=200,json={'branches':[{'name':'main','ref':'refs/heads/main','id':'a'*40}]}))
 page.route('**/git-sync/credentials?*',lambda r:r.fulfill(status=200,json={'configured':True}))
 panel.get_by_label('Repository URL',exact=True).fill('https://github.com/fixture/masked-token')
 panel.get_by_text('Your repository credentials',exact=True).click()
 expect(panel.get_by_text('Your token is configured.',exact=True)).to_be_visible()
 token=panel.get_by_label('Repository access token',exact=True);expect(token).to_have_value('••••••••••••');assert token.get_attribute('readonly') is not None
 panel.get_by_role('button',name='Replace token',exact=True).click();expect(token).to_have_value('');token.fill('synthetic-not-a-secret');panel.get_by_role('button',name='Cancel',exact=True).click();expect(token).to_have_value('••••••••••••');report['savedTokenMaskAndReplace']=True
 panel.screenshot(path=str(out/'connection-saved-token.png'))
 report['passed']=True;(out/'connection-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
