import { expect } from 'chai'
import sinon from 'sinon'
import { shellTerminalApi } from '@/features/source-control/shell-terminal-api'
import type { GitApi } from '@/features/source-control/api'
describe('draft terminal adapter',()=>{
 it('attaches an existing draft and scopes every session action; closing the view does not stop or apply',async()=>{
  const command=sinon.stub().resolves({result:{state:'running'}})
  const api=shellTerminalApi({command} as unknown as GitApi,'draft')
  const opened=await api.command({command:'terminalOpen',mode:'full-access',directory:'/host'})
  expect(opened.result).to.deep.equal({id:'draft',directory:'Private shell draft'})
  await api.command({command:'terminalInput',id:'foreign',input:'pwd\r',directory:'/host'})
  expect(command.lastCall.args[0]).to.deep.equal({command:'shellDraftInput',id:'draft',input:'pwd\r'})
  await api.command({command:'terminalRun',id:'foreign',text:'pwd',approval:'token'})
  expect(command.lastCall.args[0]).to.deep.equal({command:'shellDraftRun',id:'draft',text:'pwd',approval:'token'})
  const count=command.callCount
  await api.command({command:'terminalClose',id:'foreign'})
  expect(command.callCount).to.equal(count)
  try{await api.command({command:'discardAll'});throw Error('should refuse')}catch(error){expect((error as Error).message).to.equal('Unsupported draft terminal action')}
 })
 it('refuses to attach a stopped draft',async()=>{
  const api=shellTerminalApi({command:sinon.stub().resolves({result:{state:'review-ready'}})} as unknown as GitApi,'draft')
  try{await api.command({command:'terminalOpen'});throw Error('should refuse')}catch(error){expect((error as Error).message).to.contain('no running shell')}
 })
})
describe('draft terminal output positions',()=>{
 it('tracks cursor per view and resets it when reattaching',async()=>{
  const command=sinon.stub().callsFake(async body=>({result:body.command==='shellDraftGet'?{state:'running'}:{output:'next',cursor:10}}))
  const source={command} as unknown as GitApi
  const a=shellTerminalApi(source,'draft'),b=shellTerminalApi(source,'draft')
  await a.command({command:'terminalPoll'})
  await a.command({command:'terminalPoll'})
  expect(command.lastCall.args[0].cursor).to.equal(10)
  await b.command({command:'terminalPoll'})
  expect(command.lastCall.args[0].cursor).to.equal(0)
  await a.command({command:'terminalOpen'})
  await a.command({command:'terminalPoll'})
  expect(command.lastCall.args[0].cursor).to.equal(0)
 })
 it('ignores a previous attachment response when updating the new cursor',async()=>{
  let finish:(value:unknown)=>void=()=>{}
  const command=sinon.stub().callsFake(async body=>body.command==='shellDraftGet'?{result:{state:'running'}}:new Promise(resolve=>{finish=resolve}))
  const api=shellTerminalApi({command} as unknown as GitApi,'draft')
  const pending=api.command({command:'terminalPoll'})
  await api.command({command:'terminalOpen'})
  finish({result:{cursor:99}});await pending
  const next=api.command({command:'terminalPoll'})
  expect(command.lastCall.args[0].cursor).to.equal(0)
  finish({result:{cursor:100}});await next
 })
})
