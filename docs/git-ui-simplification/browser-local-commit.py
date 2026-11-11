import json,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text())
project='6aee30c179c897758e370d23';base=f'http://127.0.0.1:18081/project/{project}/git-sync';branch=f'test/local-commit-{int(time.time())}';report={};writes=[]
with sync_playwright() as p:
 b=p.chromium.launch();page=b.new_page(viewport={'width':1600,'height':1000});page.set_default_timeout(30000)
 def guard(route):
  req=route.request
  if req.method=='GET':route.continue_()
  elif req.url in [base+'/branches',base+'/checkout',base+'/commits']:writes.append(req.url);route.continue_()
  else:route.abort()
 page.route('**/git-sync/**',guard)
 page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 page.goto(f'http://127.0.0.1:18081/project/{project}');page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500)
 initial=page.request.get(base).json();before=page.request.get(base+'/changes').json()
 page.get_by_role('tab',name='Git history & sync',exact=True).click()
 page.get_by_role('button',name='Current branch:',exact=False).click();pop=page.get_by_role('dialog',name='Select a branch',exact=True)
 pop.get_by_role('button',name='Create new branch…',exact=True).click();pop.get_by_label('Branch name',exact=True).fill(branch);pop.get_by_role('button',name='Create branch',exact=True).click();expect(pop).not_to_be_visible(timeout=60000)
 parent=page.request.get(base).json()['baseCommit'];commits=[]
 for index in range(2):
  current=page.request.get(base+'/changes').json();file=next(x['path'] for x in current['files'] if not x.get('ignored'))
  page.get_by_label(f'Include {file} in commit',exact=True).check();message=f'test: direct local commit {index+1} {branch}'
  page.get_by_label('Commit message',exact=True).fill(message)
  with page.expect_response(lambda r:r.url==base+'/commits',timeout=60000) as pending:page.get_by_role('button',name='Commit',exact=True).click()
  response=pending.value;assert response.status==201,(response.status,response.text()[:1000]);commit=response.json();assert commit['status']=='committed'
  expect(page.get_by_label('Commit message',exact=True)).to_have_value('')
  expect(page.get_by_label(f'Include {file} in commit',exact=True)).to_have_count(0)
  expect(page.get_by_role('button',name='Open commit review',exact=True)).to_have_count(0)
  expect(page.get_by_text(message,exact=True).first).to_be_visible(timeout=30000)
  graph=page.request.get(base+'/graph').json();entry=next(x for x in graph['commits'] if x['id']==commit['commit']);assert entry['parents']==[parent]
  status=page.request.get(base).json();assert status['baseCommit']==commit['commit'];assert status['branch']=='refs/heads/'+branch
  assert next(x for x in status['branches'] if x['ref']==status['branch'])['id']==commit['commit']
  assert len(page.request.get(base+'/changes').json()['files'])==len(current['files'])-1
  commits.append({'commit':commit['commit'],'file':file,'message':message});parent=commit['commit']
 page.screenshot(path=str(out/'local-commit-graph.png'))
 assert page.request.get(base+'/changes').json()['fingerprint']==before['fingerprint']
 assert not any(url.endswith('/push') or '/pushes' in url for url in writes)
 report.update(passed=True,branch=branch,commits=commits,graphUpdatedWithoutReload=True,selectionRemovedAfterCommit=True,noReviewPortal=True,noPush=True,projectFilesUnchanged=True)
 (out/'local-commit-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
