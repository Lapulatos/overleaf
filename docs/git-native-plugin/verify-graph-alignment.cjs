const {chromium}=require('/Users/sujie/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');const fs=require('fs'),assert=require('assert');
(async()=>{const b=await chromium.launch({headless:true});try{
 const p=await b.newPage({viewport:{width:1100,height:500},timezoneId:'Asia/Shanghai'});await p.setContent('<div id="app"></div>');await p.addStyleTag({content:fs.readFileSync('/tmp/native-git-r49-date.css','utf8')});await p.addScriptTag({content:fs.readFileSync('/tmp/native-git-r49-date.js','utf8')});await p.locator('.native-git-commit-date').waitFor();
 for(const width of [800,1100,1500]){
  await p.setViewportSize({width,height:500});
  const result=await p.evaluate(()=>{
   const headers=[...document.querySelectorAll('.native-git-graph-columns > span')];
   const cells=['date','author','hash'].map(key=>document.querySelector('.native-git-commit-'+key));
   return {headers:headers.map(e=>getComputedStyle(e).textAlign),data:cells.map(e=>getComputedStyle(e).textAlign),centerDelta:cells.map((e,i)=>{const a=e.getBoundingClientRect(),h=headers[i+2].getBoundingClientRect();return Math.abs(a.x+a.width/2-h.x-h.width/2)}),authorTitle:cells[1].title,ellipsis:getComputedStyle(cells[1]).textOverflow}
  });
  assert.deepEqual(result.headers,['center','left','center','center','center']);assert.deepEqual(result.data,['center','center','center']);assert.ok(result.centerDelta.every(v=>v<1));assert.equal(result.authorTitle,'Author');assert.equal(result.ellipsis,'ellipsis');console.log(width,JSON.stringify(result));
 }
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)})
