import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'

const fail = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode })

// The endpoint and secret come exclusively from server settings, never a user's
// saved provider configuration. Inject the transport for protocol-level tests.
export function createAgentProvider(
  getSettings,
  request = fetch,
  pause = sleep
) {
  return {
    async check({
      text,
      systemPrompt,
      enabledCategories,
      userMessage,
      timeout = 60000,
      signal: clientSignal,
    }) {
      const { agentEndpoint, agentToken } = getSettings() || {}
      if (!agentEndpoint || !agentToken)
        throw fail(503, 'Local agent endpoint and token are not configured')
      const taskId = randomUUID()
      const duration = Math.min(60000, Math.max(2000, timeout))
      const deadline = AbortSignal.timeout(duration)
      const signal = clientSignal
        ? AbortSignal.any([deadline, clientSignal])
        : deadline
      let finished = false
      let submitted = false
      const call = async (path, method, body, requestSignal = signal) => {
        const response = await request(
          `${agentEndpoint.replace(/\/$/, '')}${path}`,
          {
            method,
            headers: {
              'Content-Type': 'application/json',
              'X-Agent-Token': agentToken,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: requestSignal,
          }
        )
        if (!response.ok)
          throw fail(
            response.status === 429 ? 429 : 502,
            response.status === 429
              ? 'Local agent is busy; try again shortly'
              : 'Local agent request failed'
          )
        return response.json()
      }
      try {
        // Mark before POST: a lost response may still have created a task.
        signal.throwIfAborted()
        submitted = true
        const taskRequest = {
          taskId,
          type: 'writing-assist-json',
          timeout: duration,
          instruction: systemPrompt,
          context: {
            userMessage:
              userMessage ??
              [
                `Enabled categories: ${enabledCategories.join(', ')}`,
                'Return issues for ONLY these categories. Ignore others.',
                'Text to check:',
                text,
              ].join('\n'),
          },
        }
        // Allow a just-cancelled task to release its process slot. Do not
        // retry lost responses or other failures, which might duplicate work.
        for (let retry = 0; ; retry++) {
          try {
            await call('/agent/task', 'POST', taskRequest)
            break
          } catch (error) {
            if (error.statusCode !== 429 || retry >= 20) throw error
            await pause(250, undefined, { signal })
          }
        }
        while (true) {
          const task = await call(`/agent/task/${taskId}`, 'GET')
          if (task.status === 'completed') {
            finished = true
            if (
              typeof task.summary !== 'string' ||
              task.summary.length > 128000
            )
              throw fail(502, 'Invalid local agent response')
            // A malformed model response must not look like a clean grammar
            // result (the legacy parser otherwise treats invalid JSON as []).
            let parsed
            try {
              parsed = JSON.parse(
                task.summary
                  .trim()
                  .replace(/^```(?:json)?\s*\n?/i, '')
                  .replace(/\n?```\s*$/, '')
              )
            } catch {
              throw fail(502, 'Local agent returned invalid JSON')
            }
            if (
              userMessage === undefined
                ? !Array.isArray(parsed?.issues)
                : typeof parsed?.result !== 'string'
            ) {
              throw fail(
                502,
                'Local agent returned an invalid writing response'
              )
            }
            return JSON.stringify(parsed)
          }
          if (['failed', 'cancelled', 'timeout'].includes(task.status)) {
            finished = true
            throw fail(
              task.status === 'timeout' ? 504 : 502,
              `Local agent task ${task.status}`
            )
          }
          await pause(250, undefined, { signal })
        }
      } catch (error) {
        if (clientSignal?.aborted) throw fail(499, 'Writing request cancelled')
        if (signal.aborted) throw fail(504, 'Local agent request timed out')
        if (error.statusCode) throw error
        throw fail(502, 'Local agent is unreachable')
      } finally {
        if (submitted && !finished) {
          await call(
            `/agent/task/${taskId}`,
            'DELETE',
            undefined,
            AbortSignal.timeout(2000)
          ).catch(() => {})
        }
      }
    },
  }
}
