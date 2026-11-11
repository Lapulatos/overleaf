import json
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path('docs/git-review');a=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch();c=b.new_context(viewport={'width':1600,'height':1000});page=c.new_page();page.set_default_timeout(45000)
 page.route('**/git-sync/**',lambda route:route.continue_() if route.request.method=='GET' else route.abort())
 page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(a['email']);page.locator('[name=password]').fill(a['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 page.goto('http://127.0.0.1:18081/project/6ae8c19a1bd2fd256c96e759');page.get_by_role('tab',name='Git history & sync',exact=True).click()
 panel=page.locator('.git-sync-panel');panel.wait_for();page.wait_for_timeout(2000)
 report={'settings':panel.inner_text(),'geometry':panel.bounding_box()};panel.screenshot(path=str(out/'git-settings.png'))
 for tab in ['Changes','Commits']:
  panel.get_by_role('tab',name=tab,exact=True).click();page.wait_for_timeout(1000);report[tab]=panel.inner_text();panel.screenshot(path=str(out/('git-'+tab.lower()+'.png')))
 (out/'browser-observations.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
