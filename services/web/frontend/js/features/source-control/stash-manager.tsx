import MaterialIcon from '@/shared/components/material-icon'
import { formatGitDate } from './format-date'
import { useEffect, useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'
import type { GitCommand } from './api'
import type { GitSnapshot } from './types'

export type StashEntry = { hash: string; message: string; date: string; author_name: string }

export default function StashManager({ intent, entries, command, reload, busy, error, onClose, onPreview }: {
  intent?: 'apply'|'pop'|'drop'|'view'
  entries: StashEntry[]
  command: (body: GitCommand) => Promise<GitSnapshot | undefined>
  reload: () => Promise<void>
  busy: boolean
  error: string
  onPreview: (title: string, patch: string) => void
  onClose: () => void
}) {
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [deleting, setDeleting] = useState<string>()
  const action = async (name: string, entry: StashEntry, index: number, pop = false) => {
    const result = await command({ command: name, index, expectedHash: entry.hash, ...(name === 'applyStash' ? { pop } : {}) })
    if (!result || !mounted.current) return
    if (name === 'stashDiff') onPreview(entry.message, String(result.result || 'No text differences'))
    else {
      setDeleting(undefined)
      await reload()
    }
  }
  return <Modal className="native-git-dialog" show onHide={onClose} size="lg" aria-label="Stashes">
    <Modal.Header closeButton><Modal.Title>Stashes</Modal.Title></Modal.Header>
    <Modal.Body className="native-git-stashes">
      {error && <p role="alert" className="native-git-error">{error}</p>}
      <div className="native-git-diff-toolbar"><span>{entries.length} saved changes</span>
        <button type="button" className="btn btn-default btn-sm" disabled={busy} onClick={async () => {
          setDeleting(undefined); await reload()
        }}><MaterialIcon type="refresh" />Refresh stashes</button></div>
      {!entries.length && <p>No stashes.</p>}
      {entries.map((entry, index) => <section className="native-git-stash" key={entry.hash}>
        <strong>{entry.message}</strong>
        <p className="native-git-stash-meta">stash@{'{'}{index}{'}'} · {entry.author_name} · {formatGitDate(entry.date)} · {entry.hash.slice(0, 8)}</p>
        <div className="native-git-stash-actions">
          {(!intent || intent === 'view') && <button type="button" className="btn btn-default btn-sm" disabled={busy} onClick={() => action('stashDiff', entry, index)}>View changes</button>}
          {(!intent || intent === 'apply') && <button type="button" className="btn btn-default btn-sm" disabled={busy} title="Restore changes and keep this stash" onClick={() => action('applyStash', entry, index)}><MaterialIcon type="check" />Apply</button>}
          {(!intent || intent === 'pop') && <button type="button" className="btn btn-default btn-sm" disabled={busy} title="Restore changes and remove this stash on success" onClick={() => action('applyStash', entry, index, true)}>Pop</button>}
          {(!intent || intent === 'drop') && <button type="button" className="btn btn-default btn-sm" disabled={busy} onClick={() => setDeleting(entry.hash)}><MaterialIcon type="delete" />Delete…</button>}
        </div>
        {deleting === entry.hash && <div className="native-git-stash-confirm">
          <p>Delete “{entry.message}”? This removes the saved changes without restoring them.</p>
          <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => action('dropStash', entry, index)}><MaterialIcon type="delete" />Delete stash</button>{' '}
          <button type="button" className="btn btn-default btn-sm" disabled={busy} onClick={() => setDeleting(undefined)}><MaterialIcon type="close" />Cancel</button>
        </div>}
      </section>)}
    </Modal.Body>
  </Modal>
}
