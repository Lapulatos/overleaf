import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());report={'passed':False}
with sync_playwright() as p:
 b=p.chromium.launch();c=b.new_context(viewport={'width':1600,'height':1000});page=c.new_page();page.set_default_timeout(30000)
 page.route('**/git-sync/**',lambda route:route.continue_() if route.request.method=='GET' else route.abort())
 try:
  page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
  def visit(project):
   page.goto('http://127.0.0.1:18081/project/'+project);panel=page.locator('.git-sync-panel')
   if not panel.is_visible():page.get_by_role('tab',name='Git history & sync',exact=True).click()
   return panel
  panel=visit('6aee30c179c897758e370d23');expect(panel.get_by_label('Commit message',exact=True)).to_be_visible()
  expect(panel.locator(':scope > section > .git-scm-heading')).to_have_text(['Repositories','Changes','Graph']);expect(panel.get_by_role('tablist')).to_have_count(0)
  composer=panel.get_by_label('Commit message',exact=True);composer.fill('Retained layout draft');panel.get_by_label('Include main.tex in commit').check()
  panel.locator('.git-scm-changes > .git-scm-heading').click();expect(composer).not_to_be_visible();expect(panel.locator('.git-scm-graph > .git-scm-heading')).to_be_visible();panel.locator('.git-scm-changes > .git-scm-heading').click();expect(composer).to_have_value('Retained layout draft');expect(panel.get_by_label('Include main.tex in commit')).to_be_checked();report['collapseRetainsDraft']=True
  panel.get_by_role('button',name='Repository settings',exact=True).click();expect(page.get_by_label('Check for remote updates automatically',exact=True)).to_be_visible();expect(composer).to_be_visible();workspace=page.get_by_role('region',name='Git editor workspace',exact=True);expect(workspace).to_be_visible();assert workspace.bounding_box()['x'] >= panel.bounding_box()['x'] + panel.bounding_box()['width'] - 2;page.get_by_role('button',name='Close Git editor workspace',exact=True).click();report['settingsInEditor']=True
  panel.get_by_text('Ignore generated files',exact=True).click();expect(workspace.get_by_label('Ignore patterns',exact=True)).to_be_visible();page.get_by_role('button',name='Close Git editor workspace',exact=True).click();report['ignoreRulesInEditor']=True
  panel.get_by_text('Save unfinished work',exact=True).click();expect(workspace.get_by_label('Saved work name',exact=True)).to_be_visible();page.get_by_role('button',name='Close Git editor workspace',exact=True).click();report['savedWorkInEditor']=True
  panel.screenshot(path=str(out/'three-sections.png'));report['threeSections']=True
  panel.get_by_role('button',name='View changes in main.tex',exact=True).click();expect(workspace.get_by_role('region',name='Local diff main.tex',exact=True)).to_be_visible();expect(panel.get_by_label('Include main.tex in commit')).to_be_checked();expect(workspace.get_by_role('region',name='Line diff',exact=True)).to_be_visible();page.screenshot(path=str(out/'editor-diff.png'));report['diffInEditor']=True
  page.get_by_role('button',name='Close Git editor workspace',exact=True).click();expect(workspace).not_to_be_visible()
  panel.get_by_role('button',name='Open Git Graph',exact=True).click();expect(workspace.get_by_role('region',name='Git Graph workspace',exact=True)).to_be_visible();expect(page.get_by_role('dialog')).to_have_count(0);expect(workspace.get_by_role('button',name='Inspect commit History fixture 54',exact=True)).to_be_visible();page.screenshot(path=str(out/'editor-graph.png'));report['graphInEditor']=True;workspace.get_by_role('button',name='Inspect commit History fixture 54',exact=True).click();expect(workspace.locator('.git-commit-details')).to_be_visible();report['commitDetailsInEditor']=True
  page.get_by_role('button',name='Close Git editor workspace',exact=True).click()

  panel.get_by_role('button',name='Current branch: main. Manage branches',exact=True).click();expect(workspace.get_by_label('New branch name',exact=True)).to_be_visible();page.get_by_role('button',name='Close Git editor workspace',exact=True).click();report['branchesInEditor']=True
  panel=visit('6ae8c19a1bd2fd256c96e759');expect(panel.locator('.git-scm-repositories > .git-scm-heading')).to_have_text('Repositories');expect(panel.locator('.git-scm-changes > .git-scm-heading')).to_be_visible();expect(panel.locator('.git-scm-graph > .git-scm-heading')).to_be_visible();panel.screenshot(path=str(out/'initial-sync-sections.png'));report['initialSyncSections']=True
  page.route('**/project/6ae8c19a1bd2fd256c96e759/git-sync',lambda route:route.fulfill(status=200,json={'connected':False}) if route.request.method=='GET' else route.abort())
  page.reload();page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500);panel=page.locator('.git-sync-panel')
  if not panel.is_visible():page.get_by_role('tab',name='Git history & sync',exact=True).click()
  expect(panel.get_by_label('Repository URL',exact=True)).to_be_visible();expect(panel.locator('.git-scm-changes')).not_to_be_visible();expect(panel.locator('.git-scm-graph')).not_to_be_visible();panel.screenshot(path=str(out/'binding-first.png'));report['unboundFixtureOnlyBinding']=True
  report['passed']=True
 except Exception as e:
  report['error']=str(e)[:2000];page.screenshot(path=str(out/'sections-failure.png'))
 finally:
  (out/'sections-report.json').write_text(json.dumps(report,indent=2)+'\n');b.close();print(json.dumps(report))
if not report['passed']:raise SystemExit(1)
