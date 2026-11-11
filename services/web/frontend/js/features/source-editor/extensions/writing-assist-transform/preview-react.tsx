import React, { useCallback } from 'react'
import { ProposalDiff } from '../writing-assist/proposal-diff'
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
      if (view.state.sliceDoc(safeFrom, safeTo) !== state.preview.original) {
        view.dispatch({ effects: rejectTransformEffect.of(null) })
        return
      }
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
          rewriteFidelity: state.rewriteFidelity,
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
          <ProposalDiff before={preview.original} after={preview.suggested} startLine={view.state.doc.lineAt(Math.min(preview.from, view.state.doc.length)).number} />
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
