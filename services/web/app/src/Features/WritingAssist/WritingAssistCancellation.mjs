// Response close, unlike request close, means the browser is no longer waiting
// for the model result. Detach after completion to avoid retaining the response.
export async function withResponseCancellation(response, run) {
  const controller = new AbortController()
  const cancel = () => controller.abort(new Error('Writing request cancelled'))
  response.once('close', cancel)
  if (response.destroyed) cancel()
  try {
    return await run(controller.signal)
  } finally {
    response.removeListener('close', cancel)
  }
}

// Legacy errors carry statusCode, while the global handler expects HTTP errors.
// Preserve known local-provider statuses without exposing arbitrary upstream text.
export function withWritingErrors(handler) {
  return async (request, response) => {
    try {
      return await handler(request, response)
    } catch (error) {
      if (response.destroyed) return
      const messages = {
        429: 'Local agent is busy; try again shortly',
        499: 'Writing request cancelled',
        502: 'Local agent request failed',
        503: 'Local agent is not configured',
        504: 'Local agent request timed out',
      }
      if (!messages[error.statusCode]) throw error
      response.status(error.statusCode).json({ message: messages[error.statusCode] })
    }
  }
}
