import { imageDimensions } from '@overleaf/validation-tools/image-input.mjs'
import type { ImageAttachment } from './image-attachment'
export async function readComposerImage(file:File):Promise<ImageAttachment>{
 if(!['image/png','image/jpeg'].includes(file.type)||file.size>2*1024*1024||!file.size)throw new Error('Choose a PNG or JPEG image up to 2 MiB.')
 const bytes=new Uint8Array(await file.arrayBuffer());const dimensions=imageDimensions(bytes,file.type)
 const data=await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('Could not read image'));r.readAsDataURL(file)})
 return {name:file.name.slice(0,200),mime:file.type as ImageAttachment['mime'],data,...dimensions}
}
