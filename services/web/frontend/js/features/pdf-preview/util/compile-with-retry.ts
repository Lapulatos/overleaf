const TRANSIENT_STATUSES = new Set([
  'compile-in-progress',
  'too-recently-compiled',
])

function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, ms)
    signal.addEventListener('abort', abort, { once: true })
  })
}

// A reload can race a compile from the previous page. Retry only initial
// automatic compiles; keep the server's error after the bounded retry window.
export async function compileWithRetry<T extends { status: string }>(
  request: () => Promise<T>,
  autoCompileOnLoad: boolean,
  signal: AbortSignal,
  wait = waitForRetry
): Promise<T> {
  const delays = [1000, 2000, 4000]
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted()
    const result = await request()
    if (
      !autoCompileOnLoad ||
      !TRANSIENT_STATUSES.has(result.status) ||
      attempt >= delays.length
    ) {
      return result
    }
    await wait(delays[attempt], signal)
  }
}
