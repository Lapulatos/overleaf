export const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const MAX_PIXELS = 16 * 1024 * 1024

export function validateImages(images) {
  if (images === undefined) return []
  if (!Array.isArray(images) || images.length > 1)
    throw new Error('Attach at most one image per message')
  return images.map(validateImage)
}
export function validateImage(image) {
  if (
    !image ||
    !['image/png', 'image/jpeg'].includes(image.mime) ||
    typeof image.data !== 'string'
  )
    throw new Error('Use a PNG or JPEG image')
  if (
    !image.data.length ||
    image.data.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(image.data)
  )
    throw new Error('Image must be valid base64 and at most 2 MiB')
  const bytes = Buffer.from(image.data, 'base64')
  if (bytes.length > MAX_IMAGE_BYTES || bytes.toString('base64') !== image.data)
    throw new Error('Image must be valid base64 and at most 2 MiB')
  const { width, height } = imageDimensions(bytes, image.mime)
  const name =
    typeof image.name === 'string'
      ? image.name.replace(/[^a-zA-Z0-9_.-]/g, '_').slice(0, 100)
      : 'image'
  return { name, mime: image.mime, data: image.data, width, height }
}

export function imageDimensions(bytes, mime) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let width, height
  if (mime === 'image/png') {
    if (
      bytes.length < 33 ||
      ![137, 80, 78, 71, 13, 10, 26, 10].every(
        (value, index) => bytes[index] === value
      ) ||
      String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR'
    )
      throw new Error('Invalid PNG header')
    width = view.getUint32(16)
    height = view.getUint32(20)
  } else {
    if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216)
      throw new Error('Invalid JPEG header')
    let offset = 2
    while (offset < bytes.length) {
      if (bytes[offset++] !== 255) break
      while (bytes[offset] === 255) offset++
      const marker = bytes[offset++]
      if (marker === 218 || marker === 217) break
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue
      if (offset + 2 > bytes.length) break
      const length = view.getUint16(offset)
      if (length < 2 || offset + length > bytes.length) break
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        if (length < 8) break
        height = view.getUint16(offset + 3)
        width = view.getUint16(offset + 5)
        break
      }
      offset += length
    }
    if (!width || !height) throw new Error('Invalid JPEG dimensions')
  }
  if (
    !width ||
    !height ||
    width > 8192 ||
    height > 8192 ||
    width * height > MAX_PIXELS
  )
    throw new Error('Image exceeds 16 megapixels or 8192 pixels per side')
  return { width, height }
}
