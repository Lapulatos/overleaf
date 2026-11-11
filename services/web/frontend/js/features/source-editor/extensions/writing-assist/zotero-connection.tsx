import { useEffect, useRef, useState } from 'react'
import { getJSON, postJSON, deleteJSON } from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
import OLButton from '@/shared/components/ol/ol-button'
import { message } from './agent-task-result'

type Status = { connected: boolean; libraryId: string | null }
export function ZoteroConnection({
  endpoint,
  disabled,
  onConnectionChange,
}: {
  endpoint: string
  disabled: boolean
  onConnectionChange: (connected: boolean) => void
}) {
  const [status, setStatus] = useState<Status | null>(null)
  const [libraryId, setLibraryId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<AbortController | null>(null)
  const identityEdited = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    request.current = controller
    getJSON<Status>(endpoint, { signal: controller.signal })
      .then((value) => {
        if (!value || controller.signal.aborted) return
        setStatus(value)
        if (!identityEdited.current) setLibraryId(value.libraryId || '')
        onConnectionChange(value.connected)
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(message(error))
      })
    return () => {
      request.current?.abort()
      request.current = null
    }
  }, [endpoint, onConnectionChange])

  async function change(disconnect: boolean) {
    if (busy || disabled) return
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setBusy(true)
    setError('')
    try {
      const value = disconnect
        ? await deleteJSON<Status>(endpoint, { signal: controller.signal })
        : await postJSON<Status>(endpoint, {
            body: { libraryId: libraryId.trim(), apiKey: apiKey.trim() },
            signal: controller.signal,
          })
      if (controller.signal.aborted) return
      setStatus(value)
      onConnectionChange(value.connected)
    } catch (error) {
      if (!controller.signal.aborted) setError(message(error))
    } finally {
      if (!controller.signal.aborted) {
        setApiKey('')
        setBusy(false)
      }
    }
  }

  return (
    <section className="paper-zotero-settings" aria-label="Zotero connection">
      <div className="paper-zotero-status"><span>{status?.connected ? `Connected · Library ${status.libraryId}` : 'Not connected'}</span>
        <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener noreferrer">API keys</a></div>
      <label htmlFor="zotero-user-id">Zotero user ID</label>
      <input
        id="zotero-user-id"
        className="form-control"
        inputMode="numeric"
        maxLength={12}
        value={libraryId}
        disabled={busy || disabled}
        onChange={(event) => {
          identityEdited.current = true
          setLibraryId(event.target.value)
        }}
      />
      <label htmlFor="zotero-api-key">Zotero API key</label>
      <div className="paper-literature-input-row">
      <input
        id="zotero-api-key"
        className="form-control"
        type="password"
        autoComplete="off"
        maxLength={128}
        value={apiKey}
        disabled={busy || disabled}
        onChange={(event) => setApiKey(event.target.value)}
      />
      <OLButton
        disabled={busy || disabled || !libraryId.trim() || !apiKey.trim()}
        className="paper-literature-icon-button"
        aria-label={status?.connected ? 'Replace Zotero connection' : 'Connect Zotero'}
        title={status?.connected ? 'Replace Zotero connection' : 'Connect Zotero'}
        onClick={() => change(false)}
      >
        <MaterialIcon type={status?.connected ? 'sync' : 'link'} />
      </OLButton>
      {status?.connected && (
        <OLButton className="paper-literature-icon-button" variant="secondary" aria-label="Disconnect Zotero" title="Disconnect Zotero" disabled={busy || disabled} onClick={() => change(true)}>
          <MaterialIcon type="link_off" />
        </OLButton>
      )}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
