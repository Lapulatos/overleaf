// These change project-shared remote configuration or remove remote refs.
// Credentials remain personal (stored under userId), not project-shared.
const remoteManagementCommands = new Set([
  'addRemote', 'removeRemote', 'changeRemote', 'connect', 'deleteRemoteRef',
])

export async function requireCommandCapability(command, userId, getAccess) {
  if (!remoteManagementCommands.has(command)) return
  const access = await getAccess()
  if (String(access.getOwnerId()) !== String(userId)) {
    throw Object.assign(new Error('Only the project owner can change shared remotes or delete remote branches and tags.'), { status: 403 })
  }
}
