import { StateField } from '@codemirror/state'
import { showTooltip, type Tooltip } from '@codemirror/view'
import type { TransformState } from './types'
import {
  requestTransformEffect,
  setTransformPreviewEffect,
  acceptTransformEffect,
  rejectTransformEffect,
  transformErrorEffect,
} from './effects'

const IDLE: TransformState = { status: 'idle' }

export const transformPreviewField = StateField.define<Tooltip | null>({
  create(): Tooltip | null {
    return null
  },

  update(value, tr) {
    let state: TransformState = IDLE

    if (value && (value as any).__waTransformState) {
      state = (value as any).__waTransformState as TransformState
    }

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
      if (state.status === 'loading' || state.status === 'error') {
        state = { ...state, from: tr.changes.mapPos(state.from), to: tr.changes.mapPos(state.to) }
      }
      if (state.status === 'preview') {
        const p = state.preview
        state = { ...state, preview: { ...p, from: tr.changes.mapPos(p.from), to: tr.changes.mapPos(p.to) } }
      }
    }

    if (state.status === 'idle') return null

    const pos = state.status === 'preview' ? state.preview.from
      : state.status === 'loading' ? state.from
      : state.from

    const tooltip: Tooltip = {
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
    ;(tooltip as any).__waTransformState = state
    return tooltip
  },

  provide: f => showTooltip.from(f),
})
