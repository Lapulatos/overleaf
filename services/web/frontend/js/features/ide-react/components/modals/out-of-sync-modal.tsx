import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { memo, useState } from 'react'
import { useLocation } from '@/shared/hooks/use-location'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'

export type OutOfSyncModalProps = {
  editorContent: string
  recoveryNotice?: string
  show: boolean
  onHide: () => void
}

function OutOfSyncModal({ editorContent, recoveryNotice, show, onHide }: OutOfSyncModalProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const [editorContentShown, setEditorContentShown] = useState(false)
  const editorContentRows = (editorContent.match(/\n/g)?.length || 0) + 1

  // Reload the page to avoid staying in an inconsistent state.
  // https://github.com/overleaf/issues/issues/3694
  function done() {
    onHide()
    location.reload()
  }

  return (
    <OLModal
      show={show}
      onHide={done}
      className="out-of-sync-modal"
      backdrop={false}
      keyboard={false}
    >
      <OLModalHeader>
        <OLModalTitle>{t('out_of_sync')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody className="modal-body-share">
        <p>The editor needs to reconnect before you continue writing.</p>
        <ol>
          <li>Download or view your local text below before reloading.</li>
          <li>Reload the editor to get the current server version.</li>
          <li>Compare your saved text with the reopened file and restore any missing edits. Saved recovery copies are available under Local recovery copies.</li>
        </ol>
      </OLModalBody>
      <OLModalBody>
        {recoveryNotice && <p role="status">{recoveryNotice}</p>}
        <OLButton
          variant="secondary"
          onClick={() => setEditorContentShown(shown => !shown)}
        >
          <MaterialIcon type="description" />{editorContentShown
            ? t('hide_local_file_contents')
            : t('show_local_file_contents')}
        </OLButton>
        <OLButton variant="secondary" onClick={() => {
          const url = URL.createObjectURL(new Blob([editorContent], { type: 'text/plain;charset=utf-8' }))
          const link = document.createElement('a'); link.href = url; link.download = 'local-recovery.txt'; link.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }}><MaterialIcon type="download" />Download local text</OLButton>
        {editorContentShown ? (
          <div className="text-preview">
            <textarea
              className="scroll-container"
              readOnly
              rows={editorContentRows}
              value={editorContent}
            />
          </div>
        ) : null}
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={done}>
          <MaterialIcon type="refresh" />{t('reload_editor')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(OutOfSyncModal)
