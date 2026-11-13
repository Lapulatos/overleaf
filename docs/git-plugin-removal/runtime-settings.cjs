const settings = require('/etc/overleaf/settings.js')
if (settings.siteUrl !== 'http://127.0.0.1:18081' || !settings.mongo.url.endsWith('/prism_reviewed_deletion')) {
  throw new Error('Refusing candidate settings outside isolated instance')
}
settings.cookieName = 'overleaf.candidate.sid'
settings.documentupdater = { ...settings.documentupdater, reviewedDeletionEnabled: true }
settings.nativeGit = { ...settings.nativeGit, discoveryScheduler: true, autoCommitScheduler: true, autoSyncScheduler: true }
if (require('fs').existsSync('/etc/overleaf/terminal-runtime.json')) {
  const terminal = require('/etc/overleaf/terminal-runtime.json')
  if (terminal.container !== 'overleaf-deletion-acceptance-candidate-web-1' || terminal.endpoint !== 'http://host.docker.internal:47295') throw new Error('Unexpected terminal runtime')
  process.env.OVERLEAF_NATIVE_GIT_TERMINAL_ENDPOINT = terminal.endpoint
  process.env.OVERLEAF_TERMINAL_RUNNER_TOKEN = terminal.token
  settings.nativeGit.shellDrafts = true
}
module.exports = settings
