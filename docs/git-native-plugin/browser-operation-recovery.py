"""Load into the existing isolated Playwright REPL; does not launch a browser."""
import json, re, subprocess
from pathlib import Path
recovery_state=json.loads((Path.home()/'.local/share/overleaf-acceptance/native-git-operation-recovery-r27.json').read_text())
recovery_project=recovery_state['projectId']
assert recovery_project=='6af2cf744b782c4ad5c040aa'
recovery_repo='/var/lib/overleaf/native-git/'+recovery_project+'/repository'
recovery_output=Path('/tmp/native-git-operation-recovery-browser.json')
recovery_results=json.loads(recovery_output.read_text()) if recovery_output.exists() else {}
def recovery_git(*args):
 return subprocess.check_output(['docker','exec','-u','www-data','overleaf-deletion-acceptance-candidate-web-1','git','-C',recovery_repo,*args],text=True).rstrip('\n')
def recovery_checkout(branch):
 assert page.url.endswith('/project/'+recovery_project)
 page.locator('.native-git-branch-button').click()
 page.get_by_role('combobox',name='Select a branch or tag to checkout',exact=True).fill(branch)
 page.get_by_role('listbox',name='Branches, tags and checkout actions').locator('button').filter(has=page.locator('strong',has_text=re.compile('^'+re.escape(branch)+'$'))).click()
 page.get_by_role('listbox',name='Branches, tags and checkout actions').wait_for(state='hidden')
 page.locator('.native-git-panel[aria-busy="false"]').wait_for()
 assert page.locator('.native-git-branch-button').get_attribute('title')==branch

def recovery_case(operation, action):
 branch=('cherry' if operation=='cherry-pick' else operation)+'-'+action
 if branch in recovery_results:
  print('ALREADY VERIFIED',branch,flush=True);return
 recovery_checkout(branch)
 before=recovery_git('rev-parse',branch)
 page.get_by_role('button',name='Repository actions',exact=True).click()
 menu={'rebase':'Rebase onto…','cherry-pick':'Cherry-pick…','revert':'Revert commit…'}[operation]
 page.get_by_text(menu,exact=True).click()
 page.get_by_role('textbox',name='Branch, tag or commit',exact=True).fill('source')
 page.get_by_role('button',name='Continue',exact=True).click()
 page.get_by_role('button',name='Abort '+operation,exact=True).wait_for()
 launch_stayed=page.get_by_role('dialog').count()>0
 if launch_stayed: page.get_by_role('button',name='Cancel',exact=True).click()
 if action=='continue':
  page.get_by_role('button',name='Resolve main.tex',exact=True).click()
  merged='% RESOLVED '+operation+' recovery\n'+'\n'.join(recovery_state['targetText'].split('\n')[1:])
  page.get_by_role('textbox',name='Merged result',exact=True).fill(merged)
  page.get_by_role('button',name='Save result & stage',exact=True).click()
  page.get_by_role('dialog').wait_for(state='hidden')
  page.get_by_role('button',name='Continue '+operation,exact=True).click()
 elif action=='abort':page.get_by_role('button',name='Abort '+operation,exact=True).click()
 else:page.get_by_role('button',name='Skip commit',exact=True).click()
 page.locator('.native-git-operation').wait_for(state='hidden')
 page.locator('.native-git-panel[aria-busy="false"]').wait_for()
 after=recovery_git('rev-parse',branch)
 if action=='continue':
  assert after!=before
  parent=recovery_git('rev-parse',branch+'^')
  assert parent==(recovery_state['source'] if operation=='rebase' else before)
  expected=merged
 else:
  expected_head=recovery_state['source'] if operation=='rebase' and action=='skip' else before
  assert after==expected_head,(branch,after,expected_head)
  expected=recovery_state['sourceText'] if operation=='rebase' and action=='skip' else recovery_state['targetText']
 assert recovery_git('show',branch+':main.tex')==expected.rstrip('\n')
 assert '\n'.join(page.get_by_role('textbox',name='Source Editor editing').locator('.cm-line').all_text_contents())==expected
 assert not page.locator('.native-git-conflict-list').count()
 recovery_results[branch]={'before':before,'after':after,'editorExact':True,'launchDialogStayedOpen':launch_stayed}
 recovery_output.write_text(json.dumps(recovery_results,indent=2)+'\n')
 print('PASS',branch,flush=True)
