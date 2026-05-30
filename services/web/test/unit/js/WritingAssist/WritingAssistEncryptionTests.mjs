import { describe, it } from 'mocha'
import { expect } from 'chai'
import WritingAssistEncryption from
  '../../../../app/src/Features/WritingAssist/WritingAssistEncryption.mjs'

describe('WritingAssistEncryption', function () {
  const key = 'test-key-32-bytes-long-xxxxxxxxx'

  it('should round-trip encrypt/decrypt', function () {
    const plaintext = 'sk-abc123-def456-ghi789'
    const encrypted = WritingAssistEncryption.encrypt(plaintext, key)
    expect(encrypted).to.not.equal(plaintext)
    expect(encrypted).to.match(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)
    const decrypted = WritingAssistEncryption.decrypt(encrypted, key)
    expect(decrypted).to.equal(plaintext)
  })

  it('should return empty string for empty input', function () {
    expect(WritingAssistEncryption.encrypt('', key)).to.equal('')
    expect(WritingAssistEncryption.decrypt('', key)).to.equal('')
  })

  it('should produce different ciphertext each time', function () {
    const e1 = WritingAssistEncryption.encrypt('same-text', key)
    const e2 = WritingAssistEncryption.encrypt('same-text', key)
    expect(e1).to.not.equal(e2)
  })

  it('should throw on malformed ciphertext', function () {
    expect(() => WritingAssistEncryption.decrypt('not-valid', key)).to.throw()
  })
})
