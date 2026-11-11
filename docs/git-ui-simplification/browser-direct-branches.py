import json,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text())
project='6aee30c179c897758e370d23';base=f'http://127.0.0.1:18081/project/{project}/git-sync'
report={};prefix=f'test/direct-{int(time.time())}'
with sync_playwright() as p:
 b=p.chromium.launch(); page=b.new_page(viewport={'width':1600,'height':1000});page.set_default_timeout(30000)
 def guard(route):
  request=route.request
  if request.method=='GET' or (f'/project/{project}/git-sync/' in request.url and request.url.endswith(('/branches','/checkout'))): route.continue_()
  else: route.abort()
 page.route('**/git-sync/**',guard)
 page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 page.goto(f'http://127.0.0.1:18081/project/{project}');page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1800)
 expect(page.locator('.git-sync-panel')).not_to_be_visible();report['noAutomaticGitPage']=True
 initial=page.request.get(base).json();original=initial['branch']
 before=page.request.get(base+'/changes').json()
 page.get_by_role('tab',name='Git history & sync',exact=True).click()
 expect(page.get_by_text('Start first synchronization',exact=True)).to_have_count(0)
 expect(page.get_by_role('button',name='Incoming & merge',exact=False)).to_have_count(0)
 def picker():
  page.get_by_role('button',name='Current branch:',exact=False).click()
  return page.get_by_role('dialog',name='Select a branch',exact=True)
 for index in range(3):
  pop=picker()
  for label in ['Create new branch…','Create new branch from…','Checkout detached…']:expect(pop.get_by_role('button',name=label,exact=True)).to_be_visible()
  pop.screenshot(path=str(out/'direct-branch-picker.png'))
  pop.get_by_role('button',name='Create new branch from…' if index==1 else 'Create new branch…',exact=True).click()
  if index==1:pop.locator('.git-branch-results button').first.click()
  name=f'{prefix}-{index}'
  pop.get_by_label('Branch name',exact=True).fill(name)
  pop.get_by_role('button',name='Create branch',exact=True).click()
  expect(pop).not_to_be_visible(timeout=60000)
  expect(page.get_by_role('button',name=f'Current branch: {name}. Checkout branch',exact=True)).to_be_visible()
 current=page.request.get(base).json()
 names=[f'{prefix}-{i}' for i in range(3)]
 assert all(any(row['ref']=='refs/heads/'+name for row in current['branches']) for name in names)
 pop=picker();pop.get_by_role('button',name='Checkout detached…',exact=True).click();pop.locator('.git-branch-results button').first.click()
 expect(pop).not_to_be_visible(timeout=60000)
 detached=page.request.get(base).json();assert len(detached['branch']) in [40,64]
 report['detachedCommit']=detached['branch']
 pop=picker();pop.get_by_role('textbox',name='Search branches').fill(original.split('/')[-1]);pop.locator('.git-branch-results button').filter(has_text=original.split('/')[-1]).first.click()
 expect(pop).not_to_be_visible(timeout=60000)
 after=page.request.get(base+'/changes').json();assert before['fingerprint']==after['fingerprint']
 report.update(passed=True,createdLocalBranches=names,restoredBranch=page.request.get(base).json()['branch'],projectFileFingerprintUnchanged=True)
 page.screenshot(path=str(out/'direct-branches-result.png'))
 (out/'direct-branches-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
