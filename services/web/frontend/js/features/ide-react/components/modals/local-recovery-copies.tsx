import MaterialIcon from '@/shared/components/material-icon'
import { formatGitDate } from '@/features/source-control/format-date'
import { useEffect, useState } from 'react'
import { listLocalRecovery, removeLocalRecovery, type LocalRecovery } from '../../editor/local-recovery'
import OLButton from '@/shared/components/ol/ol-button'
import { OLModal, OLModalBody, OLModalFooter, OLModalHeader, OLModalTitle } from '@/shared/components/ol/ol-modal'

export default function LocalRecoveryCopies({ userId, workspaceId, revision }: { userId?: string; workspaceId: string; revision: number }) {
  const [copies, setCopies] = useState<LocalRecovery[]>([])
  const [error, setError] = useState('')
  const [show, setShow] = useState(false)
  const [selected, setSelected] = useState<string>()
  const [selectedDoc, setSelectedDoc] = useState('')
  useEffect(() => {
    const refresh = () => {
      setSelected(undefined)
      setCopies([])
      if (!userId) return
      try { setCopies(listLocalRecovery(localStorage, userId, workspaceId)); setError('') }
      catch { setError('Local recovery copies could not be read. Browser storage may be unavailable or damaged.') }
    }
    refresh()
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [userId, workspaceId, revision])
  const current = (copies.find(copy => copy.id === selected) ?? copies[0])
  if (!userId || (!copies.length && !error)) return null
  const download = (copy: LocalRecovery) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `recovery-${copy.workspaceId}-${copy.id}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <>
    <div style={{ position: 'fixed', bottom: 12, right: 24, zIndex: 1040 }}>
      <OLButton variant="secondary" onClick={() => setShow(true)}><MaterialIcon type="restore" /> Local recovery copies ({copies.length})</OLButton>
    </div>
    <OLModal show={show} onHide={() => setShow(false)} className="native-git-dialog local-recovery-dialog">
      <OLModalHeader closeButton><OLModalTitle><MaterialIcon type="restore" /> Local recovery copies</OLModalTitle></OLModalHeader>
      <OLModalBody>
        <p className="local-recovery-caption"><MaterialIcon type="info" /> Saved text from an interrupted editing session. Preview it here, then copy any missing edits into your file.</p>
        {error && <p role="alert">{error}</p>}
        <div className="local-recovery-layout">
          <aside aria-label="Saved copies" className="local-recovery-list">
            <h5><MaterialIcon type="history" /> Saved copies <span>({copies.length})</span></h5>
            {copies.map(copy => <button type="button" key={copy.id} className={`local-recovery-item${current?.id === copy.id ? ' is-selected' : ''}`} aria-pressed={current?.id === copy.id} onClick={() => { setSelected(copy.id); setSelectedDoc('') }}>
              <MaterialIcon type="description" /><span><strong>{formatGitDate(copy.createdAt)}</strong><small>{copy.documents?.length || 1} file{(copy.documents?.length || 1) > 1 ? 's' : ''}</small></span>
            </button>)}
            <p className="local-recovery-storage"><MaterialIcon type="computer" /> Only in this browser. Download before clearing browser data.</p>
          </aside>
          {current && <section className="local-recovery-preview" aria-label="Recovery preview">
            <div className="local-recovery-preview-heading"><strong><MaterialIcon type="visibility" /> Text preview</strong><span>Read only</span></div>
            {!!current.documents?.length && <label className="local-recovery-file"><MaterialIcon type="description" /> File
              <select className="form-control" aria-label="Recovered document" value={selectedDoc} onChange={event => setSelectedDoc(event.target.value)}>
                <option value="">{current.documents.length > 1 ? 'All saved text' : current.documents[0].name || 'Saved text'}</option>
                {current.documents.length > 1 && current.documents.map((doc, index) => <option key={doc.docId} value={doc.docId}>{doc.name || `File ${index + 1}`}</option>)}
              </select>
            </label>}
            <textarea className="form-control local-recovery-text" aria-label="Saved local recovery text" readOnly value={current.documents?.find(doc => doc.docId === selectedDoc)?.content ?? current.content} rows={14} />
            <small>Your project is unchanged. Nothing is restored automatically.</small>
          </section>}
        </div>
      </OLModalBody>
      <OLModalFooter>
        {current && <OLButton variant="secondary" className="local-recovery-remove" onClick={() => {
          if (!window.confirm('Delete this browser copy? Download it first if you still need the saved text. Your project will not be changed.')) return
          try { removeLocalRecovery(localStorage, userId, workspaceId, current.id); setCopies(value => value.filter(copy => copy.id !== current.id)); setSelected(undefined); setSelectedDoc('') }
          catch { setError('The recovery copy could not be removed.') }
        }}><MaterialIcon type="delete_outline" /> Delete copy</OLButton>}
        <OLButton variant="secondary" onClick={() => setShow(false)}><MaterialIcon type="close" /> Close</OLButton>
        {current && <OLButton variant="primary" onClick={() => download(current)}><MaterialIcon type="download" /> Download copy</OLButton>}
      </OLModalFooter>
    </OLModal>
  </>
}
