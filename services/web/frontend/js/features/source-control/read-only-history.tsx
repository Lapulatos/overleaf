import MaterialIcon from '@/shared/components/material-icon'
import { viewGitCommit } from './git-presence-state'
import { useEffect, useRef, useState } from 'react'
import { Modal } from 'react-bootstrap'
import GraphHistory from './graph-history'
import { FilePreview, hasVisualPreview, type FileVersions } from './file-preview'
import { errorMessage, type GitApi } from './api'
import { formatGitDate } from './format-date'
import type { GitCommit, GitSnapshot, CommitFile } from './types'
export default function ReadOnlyHistory({ api, snapshot, onRefresh }: { api: GitApi; snapshot: GitSnapshot; onRefresh(): unknown }) {
  const [selected, setSelected] = useState<GitCommit>()
  const [details, setDetails] = useState<{ message: string; files: CommitFile[] }>()
  const [file, setFile] = useState<{ title: string; patch?: string; versions?: FileVersions }>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const request = useRef(0)
  useEffect(() => { viewGitCommit(api.projectId, selected?.hash || null); return () => viewGitCommit(api.projectId, null) }, [api.projectId, selected?.hash])
  const select = async (commit: GitCommit) => {
    const generation = ++request.current
    setSelected(commit); setDetails(undefined); setFile(undefined); setError(''); setBusy(true)
    try {
      const response = await api.command({ command: 'commitDetails', ref: commit.hash })
      if (generation === request.current) setDetails(response.result as { message: string; files: CommitFile[] })
    } catch (reason) { if (generation === request.current) setError(errorMessage(reason)) }
    finally { if (generation === request.current) setBusy(false) }
  }
  const openFile = async (path: string) => {
    if (!selected) return
    const generation = ++request.current
    setError(''); setBusy(true)
    try {
      const visual = hasVisualPreview(path)
      const response = await api.command({ command: visual ? 'commitFilePreview' : 'commitFileDiff', ref: selected.hash, path })
      if (generation === request.current) setFile(visual ? { title: path, versions: response.result as FileVersions } : { title: path, patch: response.result as string })
    } catch (reason) { if (generation === request.current) setError(errorMessage(reason)) }
    finally { if (generation === request.current) setBusy(false) }
  }
  return <div className="native-git-panel">
    <p role="status">Read-only project access. You can inspect commits and file history; repository changes require edit access.</p>
    {snapshot.connected === false ? <p>This project has no initialized Git repository.</p> : <GraphHistory api={api} inlineToolbar commits={snapshot.graph || []} branches={[...(snapshot.branches || []), ...(snapshot.tags || [])]} busy={busy}
      onSelect={commit => void select(commit)} extraTools={<button type="button" className="btn btn-link" onClick={() => onRefresh()}><MaterialIcon type="refresh" />Refresh history</button>} />}
    <Modal className="native-git-dialog" show={!!selected} onHide={() => { request.current++; setSelected(undefined); setBusy(false) }} aria-label="Read-only commit details">
      <Modal.Header closeButton><Modal.Title>{file ? file.title : 'Commit details'}</Modal.Title></Modal.Header>
      <Modal.Body>
        {selected && <p>{selected.hash.slice(0, 8)} · {selected.author} · {formatGitDate(selected.date)}</p>}
        {busy && <p role="status">Loading history…</p>}{error && <p role="alert">{error}</p>}
        {file ? <><button className="btn btn-link" onClick={() => setFile(undefined)}>Back to commit</button>{file.versions ? <FilePreview title={file.title} versions={file.versions} /> : <pre>{file.patch}</pre>}</> : details && <>
          <pre>{details.message}</pre><ul>{details.files.map(item => <li key={item.path}><button className="btn btn-link" disabled={busy} onClick={() => void openFile(item.path)}>{item.status} {item.path}</button></li>)}</ul>
        </>}
      </Modal.Body>
    </Modal>
  </div>
}
