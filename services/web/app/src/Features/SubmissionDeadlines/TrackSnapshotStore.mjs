import fs from 'node:fs/promises'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
export function trackSnapshotStore(root){
 const file=id=>path.join(root,createHash('sha256').update(id).digest('hex')+'.json')
 return {async load(id){try{const value=JSON.parse(await fs.readFile(file(id),'utf8'));if(value.venueId!==id||!Number.isFinite(value.fetched)||!Array.isArray(value.tracks)||!value.tracks.some(t=>t.status==='retrieved')||value.tracks.some(t=>!t.id.startsWith(id+'::track:')))return null;return value}catch{return null}},async save(id,value){if(!value.tracks.some(t=>t.status==='retrieved'))return;await fs.mkdir(root,{recursive:true,mode:0o700});const temporary=file(id)+'.'+randomUUID();await fs.writeFile(temporary,JSON.stringify({venueId:id,...value}),{mode:0o600});await fs.rename(temporary,file(id))}}
}
