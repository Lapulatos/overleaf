import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import CollaborationTasks from '@/features/source-control/collaboration-tasks'
import type { GitApi } from '@/features/source-control/api'
const base = { id: 'task', revision: 1, state: 'ready-to-apply', sourceRef: 'topic', targetBranch: 'main', remainingPaths: [], leaseGeneration: 0 }
describe('shared collaboration tasks', () => {
  afterEach(cleanup)
  it('requires a server-issued lease and submits its exact revision/generation when applying', async () => {
    const command=sinon.stub().callsFake(async body => {
      if(body.command==='mergeDraftList')return {result:[base]}
      if(body.command==='mergeDraftClaim')return {result:{...base,revision:2,leaseGeneration:3,lease:{actorId:'A',sessionId:body.sessionId,expiresAt:Date.now()+100000}}}
      return {result:{...base,state:'resolved',revision:3}}
    })
    const close=sinon.spy()
    render(<CollaborationTasks api={{command} as unknown as GitApi} canApply selectedId="task" onClose={close}/>)
    await screen.findByRole('button',{name:'Take resolution lease'})
    expect((screen.getByRole('button',{name:'Apply resolved merge'}) as HTMLButtonElement).disabled).to.equal(true)
    fireEvent.click(screen.getByRole('button',{name:'Take resolution lease'}))
    await screen.findByText('You are resolving this task.')
    fireEvent.click(screen.getByRole('button',{name:'Apply resolved merge'}))
    await waitFor(()=>expect(close.calledOnce).to.equal(true))
    const claim=command.args.find(([b])=>b.command==='mergeDraftClaim')![0]
    const apply=command.args.find(([b])=>b.command==='mergeDraftApply')![0]
    expect(apply).to.deep.equal({command:'mergeDraftApply',id:'task',revision:2,sessionId:claim.sessionId,generation:3})
  })
  it('shows lease refusal without enabling apply or closing the task', async () => {
    const command=sinon.stub().callsFake(async body=>{if(body.command==='mergeDraftList')return {result:[base]};throw new Error('Another session is resolving this task')})
    const close=sinon.spy()
    render(<CollaborationTasks api={{command} as unknown as GitApi} canApply selectedId="task" onClose={close}/>)
    fireEvent.click(await screen.findByRole('button',{name:'Take resolution lease'}))
    expect((await screen.findByRole('alert')).textContent).to.contain('Another session')
    expect(close.called).to.equal(false)
    expect((screen.getByRole('button',{name:'Apply resolved merge'}) as HTMLButtonElement).disabled).to.equal(true)
  })
  it('requires recovery preview and explicit choice; disables unsafe resume', async () => {
    const task={...base,state:'recovery-required'}
    const command=sinon.stub().callsFake(async body=>{
      if(body.command==='mergeDraftList')return {result:[task]}
      if(body.command==='mergeDraftRecoveryPreview')return {result:{task,canResume:false,fingerprint:'a'.repeat(64),explanation:'Current documents changed.'}}
      return {result:{...task,state:'cancelled'}}
    })
    const close=sinon.spy()
    render(<CollaborationTasks api={{command} as unknown as GitApi} canApply selectedId="task" onClose={close}/>)
    fireEvent.click(await screen.findByRole('button',{name:'Review recovery'}))
    await screen.findByText('Current documents changed.')
    expect((screen.getByRole('button',{name:'Resume interrupted merge'}) as HTMLButtonElement).disabled).to.equal(true)
    fireEvent.click(screen.getByRole('button',{name:'Preserve current contents'}))
    await waitFor(()=>expect(close.calledOnce).to.equal(true))
    const request=command.args.find(([b])=>b.command==='mergeDraftRecover')![0]
    expect(request.mode).to.equal('preserve-current');expect(request.fingerprint).to.equal('a'.repeat(64));expect(request.operationId).to.be.a('string')
  })
})
