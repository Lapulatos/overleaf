import type { Task } from './agent-task-result'
import { useEffect, useRef, useState } from 'react'
import { getJSON, postJSON } from '@/infrastructure/fetch-json'
import { OLModal, OLModalHeader, OLModalTitle, OLModalBody, OLModalFooter } from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { ProposalDiff } from './proposal-diff'

type Inspection = {
  fingerprint?: string
  status?: string
  disposition?: { kind: string } | null
  checkedAt: string
  workspaceMatches: boolean
  comparison: string
  acknowledgement?: { state: string; acknowledgedAt: string } | null
  baseline: { content: string }
  proposed: { content: string }
  current: { content: string; path: string; version: number } | null
}
const descriptions: Record<string, string> = {
  'matches-proposal': 'Current text matches the proposed text.',
  'matches-baseline': 'Current text matches the original snapshot.',
  changed: 'Current text differs from both snapshots.',
  missing: 'The document is currently missing.',
  replaced: 'A different document now occupies this path.',
  renamed: 'The original document now has a different path.',
}

export function ApplicationInspection({ projectId, taskId, proposalId, onRecovered }: { projectId: string; taskId: string; proposalId: string; onRecovered?: (task: Task) => void }) {
  const [open, setOpen] = useState(false)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<Inspection | null>(null)
  const [error, setError] = useState('')
  const [recovering, setRecovering] = useState(false)
  const [recovered, setRecovered] = useState<'accepted' | 'closed-unconfirmed' | null>(null)
  const recoveryRequest = useRef<AbortController | null>(null)
  useEffect(() => {
    setRecovered(null)
    setRecovering(false)
    return () => recoveryRequest.current?.abort()
  }, [projectId, taskId, proposalId, open])
  useEffect(() => {
    setResult(null)
    setError('')
    if (!open) return
    const controller = new AbortController()
    getJSON<Inspection>(`/writing-assist/project/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/proposals/${encodeURIComponent(proposalId)}/inspection`, { signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) setResult(value) })
      .catch(() => { if (!controller.signal.aborted) setError('Inspection unavailable. Check access and inspect again; no changes were applied.') })
    return () => controller.abort()
  }, [open, revision, projectId, taskId, proposalId])
  async function recover(close = false) {
    if (recovering || (close ? !result?.fingerprint || !!result.acknowledgement : !result?.acknowledgement)) return
    const controller = new AbortController()
    recoveryRequest.current = controller
    setRecovering(true)
    setError('')
    try {
      const task = await postJSON<Task>(`/writing-assist/project/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/proposals/${encodeURIComponent(proposalId)}/${close ? 'close-unconfirmed' : 'recover'}`, { body: close ? { fingerprint: result?.fingerprint, decision: 'close-without-retry' } : {}, signal: controller.signal })
      if (controller.signal.aborted) return
      const expected = close ? 'closed-unconfirmed' : 'accepted'
      if (!task.proposals.some(value => value.id === proposalId && value.status === expected)) throw new Error('Recovery not confirmed')
      setRecovered(expected)
      onRecovered?.(task)
    } catch {
      if (controller.signal.aborted) return
      setResult(null)
      setError('Task recovery could not be confirmed. Inspect again before continuing. No document write was requested.')
    } finally { if (!controller.signal.aborted) setRecovering(false) }
  }
  function download() {
    if (!result) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `write-inspection-${taskId}-${proposalId}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return <>
    <OLButton variant="secondary" onClick={() => setOpen(true)}>Inspect write</OLButton>
    <OLModal show={open} onHide={() => setOpen(false)} size="lg" aria-label="Inspect interrupted write">
      <OLModalHeader><OLModalTitle>Inspect interrupted write</OLModalTitle></OLModalHeader>
      <OLModalBody>
        <p>This inspection is read-only. Matching text does not prove the earlier write succeeded. Confirming a recorded server acknowledgement updates task status only; it does not write the document again.</p>
        {recovered === 'accepted' && <p role="status">Task recovery confirmed. The document was not rewritten.</p>}
        {(recovered === 'closed-unconfirmed' || result?.status === 'closed-unconfirmed') && <p role="status">Closed without retry. The earlier write outcome remains unconfirmed; evidence is retained.</p>}
        {error ? <p role="alert">{error}</p> : !result ? <p role="status">Reading current document…</p> : <>
          <p role="status">{descriptions[result.comparison] || 'Current document state is unknown.'}</p>
          {result.acknowledgement && <p>The document service acknowledged this operation at {result.acknowledgement.acknowledgedAt}. Final task settlement remains unconfirmed; this inspection does not replay the write.</p>}
          {!result.workspaceMatches && <p role="alert">The workspace has changed since this task. These snapshots belong to the original workspace state.</p>}
          <p>Checked: {result.checkedAt}</p>
          {result.current && <p>Current file: {result.current.path} · version {result.current.version}</p>}
          <details><summary>Original and proposed text</summary><ProposalDiff before={result.baseline.content} after={result.proposed.content} /></details>
          {result.current && <details><summary>Original and current text</summary><ProposalDiff before={result.baseline.content} after={result.current.content} /></details>}
        </>}
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" disabled={recovering} onClick={() => setRevision(value => value + 1)}>Inspect again</OLButton>
        {result?.acknowledgement && !recovered && <OLButton variant="primary" disabled={recovering} onClick={() => recover()}>Confirm acknowledged write</OLButton>}
        {result && !result.acknowledgement && result.status !== 'closed-unconfirmed' && !recovered && <>
          <p>Closing only ends this task's retry path. It does not undo or confirm the earlier write. Keep the current document and review it before starting another task.</p>
          <OLButton variant="secondary" disabled={recovering || !result.fingerprint} onClick={() => recover(true)}>Close without retry</OLButton>
        </>}
        <OLButton variant="secondary" disabled={!result} onClick={download}>Download recovery snapshot</OLButton>
        <OLButton variant="secondary" onClick={() => setOpen(false)}>Close inspection</OLButton>
      </OLModalFooter>
    </OLModal>
  </>
}
