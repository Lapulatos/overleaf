import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text())
project='6aee30c179c897758e370d23';base=f'http://127.0.0.1:18081/project/{project}/git-sync';report={};mutations=[]
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page(viewport={'width':1600,'height':1000});page.set_default_timeout(30000)
 def guard(route):
  req=route.request
  if req.method=='GET':route.continue_()
  elif req.url==base+'/commit-message':mutations.append(req.url);route.continue_()
  else:route.abort()
 page.route('**/git-sync/**',guard)
 page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 page.goto(f'http://127.0.0.1:18081/project/{project}');page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500)
 page.get_by_role('tab',name='Git history & sync',exact=True).click()
 expect(page.get_by_text('Enter a commit message.',exact=True)).to_have_count(0)
 expect(page.get_by_text('Saved commits awaiting push',exact=True)).to_have_count(0)
 expect(page.get_by_role('button',name='Refresh saved commits',exact=True)).to_have_count(0)
 before=page.request.get(base+'/changes').json()
 selected=next((x['path'] for x in before['files'] if x['path'].endswith('.tex') and not x.get('ignored')),before['files'][0]['path'])
 page.get_by_label(f'Include {selected} in commit',exact=True).check()
 button=page.get_by_role('button',name='Generate commit message',exact=True)
 with page.expect_response(lambda r:r.url==base+'/commit-message',timeout=70000) as pending:
  button.click()
 response=pending.value
 assert response.status==200, (response.status,response.text()[:500])
 message=response.json()['message']
 expect(page.get_by_label('Commit message',exact=True)).to_have_value(message)
 assert message.strip()
 expect(page.get_by_role('button',name='Commit',exact=True)).to_be_enabled()
 page.locator('.git-scm-changes').screenshot(path=str(out/'ai-commit-composer.png'))
 page.get_by_role('button',name='Current branch:',exact=False).click()
 pop=page.get_by_role('dialog',name='Select a branch',exact=True)
 expect(pop.locator('time').first).to_be_visible()
 status=page.request.get(base).json();tip=status['branches'][0]
 assert tip['author'] and tip['subject'] and tip['date']
 pop.screenshot(path=str(out/'branch-tip-metadata.png'))
 assert page.request.get(base+'/changes').json()['fingerprint']==before['fingerprint']
 assert mutations==[base+'/commit-message']
 report.update(passed=True,selectedFile=selected,generatedMessage=message,branchMetadata=tip,onlyGenerationRequested=True,projectFilesUnchanged=True)
 (out/'ai-commit-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
