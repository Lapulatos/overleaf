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
 page.get_by_role('tab',name='Git history & sync',exact=True).click();page.get_by_role('button',name='Repository settings',exact=True).click();expect(page.get_by_role('region',name='Git editor workspace',exact=True)).to_be_visible();page.screenshot(path=str(out/'compact-git-settings.png'));page.get_by_role('button',name='Close Git editor workspace',exact=True).click()
 page.get_by_role('button',name='Venues',exact=True).click();search=page.get_by_label('Search venues',exact=True);expect(search).to_be_visible();page.get_by_role('button',name='Card',exact=True).click();search.fill('S & P');titles=page.locator('.deadline-card .deadline-title');expect(titles).to_have_count(1);report['oneConferenceCard']=True;titles.first.click()
 cycle2=page.get_by_role('button',name='Cycle 2 · Next / latest',exact=True);expect(cycle2).to_have_attribute('aria-pressed','true')
 graph=page.get_by_label('Conference Track branches',exact=True)
 labels=graph.locator('button.venue-detail-track-point').evaluate_all('(es)=>es.map(e=>e.getAttribute("aria-label"))')
 papers=[t for t in labels if t.startswith('Papers')];artifacts=[t for t in labels if t.startswith('Artifacts')];assert len(papers)==10 and len(artifacts)==5,(papers,artifacts);assert all('Cycle 2' in t for t in papers+artifacts);assert not any('June' in t or 'September' in t for t in papers+artifacts);report['cycle2']={'papers':len(papers),'artifacts':len(artifacts)}
 page.screenshot(path=str(out/'sp-cycle2.png'));page.get_by_role('button',name='Cycle 1',exact=True).click()
 labels=graph.locator('button.venue-detail-track-point').evaluate_all('(es)=>es.map(e=>e.getAttribute("aria-label"))');papers=[t for t in labels if t.startswith('Papers')];artifacts=[t for t in labels if t.startswith('Artifacts')];assert len(papers)==10 and len(artifacts)==5;assert all('Cycle 1' in t for t in papers+artifacts);assert not any('November' in t or '2027' in t for t in papers+artifacts);report['cycle1']={'papers':len(papers),'artifacts':len(artifacts)}
 page.screenshot(path=str(out/'sp-cycle1.png'));report['passed']=True;(out/'cycles-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));b.close()
