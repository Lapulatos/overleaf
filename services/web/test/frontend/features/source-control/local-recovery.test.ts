import { expect } from 'chai'
import sinon from 'sinon'
import { accumulateLocalRecovery, saveLocalRecovery, listLocalRecovery, removeLocalRecovery } from '@/features/ide-react/editor/local-recovery'

describe('durable browser recovery copies', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { sinon.restore(); localStorage.clear() })
  const value = { userId: 'owner', workspaceId: 'branch', epoch: 3, content: 'unsent manuscript\n☃' }
  it('retains two independent tab snapshots and isolates account and workspace reads', () => {
    const first = saveLocalRecovery(localStorage, value)
    const second = saveLocalRecovery(localStorage, { ...value, content: 'other tab', epoch: 4 })
    expect(first.id).not.to.equal(second.id)
    expect(listLocalRecovery(localStorage, 'owner', 'branch')).to.have.length(2)
    expect(listLocalRecovery(localStorage, 'other', 'branch')).to.have.length(0)
    expect(listLocalRecovery(localStorage, 'owner', 'other')).to.have.length(0)
    removeLocalRecovery(localStorage, 'other', 'branch', first.id)
    expect(listLocalRecovery(localStorage, 'owner', 'branch')).to.have.length(2)
    removeLocalRecovery(localStorage, 'owner', 'branch', second.id)
    expect(listLocalRecovery(localStorage, 'owner', 'branch')[0]).to.deep.equal(first)
  })
  it('reports quota failure without deleting existing copies', () => {
    saveLocalRecovery(localStorage, value)
    const full = { setItem: () => { throw Error('quota') } } as unknown as Storage
    expect(() => saveLocalRecovery(full, value)).to.throw('quota')
    expect(listLocalRecovery(localStorage, 'owner', 'branch')).to.have.length(1)
  })
  it('reports corrupted data and preserves its bytes for diagnosis', () => {
    const copy = saveLocalRecovery(localStorage, value)
    const key = localStorage.key(0)!
    localStorage.setItem(key, '{broken')
    expect(() => listLocalRecovery(localStorage, 'owner', 'branch')).to.throw()
    expect(localStorage.getItem(key)).to.equal('{broken')
    expect(copy.content).to.equal(value.content)
  })
  it('rejects missing generation and detects a silently failed write', () => {
    expect(() => saveLocalRecovery(localStorage, { ...value, epoch: 0 })).to.throw()
    const unavailable = { setItem: () => {}, getItem: () => null } as unknown as Storage
    expect(() => saveLocalRecovery(unavailable, value)).to.throw('verified')
  })
  it('retains distinct same-name documents and refuses ambiguous duplicate identities', () => {
    const documents = [
      { docId: 'original', name: 'main.tex', version: 8, epoch: 3, content: 'old local text' },
      { docId: 'recreated', name: 'main.tex', version: 0, epoch: 4, content: 'different document' },
    ]
    saveLocalRecovery(localStorage, { ...value, documents })
    expect(listLocalRecovery(localStorage, 'owner', 'branch')[0].documents).to.deep.equal(documents)
    expect(() => saveLocalRecovery(localStorage, { ...value, documents: [documents[0], documents[0]] })).to.throw('identities')
  })

  it('retains detached same-name files despite repeated storage failure', () => {
    const first = { docId: 'old', name: 'main.tex', version: 8, epoch: 3, content: 'first unsent text' }
    const second = { ...first, docId: 'new', content: 'second unsent text' }
    const unavailable = { setItem: () => { throw Error('quota') } } as unknown as Storage
    const pending = accumulateLocalRecovery(undefined, { ...value, documents: [first] })
    expect(() => saveLocalRecovery(unavailable, pending)).to.throw('quota')
    const next = accumulateLocalRecovery(pending, { ...value, documents: [second] })
    expect(() => saveLocalRecovery(unavailable, next)).to.throw('quota')
    expect(JSON.parse(next.content).documents).to.deep.equal([first, second])
    const updated = accumulateLocalRecovery(next, { ...value, documents: [{ ...second, content: 'latest text' }] })
    expect(updated.documents).to.have.length(2)
    expect(updated.documents![1].content).to.equal('latest text')
    expect(next.documents![1].content).to.equal('second unsent text')
  })
  it('isolates accumulated recovery by account, workspace and generation', () => {
    const previous = accumulateLocalRecovery(undefined, { ...value, documents: [
      { docId: 'old', name: 'main.tex', version: 8, epoch: 3, content: 'private old text' },
    ] })
    for (const change of [{ userId: 'other' }, { workspaceId: 'other' }, { epoch: 4 }]) {
      const next = accumulateLocalRecovery(previous, { ...value, ...change, content: 'new text', documents: [] })
      expect(next.documents).to.deep.equal([])
      expect(next.content).to.equal('new text')
    }
  })

})
