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
  const current = copies.find(copy => copy.id === selected)
  if (!userId || (!copies.length && !error)) return null
  const download = (copy: LocalRecovery) => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(copy, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `recovery-${copy.workspaceId}-${copy.id}.json`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <>
    <div style={{ position: 'fixed', bottom: 12, right: 24, zIndex: 1040 }}>
      <OLButton variant="secondary" onClick={() => setShow(true)}>Local recovery copies ({copies.length})</OLButton>
    </div>
    <OLModal show={show} onHide={() => setShow(false)}>
      <OLModalHeader closeButton><OLModalTitle>Local recovery copies</OLModalTitle></OLModalHeader>
      <OLModalBody>
        <p>These copies are stored in this browser for your account and this workspace. Download a copy before clearing browser data. Nothing is applied to the project automatically.</p>
        {error && <p role="alert">{error}</p>}
        {copies.map(copy => <div key={copy.id}>
          <OLButton variant="link" onClick={() => { setSelected(copy.id); setSelectedDoc('') }}>{formatGitDate(copy.createdAt)} · version {copy.epoch}</OLButton>
          <OLButton variant="secondary" onClick={() => download(copy)}>Download copy</OLButton>
        </div>)}
        {current?.documents && <label>Recovered document
          <select aria-label="Recovered document" value={selectedDoc} onChange={event => setSelectedDoc(event.target.value)}>
            <option value="">Original recovery text</option>
            {current.documents.map(doc => <option key={doc.docId} value={doc.docId}>{doc.name || 'Unnamed document'} · {doc.docId} · version {doc.version ?? 'unknown'}</option>)}
          </select>
        </label>}
        {current?.documents && <p>Document IDs identify the original files. Renamed or recreated files are not restored automatically.</p>}
        {current && <textarea aria-label="Saved local recovery text" readOnly value={current.documents?.find(doc => doc.docId === selectedDoc)?.content ?? current.content} rows={12} style={{ width: '100%' }} />}
      </OLModalBody>
      <OLModalFooter>
        {current && <OLButton variant="secondary" onClick={() => {
          try { removeLocalRecovery(localStorage, userId, workspaceId, current.id); setCopies(value => value.filter(copy => copy.id !== current.id)); setSelected(undefined) }
          catch { setError('The recovery copy could not be removed.') }
        }}>Delete selected local copy</OLButton>}
        <OLButton variant="secondary" onClick={() => setShow(false)}>Close</OLButton>
      </OLModalFooter>
    </OLModal>
  </>
}
