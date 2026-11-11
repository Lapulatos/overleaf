import json
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());report={'passed':False}
with sync_playwright() as p:
 browser=p.chromium.launch();context=browser.new_context(viewport={'width':1600,'height':1000});page=context.new_page();page.set_default_timeout(30000)
 page.route('**/git-sync/**',lambda route:route.continue_() if route.request.method=='GET' else route.abort())
 try:
  page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
  page.goto('http://127.0.0.1:18081/project/6aee30c179c897758e370d23');panel=page.locator('.git-sync-panel')
  if not panel.is_visible():page.get_by_role('tab',name='Git history & sync',exact=True).click()
  expect(panel.get_by_label('Commit message',exact=True)).to_be_visible();expect(panel.get_by_role('button',name='View changes in main.tex',exact=True)).to_be_visible()
  composer=panel.get_by_label('Commit message',exact=True);files=panel.locator('.git-source-files');assert composer.bounding_box()['y'] < files.bounding_box()['y'];report['composerAboveFiles']=True
  panel.screenshot(path=str(out/'daily-workflow.png'))
  expect(panel.get_by_role('button',name='Commit only',exact=True)).not_to_be_visible();panel.locator('#git-changes-panel').get_by_text('More commit options',exact=True).click();expect(panel.get_by_role('button',name='Commit only',exact=True)).to_be_visible();panel.locator('#git-changes-panel').get_by_text('More commit options',exact=True).click();report['secondaryActionsCollapsed']=True
  composer.fill('Retained UI draft');panel.get_by_label('Include main.tex in commit').check()
  panel.get_by_label('More Git views',exact=True).click();panel.get_by_role('tab',name='Branches',exact=True).click();expect(panel.get_by_label('New branch name',exact=True)).to_be_visible()
  panel.get_by_role('tab',name='Changes',exact=True).click();expect(composer).to_have_value('Retained UI draft');expect(panel.get_by_label('Include main.tex in commit')).to_be_checked();report['draftAndSelectionPreserved']=True
  panel.get_by_role('button',name='Repository settings',exact=True).click();expect(panel.get_by_label('Check for remote updates automatically',exact=True)).to_be_visible();report['settingsRetained']=True
  panel.get_by_role('tab',name='Changes',exact=True).click()
  if panel.locator('.git-views-more').get_attribute('open') is not None:panel.get_by_label('More Git views',exact=True).click()
  panel.get_by_role('button',name='Open Git Graph',exact=True).click();expect(page.locator('.git-history-modal')).to_be_visible();report['graphAvailable']=True
  page.screenshot(path=str(out/'history-graph.png'));report['passed']=True
 except Exception as error:
  report['error']=str(error)[:1800];page.screenshot(path=str(out/'browser-failure.png'))
 finally:
  (out/'browser-report.json').write_text(json.dumps(report,indent=2)+'\n');browser.close();print(json.dumps(report))
if not report['passed']:raise SystemExit(1)
