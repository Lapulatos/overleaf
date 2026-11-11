import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page(viewport={'width':1600,'height':1000});page.set_default_timeout(30000)
 page.route('**/git-sync/**',lambda r:r.continue_() if r.request.method=='GET' else r.abort())
 page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 page.goto('http://127.0.0.1:18081/project/6aee30c179c897758e370d23');page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500)
 page.get_by_role('tab',name='Git history & sync',exact=True).click()
 field=page.get_by_label('Commit message',exact=True);expect(field).to_be_visible()
 field.fill('Update balanced accuracy values in the label-swap table')
 assert field.evaluate('(el) => el.tagName')=='INPUT'
 icon=page.get_by_role('button',name='Generate commit message',exact=True)
 measurements=[]
 for width in [1600,1100]:
  page.set_viewport_size({'width':width,'height':1000});page.wait_for_timeout(300)
  a=field.bounding_box();c=icon.bounding_box();delta=abs(a['y']+a['height']/2-c['y']-c['height']/2)
  assert delta<1,(width,delta)
  measurements.append({'viewportWidth':width,'centerDifferencePx':delta,'inputHeight':a['height']})
 page.locator('.git-scm-changes').screenshot(path=str(out/'commit-input-alignment.png'))
 report={'passed':True,'singleLineInput':True,'measurements':measurements,'gitMutationsBlocked':True}
 (out/'commit-input-alignment-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
