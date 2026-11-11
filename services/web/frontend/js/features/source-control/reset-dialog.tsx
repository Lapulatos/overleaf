import { formatGitDate } from './format-date'
import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import type { GitCommit } from './types'

export type ResetPreview = { target: string; head: string; branch: string | null; fingerprint: string; changes: string; untracked: string[] }
export type ResetMode = 'soft' | 'mixed' | 'hard'
const modes: { value: ResetMode; label: string; description: string }[] = [
  { value: 'soft', label: 'Soft — keep staged changes', description: 'Move the branch pointer. Keep the index and project files unchanged.' },
  { value: 'mixed', label: 'Mixed — keep file changes', description: 'Move the branch pointer and unstage changes. Keep project files unchanged.' },
  { value: 'hard', label: 'Hard — discard file changes', description: 'Replace the index and tracked project files with the selected commit. Untracked files blocking tracked paths may also be removed.' },
]

export default function ResetDialog({ commits, busy, error, onPreview, onReset, onClose }: {
  commits: GitCommit[]; busy: boolean; error: string
  onPreview: (ref: string) => Promise<ResetPreview | undefined>
  onReset: (preview: ResetPreview, mode: ResetMode) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string>()
  const [preview, setPreview] = useState<ResetPreview>()
  const [mode, setMode] = useState<ResetMode>('mixed')
  const [confirmed, setConfirmed] = useState(false)
  const visible = commits.filter(commit => `${commit.hash} ${commit.subject} ${commit.author} ${commit.refs}`.toLowerCase().includes(query.toLowerCase()))
  const refresh = async () => {
    if (!selected) return
    setPreview(undefined); setConfirmed(false)
    setPreview(await onPreview(selected))
  }
  return <Modal show size="lg" onHide={() => { if (!busy) onClose() }} aria-label="Reset current branch">
    <Modal.Header closeButton><Modal.Title>Reset current branch</Modal.Title></Modal.Header>
    <Modal.Body>
      {error && <p role="alert" className="native-git-error">{error}</p>}
      <input type="search" autoFocus className="form-control" aria-label="Search reset commits" placeholder="Search commits, authors or references…" value={query} disabled={busy}
        onChange={event => { setQuery(event.target.value); setSelected(undefined); setPreview(undefined); setConfirmed(false) }} />
      <div className="native-git-merge-choices" role="radiogroup" aria-label="Reset target commit">
        {visible.map(commit => <label className="native-git-merge-choice" key={commit.hash}>
          <input type="radio" name="reset-target" checked={selected === commit.hash} disabled={busy} onChange={() => { setSelected(commit.hash); setPreview(undefined); setConfirmed(false) }} />
          <span><strong>{commit.subject}</strong><span className="native-git-merge-meta">{commit.hash.slice(0, 8)} · {commit.author} · {formatGitDate(commit.date)} {commit.refs}</span></span>
        </label>)}
        {!visible.length && <p>No matching commits in loaded history.</p>}
      </div>
      <button type="button" className="btn btn-default" disabled={busy || !selected} onClick={refresh}>Preview reset</button>
      {preview && <>
        <p>{preview.branch || 'Detached HEAD'}: {preview.head.slice(0, 8)} → {preview.target.slice(0, 8)}</p>
        <pre>{preview.changes || 'No tracked file differences.'}</pre>
        {!!preview.untracked.length && <p>Untracked files: {preview.untracked.join(', ')}</p>}
        <fieldset><legend>Reset mode</legend>{modes.map(option => <label className="native-git-merge-choice" key={option.value}>
          <input type="radio" name="reset-mode" checked={mode === option.value} disabled={busy} onChange={() => { setMode(option.value); setConfirmed(false) }} />
          <span><strong>{option.label}</strong><span className="native-git-merge-meta">{option.description}</span></span>
        </label>)}</fieldset>
        {mode === 'hard' && <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> Discard changes and replace files with this commit</label>}
      </>}
    </Modal.Body>
    <Modal.Footer>
      <button type="button" className="btn btn-default" disabled={busy} onClick={onClose}>Cancel</button>
      <button type="button" className={`btn ${mode === 'hard' ? 'btn-danger' : 'btn-primary'}`} disabled={busy || !preview || (mode === 'hard' && !confirmed)} onClick={() => { if (preview) onReset(preview, mode) }}>Reset branch</button>
    </Modal.Footer>
  </Modal>
}
