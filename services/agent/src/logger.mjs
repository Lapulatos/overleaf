// @ts-check
/**
 * Minimal structured logger for overleaf-agent.
 *
 * Outputs one JSON line per call to stderr (so stdout stays clean for
 * future stream-json modes). Fields:
 *   { ts, level, msg, ...fields }
 *
 * Levels: debug < info < warn < error. Below-threshold calls are dropped.
 *
 * Usage:
 *   const log = createLogger({ level: 'info' })
 *   log.info('server started', { port: 47291 })
 *   log.error('task failed', { taskId, err: err.message })
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }

/**
 * @typedef {'debug'|'info'|'warn'|'error'} LogLevel
 */

/**
 * @param {{ level?: LogLevel }} [opts]
 */
export function createLogger(opts) {
  const threshold = LEVELS[opts?.level || 'info'] || LEVELS.info

  /**
   * @param {LogLevel} level
   * @param {string} msg
   * @param {Object} [fields]
   */
  function emit(level, msg, fields) {
    if (LEVELS[level] < threshold) return
    const entry = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...(fields || {}),
    }
    // Emit on stderr so stdout stays usable for piping.
    process.stderr.write(JSON.stringify(entry) + '\n')
  }

  return {
    /** @param {string} msg @param {Object} [fields] */
    debug: (msg, fields) => emit('debug', msg, fields),
    /** @param {string} msg @param {Object} [fields] */
    info: (msg, fields) => emit('info', msg, fields),
    /** @param {string} msg @param {Object} [fields] */
    warn: (msg, fields) => emit('warn', msg, fields),
    /** @param {string} msg @param {Object} [fields] */
    error: (msg, fields) => emit('error', msg, fields),
  }
}
