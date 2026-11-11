import {compilationEvidence,sourceFailure} from '@overleaf/validation-tools/agent-tool-evidence.mjs'
import {createHash} from 'node:crypto'

export const requiredChecks = ['submission-stage','document-class','class-options','anonymity','front-matter','layout','bibliography','figures-tables','supplements','pdf']
export const complianceInstructions = `
MANDATORY SUBMISSION COMPLIANCE AUDIT (all target publishers, not just ACM):
When current-edition author instructions are TBD or not published, the user authorizes converting using the PREVIOUS YEAR's official instructions for the SAME venue and submission track/stage. Find and read those official pages, apply their verified class/options, anonymity, bibliography and other format rules to this new draft. Do not merely retain the source's unrelated template settings. Current-year explicit requirements override previous-year rules; only fill missing rules from last year. Clearly state the actual year and URL for every inherited rule and mark it provisional, not current compliance. If last year's same-track rules are also unavailable, mark unresolved; do not invent them.
Before editing, read the official author instructions for the exact venue, track and initial/revised submission stage. Build a requirement matrix. A generic publisher sample is not proof of venue-specific anonymity or submission mode. Record conflicts and inaccessible sources as unverified. Review source documentclass/options (including review, anonymous, manuscript, sigconf and journal switches where applicable), author/affiliation/acknowledgment blocks, PDF author metadata, running heads, self-identifying links/supplements, columns/margins/fonts/spacing, bibliography engine/style/citation format, figure/table/caption conventions, appendix and supplementary packaging. Preserve author identities in the original; never invent author metadata. Do not remove required packages or shrink text to force compilation. Page/word limits are advisory only.
After converting, do a SECOND audit against the actual final files and compiled PDF, not your intended edits. Repair every verified mismatch you can in the isolated package and recompile after changes. Recheck anonymity across included files and PDF metadata, documentclass and all options, target stage and bibliography. Do not equate compilation success with submission compliance. If requirements remain unknown or conflicting, finish an explicitly provisional draft with concrete next actions, not a claim of compliance.
Create or update submission-compliance.json in the new package, schema:
{"version":1,"venueId":"TARGET_ID","stage":"initial submission (or exact applicable stage)","rootPath":"actual/root.tex","documentClass":{"name":"actual-class","options":["actual","options"]},"files":[{"path":"actual/root.tex","sha256":"SHA256_OF_FINAL_BYTES"}],"checks":[{"id":"submission-stage","status":"passed|failed|unverified|not-applicable","requirement":"exact applicable rule","before":"what source manuscript did","after":"what final files/PDF do","files":["actual/root.tex"],"sources":[{"url":"official fetched URL","quote":"short supporting excerpt"}],"action":"fix made or precise user action","severity":"error|warning|success","basis":{"kind":"current-edition|previous-edition","year":2026,"url":"official rule URL"}}]}
Include every check ID: ${requiredChecks.join(', ')}. Every check needs a concrete requirement, before/after observations, exact affected project paths (with line references in the narrative), next action, severity and basis. Error/red: known format violation, missing critical assets, failed compilation or blocked mandatory setting. Warning/yellow: provisional previous-year rules, unverified constraints, missing metadata or nonblocking issues. Success/green: completed and checked changes. Never mark a previous-edition rule as verified for the target year. Include a separate changes array of numbered concrete implemented changes, each with id, title, before, after, files and action; these are completed edits, not claims of submission eligibility. Include an advisory item for unenforced page/word limits. No file changes is not a reason to omit the check: identify the file to inspect or explain that the item concerns the submission portal. Passed and not-applicable require official evidence; not-applicable is allowed only for supplements. Include hashes for ALL final .tex/.cls/.sty/.bst/.bbx/.cbx/.bib/.cfg/.def/.clo/.fd/.tikz/.pgf files (including unchanged files); exclude this JSON itself. Use final exported paths after submission-layout.json moves, not duplicate staging copies. Every passed check references inspected files. Use fetch_public_source for every cited URL. Record page/word limits separately as advisory, never passed enforcement. If an existing audit belongs to another target, replace it only in this isolated output. The server validates evidence presence, file hashes and literal root documentclass/options; unresolved checks prevent automatic import but do not stop useful draft export.
In your Markdown report add a Submission checks table with requirement, before, after, status, official source and file/line references; include actionable diffs in proposals. List remaining manual policy checks (authorship approval, conflicts, ethics, disclosure, permissions) without claiming to verify facts outside the manuscript.
`

// This validates the AI audit's coverage and binding to output bytes, not the truth
// of publisher policy. The UI deliberately calls it an AI audit, not certification.
export function assessCompliance(files, task, venueId, rootPath) {
 const issues=[];const compilation=compilationEvidence(task.activity);let audit
 try {audit=JSON.parse(files.get('submission-compliance.json')?.toString()||'null')}catch{}
 if(!audit||audit.version!==1||audit.venueId!==venueId||typeof audit.stage!=='string'||!audit.stage.trim())return {ready:false,issues:['Missing or invalid target-specific submission audit.'],checks:[],changes:[],compilation}
 const rootMismatch=audit.rootPath!==rootPath
 if(rootMismatch)issues.push(`Entry file mismatch: the project uses ${rootPath}, but the audit checked ${audit.rootPath}.`)
 const fetched=new Set()
 for(const item of task.activity||[])if(item.kind==='tool'&&['Read official source / template','fetch_public_source'].includes(item.title)&&item.status==='completed'&&!sourceFailure(item)){
  // Activity output may be truncated: the leading URL still identifies the fetched source.
  const match=item.output?.match(/^\s*\{\s*"url"\s*:\s*("(?:[^"\\]|\\.)*")/)
  if(match)try{fetched.add(JSON.parse(match[1]))}catch{}
 }
 const audited=new Map((Array.isArray(audit.files)?audit.files:[]).filter(f=>f&&typeof f.path==='string').map(f=>[f.path,f.sha256]))
 for(const [name,bytes] of files)if(/\.(tex|cls|sty|bst|bbx|cbx|bib|cfg|def|clo|fd|tikz|pgf)$/i.test(name)&&audited.get(name)!==createHash('sha256').update(bytes).digest('hex'))issues.push(`Final file was not audited or changed after audit: ${name}`)
 const checks=[]
 for(const id of requiredChecks){
  const matches=Array.isArray(audit.checks)?audit.checks.filter(c=>c?.id===id):[];const check=matches[0]
  let valid=matches.length===1&&['requirement','before','after','action'].every(k=>typeof check[k]==='string'&&check[k].trim())
  valid=valid&&(check.status==='passed'||(id==='supplements'&&check.status==='not-applicable'))
  valid=valid&&Array.isArray(check.sources)&&check.sources.length>0&&check.sources.every(s=>s&&fetched.has(s.url)&&typeof s.quote==='string'&&s.quote.trim())
  valid=valid&&Array.isArray(check.files)&&check.files.length>0&&check.files.every(p=>files.has(p)&&audited.has(p))
  const provisional=check?.basis?.kind==='previous-edition'
  if(provisional)issues.push(`${id}: uses previous-edition requirements; current-year confirmation is pending.`)
  if(!valid)issues.push(`${id}: failed, unverified or missing source/file evidence.`)
  checks.push({id,status:provisional?'provisional':valid?check.status:check?.status==='failed'?'failed':'unverified',severity:provisional?'warning':valid?'success':check?.status==='failed'?'error':check?.severity==='error'?'error':'warning',requirement:typeof check?.requirement==='string'?check.requirement:'',before:typeof check?.before==='string'?check.before:'Not recorded.',after:typeof check?.after==='string'?check.after:'Not verified.',files:Array.isArray(check?.files)?check.files.filter(p=>typeof p==='string'):[],sources:Array.isArray(check?.sources)?check.sources.filter(s=>s&&typeof s.url==='string').map(s=>({url:s.url,quote:typeof s.quote==='string'?s.quote:''})):[],basis:check?.basis&&{kind:provisional?'previous-edition':'current-edition',year:Number.isInteger(check.basis.year)?check.basis.year:undefined,url:typeof check.basis.url==='string'?check.basis.url:undefined},action:typeof check?.action==='string'?check.action:'Review official instructions and final files.'})
 }
 const root=files.get(rootPath)?.toString().replace(/(?<!\\)%[^\n]*/g,'')||''
 const classes=[...root.matchAll(/\\documentclass\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/g)]
 const actual=classes[0];const expected=audit.documentClass
 const options=actual?(actual[1]||'').split(',').map(s=>s.trim()).filter(Boolean).sort():[]
 if(classes.length!==1||expected?.name!==actual?.[2]?.trim()||!Array.isArray(expected?.options)||JSON.stringify([...expected.options].sort())!==JSON.stringify(options))issues.push('Root documentclass/options do not match the audit; indirect or conditional classes need manual review.')
 if(!compilation.inspected)issues.push('The final compiled PDF has not been inspected.')
 if(!compilation.compiled)issues.push('Successful compilation is not recorded.')
 if(rootMismatch)checks.unshift({id:'entry-file',status:'failed',severity:'error',requirement:'Compile and audit the project-selected entry file.',before:`Project entry: ${rootPath}`,after:`Audit entry: ${audit.rootPath}`,files:[rootPath,audit.rootPath].filter(p=>typeof p==='string'),action:`Re-run conversion using ${rootPath} as the entry file; update its template and inputs, then compile and audit that same path.`})
 const changes=(Array.isArray(audit.changes)?audit.changes:[]).filter(c=>c&&typeof c.title==='string'&&typeof c.after==='string').slice(0,80).map((c,i)=>({id:`change-${i+1}`,title:c.title,before:typeof c.before==='string'?c.before:'Not recorded.',after:c.after,files:Array.isArray(c.files)?c.files.filter(p=>typeof p==='string'):[],action:typeof c.action==='string'?c.action:'Review the package diff.'}))
 return {ready:task.status==='completed'&&issues.length===0,issues,checks,changes,compilation}
}
