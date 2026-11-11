import {readFileSync} from 'node:fs'
export const ccfDirectory=JSON.parse(readFileSync(new URL('./data/ccf-2026.json',import.meta.url)))
export const xidianDirectory=JSON.parse(readFileSync(new URL('./data/xidian-2025.json',import.meta.url)))
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
const areaCodes={'计算机体系结构/并行与分布计算/存储系统':'DS','计算机网络':'NW','网络与信息安全':'SC','软件工程/系统软件/程序设计语言':'SE','数据库/数据挖掘/内容检索':'DB','计算机科学理论':'CT','计算机图形学与多媒体':'CG','人工智能':'AI','人机交互与普适计算':'HI','交叉/综合/新兴':'MX'}
const aliases={'esecfse':'fse','usenixatc':'acmsigopsatc原usenixatc','nips':'neurips'}
export function classifyVenue(venue){
 const title=norm(venue.title);const names=[norm(venue.description),title];const candidates=ccfDirectory.entries.filter(e=>e.kind===venue.kind&&(names.includes(norm(e.name))||norm(e.abbreviation)===(aliases[title]||title)))
 const scoped=candidates.filter(e=>areaCodes[e.area]===venue.area);const match=candidates.length===1?candidates[0]:scoped.length===1?scoped[0]:null
 const ccf={edition:2026,status:match?'matched':candidates.length?'ambiguous':'unmatched',rank:match?.rank||null,page:match?.page||null,sha256:ccfDirectory.sha256,source:'/writing-assist/directories/ccf-2026',area:match?.area||null}
 const table=xidianDirectory.entries.filter(e=>names.includes(norm(e.name))||match&&norm(match.name)===norm(e.name));const eligible=table.filter(e=>e.section==='顶尖成果'||e.section.startsWith('工学'))
 const priority={'顶尖成果A类':0,'顶尖成果B类':1,'1类贡献度':2,'2类贡献度':3,'3类贡献度':4};const choices=eligible.map(e=>({category:e.category,basis:`附表：${e.section}`,page:e.page}))
 if(match)choices.push({category:xidianDirectory.rules.ccfEngineering[match.rank],basis:`工学类 CCF ${match.rank}；附件2采用最新推荐目录，当前依据CCF 2026`,page:match.rank==='A'?3:4})
 // Explicit conference exceptions stated in the policy; no inferred journal quartiles.
 if(venue.kind==='conference'&&['crypto','eurocrypt','asiacrypt'].includes(title))choices.push({category:title==='asiacrypt'?'顶尖成果B类':'顶尖成果A类',basis:'政策正文顶尖成果明确列举的密码会议',page:3})
 if(venue.kind==='conference'&&['iclr','iedm','isscc','vlsi'].includes(title))choices.push({category:'1类贡献度',basis:'政策正文明确列举的工学类会议',page:3})
 choices.sort((a,b)=>priority[a.category]-priority[b.category]);const chosen=choices[0]
 const xidian={edition:2025,label:chosen?`西电 ${chosen.category}（条件认定）`:'西电贡献度待核对',category:chosen?.category||null,basis:chosen?.basis||'未匹配附表或工学CCF规则；未据此判定为不认可',page:chosen?.page||null,source:'/writing-assist/directories/xidian-2025',conditions:['仅供投稿前候选判断，须核实适用学科及学校实际认定。','第一署名单位须为西安电子科技大学；2025-01-01起正式发表适用。','SCI/SSCI按发表当年中科院大类分区及Article/Letter/Review类型认定；预警、降级和删除规则优先。','多项条件就高认定、只计一次；认定时仍需核对最新目录。'],rulesPage:32}
 return {...venue,rank:ccf.rank,ranks:{...venue.ranks,ccf:ccf.rank},ccf,xidian}
}
export function includeDirectoryVenues(venues){
 const result=venues.map(classifyVenue)
 for(const [i,e] of ccfDirectory.entries.entries()){
  if(result.some(v=>v.kind===e.kind&&v.ccf.status==='matched'&&v.ccf.page===e.page&&(norm(v.title)===norm(e.abbreviation)||norm(v.description)===norm(e.name))))continue
  const v=classifyVenue({id:`ccf2026-${e.kind}-${i}`,title:e.abbreviation||e.name,description:e.name,kind:e.kind,area:areaCodes[e.area],year:null,round:'Directory entry · dates not announced',website:null,sourceUrl:e.url,events:[]});result.push(v)
 }
 return result.map(v=>v.kind==='journal'&&/^Discover Computing\s*[（(]/i.test(v.description)?{...v,title:'Discover Computing',description:'Discover Computing',formerName:'Information Retrieval Journal'}:v)
}
