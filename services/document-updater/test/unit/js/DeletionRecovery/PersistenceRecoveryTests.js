const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')

describe('Deletion recovery transport', function () {
  beforeEach(function () {
    this.fetchJson = sinon.stub().resolves({ version: 3 })
    this.persistence = SandboxedModule.require('../../../../app/js/PersistenceManager.js', { globals: { AbortSignal }, requires: {
      '@overleaf/settings': { apis: { web: { url: 'http://web.internal:3000', user: 'internal', pass: 'test-secret' } } },
      '@overleaf/fetch-utils': { fetchJson: this.fetchJson },
    } }).promises
    this.args = ['a'.repeat(24), 'b'.repeat(24), randomUUID()]
  })
  it('uses the exact operation private route and bounded authenticated request', async function () {
    assert.deepEqual(await this.persistence.getDeletionRecoverySnapshot(...this.args), { version: 3 })
    const [url, options] = this.fetchJson.firstCall.args
    assert.equal(url.toString(), `http://web.internal:3000/project/${this.args[0]}/doc/${this.args[1]}/deletion/${this.args[2]}/recovery-snapshot`)
    assert.equal(options.basicAuth.user, 'internal')
    assert.equal(options.basicAuth.password, 'test-secret')
    assert.ok(options.signal instanceof AbortSignal)
  })
  it('rejects untrusted path identities without a request', async function () {
    await assert.rejects(this.persistence.getDeletionRecoverySnapshot('../project', ...this.args.slice(1)), /Invalid/)
    sinon.assert.notCalled(this.fetchJson)
  })
  it('propagates failure without automatically retrying the operation', async function () {
    this.fetchJson.rejects(new Error('unavailable'))
    await assert.rejects(this.persistence.getDeletionRecoverySnapshot(...this.args), /unavailable/)
    sinon.assert.calledOnce(this.fetchJson)
  })
})
