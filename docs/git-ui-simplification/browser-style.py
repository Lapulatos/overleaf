import json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-ui-simplification');account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text())
with sync_playwright() as p:
 b=p.chromium.launch();c=b.new_context(viewport={'width':1600,'height':1000});page=c.new_page();page.set_default_timeout(30000)
 page.route('**/git-sync/**',lambda r:r.continue_() if r.request.method=='GET' else r.abort())
 page.goto('http://127.0.0.1:18081/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda u:'/login' not in u)
 page.goto('http://127.0.0.1:18081/project/6ae8c19a1bd2fd256c96e759');page.wait_for_selector('.ide-redesign-editor-container');page.wait_for_timeout(1500);panel=page.locator('.git-sync-panel')
 if not panel.is_visible():page.get_by_role('tab',name='Git history & sync',exact=True).click()
 expect(panel.get_by_role('button',name='Repository settings',exact=True)).to_be_visible()
 if '--preview' in sys.argv:page.add_style_tag(path='services/web/frontend/js/features/git-sync/git-sync.css')
 panel.get_by_role('button',name='Repository settings',exact=True).click();workspace=page.get_by_role('region',name='Git editor workspace',exact=True);expect(workspace.get_by_label('Check for remote updates automatically',exact=True)).to_be_visible()
 for section in ['Changes','Graph']:
  d=panel.locator('details.git-scm-section').filter(has=page.locator('summary',has_text=section)).first
  if d.get_attribute('open') is not None:d.locator(':scope > summary').click()
 report=page.evaluate('''() => { const style=s=>getComputedStyle(document.querySelector(s)); return { sectionBackground:style('.git-scm-section > summary').backgroundColor, workspaceHeaderBackground:style('.git-editor-workspace > header').backgroundColor, settingsCardBorder:style('.git-editor-workspace .git-auto-sync').borderLeftWidth, checkboxAccent:style('.git-editor-workspace input[type=checkbox]').accentColor } }''')
 assert report['sectionBackground']==report['workspaceHeaderBackground'];assert report['settingsCardBorder']=='0px'
 page.screenshot(path=str(out/('overleaf-style-preview.png' if '--preview' in sys.argv else 'overleaf-style.png')))
 (out/'style-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
