export async function withSavedEditor<T>(
  documents: { awaitBufferedOps: (signal: AbortSignal) => Promise<void>; hasUnsavedChanges: () => boolean },
  setBusy: (busy: boolean) => void,
  action: () => Promise<T>,
  signal = AbortSignal.timeout(15000)
) {
  setBusy(true)
  try {
    await documents.awaitBufferedOps(signal)
    signal.throwIfAborted()
    if (documents.hasUnsavedChanges()) throw new Error('Wait for project changes to finish saving before using Git')
    return await action()
  } finally { setBusy(false) }
}
