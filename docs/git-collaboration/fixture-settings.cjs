const settings = require('/etc/overleaf/settings.js')
if (settings.siteUrl !== 'http://127.0.0.1:18082' || !settings.mongo.url.endsWith('/prism_git_collaboration_20261111')) {
  throw new Error('Workspace acceptance settings require their dedicated instance')
}
settings.nativeGit = { ...settings.nativeGit, discoveryScheduler: true, autoCommitScheduler: true, autoSyncScheduler: true }
settings.cookieName = 'overleaf.workspace.acceptance.sid'
settings.documentupdater = { ...settings.documentupdater, reviewedDeletionEnabled: true }
// Credentials stay outside the repository and outside every shell scratch mount.
if (require('fs').existsSync('/etc/overleaf/shell-fixture.json')) {
  const terminal = require('/etc/overleaf/shell-fixture.json')
  if (terminal.container !== 'overleaf-git-collaboration-web' || terminal.endpoint !== 'http://host.docker.internal:47294') throw new Error('Unexpected terminal fixture')
  process.env.OVERLEAF_NATIVE_GIT_TERMINAL_ENDPOINT = terminal.endpoint
  process.env.OVERLEAF_TERMINAL_RUNNER_TOKEN = terminal.token
  settings.nativeGit.shellDrafts = true
}
module.exports = settings
