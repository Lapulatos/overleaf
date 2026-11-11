import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
export const accessModes = ['read-only','workspace-write','auto-review','full-access']
export const defaultAccessPolicy={mode:'workspace-write',directories:[]}
export async function readAccessPolicy(root,user) {
 try {const policy=JSON.parse(await readFile(path.join(root,'access-policy',user+'.json'),'utf8'));if(!accessModes.includes(policy.mode))return defaultAccessPolicy;return {mode:policy.mode,directories:[]}}catch(error){if(error.code==='ENOENT')return defaultAccessPolicy;throw error}
}
export async function saveAccessPolicy(root,user,policy) {
 const dir=path.join(root,'access-policy');await mkdir(dir,{recursive:true,mode:0o700});const file=path.join(dir,user+'.json'),tmp=file+'.'+randomUUID();await writeFile(tmp,JSON.stringify(policy),{mode:0o600});await rename(tmp,file);return policy
}
export function requireRepositoryWrite(policy) {if(policy.mode==='read-only')throw Object.assign(new Error('Read-only mode: change the mode in Paper Assistant before modifying repository files.'),{status:403})}
