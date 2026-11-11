import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('docs/git-improvements');fixture=json.loads((out/'runtime-fixture.json').read_text());account=json.loads((Path.home()/'.local/share/overleaf-acceptance/demo-account.json').read_text());base='http://127.0.0.1:18081';api=base+'/project/'+fixture['projectId']+'/git-sync'
report={'passed':False,'scope':'Isolated fixture only: PDF/image rendering, native shelve and restore with reload.'}
with sync_playwright() as p:
 browser=p.chromium.launch();context=browser.new_context(viewport={'width':1600,'height':1100});page=context.new_page();page.set_default_timeout(45000);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.route(api+'/fetch',lambda route:route.fulfill(status=200,json={'skipped':'no remote traffic'}));page.route(api+'/pushes/*/execute',lambda route:route.abort())
 try:
  page.goto(base+'/login');page.locator('[name=email]').fill(account['email']);page.locator('[name=password]').fill(account['password']);page.get_by_role('button',name='Login',exact=True).click();page.wait_for_url(lambda url:'/login' not in url)
  page.goto(base+'/project/'+fixture['projectId']);page.get_by_role('tab',name='Git history & sync',exact=True).click();panel=page.locator('.git-sync-panel');expect(panel.get_by_label('Include main.tex in commit')).to_be_visible()
  panel.get_by_role('tab',name='Commits',exact=True).click();panel.get_by_label('Search commit messages',exact=True).fill('Initial manuscript');panel.get_by_role('button',name='Search history',exact=True).click();panel.get_by_role('button',name='Inspect commit Initial manuscript and media',exact=True).click()
  modal=page.get_by_role('dialog',name='Commit details workspace',exact=True)
  modal.get_by_role('button',name='View historical diff for pixel.png',exact=True).click();image=modal.get_by_role('img',name='After',exact=True);expect(image).to_be_visible();page.wait_for_function('(img)=>img.complete && img.naturalWidth>0',arg=image.element_handle());report['imageDecoded']=True
  modal.get_by_role('button',name='View historical diff for sample.pdf',exact=True).click();modal.get_by_role('button',name='Preview PDF · After',exact=True).click();expect(modal.get_by_text('Page 1 of 1',exact=False)).to_be_visible();canvas=modal.locator('canvas');page.wait_for_function('(canvas)=>canvas.width>0 && canvas.height>0 && Array.from(canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data).some((v,i)=>i%4!==3&&v>0)',arg=canvas.element_handle());canvas.screenshot(path=str(out/'runtime-pdf-canvas.png'));report['pdfRendered']=True
  page.keyboard.press('Escape');expect(modal).to_have_count(0)
  panel.get_by_role('tab',name='Changes',exact=True).click();panel.get_by_text('Save unfinished work',exact=True).click();panel.get_by_role('button',name='Review clearing saved changes',exact=True).click()
  panel.get_by_role('button',name='Apply reviewed changes',exact=True).click();expect(panel.get_by_text('Files saved to this project. Repository push is still separate.',exact=True)).to_be_visible(timeout=120000);report['shelveApplied']=True
  page.reload();expect(page.locator('.cm-content')).to_contain_text('Original introduction.',timeout=45000)
  
  if not panel.is_visible(): page.get_by_role('tab',name='Git history & sync',exact=True).click()
  panel.get_by_text('Save unfinished work',exact=True).click();panel.get_by_role('button',name='Review restore',exact=True).click();panel.get_by_role('button',name='Apply reviewed changes',exact=True).click();expect(panel.get_by_text('Files saved to this project. Repository push is still separate.',exact=True)).to_be_visible(timeout=120000);report['restoreApplied']=True
  page.reload();expect(page.locator('.cm-content')).to_contain_text('Revised introduction.',timeout=45000);expect(page.locator('.cm-content')).to_contain_text('Revised conclusion.');report['reloadVerified']=True
  assert not errors;report['pageErrors']=errors;report['passed']=True
 except Exception as error:
  report['error']=str(error)[:2500];page.screenshot(path=str(out/'runtime-apply-media-failure.png'))
 finally:
  (out/'runtime-apply-media-report.json').write_text(json.dumps(report,indent=2)+'\n');browser.close();print(json.dumps(report))
if not report['passed']:raise SystemExit(1)
