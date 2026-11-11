import { validateProjectPath } from '@overleaf/validation-tools/project-input.mjs'
export function validateArchivePath(name) {
 // eslint-disable-next-line no-control-regex -- Archive paths must reject control characters.
 if(typeof name!=='string'||name.length>240||/[\\\x00-\x1f\x7f]/.test(name)||name.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Unsafe archive path')
}
export function conversionFiles(snapshot,proposals,summary){
 const files=new Map()
 for(const doc of snapshot.preservedDocuments||[]){validateArchivePath(doc.path);if(files.has(doc.path))throw Error('Duplicate preserved path');files.set(doc.path,Buffer.from(doc.content))}
 for(const doc of snapshot.documents){validateProjectPath(doc.path,true);if(files.has(doc.path))throw Error('Duplicate snapshot path');files.set(doc.path,Buffer.from(doc.content))}
 for(const asset of snapshot.assets){validateProjectPath(asset.path,true);if(files.has(asset.path))throw Error('Duplicate asset path');files.set(asset.path,Buffer.from(asset.data,'base64'))}
 for(const proposal of proposals){validateProjectPath(proposal.path,true);if(proposal.mode==='delete-document')throw Error('Style conversion cannot delete manuscript files');const previous=files.get(proposal.path);if(previous?previous.toString()!==proposal.before:proposal.before!=='')throw Error('Conversion patch does not match the frozen source');files.set(proposal.path,Buffer.from(proposal.after))}
 const layout=proposals.find(p=>p.path==='submission-layout.json')
 if(layout){
  if(snapshot.documents.some(d=>d.path===layout.path)||snapshot.assets.some(a=>a.path===layout.path))throw Error('Reserved layout manifest already exists; original file must be preserved')
  const manifest=JSON.parse(layout.after);if(!Array.isArray(manifest.moves)||manifest.moves.length>200)throw Error('Invalid layout moves')
  const sources=new Set();const targets=new Set();const moves=[]
  for(const move of manifest.moves){validateProjectPath(move.from,true);validateProjectPath(move.to,true);if((move.from===snapshot.rootPath&&move.to!==snapshot.exportRootPath)||move.from===move.to||move.from==='submission-layout.json'||move.to==='submission-layout.json'||sources.has(move.from)||targets.has(move.to))throw Error('Duplicate or invalid relocation');sources.add(move.from);targets.add(move.to);const bytes=files.get(move.from);if(!bytes)throw Error('Relocation source missing');const destination=files.get(move.to);if(destination&&!destination.equals(bytes))throw Error('Relocation destination would overwrite different content');moves.push({...move,bytes})}
  if([...sources].some(source=>targets.has(source)))throw Error('Chained or cyclic relocations are not supported')
  for(const move of moves){files.delete(move.from);files.set(move.to,move.bytes)}
 }
 const names=new Set([...files.keys()].map(name=>name.toLowerCase()))
 let report='CONVERSION-REPORT.md';for(let i=1;names.has(report.toLowerCase());i++)report=`CONVERSION-REPORT-${i}.md`
 files.set(report,Buffer.from('# Manuscript style conversion\n\nOriginal project unchanged. This is a separate draft package. Page and word limits were intentionally not enforced. Review the report and compile the imported project before submission.\n\n'+summary+((snapshot.preservedDocuments||[]).length?'\n\n## Preserved auxiliary files\nThese original support files were retained unchanged (not executed or edited by AI):\n'+snapshot.preservedDocuments.map(d=>'- '+d.path).join('\n'):'')))
 return files
}

export function conversionNaming(venue,sourceRoot,year=new Date().getFullYear()){
 const acronym=venue.title.toLowerCase().replace(/[^a-z0-9]+/g,'').replace(/20\d{2}$/,'')
 if(!acronym)throw Error('Target venue has no usable package name')
 const targetYear=Number(venue.year)||year
 const prefix=`${acronym}${String(targetYear).slice(-2)}`
 const sourceDirectory=sourceRoot.includes('/')?sourceRoot.slice(0,sourceRoot.lastIndexOf('/')):''
 return {prefix,year:targetYear,sourceRoot,sourceDirectory,rootPath:`${prefix}/main.tex`,bibliography:`${prefix}-ref.bib`}
}
export function conversionNamingIssues(files,naming){
 if(!naming)return []
 const issues=[]
 if(!files.has(naming.rootPath))issues.push(`Target entry file is missing: ${naming.rootPath}`)
 if(naming.sourceDirectory&&naming.sourceDirectory!==naming.prefix&&[...files.keys()].some(p=>p.startsWith(naming.sourceDirectory+'/')))issues.push(`Source project directory remains in the exported package: ${naming.sourceDirectory}`)
 const bibs=[...files.keys()].filter(p=>p.toLowerCase().endsWith('.bib'))
 for(const file of bibs){const name=file.split('/').pop();if(name!==naming.bibliography&&!(name.startsWith(naming.prefix+'-ref-')&&/^[a-z0-9.-]+\.bib$/.test(name)))issues.push(`Rename bibliography ${file} to ${naming.bibliography} (use numbered lowercase suffixes for additional databases) and update its LaTeX references`)}
 return issues
}
