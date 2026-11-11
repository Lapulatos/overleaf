import test from 'node:test'
import assert from 'node:assert/strict'
import {conversionFiles,conversionNaming,conversionNamingIssues} from '../../app/src/Features/SubmissionDeadlines/ConversionArchive.mjs'
const snapshot={documents:[{path:'main.tex',content:'original'}],assets:[{path:'figures/image.png',data:Buffer.from([0,255,12,4]).toString('base64')}]}
test('packages changed text and new styles while preserving frozen original and binary assets',()=>{const files=conversionFiles(snapshot,[{path:'main.tex',before:'original',after:'converted'},{path:'target.cls',before:'',after:'style'}],'## Converted\nStyle only');assert.equal(files.get('main.tex').toString(),'converted');assert.equal(snapshot.documents[0].content,'original');assert.deepEqual(files.get('figures/image.png'),Buffer.from([0,255,12,4]));assert.ok(files.get('CONVERSION-REPORT.md').toString().includes('Original project unchanged'));assert.equal(files.get('target.cls').toString(),'style')})
test('refuses unsafe paths, stale patches, collisions and deletion',()=>{for(const proposal of [{path:'../escape.tex',before:'',after:'bad'},{path:'main.tex',before:'wrong',after:'bad'},{path:'main.tex',before:'original',after:'',mode:'delete-document'},{path:'figures/image.png',before:'',after:'bad'}])assert.throws(()=>conversionFiles(snapshot,[proposal],''))})
test('preserves existing report file by choosing a new name',()=>{const files=conversionFiles({...snapshot,documents:[...snapshot.documents,{path:'CONVERSION-REPORT.md',content:'user report'}]},[],'new report');assert.equal(files.get('CONVERSION-REPORT.md').toString(),'user report');assert.ok(files.has('CONVERSION-REPORT-1.md'))})

test('moves original images only inside the new package without altering their bytes',()=>{const manifest={path:'submission-layout.json',before:'',after:JSON.stringify({moves:[{from:'figures/image.png',to:'figures/src/image.png'}]})};const files=conversionFiles(snapshot,[manifest],'Moved image');assert.equal(files.has('figures/image.png'),false);assert.deepEqual(files.get('figures/src/image.png'),Buffer.from([0,255,12,4]));assert.equal(snapshot.assets[0].path,'figures/image.png')})
test('rejects unsafe, missing, chained and destructive relocation mappings',()=>{for(const moves of [[{from:'figures/image.png',to:'../image.png'}],[{from:'missing.tex',to:'tex/01.tex'}],[{from:'main.tex',to:'figures/image.png'}],[{from:'main.tex',to:'a.tex'},{from:'a.tex',to:'main.tex'}]])assert.throws(()=>conversionFiles(snapshot,[{path:'submission-layout.json',before:'',after:JSON.stringify({moves})}],''))})
test('allows an identical staged copy but refuses to overwrite a preexisting user manifest',()=>{const manifest={path:'submission-layout.json',before:'',after:JSON.stringify({moves:[{from:'main.tex',to:'tex/body.tex'}]})};const files=conversionFiles(snapshot,[{path:'tex/body.tex',before:'',after:'original'},manifest],'');assert.equal(files.get('tex/body.tex').toString(),'original');assert.equal(files.has('main.tex'),false);assert.throws(()=>conversionFiles({...snapshot,documents:[...snapshot.documents,{path:'submission-layout.json',content:'{}'}]},[{...manifest,before:'{}'}],''))})

test('protects the configured root manuscript path during relocation',()=>{assert.throws(()=>conversionFiles({...snapshot,rootPath:'main.tex'},[{path:'submission-layout.json',before:'',after:JSON.stringify({moves:[{from:'main.tex',to:'tex/main.tex'}]})}],''))})

test('preserves support scripts and Makefiles without admitting them as model patches',()=>{const source={...snapshot,preservedDocuments:[{path:'Makefile',content:'all:\n\tlatexmk main.tex'},{path:'checks/verify.py',content:'print(1)'}],documents:[...snapshot.documents,{path:'figures/plot.tikz',content:'tikz'}]};const files=conversionFiles(source,[{path:'figures/plot.tikz',before:'tikz',after:'updated tikz'}],'');assert.equal(files.get('Makefile').toString(),source.preservedDocuments[0].content);assert.equal(files.get('checks/verify.py').toString(),'print(1)');assert.equal(files.get('figures/plot.tikz').toString(),'updated tikz');assert.throws(()=>conversionFiles({...snapshot,preservedDocuments:[{path:'../escape',content:'bad'}]},[],''));assert.throws(()=>conversionFiles(source,[{path:'Makefile',before:source.preservedDocuments[0].content,after:'changed'}],''))})
test('generated report avoids case-insensitive filename collisions with model reports',()=>{const files=conversionFiles(snapshot,[{path:'conversion-report.md',before:'',after:'AI report'}],'Server report');assert.equal(files.get('conversion-report.md').toString(),'AI report');assert.ok(files.has('CONVERSION-REPORT-1.md'));assert.equal(new Set([...files.keys()].map(p=>p.toLowerCase())).size,files.size)})

test('relocates the main document only to the explicit target root and preserves bibliography bytes',()=>{
 const source={...snapshot,rootPath:'fse27-opt/main.tex',exportRootPath:'tosem27/main.tex',documents:[{path:'fse27-opt/main.tex',content:'\\bibliography{tosem27-ref}'},{path:'fse27-opt/FSE27-REF.bib',content:'@article{key,title={Original title}}'}]}
 const moves=[{from:'fse27-opt/main.tex',to:'tosem27/main.tex'},{from:'fse27-opt/FSE27-REF.bib',to:'tosem27/tosem27-ref.bib'}]
 const files=conversionFiles(source,[{path:'submission-layout.json',before:'',after:JSON.stringify({moves})}],'')
 assert.equal([...files.keys()].some(p=>p.startsWith('fse27-opt/')),false)
 assert.equal(files.get('tosem27/tosem27-ref.bib').toString(),source.documents[1].content)
 assert.throws(()=>conversionFiles({...source,exportRootPath:'other/main.tex'},[{path:'submission-layout.json',before:'',after:JSON.stringify({moves})}],''))
})

test('target names are lowercase and use the target year, not the source year',()=>{
 const naming=conversionNaming({title:'TOSEM',year:2027},'fse26-opt/main.tex')
 assert.equal(naming.bibliography,'tosem27-ref.bib')
 assert.equal(naming.rootPath,'tosem27/main.tex')
 assert.equal(conversionNaming({title:'TOSEM'},'main.tex',2028).bibliography,'tosem28-ref.bib')
 assert.equal(conversionNamingIssues(new Map([['tosem27/main.tex',Buffer.from('')],['tosem27/tosem27-ref.bib',Buffer.from('')]]),naming).length,0)
 assert.equal(conversionNamingIssues(new Map([['fse26-opt/main.tex',Buffer.from('')],['FSE27-REF.bib',Buffer.from('')]]),naming).length,3)
})
