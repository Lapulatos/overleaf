import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { validateImages, validateImage, imageDimensions } from '../../../libraries/validation-tools/image-input.mjs'
import { withImageFiles } from '../src/image-files.mjs'
const png = { name: '../../formula.png', mime: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aO3sAAAAASUVORK5CYII=' }

test('image validation accepts bounded PNG and sanitizes display names', () => {
  const result = validateImage(png)
  assert.equal(result.width, 1);assert.equal(result.height, 1)
  assert.ok(!result.name.includes('/'))
  assert.deepEqual(imageDimensions(new Uint8Array(Buffer.from(png.data,'base64')), png.mime), { width: 1, height: 1 })
})
test('oversized, malformed, mismatched and multiple image inputs are refused', () => {
  for (const image of [{ ...png, mime: 'image/svg+xml' }, { ...png, data: 'not base64' }, { ...png, data: 'a'.repeat(3000000) }, { ...png, mime: 'image/jpeg' }]) assert.throws(() => validateImage(image))
  assert.throws(() => validateImages([png,png]))
  const large = Buffer.from(png.data,'base64');large.writeUInt32BE(100000,16)
  assert.throws(() => validateImage({ ...png, data: large.toString('base64') }), /megapixels/)
})
test('temporary image files are private and removed after successful execution', async () => {
  let paths
  const result = await withImageFiles([png], async values => {
    paths = values
    assert.equal((await stat(values[0])).mode & 0o777, 0o600)
    assert.equal((await readFile(values[0])).toString('base64'), png.data)
    return 'result'
  })
  assert.equal(result,'result')
  await assert.rejects(stat(paths[0]), { code: 'ENOENT' })
})
test('temporary image files are removed after failure or cancellation', async () => {
  let path
  await assert.rejects(withImageFiles([png], async paths => { path=paths[0];throw new Error('Cancelled') }), /Cancelled/)
  await assert.rejects(stat(path), { code: 'ENOENT' })
})
