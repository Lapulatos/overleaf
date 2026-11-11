import { useEffect, useRef, useState } from 'react'
import { errorMessage } from './api'

export const hasVisualPreview = (path: string) => /\.(png|jpe?g|gif|webp|svg|bmp|pdf)$/i.test(path)

export type PreviewVersion = { mime: string; base64: string; size: number }
export type FileVersions = { before: PreviewVersion | null; after: PreviewVersion | null }

export function FilePreview({ versions, title }: { versions: FileVersions; title: string }) {
  const [side, setSide] = useState<'before' | 'after'>(versions.after ? 'after' : 'before')
  useEffect(() => { if (!versions[side]) setSide(versions.after ? 'after' : 'before') }, [versions, side])
  const version = versions[side]
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!version) { setUrl(''); return }
    const data = Uint8Array.from(atob(version.base64), value => value.charCodeAt(0))
    const next = URL.createObjectURL(new Blob([data], { type: version.mime }))
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [version])
  return <div className="native-git-file-preview">
    <div className="native-git-preview-toolbar" role="group" aria-label="File version">
      <div className="native-git-version-switch">{(['before', 'after'] as const).map(value => <button type="button" className="btn btn-sm" key={value} disabled={!versions[value]} aria-pressed={side === value} onClick={() => setSide(value)}>{value === 'before' ? 'Before' : 'After'}</button>)}</div>
      <span>{!versions.before ? 'Added file' : !versions.after ? 'Deleted file' : 'Modified file'}</span>
    </div>
    {url && version && (version.mime === 'application/pdf' ? <PdfPreview key={url} url={url} /> : <img className="native-git-image-preview" src={url} alt={`${side === 'before' ? 'Before' : 'After'}: ${title}`} />)}
  </div>
}

function PdfPreview({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const [document, setDocument] = useState<import('pdfjs-dist').PDFDocumentProxy>()
  const [pageNumber, setPageNumber] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    let task: import('pdfjs-dist').PDFDocumentLoadingTask | undefined
    void import('@/features/pdf-preview/util/pdf-js').then(async ({ loadPdfDocumentFromUrl }) => {
      if (cancelled) return
      task = loadPdfDocumentFromUrl(url)
      const pdf = await task.promise
      if (!cancelled) setDocument(pdf)
    }).catch(error => { if (!cancelled) { setError(errorMessage(error)); setLoading(false) } })
    return () => { cancelled = true; void task?.destroy() }
  }, [url])
  useEffect(() => {
    if (!document) return
    let cancelled = false
    let render: import('pdfjs-dist').RenderTask | undefined
    setLoading(true)
    void document.getPage(pageNumber).then(async page => {
      if (cancelled || !canvas.current) return
      const natural = page.getViewport({ scale: 1 })
      const width = canvas.current.parentElement?.clientWidth || natural.width
      const ratio = window.devicePixelRatio || 1
      const scale = Math.min(1.5, Math.max(0.25, (width - 24) / natural.width))
      const viewport = page.getViewport({ scale: scale * ratio })
      canvas.current.width = viewport.width
      canvas.current.height = viewport.height
      canvas.current.style.width = `${viewport.width / ratio}px`
      canvas.current.style.height = `${viewport.height / ratio}px`
      render = page.render({ canvasContext: canvas.current.getContext('2d')!, viewport })
      await render.promise
      if (!cancelled) setLoading(false)
    }).catch(error => { if (!cancelled) { setError(errorMessage(error)); setLoading(false) } })
    return () => { cancelled = true; render?.cancel() }
  }, [document, pageNumber])
  return <>
    <div className="native-git-preview-toolbar native-git-page-controls">
      <button type="button" className="btn btn-default btn-sm" disabled={!document || pageNumber === 1 || loading} onClick={() => setPageNumber(value => value - 1)}>Previous page</button>
      <span>{document ? `${pageNumber} / ${document.numPages}` : 'PDF'}</span>
      <button type="button" className="btn btn-default btn-sm" disabled={!document || pageNumber === document.numPages || loading} onClick={() => setPageNumber(value => value + 1)}>Next page</button>
    </div>
    {loading && <p role="status">Loading PDF…</p>}
    {error && <p role="alert">{error}</p>}
    <div className="native-git-pdf-preview"><canvas ref={canvas} aria-label={`PDF page ${pageNumber}`} /></div>
  </>
}
