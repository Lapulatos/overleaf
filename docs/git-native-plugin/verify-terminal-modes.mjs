import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import assert from 'node:assert/strict'
import {terminalContainerArgs} from '../../services/web/app/src/Features/NativeGit/TerminalContainer.mjs'
const exec=promisify(execFile),volume=`native-git-modes-fixture-${Date.now()}`,image='overleaf-agent-acceptance:20261111-native-git-candidate-r48'
const project='a'.repeat(24),root=`/var/lib/overleaf/native-git/${project}`,directory=root+'/worktrees/test',commonDirectory=root+'/repository/.git'
await exec('docker',['volume','create',volume])
try {
 await exec('docker',['run','--rm','--network','none','--mount',`type=volume,src=${volume},dst=/var/lib/overleaf`,'--entrypoint','python3',image,'-c',`import os\nos.makedirs('${directory}/.git')\nos.makedirs('${commonDirectory}')\nos.makedirs('/var/lib/overleaf/other-project')\nfor p in ['${directory}','${directory}/.git','${commonDirectory}']: os.chown(p,33,33)`])
 for(const mode of ['read-only','workspace-write','auto-review','full-access']) {
  const args=terminalContainerArgs({project,directory,commonDirectory,mode},volume,image)
  args[args.length-1]=`import os,json,socket\ndef write(p):\n try:\n  with open(p,'w') as f:f.write('probe')\n  return True\n except OSError:return False\nprint(json.dumps({'repo':write('${directory}/probe'),'root':write('/probe'),'metadata':write('${commonDirectory}/probe'),'other':os.path.exists('/var/lib/overleaf/other-project'),'host':os.path.exists('/Users'),'socket':os.path.exists('/var/run/docker.sock'),'interfaces':os.listdir('/sys/class/net')}))`
  const result=JSON.parse((await exec('docker',args)).stdout)
  assert.equal(result.repo,mode!=='read-only');assert.equal(result.root,mode==='full-access');assert.equal(result.metadata,false)
  assert.equal(result.other,false);assert.equal(result.host,false);assert.equal(result.socket,false);assert.ok(!result.interfaces.some(name=>/^eth|^en/.test(name)))
  console.log(mode,JSON.stringify(result))
 }
}finally {await exec('docker',['volume','rm',volume])}
