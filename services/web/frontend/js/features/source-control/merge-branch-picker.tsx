import MaterialIcon from '@/shared/components/material-icon'
import { formatGitDate } from './format-date'
import { useMemo, useState } from 'react'
import { Modal } from 'react-bootstrap'
import { branchChoices, filterBranches } from './branch-choices'
import type { GitBranch } from './types'

export default function MergeBranchPicker({ branches, target, busy, error, preview = false, onMerge, onClose }: {
  preview?: boolean; branches: GitBranch[]; target: string; busy: boolean; error: string
  onMerge: (ref: string) => void; onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string>()
  const choices = useMemo(() => branchChoices(branches, target).filter(branch => !branch.current), [branches, target])
  const visible = filterBranches(choices, query)
  const source = choices.find(branch => branch.ref === selected)
  return <Modal className="native-git-dialog" show onHide={() => { if (!busy) onClose() }} aria-label="Merge branch">
    <Modal.Header closeButton><Modal.Title>Merge into {target}</Modal.Title></Modal.Header>
    <Modal.Body>
      {error && <p role="alert" className="native-git-error">{error}</p>}
      <p role="status">{source ? `${source.name} → ${target}` : `Target branch: ${target}`}</p>
      <input type="search" className="form-control" autoFocus aria-label="Search source branches" placeholder="Search branches, authors or commits…"
        value={query} disabled={busy} onChange={event => { setQuery(event.target.value); setSelected(undefined) }} />
      <div className="native-git-merge-choices" role="radiogroup" aria-label="Source branch">
        {visible.map(branch => <label className="native-git-merge-choice" key={branch.ref}>
          <input type="radio" name="merge-source" disabled={busy} value={branch.ref} checked={selected === branch.ref}
            onChange={() => setSelected(branch.ref)} />
          <span>
            <strong>{branch.name}</strong>{branch.remote && <span> · Remote</span>}
            <span className="native-git-merge-meta">{branch.author} · {branch.commit.slice(0, 8)} · <time dateTime={branch.date}>{branch.date ? formatGitDate(branch.date) : ''}</time></span>
            <span className="native-git-merge-meta">{branch.subject}</span>
          </span>
        </label>)}
        {!visible.length && <p className="native-git-empty">{choices.length ? 'No matching branches.' : 'No other branches available.'}</p>}
      </div>
    </Modal.Body>
    <Modal.Footer>
      <button type="button" className="btn btn-default" disabled={busy} onClick={onClose}><MaterialIcon type="close" />Cancel</button>
      <button type="button" className="btn btn-primary" disabled={busy || !source} onClick={() => { if (source) onMerge(source.ref) }}><MaterialIcon type="merge" />{preview ? 'Preview changes' : `Merge into ${target}`}</button>
    </Modal.Footer>
  </Modal>
}
