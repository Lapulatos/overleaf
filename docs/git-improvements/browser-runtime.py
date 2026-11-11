import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-improvements'); fixture=json.loads((out/'runtime-fixture.json').read_text()); account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());base='http://127.0.0.1:18081';api=base+'/project/'+fixture['projectId']+'/git-sync'
report={'passed':False,'projectId':fixture['projectId'],'scope':'Real candidate APIs and isolated native project. No remote network fetch or push.'}
with sync_playwright() as p:
 browser=p.chromium.launch();context=browser.new_context(viewport={'width':1600,'height':1100});page=context.new_page();page.set_default_timeout(30000)
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.route(api+'/fetch',lambda route:route.fulfill(status=200,json={'skipped':'isolated remote network disabled'}))
 page.route(api+'/pushes/*/execute',lambda route:route.abort())
 try:
  page.goto(base+'/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda url:'/login' not in url)
  page.goto(base+'/project/'+fixture['projectId']);page.get_by_role('tab',name='Git history & sync',exact=True).click();panel=page.locator('.git-sync-panel');expect(panel.get_by_role('tab',name='Changes',exact=True)).to_have_attribute('aria-selected','true')
  expect(panel.get_by_label('Include main.tex in commit')).to_be_visible()
  panel.get_by_role('button',name='View changes in main.tex',exact=True).click();panel.get_by_text('Select individual change blocks',exact=True).click()
  expect(panel.get_by_label('Include block 1 in main.tex')).to_be_visible();panel.get_by_label('Include block 1 in main.tex').check();panel.get_by_label('Commit message',exact=True).fill('Browser-selected introduction block')
  panel.get_by_role('tab',name='Branches',exact=True).click();expect(panel.get_by_text('Create a branch',exact=True)).to_be_visible();panel.get_by_role('tab',name='Changes',exact=True).click();expect(panel.get_by_label('Include block 1 in main.tex')).to_be_checked();expect(panel.get_by_label('Commit message',exact=True)).to_have_value('Browser-selected introduction block')
  panel.screenshot(path=str(out/'runtime-local-changes.png'))
  panel.get_by_role('button',name='Commit only',exact=True).click();expect(panel.get_by_role('button',name='Push commit',exact=True)).to_be_visible();report['commitOnly']=True
  panel.get_by_role('button',name='Keep for later',exact=True).click();panel.get_by_text('Saved commits awaiting push',exact=True).click();panel.get_by_role('button',name='Browser-selected introduction block',exact=True).click();expect(panel.get_by_role('button',name='Push commit',exact=True)).to_be_visible()
  panel.get_by_role('button',name='Archive without pushing',exact=True).click();expect(panel.get_by_text('Commit archived. Its bytes are retained and your project files are unchanged.',exact=True)).to_be_visible();panel.get_by_role('button',name='Close commit review',exact=True).click();report['retainedReopenAndArchive']=True
  panel.get_by_text('Ignore generated files',exact=True).click();panel.get_by_role('button',name='Use LaTeX build-file patterns',exact=True).click();panel.get_by_role('button',name='Save ignore rules',exact=True).click();expect(panel.get_by_label('Show ignored new files (1)')).to_be_visible();expect(panel.get_by_label('Include build.aux in commit')).to_have_count(0);report['ignoreRules']=True
  panel.get_by_text('Save unfinished work',exact=True).click();panel.get_by_label('Saved work name',exact=True).fill('Browser saved draft');panel.get_by_role('button',name='Save current work',exact=True).click();expect(panel.get_by_text('Saved “Browser saved draft”. Project files have not changed.',exact=True)).to_be_visible();report['savedWork']=True
  panel.get_by_role('button',name='Review clearing saved changes',exact=True).click();expect(panel.get_by_role('button',name='Review changes to main.tex',exact=True)).to_be_visible();panel.get_by_role('button',name='Review changes to main.tex',exact=True).click();expect(panel.get_by_role('region',name='Review main.tex',exact=True)).to_be_visible();report['savedWorkPreview']=True
  panel.screenshot(path=str(out/'runtime-saved-work-review.png'))
  panel.get_by_role('tab',name='Commits',exact=True).click();expect(panel.get_by_role('button',name='Load more commits',exact=True)).to_be_visible();panel.get_by_role('button',name='Load more commits',exact=True).click();expect(panel.get_by_role('button',name='Load more commits',exact=True)).to_have_count(0);report['historyPagination']=True
  page.screenshot(path=str(out/'runtime-history.png'))
  report['pageErrors']=errors;assert not errors;report['passed']=True
 except Exception as error:
  report['error']=str(error)[:2400];page.screenshot(path=str(out/'runtime-browser-failure.png'))
 finally:
  (out/'runtime-browser-report.json').write_text(json.dumps(report,indent=2)+'\n');browser.close();print(json.dumps(report))
if not report['passed']:raise SystemExit(1)
