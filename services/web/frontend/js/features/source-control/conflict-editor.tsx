import MaterialIcon from '@/shared/components/material-icon'
import { useState } from 'react'
import { Modal } from 'react-bootstrap'

type Version = { kind: 'text' | 'deleted' | 'binary' | 'large'; text: string | null }
export type ConflictDetails = {
  path: string; fingerprint: string; operation: string | null
  versions: { base: Version; current: Version; incoming: Version }; working: Version
}
export default function ConflictEditor({ details, busy, error, onResolve, onClose }: {
  details: ConflictDetails; busy: boolean; error: string
  onResolve: (choice: 'current' | 'incoming' | 'edited', text?: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(details.working.text || '')
  const preview = (version: Version) => version.kind === 'text' ? version.text
    : version.kind === 'deleted' ? 'File does not exist in this version.'
      : version.kind === 'large' ? 'File is too large for a text preview.' : 'Binary file; choose a version to preserve its bytes.'
  return <Modal className="native-git-dialog" show size="xl" onHide={() => { if (!busy) onClose() }} aria-label="Resolve conflict">
    <Modal.Header closeButton><Modal.Title>Resolve conflict · {details.path}</Modal.Title></Modal.Header>
    <Modal.Body className="native-git-conflict-editor">
      {error && <p role="alert" className="native-git-error">{error}</p>}
      {details.operation === 'rebase' && <p>During rebase, Current is the branch being rebased onto; Incoming is the commit being replayed.</p>}
      <div className="native-git-conflict-versions">
        {(['base', 'current', 'incoming'] as const).map(name => <section key={name}>
          <h5>{name === 'base' ? 'Base' : name === 'current' ? 'Current' : 'Incoming'}</h5>
          <pre>{preview(details.versions[name])}</pre>
          {name !== 'base' && <button type="button" className="btn btn-default btn-sm" disabled={busy} onClick={() => onResolve(name)}><MaterialIcon type="delete" />
            {details.versions[name].kind === 'deleted' ? `Accept ${name} deletion & stage` : `Use ${name} & stage`}
          </button>}
        </section>)}
      </div>
      {details.working.kind === 'text' && <label className="native-git-field">Merged result
        <textarea className="form-control native-git-conflict-result" value={text} disabled={busy} spellCheck={false} onChange={event => setText(event.target.value)} />
      </label>}
    </Modal.Body>
    <Modal.Footer>
      <button type="button" className="btn btn-default" disabled={busy} onClick={onClose}><MaterialIcon type="close" />Close</button>
      {details.working.kind === 'text' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onResolve('edited', text)}><MaterialIcon type="save" />Save result & stage</button>}
    </Modal.Footer>
  </Modal>
}
