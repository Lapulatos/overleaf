import { expect } from 'chai'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import sinon from 'sinon'
import SessionRecovery from '@/features/source-control/session-recovery'
import type { GitApi } from '@/features/source-control/api'
describe('session recovery dialog',()=>{
 afterEach(cleanup)
 it('requires acknowledgement and reuses operation identity after failure',async()=>{
  let attempts=0
  const command=sinon.stub().callsFake(async body=>{
   if(body.command==='sessionRecoveryList')return {result:[]}
   if(++attempts===1)throw Error('connection interrupted')
   return {result:{id:body.operationId,state:'resolved'}}
  })
  render(<SessionRecovery api={{command} as unknown as GitApi}/>);fireEvent.click(screen.getByRole('button',{name:'Reconnect editors'}))
  const check=await screen.findByRole('checkbox')
  expect((screen.getByRole('button',{name:'Restore connection'}) as HTMLButtonElement).disabled).to.equal(true)
  fireEvent.click(check);fireEvent.click(screen.getByRole('button',{name:'Restore connection'}));await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button',{name:'Restore connection'}));await screen.findByRole('button',{name:'Reload editor'})
  const calls=command.args.filter(([body])=>body.command==='sessionRecover')
  expect(calls).to.have.length(2);expect(calls[0][0].operationId).to.equal(calls[1][0].operationId)
 })
 it('resumes the server pending task',async()=>{
  const command=sinon.stub().callsFake(async body=>body.command==='sessionRecoveryList'?{result:[{id:'pending-task',state:'pending',phase:'snapshot-saved'}]}:{result:{id:body.operationId,state:'resolved'}})
  render(<SessionRecovery api={{command} as unknown as GitApi}/>);fireEvent.click(screen.getByRole('button',{name:'Reconnect editors'}))
  fireEvent.click(await screen.findByRole('checkbox'));fireEvent.click(screen.getByRole('button',{name:'Resume reconnection'}));await screen.findByRole('button',{name:'Reload editor'})
  expect(command.args[1][0]).to.deep.equal({command:'sessionRecover',operationId:'pending-task'})
 })
 it('disables recovery when permission or task lookup fails',async()=>{
  const command=sinon.stub().rejects(Error('Only the project owner can recover workspace sessions'))
  render(<SessionRecovery api={{command} as unknown as GitApi}/>);fireEvent.click(screen.getByRole('button',{name:'Reconnect editors'}));await screen.findByRole('alert')
  expect((screen.getByRole('button',{name:'Restore connection'}) as HTMLButtonElement).disabled).to.equal(true)
  expect(screen.queryByRole('checkbox')).to.equal(null);expect(command.callCount).to.equal(1)
 })
})
