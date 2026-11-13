import MaterialIcon from '@/shared/components/material-icon'
import { useState } from 'react'
import { Modal } from 'react-bootstrap'

export default function IgnoredFiles({ paths, busy, error, onStage, onRefresh, onClose }: {
  paths: string[]; busy: boolean; error: string
  onStage: (path: string) => void; onRefresh: () => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const visible = paths.filter(path => path.toLowerCase().includes(query.toLowerCase()))
  return <Modal className="native-git-dialog" show onHide={() => { if (!busy) onClose() }} aria-label="Ignored files">
    <Modal.Header closeButton><Modal.Title>Ignored files</Modal.Title></Modal.Header>
    <Modal.Body>
      {error && <p role="alert" className="native-git-error">{error}</p>}
      <p>Git excludes these files from Changes. Stage anyway adds a file to the index without changing ignore rules.</p>
      <input type="search" className="form-control" autoFocus aria-label="Search ignored files" placeholder="Search files…" value={query} disabled={busy} onChange={event => setQuery(event.target.value)} />
      <div className="native-git-merge-choices">
        {visible.map(path => <div className="native-git-file" key={path}>
          <span className="native-git-file-name">{path}</span>
          <button type="button" className="btn btn-default btn-sm" disabled={busy} aria-label={`Stage ignored file ${path}`} onClick={() => onStage(path)}>Stage anyway</button>
        </div>)}
        {!visible.length && <p>{paths.length ? 'No matching ignored files.' : 'No ignored files.'}</p>}
      </div>
    </Modal.Body>
    <Modal.Footer>
      <button type="button" className="btn btn-default" disabled={busy} onClick={onRefresh}><MaterialIcon type="refresh" />Refresh</button>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={onClose}><MaterialIcon type="close" />Close</button>
    </Modal.Footer>
  </Modal>
}
