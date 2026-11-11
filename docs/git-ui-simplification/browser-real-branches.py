import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());report={}
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page(viewport={'width':1600,'height':1000});page.set_default_timeout(30000)
 page.route('**/git-sync/**',lambda r:r.continue_() if r.request.method=='GET' else r.abort())
 page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 page.goto('http://127.0.0.1:18081/project/6ae8c19a1bd2fd256c96e759');page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500)
 page.evaluate("localStorage.setItem('selected-rail-tab-6ae8c19a1bd2fd256c96e759',JSON.stringify('git-sync'))")
 page.reload();page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500)
 expect(page.locator('.git-sync-panel')).not_to_be_visible();expect(page.get_by_role('region',name='Git editor workspace',exact=True)).not_to_be_visible();report['noAutomaticGitPage']=True
 page.get_by_role('tab',name='Git history & sync',exact=True).click()
 page.get_by_role('button',name='Current branch:',exact=False).click()
 picker=page.get_by_role('dialog',name='Select a branch',exact=True)
 names=['test/ui-20261109-a','test/ui-20261109-b','test/ui-20261109-c']
 for name in names: expect(picker.get_by_role('button',name=name,exact=False)).to_be_visible()
 picker.screenshot(path=str(out/'real-remote-branch-picker.png'))
 for label in ['Create new branch…','Create new branch from…','Checkout detached…']:
  expect(picker.get_by_role('button',name=label,exact=True)).to_be_visible()
 picker.get_by_role('textbox',name='Search branches').press('Escape')
 expect(page.get_by_text('Start first synchronization',exact=True)).to_have_count(0)
 expect(page.get_by_role('button',name='Incoming & merge',exact=False)).to_have_count(0)
 page.get_by_label('Commit message',exact=True).fill('Read-only UI check — not submitted')
 expect(page.locator('.git-commit-hint')).not_to_have_text('Loading or refreshing changes…',timeout=60000)
 report['commitHint']=page.locator('.git-commit-hint').inner_text()
 report['alerts']=page.get_by_role('alert').all_text_contents()
 report['commitEnabledWithMessage']=page.get_by_role('button',name='Commit',exact=True).is_enabled()
 page.get_by_label('Commit message',exact=True).fill('')
 report.update(passed=True,remoteBranchesVisible=names,threeDirectCommands=True,noFirstSyncPrerequisite=True)
 (out/'real-remote-branches-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
