// @ts-check

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const ENCODING_INPUT = 'utf8'
const ENCODING_OUTPUT = 'hex'

function deriveKey(rawKey) {
  const key = Buffer.from(rawKey, 'utf8')
  if (key.length >= 32) return key.subarray(0, 32)
  const padded = Buffer.alloc(32)
  key.copy(padded)
  return padded
}

function encrypt(plaintext, rawKey) {
  if (!plaintext) return ''
  const key = deriveKey(rawKey)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, ENCODING_INPUT, ENCODING_OUTPUT)
  encrypted += cipher.final(ENCODING_OUTPUT)
  const tag = cipher.getAuthTag()
  return `${iv.toString(ENCODING_OUTPUT)}:${tag.toString(ENCODING_OUTPUT)}:${encrypted}`
}

function decrypt(combined, rawKey) {
  if (!combined) return ''
  const parts = combined.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted data format')
  const [ivHex, tagHex, encrypted] = parts
  const key = deriveKey(rawKey)
  const iv = Buffer.from(ivHex, ENCODING_OUTPUT)
  const tag = Buffer.from(tagHex, ENCODING_OUTPUT)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(encrypted, ENCODING_OUTPUT, ENCODING_INPUT)
  decrypted += decipher.final(ENCODING_INPUT)
  return decrypted
}

export default { encrypt, decrypt }
