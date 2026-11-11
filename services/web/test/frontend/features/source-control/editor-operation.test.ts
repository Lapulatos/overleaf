import { expect } from 'chai'
import sinon from 'sinon'
import { withSavedEditor } from '@/features/source-control/editor-operation'

describe('Git editor save barrier', () => {
  it('waits for buffered operations before invoking Git and always restores editor access', async () => {
    let saved = false
    const busy = sinon.spy()
    const action = sinon.stub().callsFake(async () => { expect(saved).to.equal(true); return 'committed' })
    const result = await withSavedEditor({ awaitBufferedOps: async () => { saved = true }, hasUnsavedChanges: () => false }, busy, action)
    expect(result).to.equal('committed')
    expect(busy.args).to.deep.equal([[true], [false]])
  })
  it('does not run Git if saving timed out or buffered edits remain', async () => {
    for (const aborted of [true, false]) {
      const controller = new AbortController()
      const action = sinon.stub()
      const busy = sinon.spy()
      if (aborted) controller.abort()
      let error: unknown
      try {
        await withSavedEditor({ awaitBufferedOps: async () => {}, hasUnsavedChanges: () => true }, busy, action, controller.signal)
      } catch (caught) { error = caught }
      expect(error).to.exist
      expect(action).not.to.have.been.called
      expect(busy.lastCall.args).to.deep.equal([false])
    }
  })
})
