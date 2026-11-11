import {expect} from 'chai'
import {render,screen,cleanup} from '@testing-library/react'
import {FilePreview} from '@/features/source-control/file-preview'
describe('Git file preview navigation',()=>{
 afterEach(cleanup)
 it('selects the existing version when switching from added to deleted file',()=>{
  const decode=Object.getOwnPropertyDescriptor(globalThis,'atob')
  Object.defineProperty(globalThis,'atob',{configurable:true,value:(value:string)=>Buffer.from(value,'base64').toString('binary')})
  const create=Object.getOwnPropertyDescriptor(URL,'createObjectURL'),revoke=Object.getOwnPropertyDescriptor(URL,'revokeObjectURL')
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:()=> 'blob:audit'})
  Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:()=>{}})
  try{
   const version={mime:'image/png',base64:'AA==',size:1}
   const view=render(<FilePreview title="added.png" versions={{before:null,after:version}}/>)
   expect(screen.getByRole('img').getAttribute('alt')).to.equal('After: added.png')
   view.rerender(<FilePreview title="deleted.png" versions={{before:version,after:null}}/>)
   expect(screen.getByRole('img').getAttribute('alt')).to.equal('Before: deleted.png')
  }finally{
   cleanup()
   if(decode)Object.defineProperty(globalThis,'atob',decode)
   for(const [key,descriptor] of [['createObjectURL',create],['revokeObjectURL',revoke]] as const){if(descriptor)Object.defineProperty(URL,key,descriptor);else delete (URL as any)[key]}
  }
 })
})
