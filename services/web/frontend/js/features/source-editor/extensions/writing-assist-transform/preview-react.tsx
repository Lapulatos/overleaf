import React, { useCallback } from 'react'
import type { TransformState } from './types'
import { ACTION_META } from './types'
import { acceptTransformEffect, rejectTransformEffect, requestTransformEffect, clearTransformToolbarEffect } from './effects'
import type { EditorView } from '@codemirror/view'

interface PreviewProps {
  view: EditorView
  state: TransformState
}

/**
 * Diff preview card for transform results. Portaled into the preview Tooltip DOM
 * by preview-portal.tsx.
 *
 * States:
 *  - loading: spinner + "AI 处理中..."
 *  - preview: strikethrough original + green suggestion + Accept/Reject
 *  - error: error message + retry button
 */
export function TransformPreview({ view, state }: PreviewProps): React.ReactElement {
  const handleAccept = useCallback(() => {
    if (state.status === 'preview') {
      const { from, to, suggested } = state.preview
      const docLen = view.state.doc.length
      const safeFrom = Math.max(0, Math.min(from, docLen))
      const safeTo = Math.max(safeFrom, Math.min(to, docLen))
      view.dispatch({
        changes: { from: safeFrom, to: safeTo, insert: suggested },
        effects: [
          acceptTransformEffect.of(null),
          clearTransformToolbarEffect.of(null),
        ],
      })
    }
  }, [view, state])

  const handleReject = useCallback(() => {
    view.dispatch({
      effects: [
        rejectTransformEffect.of(null),
      ],
    })
  }, [view])

  const handleRetry = useCallback(() => {
    if (state.status === 'error') {
      view.dispatch({
        effects: requestTransformEffect.of({
          from: state.from,
          to: state.to,
          action: state.action,
          targetLanguage: state.targetLanguage,
          customInstruction: state.customInstruction,
          lengthRatio: state.lengthRatio,
        }),
      })
    }
  }, [view, state])

  if (state.status === 'loading') {
    const actionMeta = ACTION_META[state.action]
    return (
      <div className="wa-transform-preview wa-transform-preview-loading">
        <div className="wa-transform-spinner" />
        <span className="wa-transform-loading-text">
          AI {actionMeta?.label ?? ''}处理中...
        </span>
      </div>
    )
  }

  if (state.status === 'error') {
    const actionMeta = ACTION_META[state.action]
    return (
      <div className="wa-transform-preview wa-transform-preview-error">
        <div className="wa-transform-error-header">
          <span className="wa-transform-error-action">{actionMeta?.label ?? ''}失败</span>
        </div>
        <div className="wa-transform-error-message">{state.message}</div>
        <div className="wa-transform-preview-actions">
          <button
            className="wa-transform-btn-action wa-transform-btn-retry"
            onClick={handleRetry}
          >
            重试
          </button>
          <button
            className="wa-transform-btn-action wa-transform-btn-cancel"
            onClick={handleReject}
          >
            取消
          </button>
        </div>
      </div>
    )
  }

  if (state.status === 'preview') {
    const preview = state.preview
    const actionMeta = ACTION_META[preview.action]
    return (
      <div className="wa-transform-preview wa-transform-preview-diff">
        <div className="wa-transform-preview-header">
          <span className="wa-transform-preview-action">{actionMeta?.label ?? ''}</span>
        </div>
        <div className="wa-transform-diff-content">
          <DiffView original={preview.original} suggested={preview.suggested} />
        </div>
        <div className="wa-transform-preview-actions">
          <button
            className="wa-transform-btn-action wa-transform-btn-accept"
            onClick={handleAccept}
          >
            接受
          </button>
          <button
            className="wa-transform-btn-action wa-transform-btn-reject"
            onClick={handleReject}
          >
            拒绝
          </button>
        </div>
      </div>
    )
  }

  // idle — should not be rendered
  return <div />
}

/**
 * Simple inline diff view: strikethrough original, green suggested text.
 * For transform actions, the diff is typically a full replacement so we show
 * the original in strikethrough red followed by the suggestion in green.
 */
function DiffView({
  original,
  suggested,
}: {
  original: string
  suggested: string
}): React.ReactElement {
  // If original and suggested are very similar, try to highlight just the
  // changed portion. Otherwise show a full replacement diff.
  if (original === suggested) {
    // No change — just show the text
    return <span className="wa-transform-diff-unchanged">{original}</span>
  }

  // Find common prefix
  let prefixLen = 0
  while (
    prefixLen < original.length &&
    prefixLen < suggested.length &&
    original[prefixLen] === suggested[prefixLen]
  ) {
    prefixLen++
  }

  // Find common suffix (from the end)
  let suffixLen = 0
  while (
    suffixLen < original.length - prefixLen &&
    suffixLen < suggested.length - prefixLen &&
    original[original.length - 1 - suffixLen] ===
      suggested[suggested.length - 1 - suffixLen]
  ) {
    suffixLen++
  }

  const prefix = original.slice(0, prefixLen)
  const delPart = original.slice(prefixLen, original.length - suffixLen)
  const addPart = suggested.slice(prefixLen, suggested.length - suffixLen)
  const suffix = original.slice(original.length - suffixLen)

  // If the diff parts are too large relative to the text (more than 80%
  // changed), show it as a full replacement for readability.
  const changeRatio =
    delPart.length / Math.max(original.length, 1)

  if (changeRatio > 0.8 || delPart.length === 0 && addPart.length === 0) {
    return (
      <>
        <span className="wa-transform-diff-del">{original}</span>
        <span className="wa-transform-diff-arrow"> → </span>
        <span className="wa-transform-diff-add">{suggested}</span>
      </>
    )
  }

  return (
    <>
      {prefix && <span className="wa-transform-diff-ctx">{prefix}</span>}
      {delPart && <span className="wa-transform-diff-del">{delPart}</span>}
      {addPart && <span className="wa-transform-diff-add">{addPart}</span>}
      {suffix && <span className="wa-transform-diff-ctx">{suffix}</span>}
    </>
  )
}