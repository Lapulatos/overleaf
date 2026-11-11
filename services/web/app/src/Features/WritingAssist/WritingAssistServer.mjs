// @ts-check
/**
 * Standalone Writing Assist (WA) Express server for host-side (arm64 native)
 * development.
 *
 * Routes `/writing-assist/*` requests that the container's nginx proxies to
 * `host.docker.internal:3050`. Reads sessions from the same Redis instance
 * as the container, so authentication works seamlessly.
 *
 * Usage:
 *   cd services/web && OVERLEAF_CONFIG=../../server-ce/config/settings.js \
 *     OVERLEAF_MONGO_URL=mongodb://localhost:27017/sharelatex \
 *     OVERLEAF_REDIS_HOST=localhost \
 *     OVERLEAF_SESSION_SECRET=dev-secret-change-in-production-1234567890 \
 *     node app/src/Features/WritingAssist/WritingAssistServer.mjs
 *
 * Or use plan/start-wa-host.sh which sets all env vars.
 */

import express from 'express'
import session from 'express-session'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import Redis from 'ioredis'
import createRedisStore from 'connect-redis'

import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'

// ── Mongoose connection ──────────────────────────────────────────────────────

// The MongoDB replica set member host is "mongo:27017" (a Docker hostname that
// the host cannot resolve). directConnection=true bypasses replica set
// topology discovery and connects directly to the specified host:port.
// Note: directConnection bypasses replica set topology. WA code does not use
// MongoDB transactions, so this is safe. If transactions are needed later,
// use a replicaSet URL with resolvable hostnames instead.
const mongooseOptions = {
  ...Settings.mongo.options,
  directConnection: true,
  serverSelectionTimeoutMS: 10000,
}
await mongoose.connect(Settings.mongo.url, mongooseOptions)
logger.info(`WA host: connected to MongoDB at ${Settings.mongo.url}`)

// Patch Settings.mongo.options so that when Mongoose.mjs is imported later
// (by WA model modules), it calls mongoose.connect() with directConnection=true
// too. Without this, Mongoose.mjs creates a second connection attempt to the
// replica set member host "mongo:27017" (unresolvable from host), which crashes
// the process with ENOTFOUND.
Settings.mongo.options = {
  ...Settings.mongo.options,
  directConnection: true,
}

// ── Redis session store ──────────────────────────────────────────────────────

const websessionsConfig = Settings.redis.websessions || Settings.redis.web
const redisClient = new Redis({
  host: websessionsConfig.host,
  port: parseInt(websessionsConfig.port, 10) || 6379,
  password: websessionsConfig.password || undefined,
  tls: websessionsConfig.tls || undefined,
})

const RedisStore = createRedisStore(session)
const sessionStore = new RedisStore({ client: redisClient, prefix: 'sess:' })

// ── Session secrets (must match container) ───────────────────────────────────

const sessionSecrets = [
  Settings.security.sessionSecret,
  Settings.security.sessionSecretUpcoming,
  Settings.security.sessionSecretFallback,
].filter(Boolean)

// ── Auth middleware ───────────────────────────────────────────────────────────

/**
 * Compute the session validation token (same as CustomSessionStore).
 * The container's session store writes `validationToken = 'v1:' + sid.slice(-4)`
 * on every session set.
 */
function computeValidationToken(sid) {
  return 'v1:' + sid.slice(-4)
}

/**
 * Custom auth middleware that replaces AuthenticationController.requireLogin().
 * Reads the user from the Redis-backed session (same store as the container).
 *
 * Matches CustomSessionStore behavior strictly:
 * - Sessions without a validationToken are rejected (same as CustomSessionStore
 *   which returns null for missing tokens).
 * - Sessions with mismatched tokens are rejected.
 * - Only sessions with valid tokens AND a logged-in user pass through.
 * - Sets req.user to match the main app's requireLogin() behavior.
 */
function sessionAuth(req, res, next) {
  if (!req.session) {
    return res.status(401).json({ error: 'no session' })
  }

  // Strict validation: reject sessions without or with mismatched tokens,
  // matching CustomSessionStore.get() behavior.
  const token = req.session.validationToken
  if (!token || token !== computeValidationToken(req.sessionID)) {
    return res.status(401).json({ error: 'invalid session' })
  }

  // Extract user info from session (same logic as SessionManager).
  const sessionUser = req.session.user || req.session?.passport?.user
  if (!sessionUser || !sessionUser._id) {
    return res.status(401).json({ error: 'not logged in' })
  }

  // Set req.user to match the main app's requireLogin() behavior,
  // so any future code that reads req.user (instead of req.session)
  // works correctly.
  req.user = sessionUser

  next()
}

// ── CSRF protection ──────────────────────────────────────────────────────────

/**
 * Lightweight CSRF check for mutation requests (POST, PUT, DELETE).
 * Verifies that the Origin or Referer header matches the expected host,
 * matching the pattern used in Csrf.blockCrossOriginRequests().
 * GET/HEAD/OPTIONS are safe by definition (no state change) and skip the check.
 *
 * When behind nginx proxy, the Host header is overridden to the backend's
 * address (host.docker.internal:3050) for Node.js strict Host checking. The
 * original browser host is preserved in X-Forwarded-Host. We compare the
 * Origin/Referer against X-Forwarded-Host (or Host if no proxy header).
 */
function csrfCheck(req, res, next) {
  if (
    req.method === 'GET' ||
    req.method === 'HEAD' ||
    req.method === 'OPTIONS'
  ) {
    return next()
  }

  const origin = req.headers['origin']
  const referer = req.headers['referer']
  // Use X-Forwarded-Host when behind nginx (preserves original browser host).
  // Fall back to Host header for direct requests (e.g. curl).
  const targetHost = req.headers['x-forwarded-host'] || req.headers['host']

  // Determine the source of the request
  const sourceHost = origin
    ? new URL(origin).host
    : referer
      ? new URL(referer).host
      : ''

  // Normalize default ports: "localhost:80" and "localhost" are equivalent
  // for HTTP; "localhost:443" and "localhost" are equivalent for HTTPS.
  // The browser omits default ports from Origin, but nginx may include them
  // in the Host header when forwarding.
  const normalizeHost = (h) => h.replace(/:80$/, '').replace(/:443$/, '')

  // Allow requests where the source host matches the target host
  // (same-origin). Also allow requests with no origin/referer (direct API
  // calls, e.g. curl) — these are not cross-site attacks.
  if (!sourceHost || normalizeHost(sourceHost) === normalizeHost(targetHost)) {
    return next()
  }

  return res.status(403).json({ error: 'csrf check failed' })
}

// ── Express app ──────────────────────────────────────────────────────────────

const app = express()
const WA_PORT = parseInt(process.env.WA_HOST_PORT, 10) || 3050

app.use(cookieParser(sessionSecrets))
app.use(
  session({
    store: sessionStore,
    secret: sessionSecrets,
    resave: false,
    saveUninitialized: false,
    // Cookie name (key) must match the main app so the browser sends the same
    // session cookie to both. IMPORTANT: `key` is a top-level session() option,
    // NOT a nested cookie property. Putting it inside `cookie` makes express-session
    // fall back to 'connect.sid', which doesn't match the browser's 'overleaf.sid'.
    key: Settings.cookieName || 'overleaf.sid',
    // Cookie config matches the main app (Server.mjs:189-203).
    // Domain, maxAge, and sameSite must match so the browser sends the
    // same session cookie to both the main app and the WA server.
    cookie: {
      domain: Settings.cookieDomain,
      maxAge: Settings.cookieSessionLength,
      sameSite: Settings.sameSiteCookie || 'lax',
      secure: Settings.secureCookie || false,
    },
    rolling: Settings.cookieRollingSession === true,
    proxy: Settings.behindProxy,
  })
)
app.use(express.json({ limit: '2mb' }))
app.use(csrfCheck)

// ── Patch settings for missing server-only configs ────────────────────────────

// Some modules in the WA dependency chain access server-only settings that are
// undefined in the dev environment (e.g. settings.apis.v1.url). Without these
// patches, the dynamic import of WritingAssistRouter crashes with TypeError.
// These patches provide dummy values that will never actually be called (the WA
// server never makes V1 API requests).
if (!Settings.apis.v1 || !Settings.apis.v1.url) {
  Settings.apis.v1 = {
    url: 'http://127.0.0.1:3001',
    user: '',
    pass: '',
    timeout: 5000,
  }
  logger.info('Patched settings.apis.v1 with dummy values for host WA server')
}

// ── Mount WA routes ──────────────────────────────────────────────────────────

// Dynamic import of WA modules AFTER mongoose connection is established.
// The WA managers import Mongoose models that need an active connection.
const {
  default: WritingAssistRouter,
} = await import('./WritingAssistRouter.mjs')

// Pass our sessionAuth as the auth middleware (third argument).
// WritingAssistRouter.apply() registers /writing-assist/* routes that each
// attach AuthenticationController.requireLogin() as their auth middleware.
// On the host server we authenticate via our own sessionAuth (Redis-backed
// session lookup). To avoid the container's requireLogin trying to redirect
// to /login when our sessionAuth has already vetted the request, swap it for
// a noop on this process before the Router imports it.
const AuthenticationController = (
  await import('../Authentication/AuthenticationController.mjs')
).default
AuthenticationController.requireLogin = () => (_req, _res, next) => next()

// Note: routes already include the /writing-assist/ prefix, so mount at /.
const router = express.Router()
router.use(sessionAuth)
WritingAssistRouter.apply(router)
app.use('/', router)

// ── Error handler ────────────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500
  logger.error({ err, statusCode }, 'WA host server error')
  // Only expose error messages for client errors (4xx); hide internals for
  // server errors (5xx).
  const isClientError = statusCode >= 400 && statusCode < 500
  res.status(statusCode).json({
    error: isClientError
      ? err.message || 'bad request'
      : 'internal server error',
  })
})

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(WA_PORT, '127.0.0.1', () => {
  logger.info(
    `WA host server listening on 127.0.0.1:${WA_PORT} (arm64 native)`
  )
  logger.info(`  MongoDB: ${Settings.mongo.url}`)
  logger.info(
    `  Redis:   ${websessionsConfig.host}:${websessionsConfig.port}`
  )
})