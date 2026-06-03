import { StateEffect } from '@codemirror/state'
import type { TransformAction, TransformPreview, SupportedLanguage } from './types'

/** Dispatched when the user picks an action from the toolbar. Carries the
 *  selection range, action type, and optional language/instruction/ratio. */
export const requestTransformEffect = StateEffect.define<{
  from: number
  to: number
  action: TransformAction
  targetLanguage?: SupportedLanguage
  customInstruction?: string
  lengthRatio?: number
  rewriteFidelity?: number
}>()

/** Dispatched by the transform runner when the LLM response arrives. */
export const setTransformPreviewEffect = StateEffect.define<TransformPreview>()

/** Dispatched when the user accepts the suggested replacement. */
export const acceptTransformEffect = StateEffect.define<null>()

/** Dispatched when the user rejects the suggested replacement. */
export const rejectTransformEffect = StateEffect.define<null>()

/** Dispatched to hide the floating toolbar (e.g. after an action is picked). */
export const clearTransformToolbarEffect = StateEffect.define<null>()

/** Dispatched when a transform request fails. */
export const transformErrorEffect = StateEffect.define<{
  message: string
  from: number
  to: number
  action: TransformAction
}>()

/**
 * Lock the toolbar tooltip open while the user is interacting with a
 * dropdown or custom-input field inside it. While locked, the toolbar
 * StateField ignores selection changes that would normally cause it to
 * vanish. The lock is cleared by request/clear/accept/reject effects.
 */
export const lockTransformToolbarEffect = StateEffect.define<null>()