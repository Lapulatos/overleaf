import { randomUUID } from 'node:crypto'

// Fetch into remote-tracking refs, then prepare the existing shared merge task.
// This operation deliberately never applies documents or pushes a remote ref.
export async function prepareReviewedPull({ command, authorize, discover, prepare }) {
  if (command.rebase) throw Object.assign(Error('Collaborative pull uses a reviewed merge. Rebase is not supported for shared workspaces.'), { status: 409 })
  await authorize()
  const operationId = command.operationId || randomUUID()
  const ref = `refs/remotes/${command.remote}/${command.branch}`
  const discovery = await discover({ remote: command.remote, operationId })
  await authorize()
  const expectedSourceOid = discovery.after?.[ref]
  if (discovery.state !== 'fetched' || !/^[a-f0-9]{40,64}$/.test(expectedSourceOid || '')) {
    throw Object.assign(Error('The requested remote branch is absent from the fetched snapshot. Refresh and choose an existing branch.'), { status: 409 })
  }
  return prepare({ operationId, ref, expectedSourceOid })
}
