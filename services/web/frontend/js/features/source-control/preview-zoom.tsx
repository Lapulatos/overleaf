import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '@/shared/components/material-icon'
export type PreviewSize = { width: number; height: number }
export function fitPreviewScale(natural: PreviewSize, viewport: PreviewSize) {
  if (!natural.width || !natural.height || !viewport.width || !viewport.height) return 1
  return Math.max(0.01, Math.min((viewport.width - 24) / natural.width, (viewport.height - 24) / natural.height))
}
export function usePreviewViewport() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<PreviewSize>({width:0,height:0})
  useEffect(() => {
    const update = () => { if(ref.current) setSize({width:ref.current.clientWidth,height:ref.current.clientHeight}) }
    update(); const observer = new ResizeObserver(update); if(ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return {ref,size}
}
export function PreviewZoom({zoom,scale,onChange}:{zoom:'fit'|number;scale:number;onChange(value:'fit'|number):void}) {
  return <div className="native-git-preview-zoom" role="group" aria-label="Preview zoom">
    <button type="button" className="native-git-icon-button" title="Zoom out" aria-label="Zoom out" disabled={scale<=.1} onClick={()=>onChange(Math.max(.1,scale/1.25))}><MaterialIcon type="remove"/></button>
    <span aria-live="polite">{Math.round(scale*100)}%</span>
    <button type="button" className="native-git-icon-button" title="Zoom in" aria-label="Zoom in" disabled={scale>=8} onClick={()=>onChange(Math.min(8,scale*1.25))}><MaterialIcon type="add"/></button>
    <button type="button" className="native-git-icon-button" title="Actual size (100%)" aria-label="Actual size (100%)" aria-pressed={zoom===1} onClick={()=>onChange(1)}><MaterialIcon type="zoom_in_map"/></button>
    <button type="button" className="native-git-icon-button" title="Fit to window" aria-label="Fit to window" aria-pressed={zoom==='fit'} onClick={()=>onChange('fit')}><MaterialIcon type="fit_screen"/></button>
  </div>
}
