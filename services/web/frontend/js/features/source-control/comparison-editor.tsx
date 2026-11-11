import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, Decoration, drawSelection, highlightActiveLine, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { diffWordsWithSpace } from 'diff'

export type ComparisonRow = { left?: string; right?: string; old?: number; next?: number; changed?: boolean }

export default function ComparisonEditor({ rows, side }: { rows: ComparisonRow[]; side: 'left' | 'right' }) {
  const host = useRef<HTMLDivElement>(null)
  const identity = JSON.stringify(rows)
  useEffect(() => {
    if (!host.current) return
    const state = EditorState.create({ doc: rows.map(row => row[side] ?? '').join('\n') })
    const decorations = []
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i], line = state.doc.line(i + 1)
      if (!row.changed || row[side] === undefined) continue
      decorations.push(Decoration.line({ attributes: {
        class: `native-git-changed-row ${side === 'left' ? 'native-git-line-remove' : 'native-git-line-add'}`,
        'data-kind': row.left === undefined ? 'added' : row.right === undefined ? 'deleted' : 'modified',
        'data-line': String(side === 'left' ? row.old : row.next),
      } }).range(line.from))
      if (row.left !== undefined && row.right !== undefined) {
        let offset = line.from
        for (const part of diffWordsWithSpace(row.left, row.right)) {
          if (side === 'left' ? part.added : part.removed) continue
          if ((part.added || part.removed) && part.value.length) decorations.push(Decoration.mark({ class: side === 'left' ? 'native-git-word-remove' : 'native-git-word-add' }).range(offset, offset + part.value.length))
          offset += part.value.length
        }
      }
    }
    const announce = (view: EditorView) => {
      if (!view.hasFocus) return
      const pos = view.state.selection.main.head
      const row = rows[view.state.doc.lineAt(pos).number - 1]
      const coords = view.coordsAtPos(pos)
      if (coords) host.current?.dispatchEvent(new CustomEvent('git-diff-cursor', { bubbles: true, detail: { top: coords.top, line: String((side === 'left' ? row.old : row.next) ?? ''), side: side === 'left' ? 'Before' : 'After' } }))
    }
    const view = new EditorView({ parent: host.current, state: EditorState.create({ doc: state.doc, extensions: [
      EditorState.readOnly.of(true), EditorState.transactionFilter.of(transaction => transaction.docChanged ? [] : transaction), EditorView.contentAttributes.of({ 'aria-label': `${side === 'left' ? 'Before' : 'After'} version`, 'aria-readonly': 'true' }),
      drawSelection(), highlightActiveLine(), keymap.of(defaultKeymap),
      lineNumbers({ formatNumber: number => { const row = rows[number - 1]; const n = side === 'left' ? row?.old : row?.next; return n === undefined ? '' : `${n}${row.changed ? side === 'left' ? ' −' : ' +' : ''}` } }),
      EditorView.decorations.of(Decoration.set(decorations, true)),
      EditorView.updateListener.of(update => { if (update.selectionSet || update.focusChanged || update.geometryChanged) update.view.requestMeasure({ read: announce }) }),
      EditorView.theme({ '&': { fontSize: '12px' }, '.cm-scroller': { fontFamily: 'var(--font-family-monospace, monospace)', lineHeight: '1.65', overflowX: 'auto' }, '.cm-content': { padding: '0', caretColor: 'var(--content-primary, #202936)' }, '.cm-line': { padding: '0 6px' }, '.cm-gutters': { backgroundColor: 'transparent', borderRight: '1px solid #dde2e8' }, '.cm-cursor': { borderLeftColor: 'var(--content-primary, #202936)' }, '.cm-activeLine': { backgroundColor: '#7894b21a' }, '&.cm-focused': { outline: 'none' } }),
    ] }) })
    return () => view.destroy()
    // A new selection in the parent must not recreate the editor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, side])
  return <div className="native-git-comparison-editor" ref={host} />
}
