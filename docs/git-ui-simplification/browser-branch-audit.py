import json,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text())
project='6aebe9278850b5fc9924feda';base=f'http://127.0.0.1:18081/project/{project}/git-sync';branch=f'test/local-commit-{int(time.time())}';report={};writes=[]
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
 status=page.request.get(base).json();changes=page.request.get(base+'/changes').json()
 report={'branch':status.get('branch'),'baseCommit':status.get('baseCommit'),'branches':status.get('branches'),'files':changes.get('files')}
 (out/'branch-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
