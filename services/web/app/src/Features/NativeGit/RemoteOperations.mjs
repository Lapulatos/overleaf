// Run against the already locked/synchronized repository, using credentials for
// the exact fetch or push URL rather than assuming both destinations match.
export async function executeRemoteCommand(repo, command, {credentials, author}) {
  const push = ['push', 'pushTags', 'remoteRef', 'deleteRemoteRef'].includes(command.command) || command.target === 'push'
  const url = await repo.remoteUrl(command.remote, push)
  if (command.command === 'saveCredential') {
    await credentials.save(url,command.username,command.token)
    return {configured:true}
  }
  if (command.command === 'removeCredential') {
    await credentials.remove(url)
    return {configured:false}
  }
  const credential = await credentials.read(url)
  if (command.command === 'credentialStatus') return {configured:!!credential,username:credential?.username || '',url}
  if (author) await repo.author(author.name,author.email)
  if (command.command === 'sync') {
    if ((await repo.status()).branch !== command.branch) throw Object.assign(new Error('The current branch changed. Reopen Sync.'),{status:409})
    await repo.withRemoteCredentials(url,credential,remote=>remote.pull(command.remote,command.branch))
    const pushUrl = await repo.remoteUrl(command.remote,true)
    return repo.withRemoteCredentials(pushUrl,await credentials.read(pushUrl),remote=>remote.push(command.remote,command.branch))
  }
  return repo.withRemoteCredentials(url,credential,remote=>{
    switch(command.command) {
      case 'fetch': return remote.fetch(command.remote,{prune:command.prune})
      case 'push': return remote.push(command.remote,command.branch,{publish:command.publish})
      case 'pull': return remote.pull(command.remote,command.branch,{rebase:command.rebase})
      case 'remoteRef': return remote.remoteRef(command.remote,command.kind,command.name)
      case 'deleteRemoteRef': return remote.deleteRemoteRef(command.remote,command.kind,command.name,command.expectedHash)
      case 'pushTags': return remote.pushTags(command.remote)
      default: throw new Error('Unsupported remote operation')
    }
  })
}
