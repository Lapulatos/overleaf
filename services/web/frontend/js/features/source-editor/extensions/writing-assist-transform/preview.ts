import { StateField } from '@codemirror/state'
import { Decoration, EditorView, showTooltip, type Tooltip } from '@codemirror/view'
import { InlineTransformPreview } from './inline-preview'
import type { TransformState } from './types'
import {
  requestTransformEffect,
  setTransformPreviewEffect,
  acceptTransformEffect,
  rejectTransformEffect,
  transformErrorEffect,
} from './effects'

const IDLE: TransformState = { status: 'idle' }
type TransformTooltip = Tooltip & { __waTransformState: TransformState }

export const transformPreviewField = StateField.define<TransformTooltip | null>({
  create(): TransformTooltip | null {
    return null
  },

  update(value, tr) {
    let state: TransformState = IDLE

    if (value) state = value.__waTransformState

    for (const e of tr.effects) {
      if (e.is(requestTransformEffect)) {
        const { from, to, action, targetLanguage, customInstruction, lengthRatio, rewriteFidelity } = e.value
        state = { status: 'loading', from, to, action, targetLanguage, customInstruction, lengthRatio, rewriteFidelity }
      }
      if (e.is(setTransformPreviewEffect)) {
        state = { status: 'preview', preview: e.value }
      }
      if (e.is(transformErrorEffect)) {
        const { message, from, to, action } = e.value
        const prev = state.status === 'loading' ? state : null
        state = {
          status: 'error', message, from, to, action,
          targetLanguage: prev?.targetLanguage,
          customInstruction: prev?.customInstruction,
          lengthRatio: prev?.lengthRatio,
          rewriteFidelity: prev?.rewriteFidelity,
        }
      }
      if (e.is(acceptTransformEffect) || e.is(rejectTransformEffect)) {
        state = IDLE
      }
    }

    if (tr.docChanged && state.status !== 'idle') {
      // A reviewed replacement is tied to its original text. Mapping positions
      // alone would allow a stale suggestion to overwrite newer manuscript edits.
      state = IDLE
    }

    if (state.status === 'idle') return null

    const pos = state.status === 'preview' ? state.preview.from
      : state.status === 'loading' ? state.from
      : state.from

    const tooltip: TransformTooltip = {
      __waTransformState: state,
      pos,
      above: true,
      create() {
        const dom = document.createElement('div')
        dom.className = 'wa-transform-preview-tooltip'
        dom.setAttribute('data-wa-tooltip', 'preview')
        // CM6 adds .cm-tooltip class directly to this dom element (no wrapper).
        // Set inline styles to override CM6's default .cm-tooltip styling
        // (#f5f5f5 bg, 1px solid #bbb border) with our card styling.
        // Unlike the icon tooltip, this .cm-tooltip IS the visual container.
        dom.style.setProperty('background', 'var(--wa-themed-bg, #fff)', 'important')
        dom.style.setProperty('border', '1px solid var(--wa-themed-border, #e2e8f0)', 'important')
        dom.style.setProperty('border-radius', '10px', 'important')
        dom.style.setProperty('padding', '10px', 'important')
        dom.style.setProperty('box-shadow', '0 4px 16px rgba(0,0,0,0.12)', 'important')
        dom.style.setProperty('max-width', '420px', 'important')
        dom.style.setProperty('z-index', '100', 'important')
        dom.style.setProperty('font-family', 'var(--font-sans, system-ui, -apple-system, sans-serif)', 'important')
        return { dom }
      },
    }
    return tooltip
  },

  provide: f => [
    showTooltip.computeN([f], state => {
      const value = state.field(f)
      return value && value.__waTransformState.status !== 'preview' ? [value] : []
    }),
    EditorView.decorations.compute([f], state => {
      const value = state.field(f)?.__waTransformState
      if (value?.status !== 'preview') return Decoration.none
      const { from, to, original } = value.preview
      if (from < 0 || to > state.doc.length || from > to || state.sliceDoc(from, to) !== original) return Decoration.none
      const decorations = []
      if (from < to) decorations.push(Decoration.mark({ class: 'wa-transform-source-under-review' }).range(from, to))
      decorations.push(Decoration.widget({ widget: new InlineTransformPreview(value), block: true, side: 1 }).range(state.doc.lineAt(to).to))
      return Decoration.set(decorations, true)
    }),
  ],
})
