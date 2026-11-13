import MaterialIcon from '@/shared/components/material-icon'
import { useState } from 'react'
import { Modal } from 'react-bootstrap'

export type WorktreeEntry = {
  id: string; head: string; branch: string | null; detached: boolean
  current: boolean; main: boolean; locked: boolean; changedFiles: number; cleanupBlocked: string | null
}
export default function WorktreeManager({ entries, busy, error, reload, clean, onClose }: {
  entries: WorktreeEntry[]; busy: boolean; error: string
  reload: () => void; clean: (entry: WorktreeEntry) => Promise<boolean>; onClose: () => void
}) {
  const [confirm, setConfirm] = useState<string>()
  return <Modal className="native-git-dialog" show onHide={() => { if (!busy) onClose() }} aria-label="Worktrees">
    <Modal.Header closeButton><Modal.Title>Worktrees</Modal.Title></Modal.Header>
    <Modal.Body className="native-git-stashes">
      <p>Each branch keeps its own unfinished work. Switching branches creates or reuses its workspace.</p>
      {error && <p role="alert" className="native-git-error">{error}</p>}
      <button type="button" className="btn btn-default btn-sm" disabled={busy} onClick={() => { setConfirm(undefined); reload() }}><MaterialIcon type="refresh" />Refresh worktrees</button>
      {entries.map(entry => <section className="native-git-stash" key={entry.id}>
        <strong>{entry.branch || 'Detached HEAD'}</strong>{entry.current && <span> · Current</span>}
        <p className="native-git-stash-meta">{entry.head.slice(0, 8)} · {entry.changedFiles} changed or ignored files</p>
        {entry.cleanupBlocked && <p>{entry.cleanupBlocked}</p>}
        <button type="button" className="btn btn-default btn-sm" disabled={busy || !!entry.cleanupBlocked} onClick={() => setConfirm(entry.id)}>Clean up workspace…</button>
        {confirm === entry.id && <div className="native-git-stash-confirm">
          <p>Remove the clean workspace for {entry.branch || entry.head.slice(0, 8)}? Branches and commits stay in the repository.</p>
          <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={async () => { if (await clean(entry)) setConfirm(undefined) }}>Clean up workspace</button>{' '}
          <button type="button" className="btn btn-default btn-sm" disabled={busy} onClick={() => setConfirm(undefined)}><MaterialIcon type="close" />Cancel</button>
        </div>}
      </section>)}
    </Modal.Body>
  </Modal>
}
