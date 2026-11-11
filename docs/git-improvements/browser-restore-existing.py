# Continue the already-shelved isolated fixture. Never repeats the shelve action.
import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-improvements');fixture=json.loads((out/'runtime-fixture.json').read_text());account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());base='http://127.0.0.1:18081';api=base+'/project/'+fixture['projectId']+'/git-sync'
report={'passed':False,'scope':'Restore existing named work after confirmed native shelve; isolated project only.'}
with sync_playwright() as p:
 browser=p.chromium.launch();context=browser.new_context(viewport={'width':1600,'height':1100});page=context.new_page();page.set_default_timeout(45000);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.route(api+'/fetch',lambda route:route.fulfill(status=200,json={'skipped':'no remote traffic'}));page.route(api+'/pushes/*/execute',lambda route:route.abort())
 try:
  page.goto(base+'/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda url:'/login' not in url)
  page.goto(base+'/project/'+fixture['projectId']);expect(page.locator('.cm-content')).to_contain_text('Original introduction.')
  panel=page.locator('.git-sync-panel')
  if not panel.is_visible(): page.get_by_role('tab',name='Git history & sync',exact=True).click()
  expect(panel.get_by_text('No local file changes.',exact=True)).to_be_visible()
  panel.get_by_text('Save unfinished work',exact=True).click();panel.get_by_role('button',name='Review restore',exact=True).click();panel.get_by_role('button',name='Apply reviewed changes',exact=True).click();expect(panel.get_by_text('Files saved to this project. Repository push is still separate.',exact=True)).to_be_visible(timeout=120000);report['restoreApplied']=True
  page.screenshot(path=str(out/'runtime-restore-applied.png'))
  page.reload();expect(page.locator('.cm-content')).to_contain_text('Revised introduction.',timeout=45000);expect(page.locator('.cm-content')).to_contain_text('Revised conclusion.');report['reloadVerified']=True
  if not panel.is_visible(): page.get_by_role('tab',name='Git history & sync',exact=True).click()
  expect(panel.get_by_label('Include main.tex in commit')).to_be_visible();report['localChangesRefreshed']=True
  page.screenshot(path=str(out/'runtime-restored-local-changes.png'))
  assert not errors;report['pageErrors']=errors;report['passed']=True
 except Exception as error:
  report['error']=str(error)[:2500];page.screenshot(path=str(out/'runtime-restore-existing-failure.png'))
 finally:
  (out/'runtime-restore-existing-report.json').write_text(json.dumps(report,indent=2)+'\n');browser.close();print(json.dumps(report))
if not report['passed']:raise SystemExit(1)
