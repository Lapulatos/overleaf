const fs=require('fs'),path=require('path'),parser=require('@babel/parser');
const root='services/web/frontend/js/features/source-control';const rows=[];
for(const file of fs.readdirSync(root).filter(x=>x.endsWith('.tsx'))){
 const source=fs.readFileSync(path.join(root,file),'utf8'),ast=parser.parse(source,{sourceType:'module',plugins:['typescript','jsx']});
 const text=n=>n?source.slice(n.start,n.end).replace(/\s+/g,' ').trim():'';
 const walk=n=>{if(!n||typeof n!=='object')return;
  if(n.type==='JSXElement'){
   const o=n.openingElement,tag=text(o.name),attrs=o.attributes;
   const handlers=attrs.filter(a=>a.type==='JSXAttribute'&&/^on[A-Z]/.test(a.name.name));
   if(handlers.length||['button','input','select','textarea','a','Dropdown.Item','Dropdown.Toggle'].includes(tag)){
    const label=attrs.find(a=>a.type==='JSXAttribute'&&['aria-label','title'].includes(a.name.name));
    rows.push({id:`${file}:${o.loc.start.line}`,file,line:o.loc.start.line,tag,label:label?text(label.value):n.children.map(text).join(' ').slice(0,180),handlers:handlers.map(text).join('; '),disabled:text(attrs.find(a=>a.type==='JSXAttribute'&&a.name.name==='disabled'))});
   }
  }
  for(const [k,v] of Object.entries(n)){if(['loc','start','end'].includes(k))continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}
 };walk(ast);
}
fs.writeFileSync('docs/git-native-plugin/control-inventory.json',JSON.stringify(rows,null,2)+'\n');
fs.writeFileSync('docs/git-native-plugin/control-inventory.md','# Git interactive control inventory\n\nGenerated from current JSX. Repeated menu entries and dynamic rows share handlers; this is a source inventory, not a test-pass claim.\n\n| Source | Control | Label | Handler |\n|---|---|---|---|\n'+rows.map(r=>`| ${r.id} | ${r.tag} | ${r.label.replaceAll('|','\\|')} | ${r.handlers.slice(0,500).replaceAll('|','\\|')} |`).join('\n')+'\n');
console.log(JSON.stringify({controls:rows.length,files:[...new Set(rows.map(r=>r.file))].length}));
