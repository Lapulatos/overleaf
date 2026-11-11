import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());report={}
with sync_playwright() as p:
 b=p.chromium.launch();c=b.new_context(viewport={'width':1600,'height':1000});page=c.new_page();page.set_default_timeout(30000)
 page.route('**/git-sync/**',lambda r:r.continue_() if r.request.method=='GET' else r.abort())
 page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 page.goto('http://127.0.0.1:18081/project/6aee30c179c897758e370d23');page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500)
 panel=page.locator('.git-sync-panel')
 if not panel.is_visible():page.get_by_role('tab',name='Git history & sync',exact=True).click()
 expect(panel.get_by_role('separator',name='Resize Changes')).to_be_visible()
 section=panel.locator('.git-scm-changes');before=section.bounding_box()['height'];handle=panel.get_by_role('separator',name='Resize Changes');box=handle.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+2);page.mouse.down();page.mouse.move(box['x']+box['width']/2,box['y']+62,steps=8);page.mouse.up();after=section.bounding_box()['height'];assert after>before+40,(before,after);report['pointerResize']=[before,after]
 handle.focus();handle.press('ArrowUp');assert section.bounding_box()['height']<after-10;report['keyboardResize']=True
 graph=panel.locator('.git-commit-graph');expect(graph.locator('li')).to_have_count(56);graph.evaluate('(e)=>e.scrollTop=e.scrollHeight');assert graph.evaluate('(e)=>e.scrollTop>0');report['all56CommitsScrollable']=True
 bounds=panel.locator('.git-scm-graph').bounding_box();pb=panel.bounding_box();assert abs(bounds['y']+bounds['height']-pb['y']-pb['height'])<8;report['graphFillsBottom']=True
 report['icons']=page.locator('.ide-rail-tab-link-addon').evaluate_all('(es)=>es.map(e=>{const i=e.querySelector("svg,.material-symbols");const r=i.getBoundingClientRect();return {label:e.textContent.trim(),width:r.width,height:r.height,fontSize:getComputedStyle(i).fontSize}})');assert len(report['icons'])==4;assert all(i['width']<=20.1 and i['height']<=20.1 for i in report['icons'])
 endpoint='/writing-assist/project/6aee30c179c897758e370d23/venue-workspace'
 report['workspace']=page.evaluate('''async endpoint=>{const before=await(await fetch(endpoint)).json();const plan={...(before.plan||{}),reviews:{tse:90},windows:{tse:{start:1794000000000,end:1802000000000}}};const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Csrf-Token':document.querySelector('meta[name="ol-csrfToken"]').content},body:JSON.stringify({expectedUserId:before.userId,plan})});const saved=await(await fetch(endpoint)).json();return {status:res.status,matches:JSON.stringify(saved.plan)===JSON.stringify(plan)}}''',endpoint)
 assert report['workspace']=={'status':200,'matches':True},report['workspace']
 page.screenshot(path=str(out/'rail-resize-verified.png'));report['passed']=True;(out/'followup-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
