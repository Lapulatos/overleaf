import { ViewPlugin, type EditorView, type ViewUpdate } from '@codemirror/view'
import {
  requestTransformEffect,
  setTransformPreviewEffect,
  transformErrorEffect,
} from './effects'
import { transformText } from '@/utils/api/writing-assist'
import { transformPreviewField } from './preview'
import type { TransformAction, SupportedLanguage } from './types'

/** Context characters to include around the selected text for the LLM. */
const CONTEXT_RADIUS = 200

/**
 * ViewPlugin that listens for `requestTransformEffect` and executes the
 * transform API call. Results are dispatched as `setTransformPreviewEffect`.
 * Stale requests are discarded via a monotonic token.
 */
export function transformRunner(projectId: string) {
  let token = 0

  return ViewPlugin.fromClass(
    class {
      constructor(readonly view: EditorView) {}

      update(update: ViewUpdate) {
        for (const tr of update.transactions) {
          for (const e of tr.effects) {
            if (e.is(requestTransformEffect)) {
              const req = e.value
              const myToken = ++token
              this.runTransform(req, myToken)
            }
          }
        }
      }

      private async runTransform(
        req: {
          from: number
          to: number
          action: TransformAction
          targetLanguage?: SupportedLanguage
          customInstruction?: string
          lengthRatio?: number
        },
        myToken: number
      ) {
        const { from, to, action, targetLanguage, customInstruction, lengthRatio, rewriteFidelity } = req
        const text = this.view.state.sliceDoc(from, to)

        // Gather context around the selection
        const contextBefore = this.view.state.sliceDoc(
          Math.max(0, from - CONTEXT_RADIUS),
          from
        )
        const contextAfter = this.view.state.sliceDoc(
          to,
          Math.min(this.view.state.doc.length, to + CONTEXT_RADIUS)
        )

        try {
          const result = await transformText(
            text,
            action,
            projectId,
            {
              targetLanguage: targetLanguage,
              customInstruction,
              lengthRatio,
              rewriteFidelity,
              context: { before: contextBefore, after: contextAfter },
            }
          )

          // Stale check: if a newer request was issued, discard this result
          if (myToken !== token) return
          // Also check the view is still mounted
          if (!this.view.state.field(transformPreviewField, false)) return

          this.view.dispatch({
            effects: setTransformPreviewEffect.of({
              original: text,
              suggested: result,
              from,
              to,
              action,
            }),
          })
        } catch (err: unknown) {
          if (myToken !== token) return

          const message =
            err instanceof Error ? err.message : 'Transform failed'

          // Only dispatch if the view is still alive
          if (!this.view.state.field(transformPreviewField, false)) return

          this.view.dispatch({
            effects: transformErrorEffect.of({
              message,
              from,
              to,
              action,
            }),
          })
        }
      }

      destroy() {
        // Invalidate any in-flight requests
        token++
      }
    }
  )
}
