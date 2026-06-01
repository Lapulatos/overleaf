// @ts-check

import { WritingAssistConfig } from '../../models/WritingAssistConfig.mjs'
import { callbackify } from 'node:util'

/**
 * Thin persistence layer for per-user Writing Assist config. The controller
 * owns the config shape, encryption, and merge logic; this module only
 * reads/writes the stored object (one document per user).
 */

/**
 * Return the stored config object for a user, or null if none is saved yet.
 *
 * @param {string} userId
 * @returns {Promise<any | null>}
 */
async function get(userId) {
  const doc = await WritingAssistConfig.findOne({ user_id: userId }).exec()
  return doc ? doc.config : null
}

/**
 * Upsert the full config object for a user.
 *
 * @param {string} userId
 * @param {any} config
 * @returns {Promise<void>}
 */
async function set(userId, config) {
  await WritingAssistConfig.findOneAndUpdate(
    { user_id: userId },
    { $set: { config, updatedAt: new Date() } },
    { upsert: true, new: true }
  ).exec()
}

const WritingAssistConfigManager = {
  get: callbackify(get),
  set: callbackify(set),
  promises: { get, set },
}

export default WritingAssistConfigManager
