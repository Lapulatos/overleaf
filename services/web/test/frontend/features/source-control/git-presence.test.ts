import { expect } from 'chai'
import sinon from 'sinon'
import { bindGitPresence } from '@/features/source-control/git-presence'
const snapshot=(generation:string,revision:number)=>({generation,revision,sessions:[]})
function fixture(){
 const events=new Map<string,Function>(),requests:any[]=[],values:any[]=[]
 let intent:(commit:string|null)=>void=()=>{}
 const socket={on:(key:string,fn:Function)=>events.set(key,fn),removeListener:(key:string)=>events.delete(key),emit:(_event:string,body:any,callback:Function)=>requests.push({body,callback})}
 const stop=bindGitPresence({socket,publish:value=>values.push(value),onIntent:fn=>{intent=fn;return ()=>{} }})
 return {events,requests,values,stop,intent:(value:string|null)=>intent(value)}
}
describe('Git presence protocol',()=>{
 it('ignores older snapshots and does not accept generation changes from broadcast alone',()=>{
  const f=fixture()
  try{
   f.requests[0].callback(null,snapshot('one',5))
   f.events.get('nativeGitPresenceChanged')!(snapshot('one',3))
   expect(f.values.at(-1).revision).to.equal(5)
   f.events.get('nativeGitPresenceChanged')!(snapshot('two',0))
   expect(f.values.at(-1).generation).to.equal('one')
   f.requests[1].callback(null,snapshot('two',1))
   expect(f.values.at(-1).generation).to.equal('two')
  }finally{f.stop()}
 })
 it('clears positions on disconnect and ignores late acknowledgement',()=>{
  const f=fixture()
  try{
   f.events.get('disconnect')!()
   f.requests[0].callback(null,snapshot('old',99))
   f.events.get('nativeGitPresenceChanged')!(snapshot('old',100))
   expect(f.requests.length).to.equal(1)
   expect(f.values.at(-1)).to.equal(null)
   f.events.get('connect')!();f.requests[1].callback(null,snapshot('new',1))
   expect(f.values.at(-1).generation).to.equal('new')
  }finally{f.stop()}
 })
 it('coalesces history intent and heartbeat while a request is pending',()=>{
  const clock=sinon.useFakeTimers(),f=fixture()
  try{
   f.intent('a'.repeat(40));clock.tick(2000)
   expect(f.requests.length).to.equal(1)
   f.requests[0].callback(null,snapshot('one',1))
   expect(f.requests[1].body).to.deep.equal({viewedCommit:'a'.repeat(40)})
   clock.tick(12000);expect(f.values.at(-1)).to.equal(null)
   f.requests[1].callback(null,snapshot('one',10));expect(f.values.at(-1)).to.equal(null)
  }finally{f.stop();clock.restore()}
 })
})
