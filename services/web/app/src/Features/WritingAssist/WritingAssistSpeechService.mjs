import { validateAudio } from '@overleaf/validation-tools/audio-input.mjs'
import { AgentError } from './WritingAssistAgentService.mjs'

export function createSpeechProxy({
  canWrite,
  configuration,
  fetcher = fetch,
}) {
  async function authorize(userId, projectId) {
    if (!(await canWrite(userId, projectId)))
      throw new AgentError(403, 'Project write access required')
  }
  async function request(path, body, signal) {
    const { agentEndpoint, agentToken } = configuration()
    if (!agentEndpoint || !agentToken)
      throw new AgentError(503, 'Local transcription is not configured')
    const timeout = AbortSignal.timeout(body ? 130000 : 10000)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
    try {
      const response = await fetcher(
        `${agentEndpoint.replace(/\/$/, '')}${path}`,
        {
          method: body ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Agent-Token': agentToken,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: combined,
          redirect: 'error',
        }
      )
      if (!response.ok) {
        await response.body?.cancel()
        const errors = {
          400: 'Invalid audio recording',
          422: 'Audio could not be transcribed within supported limits',
          429: 'A transcription is already running; try again shortly',
          503: 'Local transcription is not configured',
          504: 'Transcription timed out',
        }
        throw new AgentError(
          errors[response.status] ? response.status : 502,
          errors[response.status] || 'Local transcription service failed'
        )
      }
      const reader = response.body.getReader()
      let size = 0
      const chunks = []
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > 128000)
            throw new AgentError(
              502,
              'Transcription response exceeds size limit'
            )
          chunks.push(Buffer.from(value))
        }
      } finally {
        await reader.cancel().catch(() => {})
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch (error) {
      if (error instanceof AgentError) throw error
      if (signal?.aborted) throw new AgentError(499, 'Transcription cancelled')
      if (timeout.aborted) throw new AgentError(504, 'Transcription timed out')
      throw new AgentError(502, 'Local transcription service is unavailable')
    }
  }
  return {
    async capabilities(userId, projectId, signal) {
      await authorize(userId, projectId)
      const health = await request('/agent/health', undefined, signal)
      return { available: health.capabilities?.speech === true }
    },
    async transcribe(userId, projectId, input, signal) {
      await authorize(userId, projectId)
      let audio
      try {
        audio = validateAudio(input)
      } catch (error) {
        throw new AgentError(400, error.message)
      }
      const result = await request('/agent/transcribe', audio, signal)
      if (
        typeof result.text !== 'string' ||
        result.text.length > 32000 ||
        result.language !== audio.language ||
        !Number.isFinite(result.duration) ||
        result.duration <= 0 ||
        result.duration > 60
      )
        throw new AgentError(502, 'Transcription returned an invalid result')
      return {
        text: result.text,
        language: result.language,
        duration: result.duration,
      }
    },
  }
}
