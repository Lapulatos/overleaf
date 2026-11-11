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
 trigger=page.get_by_role('button',name='Current branch:',exact=False)
 trigger.click()
 picker=page.get_by_role('dialog',name='Select a branch',exact=True)
 expect(picker).to_be_visible();expect(picker.get_by_role('textbox',name='Search branches')).to_be_focused()
 picker.get_by_role('textbox').fill('conflict')
 choice=picker.get_by_role('button',name='conflict-review',exact=False)
 expect(choice).to_be_visible()
 page.screenshot(path=str(out/'repository-branch-picker.png'))
 choice.click()
 workspace=page.get_by_role('region',name='Git editor workspace',exact=True)
 expect(workspace).to_be_visible();expect(workspace.get_by_role('region',name='Repository branches')).to_be_visible();expect(workspace.get_by_label('New branch name',exact=True)).to_have_count(0);expect(workspace.get_by_label('Switch branch',exact=True)).to_have_value('refs/heads/conflict-review')
 report['searchAndBranchReviewRouting']=True
 page.get_by_role('button',name='Repository actions',exact=True).click()
 menu=page.get_by_role('dialog',name='Repository actions',exact=True)
 expect(menu.get_by_role('button',name='Fetch',exact=True)).to_be_visible()
 page.screenshot(path=str(out/'repository-actions.png'))
 menu.get_by_role('button',name='Create and publish branch…',exact=True).click()
 expect(workspace.get_by_label('New branch name',exact=True)).to_be_visible()
 report['createBranchRouting']=True
 page.get_by_role('button',name='Push branch',exact=True).click()
 expect(workspace.get_by_text('Saved commits awaiting push',exact=True)).to_be_visible()
 expect(workspace.get_by_text('Push saved commits',exact=True)).to_be_visible()
 report['pushSavedCommitsRouting']=True
 page.get_by_role('button',name='Repository actions',exact=True).click()
 page.get_by_role('dialog',name='Repository actions').get_by_role('button',name='Repository settings',exact=True).click()
 expect(workspace.locator('.git-credential-controls > summary')).to_be_visible()
 report['settingsMenuRouting']=True
 trigger.click();page.keyboard.press('Escape');expect(page.get_by_role('dialog',name='Select a branch')).to_have_count(0);expect(trigger).to_be_focused()
 report['keyboardDismissal']=True
 report['passed']=True
 (out/'repository-actions-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
