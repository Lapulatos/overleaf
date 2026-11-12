import { skillDescription } from './SkillMetadata.mjs'
import { AgentError } from '../WritingAssist/WritingAssistErrors.mjs'
const fail = message => { throw new AgentError(422, message) }
const safePath = path => typeof path === 'string' && path.length < 200 && path.split('/').every(p=>p && p!=='.' && p!=='..' && !/^(AGENTS|CLAUDE)\.md$/i.test(p) && !/[\\\x00-\x1f]/.test(p))
export function parseGitHubSource(value) {
 try{if(value.split('/').some(part=>['.','..'].includes(decodeURIComponent(part))))fail('Invalid URL path.')}catch{fail('Invalid URL path.')}
 let url;try { url=new URL(value) } catch { fail('Enter a public GitHub repository or Skill folder URL.') }
 if(url.protocol!=='https:' || url.hostname!=='github.com' || url.port || url.username || url.password || url.search || url.hash)fail('Use an HTTPS github.com URL without credentials or query parameters.')
 let parts;try{parts=url.pathname.replace(/\/$/,'').split('/').slice(1).map(decodeURIComponent)}catch{fail('Invalid URL encoding.')}
 const [owner,rawRepo,kind,ref,...rest]=parts;const repo=rawRepo?.replace(/\.git$/,'')
 if(!/^[\w.-]+$/.test(owner || '') || !/^[\w.-]+$/.test(repo || '') || ['.','..'].includes(owner) || ['.','..'].includes(repo))fail('Invalid GitHub repository.')
 if(kind && (!['tree','blob'].includes(kind) || !ref))fail('Use a repository, tree folder or SKILL.md link.')
 let path=rest.join('/');if(kind==='blob'){if(!path.endsWith('SKILL.md'))fail('Select a SKILL.md file.');path=path.slice(0,-8).replace(/\/$/,'')}
 if(path && !safePath(path))fail('Invalid Skill folder path.')
 return {owner,repo,ref,path}
}
export function createGitHubSkills(fetcher=fetch, { token = '', now = Date.now } = {}) {
 const cache=new Map(), pending=new Map();let cacheBytes=0, retryAt=0
 const limited=()=>new AgentError(429,`GitHub request limit reached. Retry after ${new Date(retryAt).toISOString().replace('T',' ').replace('.000Z',' UTC')}. This limit is shared by requests from the server.`)
 async function api(path) {
  const cached=cache.get(path)
  if(cached && cached.expires>now())return structuredClone(cached.value)
  if(cached){cache.delete(path);cacheBytes-=cached.bytes}
  if(retryAt>now())throw limited()
  if(pending.has(path))return structuredClone(await pending.get(path))
  const request=load(path)
  pending.set(path,request)
  try {
   const value=await request
   if(/\/git\/(trees|blobs)\/[a-f0-9]{40}(?:\?recursive=1)?$/.test(path)){
    const bytes=Buffer.byteLength(JSON.stringify(value))
    while(cache.size && (cache.size>=64 || cacheBytes+bytes>8*1024*1024)){
     const key=cache.keys().next().value;cacheBytes-=cache.get(key).bytes;cache.delete(key)
    }
    if(bytes<=8*1024*1024){cache.set(path,{value,bytes,expires:now()+300000});cacheBytes+=bytes}
   }
   return structuredClone(value)
  } finally {pending.delete(path)}
 }
 async function load(path) {
  let response;try{response=await fetcher(`https://api.github.com${path}`,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{...(token?{Authorization:`Bearer ${token}`} : {}),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Overleaf-Skill-Library'}})}catch{throw new AgentError(502,'GitHub could not be reached. Try again later.')}
  const reader=response.body.getReader();let size=0;const chunks=[]
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>(response.ok?3000000:16000))fail('Repository response exceeds the supported size.');chunks.push(Buffer.from(value))}}finally{await reader.cancel()}
  let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{if(response.ok)throw new AgentError(502,'GitHub returned an unreadable response.');data={}}
  if(!response.ok){
   const remaining=response.headers.get('x-ratelimit-remaining')
   if(response.status===429 || (response.status===403 && (remaining==='0' || /rate limit/i.test(data.message || '')))){
    const retry=response.headers.get('retry-after'),reset=Number(response.headers.get('x-ratelimit-reset'))*1000
    const after=retry ? (/^\d+$/.test(retry)?now()+Number(retry)*1000:Date.parse(retry)) : 0
    retryAt=Math.max(now()+60000,Number.isFinite(after) && after<=8640000000000000?after:0,remaining==='0' && Number.isFinite(reset) && reset<=8640000000000000?reset:0)
    throw limited()
   }
   if(response.status===403)throw new AgentError(403,'GitHub denied access to this repository. Check that it is public and accessible; this response is not a confirmed rate limit.')
   if(response.status===401)throw new AgentError(502,'The server GitHub credential was rejected. Ask the administrator to update the Skill installer credential.')
   throw new AgentError(response.status===404?404:502,'GitHub repository or revision could not be read. Check the public repository URL and revision.')
  }
  return data
 }
 async function discover(url) {
  const source=parseGitHubSource(url);const base=`/repos/${encodeURIComponent(source.owner)}/${encodeURIComponent(source.repo)}`
  const metadata=(!source.ref || token)?await api(base):null
  if(token && metadata?.private!==false)fail('Only public GitHub repositories can be installed.')
  const ref=source.ref || metadata.default_branch
  const commit=await api(`${base}/commits/${encodeURIComponent(ref)}`)
  if(!/^[a-f0-9]{40}$/.test(commit.sha || ''))fail('GitHub returned an invalid revision.')
  const tree=await api(`${base}/git/trees/${commit.sha}?recursive=1`)
  if(tree.truncated || !Array.isArray(tree.tree))fail('Repository is too large for this installer. Use a smaller Skill repository.')
  const skills=tree.tree.filter(f=>f.type==='blob' && f.mode==='100644' && (f.path==='SKILL.md' || f.path.endsWith('/SKILL.md')) && safePath(f.path) && (!source.path || f.path===source.path+'/SKILL.md' || f.path.startsWith(source.path+'/'))).map(f=>({path:f.path,name:f.path.split('/').at(-2) || source.repo}))
  if(!skills.length)fail('No SKILL.md found at this location.')
  return {source,commit:commit.sha,skills,tree:tree.tree,base}
 }
 async function install(url,path,expectedCommit) {
  const found=await discover(url)
  if(expectedCommit && expectedCommit!==found.commit)throw new AgentError(409,'Repository changed after discovery. Find Skills again before installing.')
  const selected=path || (found.skills.length===1?found.skills[0].path:null)
  if(!found.skills.some(s=>s.path===selected))fail('Choose one of the discovered Skills.')
  const prefix=selected.slice(0,-8)
  const siblings=found.tree.filter(f=>f.type==='blob' && f.path.startsWith(prefix) && !found.skills.some(s=>s.path!==selected && s.path.startsWith(prefix) && f.path.startsWith(s.path.slice(0,-8))))
  const supported=siblings.filter(f=>f.mode==='100644' && /\.(md|txt|json)$/i.test(f.path) && f.path.slice(prefix.length).length<=180 && safePath(f.path.slice(prefix.length)) && f.path.slice(prefix.length).split('/').every(p=>!p.startsWith('.')))
  if(supported.length>30 || supported.reduce((n,f)=>n+(f.size || 0),0)>200000)fail('Skill exceeds 30 text files or 200 KB.')
  const files=[]
  for(const file of supported){
   if(!/^[a-f0-9]{40}$/.test(file.sha))fail('Invalid file revision.')
   const blob=await api(`${found.base}/git/blobs/${file.sha}`)
   if(blob.encoding!=='base64')fail('Unsupported GitHub file encoding.')
   const bytes=Buffer.from(blob.content,'base64');if(bytes.length>100000 || bytes.includes(0) || !Buffer.from(bytes.toString('utf8')).equals(bytes))fail('Skill files must be UTF-8 text under 100 KB.')
   files.push({path:file.path.slice(prefix.length),content:bytes.toString('utf8')})
  }
  if(files.reduce((n,f)=>n+Buffer.byteLength(f.content),0)>200000)fail('Skill exceeds 200 KB.')
  const main=files.find(f=>f.path==='SKILL.md')?.content
  if(!main?.trim() || main.length>20000)fail('SKILL.md must contain between 1 and 20,000 characters.')
  const name=(main.match(/^name:\s*["']?([^\n"']+)/m)?.[1] || selected.split('/').at(-2) || found.source.repo).trim().toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'').slice(0,48)
  if(!name)fail('Skill needs a valid name.')
  return {name,description:skillDescription(main),sourceUrl:`https://github.com/${found.source.owner}/${found.source.repo}/tree/${found.commit}/${prefix}`,commit:found.commit,skillPath:selected,files,unsupportedFiles:siblings.filter(f=>!supported.includes(f)).map(f=>f.path.slice(prefix.length)).slice(0,100),capabilities:['instructions','project-tools'],formatVersion:1}
 }
 return {discover,install}
}
