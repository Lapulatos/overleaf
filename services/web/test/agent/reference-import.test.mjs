import test from 'node:test'
import assert from 'node:assert/strict'
import { parseReferenceFile } from '../../app/src/Features/WritingAssist/WritingAssistReferenceImport.mjs'

test('RIS imports repeated authors, page ranges, abstract, publisher and multiple records',()=>{
 const input='TY  - CPAPER\nAU  - Farzan, Azadeh\nAU  - Klumpp, Dominik\nTI  - Sound & safe\nPY  - 2022/06/09\nT2  - Proceedings of PLDI\nSP  - 506\nEP  - 521\nPB  - ACM\nCY  - New York\nDO  - 10.1145/3519939.3523727\nSN  - 9781450392655\nAB  - First line\n  continuation\nER  -\n\nTY  - JOUR\nTI  - Second\nER  -'
 const parsed=parseReferenceFile(input);assert.equal(parsed.format,'RIS');assert.equal(parsed.entries.length,2)
 const f=parsed.entries[0].fields
 assert.equal(parsed.entries[0].type,'inproceedings');assert.equal(f.author,'Farzan, Azadeh and Klumpp, Dominik');assert.equal(f.pages,'506--521');assert.equal(f.abstract,'First line continuation');assert.equal(f.title,'Sound \\& safe');assert.equal(f.isbn,'9781450392655')
})
test('EndNote tagged text retains bibliography fields and normalizes ranges',()=>{
 const p=parseReferenceFile('%0 Journal Article\n%A Cao, A\n%A Smith, B\n%T Spiking\n%D 2024\n%J Journal\n%P 1–9\n%@ 1234-5678\n%R 10.1234/a\n%X Abstract\n')
 assert.equal(p.format,'EndNote tagged');assert.equal(p.entries[0].fields.issn,'1234-5678');assert.equal(p.entries[0].fields.pages,'1--9')
})
test('CSL-JSON converts literal fields and reports unmapped data without inventing missing values',()=>{
 const p=parseReferenceFile(JSON.stringify([{type:'paper-conference',title:'A {test} 50%',author:[{family:'Cao',given:'A'}],issued:{'date-parts':[[2024,5]]},'container-title':'Proceedings',ISBN:'123',DOI:'10.1234/a',page:'1-2',custom:'not silently dropped'}]))
 assert.equal(p.entries[0].fields.title,'A \\{test\\} 50\\%');assert.equal(p.entries[0].fields.month,'5');assert.equal(p.entries[0].fields.publisher,undefined);assert.match(p.warnings[0],/custom/)
})
test('BibTeX preserves existing raw fields and recognizes clipboard HTML',()=>{
 const p=parseReferenceFile('@article{x,title={Title},custom={Kept}}<a><svg>data:xxx</svg></a>')
 assert.equal(p.format,'BibTeX');assert.equal(p.entries[0].fields.custom,'Kept');assert.equal(p.markup.length,1)
})
test('rejects truncated RIS, malformed JSON, titleless records, unsupported formats and oversized imports',()=>{
 for(const input of ['TY  - JOUR\nTI  - Truncated','{bad}','%0 Journal Article\n%A Person\n','<xml>Unknown</xml>','x'.repeat(200001)]) assert.throws(()=>parseReferenceFile(input),{status:422})
 assert.throws(()=>parseReferenceFile(Array.from({length:51},(_,i)=>`@article{x${i},title={T}}`).join('\n')),{status:422})
})
