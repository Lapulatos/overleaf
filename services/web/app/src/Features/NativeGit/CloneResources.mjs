import { readWorktree } from './WorktreeFiles.mjs'

export async function validateCloneResources(repository) {
  // Read the index, not .gitmodules: a gitlink can exist without that file.
  const entries = (await repository.git.raw(['ls-files', '--stage', '-z'])).split('\0')
  const submodules = entries.filter(entry => entry.startsWith('160000 '))
    .map(entry => entry.slice(entry.indexOf('\t') + 1))
  if (submodules.length) {
    throw Object.assign(new Error(`Clone cannot import submodules: ${submodules.slice(0,5).join(', ')}. Commit their required files as ordinary repository files before cloning.`), { status: 400 })
  }
  const files = await readWorktree(repository.directory)
  const missing = [...files].filter(([, bytes]) => {
    if (bytes.length >= 1024) return false
    const text = bytes.toString('utf8')
    return /^version https:\/\/(git-lfs|hawser)\.github\.com\/spec\/v1\r?\n/.test(text) &&
      /^oid sha256:[a-f0-9]{64}\r?$/m.test(text) && /^size [0-9]+\r?$/m.test(text)
  }).map(([path]) => path)
  if (missing.length) {
    throw Object.assign(new Error(`Clone found Git LFS pointers without file contents: ${missing.slice(0,5).join(', ')}. Download the LFS resources and commit the required files as ordinary Git files before cloning.`), { status: 400 })
  }
  return files
}
