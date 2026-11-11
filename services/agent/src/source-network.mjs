import {readFile,writeFile,rename,mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {fetchPublicPage,sourceFailureDetails,setSourceProxyPolicy,publicUrl} from '../../web/app/src/Features/SubmissionDeadlines/PublicPage.mjs'
const fail=(status,message)=>Object.assign(new Error(message),{status})
export async function createSourceNetwork(config,{fetcher=fetchPublicPage,applyPolicy=setSourceProxyPolicy}={}){
 if(!config.maintenanceConfig)return null
 const operator=JSON.parse(await readFile(config.maintenanceConfig,'utf8'))
 if(!/^[a-f0-9]{24}$/.test(operator.ownerUserId)||!operator.stateDirectory)throw Error('Invalid network owner configuration')
 const statePath=join(operator.stateDirectory,'source-network.json');await mkdir(operator.stateDirectory,{recursive:true,mode:0o700})
 let state={mode:'environment',url:'',username:'',password:''},saving=false
 try{state={...state,...JSON.parse(await readFile(statePath,'utf8'))}}catch(e){if(e.code!=='ENOENT')throw e}
 const apply=()=>{if(state.mode!=='custom')return applyPolicy({mode:state.mode});const proxy=new URL(state.url);proxy.username=state.username;proxy.password=state.password;applyPolicy({mode:'custom',proxy:proxy.href})}
 apply()
 const check=user=>{if(user!==operator.ownerUserId)throw fail(403,'Only the configured computer owner may manage source proxy settings')}
 const publicState=()=>({mode:state.mode,url:state.url,username:state.username,hasPassword:Boolean(state.password),environmentProxyConfigured:['https_proxy','HTTPS_PROXY','all_proxy','ALL_PROXY'].some(k=>Boolean(process.env[k]))})
 return {
  status(user){check(user);return publicState()},
  async save(user,input){check(user);if(saving)throw fail(409,'Proxy settings are being saved');if(!['environment','direct','custom'].includes(input.mode))throw fail(400,'Select a valid proxy mode')
   if(['url','username','password'].some(k=>input[k]!==undefined&&typeof input[k]!=='string'))throw fail(400,'Proxy fields must be text')
   const url=String(input.url||'').trim();if(url){let u;try{u=new URL(url)}catch{throw fail(400,'Enter a valid HTTP or HTTPS proxy URL')};if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash||!['','/'].includes(u.pathname))throw fail(400,'Use an HTTP/HTTPS proxy address only; enter credentials in the separate fields')}
   if(input.mode==='custom'&&!url)throw fail(400,'A proxy address is required')
   const username=String(input.username||'');const password=input.clearPassword?'':input.password||((url===state.url&&username===state.username)?state.password:'')
   if(url.length>2000||username.length>256||String(password).length>1024)throw fail(400,'Proxy settings exceed supported length')
   saving=true;try{const next={mode:input.mode,url,username,password};const temp=statePath+'.'+randomUUID();await writeFile(temp,JSON.stringify(next),{mode:0o600,flag:'wx'});await rename(temp,statePath);state=next;apply();return publicState()}finally{saving=false}
  },
  async test(user,url='https://conf.researchr.org/'){check(user);if(!publicUrl(url))throw fail(400,'Use a public HTTP/HTTPS source URL');const started=Date.now();try{const result=await fetcher(url,0,{binary:true});return {ok:true,url:result.url,httpStatus:200,elapsedMs:Date.now()-started,mode:state.mode}}catch(error){const detail=sourceFailureDetails(error,url);return {ok:false,url:detail.url,httpStatus:detail.httpStatus,kind:detail.kind,message:detail.explanation,elapsedMs:Date.now()-started,mode:state.mode}}}
 }
}
