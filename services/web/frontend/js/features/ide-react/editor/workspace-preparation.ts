import type { Socket } from '../connection/types/socket'

type Request = { id: string; projectId: string; epoch: number; ttlMs: number }
type Documents = { awaitBufferedOps(signal: AbortSignal): Promise<void>; hasUnsavedChanges(): boolean }

// The server independently validates membership and versions. This handler only
// attests that this browser's buffers are saved while its editor is frozen.
export function bindWorkspacePreparation({ socket, projectId, epoch, documents, setBusy, onAcknowledged }: {
  socket: Pick<Socket, 'on' | 'removeListener' | 'emit'>
  projectId: string
  epoch: number | undefined
  documents: Documents
  setBusy(busy: boolean): void
  onAcknowledged?(epoch: number | undefined): void
}) {
  let active: { request: Request; abort: AbortController; timer: ReturnType<typeof setTimeout> } | undefined
  let disposed = false
  const reply = (request: Request, saved: boolean) => socket.emit('nativeGitPrepareAck', { id: request.id, epoch: request.epoch, saved })
  const release = () => {
    const previous = active
    active = undefined
    if (previous) {
      clearTimeout(previous.timer)
      previous.abort.abort()
      onAcknowledged?.(undefined)
      setBusy(false)
    }
  }
  const prepare = (request: Request) => {
    if (!request || typeof request.id !== 'string' || !/^[a-f0-9-]{36}$/i.test(request.id) ||
        request.projectId !== projectId || !Number.isSafeInteger(request.epoch) || request.epoch < 1 ||
        !Number.isSafeInteger(request.ttlMs) || request.ttlMs < 1 || request.ttlMs > 60000) return
    if (request.epoch !== epoch) { reply(request, false); return }
    if (active) {
      if (active.request.id !== request.id) reply(request, false)
      return
    }
    const abort = new AbortController()
    const entry = { request, abort, timer: setTimeout(() => {
      if (active !== entry) return
      reply(request, false)
      release()
    }, request.ttlMs) }
    active = entry
    // The React adapter commits readOnly synchronously before buffers are read.
    setBusy(true)
    void (async () => {
      try {
        await documents.awaitBufferedOps(abort.signal)
        if (disposed || active !== entry || abort.signal.aborted) return
        if (documents.hasUnsavedChanges()) { reply(request, false); release(); return }
        onAcknowledged?.(request.epoch)
        reply(request, true)
        // Keep editing paused until this exact operation ends or expires.
      } catch {
        if (!disposed && active === entry) { reply(request, false); release() }
      }
    })()
  }
  const finished = (value: { id?: string }) => {
    if (value?.id === active?.request.id) release()
  }
  const disconnect = () => release()
  socket.on('nativeGitPrepare', prepare)
  socket.on('nativeGitPrepareFinished', finished)
  socket.on('disconnect', disconnect)
  return () => {
    disposed = true
    socket.removeListener('nativeGitPrepare', prepare)
    socket.removeListener('nativeGitPrepareFinished', finished)
    socket.removeListener('disconnect', disconnect)
    release()
  }
}
