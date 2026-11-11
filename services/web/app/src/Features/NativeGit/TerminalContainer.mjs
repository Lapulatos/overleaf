import path from 'node:path'
import { terminalBridge } from './RepositoryTerminal.mjs'
import { reviewedBridge } from './TerminalReview.mjs'
export function mountsFor({directory, commonDirectory, mode, directories=[]}, project) {
 const root=`/var/lib/overleaf/native-git/${project}/`
 if(!/^[a-f0-9]{24}$/.test(project)||!directory.startsWith(root)||directory.includes(',')||path.posix.normalize(directory)!==directory)throw Error('Invalid repository directory')
 if(!['read-only','workspace-write','auto-review','full-access'].includes(mode))throw Error('Invalid terminal mode')
 const paths=[directory]
 if(commonDirectory) {if(!commonDirectory.startsWith(root)||commonDirectory.includes(',')||path.posix.normalize(commonDirectory)!==commonDirectory)throw Error('Invalid Git metadata directory');paths.push(commonDirectory);paths.push(directory+'/.git')}
 if(directories.length)throw Error('Extra directories are not supported')
 return [...new Set(paths)].sort((a,b)=>a.length-b.length)
}

export function terminalContainerArgs(body,volume,image) {
 const paths=mountsFor(body,body.project)
 const args=['run','--rm','-i','--init','--platform','linux/amd64','--network','none',...(body.mode==='full-access'?[]:['--read-only']),'--cap-drop=ALL',...(body.mode==='full-access'?['--cap-add=DAC_OVERRIDE']:[]),'--security-opt=no-new-privileges','--pids-limit','128','--memory','768m','--cpus','1','--user',body.mode==='full-access'?'0:0':'www-data','--tmpfs','/tmp:rw,nosuid,nodev,size=128m','--tmpfs','/root:ro','--tmpfs','/home:ro','--tmpfs','/overleaf:ro','--tmpfs','/etc/overleaf:ro','--tmpfs','/etc/container_environment:ro']
 for(const p of paths) args.push('--mount',`type=volume,src=${volume},dst=${p},volume-subpath=${p.slice('/var/lib/overleaf/'.length)}${body.mode==='read-only'||p===body.commonDirectory||p===body.directory+'/.git'?',readonly':''}`)
 args.push('--workdir',body.directory,'--env',`HOME=${body.directory}`,'--env','HISTFILE=/dev/null','--env','TERM=xterm-256color','--env','LANG=C.UTF-8','--entrypoint','python3',image,'-u','-c',body.mode==='auto-review'?reviewedBridge:terminalBridge)
 return args
}
