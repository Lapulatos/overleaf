// Presentation metadata only: native Git owns the remote configuration.
// Never return credentials, query strings or arbitrary remote URLs to the graph.
export function remoteWebLinks(remotes) {
  const providers = { 'github.com': 'GitHub', 'gitee.com': 'Gitee', 'gitlab.com': 'GitLab', 'bitbucket.org': 'Bitbucket' }
  return remotes.flatMap(remote => {
    const raw = remote.refs?.fetch
    if (typeof raw !== 'string') return []
    const scp = raw.match(/^(?:[^/@:]+@)?([^/:]+):([^/].*)$/)
    let url
    try { url = new URL(scp && !raw.includes('://') ? `ssh://${scp[1]}/${scp[2]}` : raw) } catch { return [] }
    const provider = Object.hasOwn(providers, url.hostname) ? providers[url.hostname] : undefined
    if (!provider || !['https:', 'http:', 'ssh:', 'git:'].includes(url.protocol) || url.port) return []
    const path = url.pathname.replace(/\.git\/?$/, '').replace(/\/$/, '')
    // Provider repository paths cannot contain encoded delimiters or traversal.
    const segments = path.slice(1).split('/')
    if (segments.length < 2 || (provider !== 'GitLab' && segments.length !== 2) || segments.some(part => !/^[\w.-]+$/.test(part) || part === '.' || part === '..')) return []
    const suffix = provider === 'GitLab' ? '/-/commit/' : provider === 'Bitbucket' ? '/commits/' : '/commit/'
    return [{ name: remote.name, provider, commitBaseUrl: `https://${url.hostname}${path}${suffix}` }]
  })
}
