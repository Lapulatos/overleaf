import React from 'react'
import ReactDOM from 'react-dom'
import { getTooltip, type Tooltip } from '@codemirror/view'
import { useCodeMirrorViewContext } from '../../components/codemirror-context'
import { transformPreviewField } from './preview'
import { TransformPreview } from './preview-react'
import type { TransformState } from './types'

export function TransformPreviewPortalWrapper(): React.ReactElement | null {
  const view = useCodeMirrorViewContext()
  const tooltip = view.state.field(transformPreviewField, false) as (Tooltip & { __waTransformState?: TransformState }) | null | undefined
  if (!tooltip) return null

  const state: TransformState | undefined = tooltip.__waTransformState
  if (!state || state.status === 'idle') return null

  const tooltipView = getTooltip(view, tooltip)
  if (!tooltipView) return null

  return ReactDOM.createPortal(
    <TransformPreview view={view} state={state} />,
    tooltipView.dom
  )
}
