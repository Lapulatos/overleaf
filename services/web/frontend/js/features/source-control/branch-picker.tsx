import { formatGitDate } from './format-date'
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from 'react'
import { Overlay, Popover } from 'react-bootstrap'
import { branchChoices, filterBranches } from './branch-choices'
import type { BranchChoice, GitBranch } from './types'
import './source-control.css'

type Props = {
  target: RefObject<HTMLElement>
  show: boolean
  branches: GitBranch[]
  tags?: GitBranch[]
  current: string | null
  busy?: boolean
  error?: string
  onClose: () => void
  onCheckout: (branch: BranchChoice) => void
  onCreate: (chooseBase: boolean) => void
  onDetached: () => void
}

export function BranchIcon({ className = '' }: { className?: string }) {
  return <svg className={`native-git-icon ${className}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="5" cy="4" r="2" /><circle cx="15" cy="4" r="2" /><circle cx="5" cy="16" r="2" />
    <path d="M5 6v8m10-8c0 6-10 2-10 8" />
  </svg>
}

export default function BranchPicker({ target, show, branches, tags = [], current, busy = false, error,
  onClose, onCheckout, onCreate, onDetached }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const listId = useId()
  const choices = useMemo(() => filterBranches([...branchChoices(branches, current), ...tags.map(tag => ({ ...tag, current: false }))], query), [branches, tags, current, query])
  const actions = [
    { label: 'Create new branch…', icon: '+', run: () => onCreate(false) },
    { label: 'Create new branch from…', icon: '+', run: () => onCreate(true) },
    { label: 'Checkout detached…', icon: '↗', run: onDetached },
  ]
  useEffect(() => { if (show) { setQuery(''); setActive(0) } }, [show])
  const activate = (index: number) => {
    if (busy) return
    if (index < actions.length) actions[index].run()
    else if (choices[index - actions.length]) onCheckout(choices[index - actions.length])
  }
  return <Overlay target={target.current} show={show} placement="bottom-end" rootClose onHide={onClose}
    onEntered={() => input.current?.focus()} flip>
    <Popover className="native-git-picker" aria-label="Switch branch">
      <div className="native-git-picker-search">
        <input ref={input} className="form-control" value={query} type="search" autoComplete="off"
          role="combobox" aria-label="Select a branch or tag to checkout" aria-expanded="true" aria-controls={listId}
          aria-activedescendant={`${listId}-${active}`} placeholder="Select a branch or tag to checkout…"
          onChange={event => { setQuery(event.target.value); setActive(0) }}
          onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); target.current?.focus() }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const next = (active + (event.key === 'ArrowDown' ? 1 : -1) + actions.length + choices.length) % (actions.length + choices.length)
              setActive(next)
              document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' })
            }
            if (event.key === 'Enter') { event.preventDefault(); activate(active) }
          }} />
      </div>
      {error && <p className="native-git-picker-error" role="alert">{error}</p>}
      <div id={listId} role="listbox" aria-label="Branches, tags and checkout actions" aria-busy={busy} className="native-git-picker-list">
        {actions.map((action, index) => <button key={action.label} id={`${listId}-${index}`} type="button" role="option"
          tabIndex={-1} aria-selected={active === index} disabled={busy} className="native-git-picker-row native-git-picker-action"
          onMouseEnter={() => setActive(index)} onClick={() => activate(index)}>
          <span className="native-git-action-glyph" aria-hidden="true">{action.icon}</span>{action.label}
        </button>)}
        <div className="native-git-picker-divider" role="presentation" />
        {choices.map((branch, offset) => <button key={branch.ref} id={`${listId}-${offset + actions.length}`} type="button" role="option"
          tabIndex={-1} aria-selected={active === offset + actions.length} disabled={busy} className="native-git-picker-row"
          onMouseEnter={() => setActive(offset + actions.length)} onClick={() => onCheckout(branch)}>
          <span className="native-git-branch-heading"><BranchIcon /><strong>{branch.name}</strong>{branch.tag && <span>Tag · detached</span>}
            <time dateTime={branch.date} title={formatGitDate(branch.date)}>{formatGitDate(branch.date)}</time>
            {branch.current && <span className="native-git-current">Current</span>}
          </span>
          <span className="native-git-branch-detail" title={`${branch.author} · ${branch.commit} · ${branch.subject}`}>
            {branch.author} · {branch.commit.slice(0, 8)} · {branch.subject}
          </span>
        </button>)}
        {choices.length === 0 && <p className="native-git-empty">No matching branches or tags</p>}
      </div>
    </Popover>
  </Overlay>
}
