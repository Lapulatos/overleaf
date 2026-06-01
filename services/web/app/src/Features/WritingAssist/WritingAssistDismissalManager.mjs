// @ts-check

import { WritingAssistDismissal } from '../../models/WritingAssistDismissal.mjs'
import { callbackify } from 'node:util'

const MAX_ENTRIES_PER_USER = 500
const MAX_TEXT_LENGTH = 2000

/**
 * Normalize a sentence for stable matching: trim, collapse internal runs of
 * whitespace to single spaces. The frontend uses the identical rule so a
 * dismissed sentence matches regardless of reflow/indentation differences.
 *
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Escape a literal string for use inside a RegExp (spaces left intact).
 *
 * @param {string} s
 * @returns {string}
 */
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Compile a stored note pattern into a tester, mirroring the frontend
 * `compileDismissMatcher` (dismiss-pattern.ts). ".*" is a non-greedy any-text
 * gap; every other chunk is an escaped literal individually word-edge bounded
 * ((?<!\w)…(?!\w)) so "find" never matches inside "finds" and a trailing anchor
 * like "out" never matches inside "about". Case-insensitive. MUST stay in sync
 * with the frontend.
 *
 * @param {string} pattern
 * @returns {(text: string) => boolean}
 */
function compileMatcher(pattern) {
  const norm = normalize(pattern)
  if (!norm) return () => false

  const chunks = norm.split(/\s*\.\*\s*/).filter(c => c.length > 0)
  if (chunks.length === 0) return () => false

  const body = chunks
    .map(c => `(?<!\\w)${escapeRegExp(c)}(?!\\w)`)
    .join('[\\s\\S]*?')
  /** @type {RegExp | null} */
  let re = null
  try {
    re = new RegExp(body, 'i')
  } catch {
    re = null
  }
  const lower = norm.toLowerCase()
  return text => {
    const t = normalize(text)
    if (re) return re.test(t)
    return t.toLowerCase().includes(lower)
  }
}

/**
 * @param {string} userId
 * @returns {Promise<Array<{ id: string, text: string, createdAt: Date }>>}
 */
async function list(userId) {
  const docs = await WritingAssistDismissal.find({ user_id: userId })
    .sort({ createdAt: -1 })
    .limit(MAX_ENTRIES_PER_USER)
    .exec()
  return docs.map(d => ({
    id: d._id.toString(),
    text: d.text,
    createdAt: d.createdAt,
  }))
}

/**
 * Add a dismissed sentence. No-op (returns the existing entry) when an
 * identical normalized sentence is already stored, so the notebook never holds
 * duplicates.
 *
 * @param {string} userId
 * @param {string} rawText
 * @returns {Promise<{ id: string, text: string, createdAt: Date } | null>}
 */
async function add(userId, rawText) {
  const text = normalize(rawText).slice(0, MAX_TEXT_LENGTH)
  if (!text) return null

  const existing = await WritingAssistDismissal.findOne({
    user_id: userId,
    text,
  }).exec()
  if (existing) {
    return { id: existing._id.toString(), text: existing.text, createdAt: existing.createdAt }
  }

  const doc = await WritingAssistDismissal.create({ user_id: userId, text })
  return { id: doc._id.toString(), text: doc.text, createdAt: doc.createdAt }
}

/**
 * Update the text of a notebook entry the user owns.
 *
 * @param {string} userId
 * @param {string} id
 * @param {string} rawText
 * @returns {Promise<{ id: string, text: string, createdAt: Date } | null>}
 */
async function update(userId, id, rawText) {
  const text = normalize(rawText).slice(0, MAX_TEXT_LENGTH)
  if (!text) return null
  const doc = await WritingAssistDismissal.findOneAndUpdate(
    { _id: id, user_id: userId },
    { $set: { text } },
    { new: true }
  ).exec()
  if (!doc) return null
  return { id: doc._id.toString(), text: doc.text, createdAt: doc.createdAt }
}

/**
 * Remove a notebook entry the user owns.
 *
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function remove(userId, id) {
  const res = await WritingAssistDismissal.deleteOne({
    _id: id,
    user_id: userId,
  }).exec()
  return res.deletedCount > 0
}

/**
 * True if `text` matches any of the user's dismiss notes. Notes may be
 * diff-patterns ("(a|b)" alternations / ".*" gaps) or plain sentences; both are
 * compiled with the same word-bounded, case-insensitive matcher as the
 * frontend. Used as the server-side backstop in the check path.
 *
 * @param {string} userId
 * @param {string} text
 * @returns {Promise<boolean>}
 */
async function isDismissed(userId, text) {
  const candidate = normalize(text)
  if (!candidate) return false
  const docs = await WritingAssistDismissal.find(
    { user_id: userId },
    { text: 1 }
  ).exec()
  for (const d of docs) {
    if (compileMatcher(d.text)(candidate)) return true
  }
  return false
}

const WritingAssistDismissalManager = {
  normalize,
  list: callbackify(list),
  add: callbackify(add),
  update: callbackify(update),
  remove: callbackify(remove),
  isDismissed: callbackify(isDismissed),
  promises: { list, add, update, remove, isDismissed },
}

export default WritingAssistDismissalManager
