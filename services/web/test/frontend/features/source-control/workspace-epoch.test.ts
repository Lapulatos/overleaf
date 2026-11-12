import { expect } from 'chai'
import sinon from 'sinon'
import { EventEmitter } from 'node:events'
import { OpenDocuments } from '@/features/ide-react/editor/open-documents'
import { assertDocumentEpoch, bindWorkspaceEpochChange } from '@/features/ide-react/editor/workspace-epoch'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { ShareJsDoc } from '@/features/ide-react/editor/share-js-doc'
import EditorWatchdogManager from '@/features/ide-react/connection/editor-watchdog-manager'
import type { Socket } from '@/features/ide-react/connection/types/socket'
import type { IdeEventEmitter } from '@/features/ide-react/create-ide-event-emitter'

describe('workspace-bound editor operations', () => {
  it('rejects reconnect across epochs, including an editor opened before fencing was enabled', () => {
    expect(() => assertDocumentEpoch(1, 2)).to.throw('older workspace version')
    expect(() => assertDocumentEpoch(undefined, 1)).to.throw('older workspace version')
    expect(() => assertDocumentEpoch(1, undefined)).to.throw('older workspace version')
    assertDocumentEpoch(2, 2)
    assertDocumentEpoch(undefined, undefined)
    assertDocumentEpoch(undefined, null)
    expect(() => assertDocumentEpoch(2, null)).to.throw()
  })
  it('retries carry the original document epoch rather than a new socket epoch', () => {
    const clock = sinon.useFakeTimers()
    try {
      const emit = sinon.spy()
      const socket = { emit, publicId: 'first' } as unknown as Socket
      const doc = new ShareJsDoc('doc', ['pending text'], 1, socket,
        new EditorWatchdogManager({ onTimeoutHandler: () => {} }), {} as IdeEventEmitter, 'sharejs-text-ot', 7)
      const update = { op: [{ p: 0, i: 'x' }], v: 1, meta: { workspaceEpoch: 99 } }
      doc.connection.send(update)
      expect(update.meta.workspaceEpoch).to.equal(7)
      socket.publicId = 'reconnected'
      doc.connection.send(update)
      expect(emit.lastCall.args[2].meta.workspaceEpoch).to.equal(7)
      expect(doc.getSnapshot()).to.equal('pending text')
    } finally { clock.restore() }
  })
  it('reconnect preserves local text and refuses catch-up when the document epoch changes', () => {
    const onError = sinon.spy(), catchUp = sinon.spy(), callback = sinon.spy()
    const doc = { workspaceEpoch: 1, getVersion: () => 4, getTimeSinceLastServerActivity: () => 0,
      getSnapshot: () => 'offline user text', catchUp }
    const socket = { emit: (_event: string, _id: string, _version: number, _options: object,
      reply: (...args: unknown[]) => void) => reply(null, ['new server text'], 8, [], {}, 'sharejs-text-ot', 2) }
    const target = { doc, socket, doc_id: 'doc', onError }
    const methods = DocumentContainer.prototype as unknown as { joinDoc(this: object, callback: () => void): void }
    methods.joinDoc.call(target, callback)
    expect(catchUp.called).to.equal(false)
    expect(onError.firstCall.args[2]).to.equal('offline user text')
    expect(callback.firstCall.args[0].code).to.equal('WORKSPACE_EPOCH_STALE')
  })
  for (const failure of [Object.assign(new Error('stale'), { code: 'WORKSPACE_EPOCH_STALE' }), new Error('document replaced')]) it(`captures ${failure.message} text before clearing pending operations`, () => {
    let text = 'recover my pending edits'
    const trigger = sinon.spy()
    const target = { doc_id: 'doc', doc: { getSnapshot: () => text, clearInflightAndPendingOps: () => { text = '' } },
      trigger, cleanUp: sinon.spy() }
    const methods = DocumentContainer.prototype as unknown as { onError(this: object, error: Error): void }
    methods.onError.call(target, failure)
    expect(trigger.firstCall.args[3]).to.equal('recover my pending edits')
    expect(text).to.equal('')
  })

})

describe('workspace epoch change notification', () => {
  it('freezes before recovery and handles a newer generation only once', () => {
    const socket=new EventEmitter(),calls:string[]=[]
    const cleanup=bindWorkspaceEpochChange({socket,projectId:'p',epoch:7,freeze:()=>calls.push('freeze'),recover:()=>calls.push('recover')})
    socket.emit('nativeGitWorkspaceEpochChanged',{projectId:'p',epoch:8})
    socket.emit('nativeGitWorkspaceEpochChanged',{projectId:'p',epoch:9})
    expect(calls).to.deep.equal(['freeze','recover']);cleanup()
  })
  it('ignores another workspace, old/equal epochs and malformed messages', () => {
    const socket=new EventEmitter(),recover=sinon.spy()
    const cleanup=bindWorkspaceEpochChange({socket,projectId:'p',epoch:7,freeze:sinon.spy(),recover})
    for(const value of [null,{}, {projectId:'other',epoch:8},{projectId:'p',epoch:7},{projectId:'p',epoch:6},{projectId:'p',epoch:'8'},{projectId:'p',epoch:8.5}])socket.emit('nativeGitWorkspaceEpochChanged',value)
    expect(recover.called).to.equal(false);cleanup()
    socket.emit('nativeGitWorkspaceEpochChanged',{projectId:'p',epoch:8})
    expect(recover.called).to.equal(false)
  })
  it('protects editors opened before epoch fencing was enabled', () => {
    const socket=new EventEmitter(),recover=sinon.spy()
    const cleanup=bindWorkspaceEpochChange({socket,projectId:'p',epoch:undefined,freeze:sinon.spy(),recover})
    socket.emit('nativeGitWorkspaceEpochChanged',{projectId:'p',epoch:1})
    expect(recover.calledOnce).to.equal(true);cleanup()
  })
  it('recovery snapshot keeps all open document contents without clearing their operations', () => {
    const target={openDocs:new Map([['a',{getSnapshot:()=> 'pending A',docName:'renamed.tex',doc:{getVersion:()=>8,workspaceEpoch:7}}],['b',{getSnapshot:()=> 'pending B'}],['loading',{getSnapshot:()=>undefined}]])}
    const snapshot=OpenDocuments.prototype.snapshotForRecovery.call(target as unknown as OpenDocuments)
    expect(snapshot).to.deep.equal([{docId:'a',content:'pending A',name:'renamed.tex',version:8,epoch:7},{docId:'b',content:'pending B',name:'',version:null,epoch:null}])
    expect(target.openDocs.size).to.equal(3)
  })
  it('tracks renamed files by ID and retains a deleted file name when its name is reused', () => {
    const original = { docName: 'main.tex', getSnapshot: () => 'offline original edits' }
    const replacement = { docName: 'main.tex', getSnapshot: () => 'new document text' }
    const target = { openDocs: new Map([['original', original], ['replacement', replacement]]) }
    const open = target as unknown as OpenDocuments
    OpenDocuments.prototype.updateDocumentNames.call(open, id => id === 'original' ? 'renamed.tex' : 'main.tex')
    expect(original.docName).to.equal('renamed.tex')
    // The original has since been deleted; a new ID now occupies its old path.
    OpenDocuments.prototype.updateDocumentNames.call(open, id => id === 'replacement' ? 'renamed.tex' : undefined)
    const recovered = OpenDocuments.prototype.snapshotForRecovery.call(open)
    expect(recovered.map(doc => [doc.docId, doc.name, doc.content])).to.deep.equal([
      ['original', 'renamed.tex', 'offline original edits'],
      ['replacement', 'renamed.tex', 'new document text'],
    ])
  })

})
