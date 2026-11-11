import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateImages } from '../../../libraries/validation-tools/image-input.mjs'

export async function withImageFiles(images, action) {
  const validated = validateImages(images)
  if (!validated.length) return await action([])
  const directory = await mkdtemp(join(tmpdir(), 'overleaf-agent-image-'))
  try {
    const paths = []
    for (const [index, image] of validated.entries()) {
      const path = join(directory, `${index}.${image.mime === 'image/png' ? 'png' : 'jpg'}`)
      await writeFile(path, Buffer.from(image.data, 'base64'), { mode: 0o600, flag: 'wx' })
      paths.push(path)
    }
    return await action(paths)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
