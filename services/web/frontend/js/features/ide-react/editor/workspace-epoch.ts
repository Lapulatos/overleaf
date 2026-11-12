export function assertDocumentEpoch(original: number | null | undefined, current: number | null | undefined) {
  if ((original ?? undefined) === (current ?? undefined)) return
  throw Object.assign(new Error('This document belongs to an older workspace version. Save the recovery text before reloading.'), {
    code: 'WORKSPACE_EPOCH_STALE',
  })
}

// Ignore stale/repeated notifications. Never relabel the existing document's
// epoch: the local snapshot belongs to the generation in which it was opened.
export function bindWorkspaceEpochChange({ socket, projectId, epoch, freeze, recover }: {
  socket: { on(event: string, listener: (value: {projectId?: string; epoch?: number}) => void): unknown; removeListener(event: string, listener: (value: {projectId?: string; epoch?: number}) => void): unknown }
  projectId: string
  epoch: number | undefined
  freeze(): void
  recover(epoch: number): void
}) {
  let handled = false
  const changed = (value: {projectId?: string; epoch?: number}) => {
    if (handled || !value || value.projectId !== projectId || !Number.isSafeInteger(value.epoch) ||
        (value.epoch ?? 0) < 1 || (epoch !== undefined && value.epoch! <= epoch)) return
    handled = true
    freeze()
    recover(value.epoch!)
  }
  socket.on('nativeGitWorkspaceEpochChanged', changed)
  return () => socket.removeListener('nativeGitWorkspaceEpochChanged', changed)
}
