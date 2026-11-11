import * as cheerio from 'cheerio'
import {fetchPublicPage} from './PublicPage.mjs'
export const metricKey = name => String(name || '').normalize('NFKC').toLowerCase().replace(/&/g,'and').replace(/[^\p{L}\p{N}]/gu,'')
const clean = value => value.replace(/\s+/g,' ').trim()
export function parseLetPub(html, source, expectedName, checked = new Date().toISOString()) {
 if(/请求页面的速度过快|请求期刊信息系统页面数据过于频繁/i.test(html))throw new Error('LetPub rate limit or verification required; retry later')
 const $=cheerio.load(html)
 // Hidden decoy values must never be treated as visible metric evidence.
 $('script,style,[hidden],[style]').each((i,e)=>{if(['script','style'].includes(e.tagName)||$(e).is('[hidden]')||/display\s*:\s*none|visibility\s*:\s*hidden/i.test($(e).attr('style')||''))$(e).remove()})
 const rows=[];$('tr').each((i,e)=>{const cells=$(e).children('td');const label=clean(cells.first().text());if(cells.length>1&&label.length<100)rows.push({label,cells:cells.slice(1),text:clean(cells.slice(1).text())})})
 const row=pattern=>rows.find(r=>pattern.test(r.label));const identity=row(/^期刊名字$/);const name=identity?.cells.find('a').first().text().trim()
 if(!name||metricKey(name)!==metricKey(expectedName))throw new Error('Journal identity does not match')
 const coverage=row(/SCI期刊收录coverage/)?.text||''
 const ifRow=row(/最新IF/);const ifValue=ifRow&&!/登录|注册/.test(ifRow.text)?Number(ifRow.text.match(/^\s*(\d+(?:\.\d+)?)/)?.[1]):NaN
 const jcrRow=row(/WOS期刊JCR分区/);const jcr=[]
 jcrRow?.cells.find('table').each((i,t)=>{if(!$(t).text().includes('JIF分区'))return;$(t).find('tr').each((j,tr)=>{const cells=$(tr).children('td');const texts=cells.map((k,c)=>clean($(c).text())).get();const q=texts.find(v=>/^Q[1-4]$/.test(v));if(q)jcr.push({category:texts[0].replace(/^学科[:：]\s*/,''),quartile:q,rank:texts.find(v=>/^\d+\s*\/\s*\d+$/.test(v))||null})})})
 const division=pattern=>{const r=row(pattern);if(!r)return null;const table=r.cells.find('table').first();const cells=table.children('tbody').children('tr').eq(1).children('td');const broad=clean(cells.first().text());const n=broad.match(/([1-4])区/);return n?{edition:r.label.match(/20\d\d/)?.[0]||null,division:Number(n[1]),category:broad.replace(/[1-4]区/g,'').trim()}:null}
 return {name,source,checked,issn:row(/^期刊ISSN$/)?.text.match(/\d{4}-[\dX]{4}/)?.[0]||null,sci:/Science Citation Index Expanded|\bSCIE\b/.test(coverage)?'SCIE':/Science Citation Index/.test(coverage)?'SCI':'Not verified',ei:/Engineering Index|Compendex/.test(coverage)?'Indexed':'Not verified',jif:Number.isFinite(ifValue)?{value:ifValue,edition:ifRow.label.match(/20\d\d(?:-20\d\d)?/)?.[0]||null}:null,jcr,jcrEdition:jcrRow?.label.match(/20\d\d(?:-20\d\d)?/)?.[0]||null,cas:division(/^期刊分区表.*2025/),xinrui:division(/新锐期刊分区表/),access:/登录|注册/.test((ifRow?.text||'')+(jcrRow?.text||''))?'login-required':'public',status:'matched'}
}
export async function queryLetPub(venue,{fetcher=fetchPublicPage,previous}={}) {
 if(venue.kind!=='journal')return {name:venue.description,status:'edition-evidence-required',checked:new Date().toISOString(),eiProceedings:'Not verified',eiPaper:'Not verified'}
 let source=previous?.source
 if(!source||!/^https:\/\/www\.letpub\.com\.cn\/index\.php\?/.test(source)){
  const search='https://www.letpub.com.cn/index.php?page=journalapp&view=search&searchname='+encodeURIComponent(venue.description)
  const result=await fetcher(search);if(/请求页面的速度过快|请求期刊信息系统页面数据过于频繁/i.test(result.text))throw new Error('LetPub rate limit or verification required; retry later');const $=cheerio.load(result.text);const matches=[]
  $('a[href*="journalid="]').each((i,a)=>{if(metricKey($(a).text())===metricKey(venue.description)){const url=new URL($(a).attr('href'),'https://www.letpub.com.cn/');if(url.origin==='https://www.letpub.com.cn')matches.push(url.href)}})
  const unique=[...new Set(matches)];if(unique.length!==1)return {name:venue.description,status:unique.length?'ambiguous':'not-found',source:search,checked:new Date().toISOString()}
  source=unique[0]
 }
 const result=await fetcher(source);return parseLetPub(result.text,source,venue.description)
}
