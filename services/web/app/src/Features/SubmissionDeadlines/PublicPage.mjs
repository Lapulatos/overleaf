import * as cheerio from 'cheerio'
import {HttpsProxyAgent} from 'https-proxy-agent'
import https from 'node:https'
import http from 'node:http'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
export function publicIPv4(address) {
 if(isIP(address)!==4)return false
 const [a,b]=address.split('.').map(Number)
 return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&[0,168].includes(b))||(a===100&&b>=64&&b<=127)||(a===198&&[18,19,51].includes(b))||(a===203&&b===0))
}
export function publicUrl(value,base){try{const u=new URL(value,base);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||u.hostname==='localhost'||u.hostname.endsWith('.local'))return null;return u.href}catch{return null}}
let sourceProxyPolicy={mode:'environment'}
export function setSourceProxyPolicy(policy){sourceProxyPolicy=policy}
export function configuredSourceProxy(url,env=process.env){
 const u=new URL(url);const noProxy=env.no_proxy||env.NO_PROXY||''
 if(noProxy.split(/[\s,]+/).some(rule=>{if(!rule)return false;if(rule==='*')return true;const [host,port]=rule.toLowerCase().split(':');if(port&&port!==(u.port||(u.protocol==='https:'?'443':'80')))return false;const domain=host.replace(/^\*?\./,'');return u.hostname===domain||((host.startsWith('.')||host.startsWith('*.'))&&u.hostname.endsWith('.'+domain))}))return null
 const value=(u.protocol==='https:'?(env.https_proxy||env.HTTPS_PROXY):(env.http_proxy||env.HTTP_PROXY))||env.all_proxy||env.ALL_PROXY
 if(!value)return null
 let proxy;try{proxy=new URL(value)}catch{throw new Error('Configured source proxy URL is invalid')}
 if(!['http:','https:'].includes(proxy.protocol))throw new Error('Configured source proxy protocol is unsupported')
 return proxy
}
export function pinnedProxyOptions(options,address,hostname){return {...options,host:address,servername:hostname}}
export async function fetchPublicPage(value,redirects=0,options={}){
 const url=publicUrl(value);if(!url||redirects>4)throw new Error('Unsupported source URL or redirect')
 const u=new URL(url);const addresses=await lookup(u.hostname,{family:4,all:true});if(!addresses.length||addresses.some(x=>!publicIPv4(x.address)))throw new Error('Source address is not public')
 const address=addresses[0].address
 const proxy=sourceProxyPolicy.mode==='direct'?null:sourceProxyPolicy.mode==='custom'?new URL(sourceProxyPolicy.proxy):configuredSourceProxy(url);const agent=proxy?new HttpsProxyAgent(proxy):undefined
 if(agent){const connect=agent.connect.bind(agent);agent.connect=(req,opts)=>connect(req,pinnedProxyOptions(opts,address,u.hostname))}
 return new Promise((resolve,reject)=>{
  let proxyFailure=false
  const req=(u.protocol==='https:'?https:http).get(u,{agent,family:4,lookup:(host,options,callback)=>options.all?callback(null,[{address,family:4}]):callback(null,address,4),headers:{'User-Agent':'PaperAssistant-SubmissionTracker/1.0','Accept':options.binary?'text/html,application/pdf,application/zip,application/octet-stream,*/*;q=0.8':'text/html,application/json','Accept-Encoding':'identity'}},res=>{
   if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){res.resume();resolve(fetchPublicPage(new URL(res.headers.location,url).href,redirects+1,options));return}
   if(res.statusCode!==200){res.resume();reject(Object.assign(new Error(`Source returned HTTP ${res.statusCode}`),{status:res.statusCode,url,proxyFailure,server:res.headers.server,challenge:res.headers['cf-mitigated']==='challenge'}));return}
   const chunks=[];let size=0
   res.on('data',chunk=>{size+=chunk.length;if(size>(options.binary?40000000:2000000)){req.destroy(new Error('Source exceeds download limit'));return}chunks.push(chunk)})
   res.on('error',reject);res.on('end',()=>resolve({url,...(options.binary?{bytes:Buffer.concat(chunks)}:{text:Buffer.concat(chunks).toString('utf8')}),contentType:res.headers['content-type']||''}))
  });req.on('proxyConnect',response=>{proxyFailure=response.statusCode!==200});const timer=setTimeout(()=>req.destroy(new Error('Source request timed out')),options.binary||options.extendedTimeout?25000:12000);req.on('close',()=>{clearTimeout(timer);agent?.destroy()});req.on('error',reject)
 })
}

export function sourceFailureDetails(error,requestedUrl){
 const status=Number(error.status)||Number(error.message?.match(/HTTP (\d{3})/)?.[1])||null
 const kind=error.proxyFailure?'proxy-access-denied':status===403?'access-denied':status===404?'not-found':status===429?'rate-limited':/ENOTFOUND|EAI_AGAIN/.test(error.code||error.message)?'dns':/timed?\s*out|ETIMEDOUT/i.test(error.code||error.message)?'timeout':'source-error'
 const explanation=kind==='proxy-access-denied'?'The configured proxy refused the connection. Check the proxy configuration; the origin template was not reached.':kind==='access-denied'?'The source server refused this request. This does not show that the template is missing. Access rules or automated-request protection may be involved; the exact cause is not confirmed.':kind==='not-found'?'This URL was not found. Follow the official author-guide links to locate the current template.':kind==='timeout'?'The source did not respond in time. This is distinct from a missing template or HTTP403.':kind==='dns'?'The source hostname could not be resolved. Check connectivity or try an official alternate source.':'The source could not be retrieved; no requirement was inferred from this failure.'
 return {error:error.message,url:publicUrl(error.url||requestedUrl)||null,httpStatus:status,kind,explanation,...(error.challenge?{challengeDetected:true}:{}),nextStep:'Try a linked official publisher or maintained template source. Do not repeatedly retry the same denied URL or bypass access controls. If current-edition rules are TBD, use the previous edition of the same track as an explicitly labelled provisional baseline; never present it as current verified policy.'}
}

export function readableSourcePage(html,url){
 const $=cheerio.load(html);$('script,style,svg,noscript,nav,header,footer').remove()
 $('a[href]').each((i,el)=>{const href=publicUrl($(el).attr('href'),url);if(href)$(el).append(` [${href}]`)})
 $('br').replaceWith('\n');$('p,div,section,h1,h2,h3,h4,li,tr').append('\n')
 const prioritized=[]
 $('[id]').each((i,el)=>{if(/call[-_ ]?for[-_ ]?papers|submission[-_ ]?(guidelines|instructions)|author[-_ ]?instructions/i.test($(el).attr('id')||'')&&$(el).text().length>100)prioritized.push($(el).text())})
 const normalize=text=>text.replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim()
 const body=normalize($('body').text()||$.root().text())
 const text=(prioritized.length?'Submission instructions section (prioritized):\n'+prioritized.map(normalize).join('\n')+'\n\nOther page content:\n':'')+body
 return {text:text.slice(0,80000),truncated:text.length>80000}
}
