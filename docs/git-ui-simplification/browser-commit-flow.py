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
 page.get_by_role('tab',name='Git history & sync',exact=True).click()
 panel=page.locator('.git-sync-panel')
 expect(panel.get_by_role('button',name='Local changes',exact=True)).to_have_count(0)
 panel.get_by_label('Commit message',exact=True).fill('UI verification only — do not push')
 all_button=panel.get_by_role('button',name='Commit all and push',exact=True)
 expect(all_button).to_be_enabled()
 panel.screenshot(path=str(out/'commit-direct-flow.png'))
 checkbox=panel.get_by_role('checkbox',name='Include main.tex in commit',exact=True)
 checkbox.check()
 expect(panel.get_by_role('button',name='Commit and push',exact=True)).to_be_enabled()
 expect(panel.get_by_text('1 selected files will be committed.',exact=True)).to_be_visible()
 report['commitAllAndSelectedEnabledWithMessage']=True
 page.goto('http://127.0.0.1:18081/project/6ae8c19a1bd2fd256c96e759');page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500)
 page.get_by_role('tab',name='Git history & sync',exact=True).click()
 panel=page.locator('.git-sync-panel')
 expect(panel.get_by_label('Commit message',exact=True)).to_have_count(0)
 action=panel.get_by_role('button',name='Start first synchronization',exact=True).or_(panel.get_by_role('button',name='Continue synchronization',exact=True))
 expect(action).to_be_enabled()
 panel.screenshot(path=str(out/'first-sync-direct-action.png'))
 report.update(passed=True,firstSyncHasActionInsteadOfDeadCommitForm=True)
 (out/'commit-flow-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
