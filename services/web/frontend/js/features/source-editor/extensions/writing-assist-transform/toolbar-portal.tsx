import React from 'react'
import ReactDOM from 'react-dom'
import { getTooltip } from '@codemirror/view'
import { useCodeMirrorViewContext } from '../../components/codemirror-context'
import { transformToolbarField } from './toolbar'
import { TransformToolbar } from './toolbar-react'

export function TransformToolbarPortalWrapper(): React.ReactElement | null {
  const view = useCodeMirrorViewContext()
  const field = view.state.field(transformToolbarField, false)
  if (!field) return null

  const tooltipView = getTooltip(view, field)
  if (!tooltipView) return null

  return ReactDOM.createPortal(
    <TransformToolbar view={view} />,
    tooltipView.dom
  )
}
