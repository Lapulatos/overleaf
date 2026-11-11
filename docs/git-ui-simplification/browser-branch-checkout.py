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
 target=next(x for x in initial['branches'] if x['ref']!=initial['branch'] and x['id']!=initial['baseCommit'])
 page.get_by_role('tab',name='Git history & sync',exact=True).click()
 results=[]
 for ref in [target['ref'],initial['branch']]:
  page.get_by_role('button',name='Current branch:',exact=False).click()
  pop=page.get_by_role('dialog',name='Select a branch',exact=True)
  label=ref.replace('refs/heads/','').replace('refs/remotes/','')
  row=pop.get_by_role('button').filter(has=page.get_by_text(label,exact=True))
  with page.expect_response(lambda r:r.url==base+'/checkout',timeout=60000) as response:row.click()
  data=response.value.json();assert data['status']=='files-applied',data
  expect(pop).not_to_be_visible(timeout=60000)
  status=page.request.get(base).json();changes=page.request.get(base+'/changes').json()
  assert status['branch']==ref and changes['branch']==ref and changes['baseCommit']==status['baseCommit']
  expect(page.get_by_text('Uncommitted changes · '+label+' · '+status['baseCommit'][:8],exact=True)).to_be_visible()
  ui=page.locator('.git-local-changes input[aria-label^="Include "]')
  expect(ui).to_have_count(len([f for f in changes['files'] if not f.get('ignored')]))
  assert all(not ui.nth(i).is_checked() for i in range(ui.count()))
  results.append({'branch':ref,'baseCommit':status['baseCommit'],'files':[f['path'] for f in changes['files']]})
 assert page.request.get(base+'/changes').json()['fingerprint']==before['fingerprint']
 page.screenshot(path=str(out/'branch-checkout.png'))
 report={'passed':True,'switches':results,'roundTripProjectBytesUnchanged':True}
 (out/'branch-checkout-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
