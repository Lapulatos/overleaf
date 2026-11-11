import MaterialIcon from '@/shared/components/material-icon'
import { newEditorIconTypeFromName } from '@/features/file-tree/util/icon-type-from-name'

export function FileLabel({ path }: { path: string }) {
  const parts = path.split('/')
  const name = parts.pop() || path
  const extension = name.split('.').pop()?.toLowerCase() || ''
  const kind = ['tex', 'bib', 'pdf', 'py', 'json', 'md'].includes(extension) ? extension : 'file'
  return <><span className={`native-git-file-icon native-git-kind-${kind}`} aria-hidden="true">
    <MaterialIcon type={newEditorIconTypeFromName(name)} />
  </span><span className="native-git-file-basename">{name}</span>
    {!!parts.length && <span className="native-git-file-directory">{parts.join('/')}</span>}</>
}
const labels: Record<string, string> = { M: 'Modified', A: 'Added', D: 'Deleted', R: 'Renamed', C: 'Copied', U: 'Untracked', '?': 'Untracked', '!': 'Ignored', T: 'Type changed' }
export function FileStatus({ status, conflict = false }: { status: string; conflict?: boolean }) {
  const code = conflict ? '!' : status === '?' ? 'U' : status
  const label = conflict ? 'Conflict' : labels[status] || status
  return <span className={`native-git-file-status native-git-status-${conflict ? 'conflict' : code}`} title={label} aria-label={label}>{code}</span>
}

export function OpenFileIcon() {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 2h4l3 3v12H5V9M14 2v4h4M2 5h9M8 2l3 3-3 3" /></svg>
}
