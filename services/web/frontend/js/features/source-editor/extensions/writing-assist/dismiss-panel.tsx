import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react'
import RailPanelHeader from '@/features/ide-react/components/rail/rail-panel-header'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import { dismissStore, normalizeDismissal, type DismissalItem } from './dismiss-store'

/**
 * Rail panel for the writing-assist "Dismiss Notes".
 *
 * Lists the sentences the user has dismissed (and which the checker therefore
 * skips). Supports full CRUD plus a fuzzy search box: add a sentence manually,
 * search/filter existing notes, edit one inline, or delete it (which re-enables
 * checking for that sentence). State is held in the shared `dismissStore` so the
 * editor's checker and this panel stay in sync.
 *
 * Styles are inline and use Overleaf's *themed* CSS tokens (…-themed) so the
 * panel reads correctly in both light and dark editor themes — earlier a fixed
 * light item background made dismissed text invisible in dark mode.
 */

const bodyStyle: CSSProperties = {
  padding: '8px 12px',
  overflowY: 'auto',
  height: '100%',
  color: 'var(--content-primary-themed)',
}
const introStyle: CSSProperties = {
  color: 'var(--content-secondary-themed)',
  fontSize: '12px',
  lineHeight: 1.5,
  marginBottom: '10px',
}
const controlsStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
  marginBottom: '8px',
}
const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}
const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '6px',
  padding: '6px 8px',
  background: 'var(--bg-secondary-themed)',
  color: 'var(--content-primary-themed)',
  borderRadius: '6px',
}
const itemTextStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  fontSize: '13px',
  lineHeight: 1.45,
  // Wrap fully so the whole sentence stays readable (no truncation).
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
}
const actionsStyle: CSSProperties = {
  display: 'flex',
  gap: '2px',
  flexShrink: 0,
}
const emptyStyle: CSSProperties = {
  color: 'var(--content-secondary-themed)',
  fontSize: '13px',
  textAlign: 'center',
  padding: '16px 0',
}

/**
 * Lightweight fuzzy match: every character of the (lowercased) query must
 * appear in order within the text (subsequence match). Covers typo-tolerant
 * "related notes" filtering without pulling in a dependency.
 */
function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true
  const t = text.toLowerCase()
  let i = 0
  for (let j = 0; j < t.length && i < q.length; j++) {
    if (t[j] === q[i]) i++
  }
  return i === q.length
}

export default function DismissNotebookPanel() {
  const items = useSyncExternalStore(
    cb => dismissStore.subscribe(cb),
    () => dismissStore.getItems()
  )

  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void dismissStore.load()
  }, [])

  // The single text box doubles as add-input and search-box. The list is
  // filtered by a fuzzy match on the current text; "Add" is only offered when
  // the text is not already an exact (normalized) note.
  const trimmed = draft.trim()
  const normalizedDraft = normalizeDismissal(draft)
  const alreadyExists = useMemo(
    () => items.some(i => normalizeDismissal(i.text) === normalizedDraft),
    [items, normalizedDraft]
  )
  const filtered = useMemo(
    () => (trimmed ? items.filter(i => fuzzyMatch(trimmed, i.text)) : items),
    [items, trimmed]
  )

  const onAdd = useCallback(async () => {
    if (!trimmed || alreadyExists) return
    setBusy(true)
    try {
      await dismissStore.add(trimmed)
      setDraft('')
    } finally {
      setBusy(false)
    }
  }, [trimmed, alreadyExists])

  return (
    <div className="wa-dismiss-panel">
      <RailPanelHeader title="Dismiss Notes" />
      <div style={bodyStyle}>
        <p style={introStyle}>
          Sentences here are skipped by Writing Assist. Click “Dismiss” on an
          underlined suggestion to add one, or add, search, edit and delete them
          manually below.
        </p>

        <div style={controlsStyle}>
          <OLFormControl
            type="text"
            placeholder="Search or add a sentence to ignore…"
            value={draft}
            disabled={busy}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void onAdd()
            }}
          />
          <OLButton
            variant="primary"
            size="sm"
            disabled={busy || !trimmed || alreadyExists}
            onClick={() => void onAdd()}
          >
            Add
          </OLButton>
        </div>
        {trimmed && alreadyExists && (
          <p style={introStyle}>Already in your notes — not added again.</p>
        )}

        {filtered.length === 0 ? (
          <div style={emptyStyle}>
            {items.length === 0 ? 'No dismissed sentences yet.' : 'No matching notes.'}
          </div>
        ) : (
          <ul style={listStyle}>
            {filtered.map(item => (
              <DismissRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function DismissRow({ item }: { item: DismissalItem }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.text)
  const [busy, setBusy] = useState(false)

  const onSave = useCallback(async () => {
    const text = draft.trim()
    if (!text || text === item.text) {
      setEditing(false)
      setDraft(item.text)
      return
    }
    setBusy(true)
    try {
      await dismissStore.update(item.id, text)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }, [draft, item.id, item.text])

  const onDelete = useCallback(async () => {
    setBusy(true)
    try {
      await dismissStore.remove(item.id)
    } finally {
      setBusy(false)
    }
  }, [item.id])

  if (editing) {
    return (
      <li style={itemStyle}>
        <OLFormControl
          type="text"
          value={draft}
          disabled={busy}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') void onSave()
            if (e.key === 'Escape') {
              setEditing(false)
              setDraft(item.text)
            }
          }}
        />
        <div style={actionsStyle}>
          <OLIconButton
            size="sm"
            variant="ghost"
            icon="check"
            accessibilityLabel="Save"
            disabled={busy}
            onClick={() => void onSave()}
          />
          <OLIconButton
            size="sm"
            variant="ghost"
            icon="close"
            accessibilityLabel="Cancel"
            disabled={busy}
            onClick={() => {
              setEditing(false)
              setDraft(item.text)
            }}
          />
        </div>
      </li>
    )
  }

  return (
    <li style={itemStyle}>
      <span style={itemTextStyle}>{item.text}</span>
      <div style={actionsStyle}>
        <OLIconButton
          size="sm"
          variant="ghost"
          icon="edit"
          accessibilityLabel="Edit"
          disabled={busy}
          onClick={() => setEditing(true)}
        />
        <OLIconButton
          size="sm"
          variant="ghost"
          icon="delete"
          accessibilityLabel="Delete"
          disabled={busy}
          onClick={() => void onDelete()}
        />
      </div>
    </li>
  )
}
