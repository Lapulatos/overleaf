// @ts-check
/**
 * Base adapter interface for agent backends.
 *
 * Every backend must implement:
 *   - execute(prompt, opts) → { summary, diffs, artifacts }
 *   - healthCheck() → boolean
 */

/**
 * @typedef {Object} BackendAdapter
 * @property {(prompt: string, opts: ExecuteOptions) => Promise<BackendResult>} execute
 * @property {() => Promise<boolean>} healthCheck
 */

/**
 * @typedef {Object} ExecuteOptions
 * @property {Function} [prepareEnvironmentRepair] Prepare-only maintenance callback.
 * @property {string} taskId
 * @property {string} taskType
 * @property {string} [instruction]
 * @property {string} [compilerImage]
 * @property {string} [effort]
 * @property {Object} context
 * @property {(event: object) => void} [onActivity]
 * @property {(text: string) => void} onProgress
 * @property {number} maxSteps
 * @property {number} timeout
 * @property {AbortSignal} [signal]
 * @property {string} [apiKey]
 * @property {string} [endpoint]
 * @property {string} [provider]
 * @property {string} [model]
 * @property {string} [sandbox]
 * @property {number} [maxBudgetUsd]
 */

/**
 * @typedef {Object} BackendResult
 * @property {string} summary
 * @property {import('../types.mjs').DiffEntry[]} diffs
 * @property {import('../types.mjs').Artifact[]} artifacts
 */

export const BackendAdapter = {} // JSDoc-only
