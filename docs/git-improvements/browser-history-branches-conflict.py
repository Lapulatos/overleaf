import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-improvements');fixture=json.loads((out/'runtime-fixture.json').read_text());account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());base='http://127.0.0.1:18081';api=base+'/project/'+fixture['projectId']+'/git-sync'
report={'passed':False,'scope':'Real isolated history restore, branch switch preserving edits, conflict draft reload; external transport blocked.'}
with sync_playwright() as p:
 browser=p.chromium.launch();context=browser.new_context(viewport={'width':1600,'height':1100});page=context.new_page();page.set_default_timeout(30000);errors=[];page.on('pageerror',lambda error:errors.append(str(error)));page.on('dialog',lambda dialog:dialog.accept())
 page.route(api+'/fetch',lambda route:route.fulfill(status=200,json={'skipped':'no remote traffic'}));page.route(api+'/pushes/*/execute',lambda route:route.abort())
 try:
  page.goto(base+'/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda url:'/login' not in url)
  page.goto(base+'/project/'+fixture['projectId']);expect(page.locator('.cm-content')).to_contain_text('Revised introduction.')
  panel=page.locator('.git-sync-panel')
  if not panel.is_visible():page.get_by_role('tab',name='Git history & sync',exact=True).click()
  expect(panel.get_by_label('Include main.tex in commit')).to_be_visible()
  panel.get_by_role('tab',name='Commits',exact=True).click();panel.get_by_label('File history',exact=True).fill('main.tex');panel.get_by_role('button',name='Search history',exact=True).click();expect(panel.get_by_text('1 commits shown for main.tex.',exact=False)).to_be_visible();report['fileHistory']=True
  panel.get_by_role('button',name='Inspect commit Initial manuscript and media',exact=True).click();modal=page.get_by_role('dialog',name='Commit details workspace',exact=True);modal.get_by_role('button',name='View historical diff for main.tex',exact=True).click();modal.get_by_role('button',name='Review restore of main.tex',exact=True).click();panel.get_by_role('button',name='Apply reviewed changes',exact=True).click();expect(panel.get_by_text('Files saved to this project. Repository push is still separate.',exact=True)).to_be_visible();expect(page.locator('.cm-content')).to_contain_text('Original introduction.');report['historicalFileRestored']=True
  panel.get_by_role('button',name='Close merge review',exact=True).click();panel.get_by_role('button',name='Local changes',exact=True).click();panel.get_by_text('Save unfinished work',exact=True).click();panel.get_by_role('button',name='Review restore',exact=True).click();panel.get_by_role('button',name='Apply reviewed changes',exact=True).click();expect(panel.get_by_text('Files saved to this project. Repository push is still separate.',exact=True)).to_be_visible();expect(page.locator('.cm-content')).to_contain_text('Revised introduction.');panel.get_by_role('button',name='Close merge review',exact=True).click()
  for ref in ['refs/heads/review-alternative','refs/heads/main']:
   panel.get_by_role('tab',name='Branches',exact=True).click();panel.get_by_label('Switch branch',exact=True).select_option(ref);panel.get_by_role('button',name='Review branch switch',exact=True).click();panel.get_by_role('button',name='Apply reviewed changes',exact=True).click();expect(panel.get_by_text('Files saved to this project. Repository push is still separate.',exact=True)).to_be_visible();expect(page.locator('.cm-content')).to_contain_text('Revised introduction.');panel.get_by_role('button',name='Close merge review',exact=True).click()
  report['branchSwitchPreservesEdits']=True
  panel.get_by_role('tab',name='Branches',exact=True).click();panel.get_by_label('Switch branch',exact=True).select_option('refs/heads/conflict-review');panel.get_by_role('button',name='Review branch switch',exact=True).click();panel.get_by_role('button',name='Review changes to main.tex',exact=True).click();expect(panel.get_by_text('2 unresolved conflict blocks',exact=True)).to_be_visible();panel.get_by_role('button',name='Use Web block',exact=True).first.click();expect(panel.get_by_text('1 unresolved conflict block',exact=True)).to_be_visible();report['perBlockChoice']=True
  page.screenshot(path=str(out/'runtime-conflict-blocks.png'));page.reload();expect(page.locator('.cm-content')).to_contain_text('Revised introduction.')
  if not panel.is_visible():page.get_by_role('tab',name='Git history & sync',exact=True).click()
  expect(panel.get_by_role('button',name='Review changes to main.tex',exact=True)).to_be_visible();panel.get_by_role('button',name='Review changes to main.tex',exact=True).click();expect(panel.get_by_text('Restored your unsaved merge draft.',exact=True)).to_be_visible();expect(panel.get_by_text('1 unresolved conflict block',exact=True)).to_be_visible();report['conflictDraftReload']=True
  panel.get_by_role('button',name='Use repository block',exact=True).click();panel.get_by_role('button',name='Save conflict decision',exact=True).click();expect(panel.get_by_role('button',name='Apply reviewed changes',exact=True)).to_be_enabled();report['resolvedPreviewReady']=True
  assert not errors;report['pageErrors']=errors;report['passed']=True
 except Exception as error:
  report['error']=str(error)[:2400];page.screenshot(path=str(out/'runtime-history-branches-conflict-failure.png'))
 finally:
  (out/'runtime-history-branches-conflict-report.json').write_text(json.dumps(report,indent=2)+'\n');browser.close();print(json.dumps(report))
if not report['passed']:raise SystemExit(1)
