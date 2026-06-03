import { StateField, StateEffect, type EditorState } from '@codemirror/state'
import { showTooltip, EditorView, type Tooltip } from '@codemirror/view'
import {
  clearTransformToolbarEffect,
  requestTransformEffect,
  acceptTransformEffect,
  rejectTransformEffect,
  lockTransformToolbarEffect,
} from './effects'

// ── Mouse-down tracking ──

export const mouseDownEffect = StateEffect.define<null>()
export const mouseUpEffect = StateEffect.define<null>()

const mouseDownStateField = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const e of tr.effects) {
      if (e.is(mouseDownEffect)) return true
      if (e.is(mouseUpEffect)) return false
    }
    return value
  },
})

interface TransformTooltip extends Tooltip {
  __waToolbarLocked: boolean
}

export const transformToolbarField = StateField.define<TransformTooltip | null>({
  create(state: EditorState): TransformTooltip | null {
    return toolbarForSelection(state, false)
  },

  update(value, tr) {
    let locked = value?.__waToolbarLocked ?? false
    let needsReevaluate = false

    for (const e of tr.effects) {
      if (
        e.is(clearTransformToolbarEffect) ||
        e.is(requestTransformEffect) ||
        e.is(acceptTransformEffect) ||
        e.is(rejectTransformEffect)
      ) {
        return null
      }
      if (e.is(lockTransformToolbarEffect)) {
        locked = true
      }
      if (e.is(mouseDownEffect) || e.is(mouseUpEffect)) {
        needsReevaluate = true
      }
    }

    if (tr.selection || tr.docChanged || needsReevaluate) {
      if (locked) {
        if (value && tr.docChanged) {
          const newPos = tr.changes.mapPos(value.pos)
          if (newPos !== value.pos) {
            return { ...value, pos: newPos, __waToolbarLocked: locked }
          }
        }
        return value
      }
      return toolbarForSelection(tr.state, locked)
    }
    if (value && value.__waToolbarLocked !== locked) {
      return { ...value, __waToolbarLocked: locked }
    }
    return value
  },

  provide: f => showTooltip.from(f),
})

function toolbarForSelection(state: EditorState, locked: boolean): TransformTooltip | null {
  const sel = state.selection.main
  if (sel.empty && !locked) return null

  const isMouseDown = state.field(mouseDownStateField, false)
  if (isMouseDown && !locked) return null

  return {
    pos: sel.head,
    above: true,
    arrow: false,
    __waToolbarLocked: locked,
    create() {
      const dom = document.createElement('div')
      dom.className = 'wa-transform-icon-tooltip'
      dom.setAttribute('data-wa-tooltip', 'icon')
      // CM6 adds .cm-tooltip class directly to this dom element (no wrapper).
      // Set inline styles to override CM6's default .cm-tooltip styling
      // (#f5f5f5 bg, 1px solid #bbb border). The visual container is the
      // inner .wa-transform-icon-btn, so .cm-tooltip itself must be transparent.
      dom.style.setProperty('background', 'transparent', 'important')
      dom.style.setProperty('border', 'none', 'important')
      dom.style.setProperty('box-shadow', 'none', 'important')
      dom.style.setProperty('padding', '0', 'important')
      return { dom, overlap: true, offset: { x: 0, y: 8 } }
    },
  }
}

export const transformToolbarMouseHandlers = EditorView.domEventHandlers({
  mousedown(_event, view) {
    let mouseUpListener: null | (() => void) = null
    const disableListener = () => {
      if (mouseUpListener) {
        document.removeEventListener('mouseup', mouseUpListener)
        mouseUpListener = null
      }
    }

    view.dispatch({ effects: mouseDownEffect.of(null) })

    mouseUpListener = () => {
      disableListener()
      view.dispatch({ effects: mouseUpEffect.of(null) })
    }
    document.addEventListener('mouseup', mouseUpListener)
  },
})

export const transformToolbarExtension = [
  mouseDownStateField,
  transformToolbarField,
  transformToolbarMouseHandlers,
]
