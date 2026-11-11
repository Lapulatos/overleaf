import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('docs/git-improvements');f=json.loads((out/'runtime-fixture.json').read_text());a=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());base='http://127.0.0.1:18081';api=base+'/project/'+f['projectId']+'/git-sync'
with sync_playwright() as p:
 b=p.chromium.launch();c=b.new_context();page=c.new_page();page.goto(base+'/login');page.locator('[name=email]').fill(a['email']);page.locator('[name=password]').fill(a['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 def get(path):
  r=c.request.get(api+path);assert r.ok,(path,r.status);return r.json()
 status=get('');assert not status.get('activeApplicationId');assert status['branch']=='refs/heads/main'
 main=get('/changes/file?path=main.tex');aux=get('/changes/file?path=build.aux');assert main['after']['text']==f['webText'];assert aux['after']['text']=='Generated fixture output'
 work=get('/saved-work');assert any(i['name']=='Browser saved draft' for i in work['items'])
 report={'passed':True,'sourceBytesRestored':True,'generatedFileBytesRestored':True,'savedWorkRetained':True,'activeApplication':False,'branch':status['branch']}
 (out/'runtime-final-readback.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
