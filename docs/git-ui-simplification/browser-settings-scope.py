import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());report={}
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page(viewport={'width':1600,'height':1000});page.set_default_timeout(30000)
 page.route('**/git-sync/**',lambda r:r.continue_() if r.request.method=='GET' else r.abort())
 page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 page.goto('http://127.0.0.1:18081/project/6aee30c179c897758e370d23');page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500)
 page.evaluate("localStorage.setItem('selected-rail-tab-6aee30c179c897758e370d23',JSON.stringify('git-sync'))")
 page.reload();page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500)
 expect(page.locator('.git-sync-panel')).not_to_be_visible();expect(page.get_by_role('region',name='Git editor workspace',exact=True)).not_to_be_visible();report['noAutomaticGitPage']=True
 page.get_by_role('tab',name='Git history & sync',exact=True).click();page.get_by_role('button',name='Repository actions',exact=True).click();page.get_by_role('button',name='Repository settings',exact=True).click()
 workspace=page.get_by_role('region',name='Git editor workspace',exact=True);expect(workspace).to_be_visible()
 for name in ['Open Changes','Sync now','Resume automatic sync']:
  expect(workspace.get_by_role('button',name=name,exact=True)).to_have_count(0)
 expect(workspace.get_by_label('Check for remote updates automatically',exact=True)).to_be_visible()
 expect(workspace.get_by_role('checkbox',name='Automatically commit and push web changes',exact=True)).to_be_visible()
 expect(workspace.get_by_label('Sync interval',exact=True)).to_be_visible()
 expect(workspace.get_by_text('Set up the first synchronization',exact=True)).to_have_count(0)
 credentials=workspace.locator('.git-credential-controls')
 expect(credentials).to_have_attribute('open','')
 expect(credentials.get_by_label('Repository access token')).to_be_visible()
 expect(workspace.locator('details.git-settings-help')).to_have_count(0)
 expect(workspace.locator('p.git-settings-help')).to_be_visible()
 credentials.locator('summary').click();expect(credentials.get_by_label('Repository access token')).not_to_be_visible()
 credentials.locator('summary').click();expect(credentials.get_by_label('Repository access token')).to_be_visible()
 report['credentialDisclosureAndInlineHelp']=True
 report['settingsContainsOnlyConfiguration']=True;report['passed']=True;page.screenshot(path=str(out/'settings-configuration-only.png'));(out/'settings-scope-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
