import { useEffect, useRef } from 'react'
import { imageDimensions } from '@overleaf/validation-tools/image-input.mjs'
import OLButton from '@/shared/components/ol/ol-button'

export type ImageAttachment = {
  name: string
  mime: 'image/png' | 'image/jpeg'
  data: string
  width: number
  height: number
}
export function ImageAttachmentInput({
  image,
  disabled,
  onChange,
  onError,
  onLoading,
}: {
  image: ImageAttachment | null
  disabled: boolean
  onChange: (image: ImageAttachment | null) => void
  onError: (message: string) => void
  onLoading: (loading: boolean) => void
}) {
  const sequence = useRef(0)
  useEffect(() => () => { sequence.current++ }, [])
  async function select(file?: File) {
    const id = ++sequence.current
    if (!file) return
    onChange(null)
    onLoading(true)
    onError('')
    try {
      if (
        !['image/png', 'image/jpeg'].includes(file.type) ||
        file.size > 2 * 1024 * 1024 ||
        !file.size
      )
        throw new Error('Choose a PNG or JPEG image up to 2 MiB.')
      const dimensions = imageDimensions(
        new Uint8Array(await file.arrayBuffer()),
        file.type
      )
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = () => reject(new Error('Could not read the image'))
        reader.readAsDataURL(file)
      })
      if (sequence.current === id)
        onChange({
          name: file.name.slice(0, 200),
          mime: file.type as ImageAttachment['mime'],
          data,
          ...dimensions,
        })
    } catch (error) {
      if (sequence.current === id)
        onError(
          error instanceof Error ? error.message : 'Could not load the image'
        )
    } finally {
      if (sequence.current === id) onLoading(false)
    }
  }
  return (
    <div style={{ margin: '12px 0' }}>
      <label htmlFor="assistant-image">Equation or image (PNG/JPEG)</label>
      <input
        id="assistant-image"
        type="file"
        accept="image/png,image/jpeg"
        disabled={disabled}
        onChange={(event) => {
          select(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <p>
        One image, up to 2 MiB and 16 megapixels. Requires a Codex agent. Attach
        it again if a later question needs the image.
      </p>
      {image && (
        <>
          <img
            src={`data:${image.mime};base64,${image.data}`}
            alt={`Attached image: ${image.name}`}
            style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain' }}
          />
          <p>
            {image.name} · {image.width} × {image.height}
          </p>
          <OLButton
            disabled={disabled}
            onClick={() => {
              sequence.current++
              onChange(null)
              onLoading(false)
            }}
          >
            Remove image
          </OLButton>
        </>
      )}
    </div>
  )
}
