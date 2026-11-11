const settings = require('/etc/overleaf/settings.js')
if (settings.siteUrl !== 'http://127.0.0.1:18081' || !settings.mongo.url.endsWith('/prism_reviewed_deletion')) {
  throw new Error('Refusing candidate settings outside isolated instance')
}
settings.cookieName = 'overleaf.candidate.sid'
settings.documentupdater = { ...settings.documentupdater, reviewedDeletionEnabled: true }
module.exports = settings
