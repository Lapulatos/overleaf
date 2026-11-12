import { expect } from 'chai'
import sinon from 'sinon'
import { EventEmitter } from 'node:events'
import { bindWorkspacePreparation } from '@/features/ide-react/editor/workspace-preparation'
import type { Socket } from '@/features/ide-react/connection/types/socket'
const request = { id: '11111111-1111-4111-8111-111111111111', projectId: 'project', epoch: 7, ttlMs: 1000 }
const settle = async () => { await Promise.resolve(); await Promise.resolve() }
describe('workspace preparation browser protocol', () => {
  let clock: sinon.SinonFakeTimers
  let cleanup: (() => void) | undefined
  beforeEach(() => { clock = sinon.useFakeTimers() })
  afterEach(() => { cleanup?.(); cleanup = undefined; clock.restore() })
  function setup() {
    const acknowledgements: (number | undefined)[] = []
    const socket = new EventEmitter(), replies: {id:string;epoch:number;saved:boolean}[] = [], busy: boolean[] = []
    socket.on('nativeGitPrepareAck', value => replies.push(value))
    const documents = { awaitBufferedOps: sinon.stub().resolves(), hasUnsavedChanges: sinon.stub().returns(false) }
    cleanup = bindWorkspacePreparation({socket: socket as unknown as Socket, projectId:'project', epoch:7, documents, setBusy: value => busy.push(value), onAcknowledged: epoch => acknowledgements.push(epoch)})
    return {socket, replies, busy, documents, acknowledgements}
  }
  it('freezes before flushing and acknowledges only after buffers finish', async () => {
    const f=setup();let complete!:()=>void
    f.documents.awaitBufferedOps.callsFake(() => {expect(f.busy).to.deep.equal([true]);return new Promise<void>(resolve => {complete=resolve})})
    f.socket.emit('nativeGitPrepare',request);expect(f.replies).to.have.length(0)
    complete();await settle()
    expect(f.acknowledgements).to.deep.equal([7]);expect(f.replies).to.deep.equal([{id:request.id,epoch:7,saved:true}]);expect(f.busy).to.deep.equal([true])
    f.socket.emit('nativeGitPrepareFinished',{id:'wrong'});expect(f.busy).to.deep.equal([true])
    f.socket.emit('nativeGitPrepareFinished',{id:request.id});expect(f.busy).to.deep.equal([true,false]);expect(f.acknowledgements).to.deep.equal([7,undefined])
  })
  it('rejects a different epoch and ignores another project without touching buffers', () => {
    const f=setup();f.socket.emit('nativeGitPrepare',{...request,epoch:8});f.socket.emit('nativeGitPrepare',{...request,projectId:'other'})
    expect(f.replies).to.deep.equal([{id:request.id,epoch:8,saved:false}]);expect(f.documents.awaitBufferedOps.called).to.equal(false)
  })
  it('does not mistake an aborted flush that resolves for successful saving', async () => {
    const f=setup();f.documents.awaitBufferedOps.callsFake((signal:AbortSignal)=>new Promise<void>(resolve=>signal.addEventListener('abort',()=>resolve())))
    f.socket.emit('nativeGitPrepare',request);clock.tick(1001);await settle()
    expect(f.replies).to.deep.equal([{id:request.id,epoch:7,saved:false}]);expect(f.busy).to.deep.equal([true,false])
  })
  it('refuses success if buffers remain', async () => {
    const f=setup();f.documents.hasUnsavedChanges.returns(true);f.socket.emit('nativeGitPrepare',request);await settle()
    expect(f.replies[0].saved).to.equal(false);expect(f.busy).to.deep.equal([true,false])
  })
  it('keeps the original pause during a competing operation', async () => {
    const f=setup();f.socket.emit('nativeGitPrepare',request);await settle()
    f.socket.emit('nativeGitPrepare',{...request,id:'22222222-2222-4222-8222-222222222222'})
    expect(f.replies.map(r=>r.saved)).to.deep.equal([true,false]);expect(f.busy).to.deep.equal([true]);expect(f.documents.awaitBufferedOps.calledOnce).to.equal(true)
  })
  it('disconnect cancels pending acknowledgement without clearing buffers', async () => {
    const f=setup();let complete!:()=>void
    f.documents.awaitBufferedOps.callsFake(()=>new Promise<void>(resolve=>{complete=resolve}))
    f.socket.emit('nativeGitPrepare',request);f.socket.emit('disconnect');complete();await settle()
    expect(f.replies).to.have.length(0);expect(f.busy).to.deep.equal([true,false])
  })
  it('context disposal removes listeners and prevents late success', async () => {
    const f=setup();let complete!:()=>void
    f.documents.awaitBufferedOps.callsFake(()=>new Promise<void>(resolve=>{complete=resolve}))
    f.socket.emit('nativeGitPrepare',request);cleanup!();complete();await settle()
    expect(f.replies).to.have.length(0);expect(f.socket.listenerCount('nativeGitPrepare')).to.equal(0)
  })
  it('flush errors release the pause and report failure', async () => {
    const f=setup();f.documents.awaitBufferedOps.rejects(new Error('out of sync'));f.socket.emit('nativeGitPrepare',request);await settle()
    expect(f.replies[0].saved).to.equal(false);expect(f.busy).to.deep.equal([true,false])
  })
})
