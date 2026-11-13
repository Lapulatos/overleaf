import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import Path from 'node:path'
import { AgentError } from '../WritingAssist/WritingAssistErrors.mjs'
const exec = promisify(execFile)

// Public HTTPS Git transport does not consume the REST API quota. No checkout,
// hooks, credential helpers or repository scripts are run.
export async function publicGitSkillSource(source) {
 const root = await mkdtemp(Path.join(tmpdir(), 'overleaf-skill-'))
 const directory = Path.join(root, 'repository')
 const close = () => rm(root, { recursive: true, force: true })
 const env = { PATH: process.env.PATH, HOME: root, LANG: 'C.UTF-8', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1' }
 const git = async args => (await exec('git', ['-c','gc.auto=0','-c','credential.helper=','-c','core.hooksPath=/dev/null','-c','protocol.allow=never','-c','protocol.https.allow=always',...args], { env, timeout: 90000, maxBuffer: 4*1024*1024, encoding: 'buffer' })).stdout
 try {
  await git(['clone','--depth=1','--filter=blob:none','--no-checkout','--',`https://github.com/${source.owner}/${source.repo}.git`,directory])
  if (source.ref) await git(['-C',directory,'fetch','--depth=1','--','origin',source.ref])
  const commit = (await git(['-C',directory,'rev-parse',source.ref?'FETCH_HEAD':'HEAD'])).toString().trim()
  const output = (await git(['-C',directory,'ls-tree','-r','-z',commit])).toString()
  const tree = output.split('\0').filter(Boolean).map(line=>{
   const tab=line.indexOf('\t'), [mode,type,sha]=line.slice(0,tab).trim().split(/\s+/)
   return {mode,type,sha,path:line.slice(tab+1)}
  })
  const timer=setTimeout(()=>void close(),900000);timer.unref()
  const request=async path=>{
   if(path.includes('/git/trees/'))return {tree,truncated:false}
   if(path.includes('/git/blobs/')) {
    const sha=path.split('/').at(-1),item=tree.find(entry=>entry.sha===sha&&entry.type==='blob')
    if(!item || item.size>1000000)throw new AgentError(422,'Skill text file exceeds the supported size.')
    return {encoding:'base64',content:(await git(['-C',directory,'cat-file','blob',sha])).toString('base64')}
   }
   if(path.includes('/commits/'))return {sha:commit}
   return {private:false,default_branch:'HEAD'}
  }
  return {request,close:async()=>{clearTimeout(timer);await close()}}
 } catch(error) { await close(); if(error instanceof AgentError)throw error;throw new AgentError(502,'Could not download the public GitHub repository. Check its URL and try again.') }
}
