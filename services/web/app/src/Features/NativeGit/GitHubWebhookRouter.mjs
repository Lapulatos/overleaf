import express from 'express'
import Settings from '@overleaf/settings'
import { nativeGitRuntime } from './NativeGitRuntime.mjs'
// Must precede JSON parsing and session/CSRF middleware. Authentication is the
// HMAC of the exact raw bytes, not a browser cookie or user-supplied owner ID.
export function applyGitHubWebhookRoute(app) {
  app.post('/native-git/webhooks/github/:projectId/:hookId',
    (req, res, next) => {
      if (!Settings.nativeGit?.enabled || !Settings.nativeGit?.discoveryScheduler) return res.sendStatus(404)
      if (!/^[a-f0-9]{24}$/.test(req.params.projectId) || !/^[a-f0-9-]{36}$/.test(req.params.hookId)) return res.sendStatus(404)
      next()
    }, express.raw({ type: 'application/json', limit: '2mb', inflate: false }),
    async (req, res) => {
      res.set('Cache-Control', 'no-store')
      try {
        const result = await nativeGitRuntime.receiveGitHubWebhook(req.params.projectId, {
          hookId: req.params.hookId, body: req.body, signature: req.get('x-hub-signature-256'),
          delivery: req.get('x-github-delivery'), event: req.get('x-github-event'),
        })
        res.status(result.queued ? 202 : 200).json(result)
      } catch (error) {
        const status = error.status || error.statusCode
        res.status([400,401,403,404,409,413,429,503].includes(status) ? status : 503)
          .json({ error: 'Webhook was not accepted. Verify its signature, repository binding and automatic remote check settings.' })
      }
    })
}
