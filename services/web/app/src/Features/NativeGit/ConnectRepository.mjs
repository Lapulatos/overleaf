import { mkdtemp, mkdir, readdir, rename, rm } from 'node:fs/promises'
import Path from 'node:path'
import { GitRepository, remoteUrl } from './GitRepository.mjs'

// Clone actual Git history, then bind the existing editor files as its working
// directory. Connecting never replaces the manuscript or invents a baseline.
export async function connectRepository(context, input) {
  const { root, repository, store, withLock, credentials } = context
  const url = remoteUrl(input.url, repository.allowLocalRemotes)
  if (!!input.token !== !!input.username) throw Object.assign(new Error('Provide both username and access token'), { status: 400 })
  return withLock(async () => {
    try { await store.read(); throw Object.assign(new Error('This project already has a Git repository'), { status: 409 }) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    // Save first so missing encryption configuration fails before a network call.
    if (input.token) await credentials.save(url, input.username, input.token)
    const credential = await credentials.read(url)
    const entries = await readdir(repository.directory)
    if (entries.length) {
      // A process may have stopped after the atomic clone install but before
      // binding persistence. Resume only the same repository and selected branch.
      const actual = await repository.remoteUrl('origin')
      const status = await repository.status()
      if (actual !== url || (input.branch && status.branch !== input.branch)) {
        throw Object.assign(new Error('An existing repository must be recovered before connecting another'), { status: 409 })
      }
      await store.initialize({ directory: repository.directory, branch: status.branch })
      return
    }
    const temporary = await mkdtemp(Path.join(root, 'clone-'))
    try {
      const directory = Path.join(temporary, 'repository')
      await mkdir(directory)
      const clone = new GitRepository(directory, repository.options)
      await clone.withRemoteCredentials(url, credential, git => git.clone(url, input.branch))
      const status = await clone.status()
      // POSIX rename replaces only the empty destination, never an existing repo.
      await rename(directory, repository.directory)
      await store.initialize({ directory: repository.directory, branch: status.branch })
    } finally { await rm(temporary, { recursive: true, force: true }) }
  })
}
