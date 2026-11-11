#!/usr/bin/env node
// @ts-check
/**
 * CLI entry point for overleaf-agent.
 *
 * Usage:
 *   npx overleaf-agent --port 47291 --backend direct --api-key sk-xxx --endpoint https://www.dmxapi.cn
 *   npx overleaf-agent --port 47291 --backend codex
 *   npx overleaf-agent --port 47291 --backend claude-code --max-budget-usd 5
 */

import 'dotenv/config'
import { Command } from 'commander'
import { startServer } from './index.mjs'

const program = new Command()

program
  .name('overleaf-agent')
  .description('Local agent daemon for Overleaf WritingAssist')
  .version('0.1.0')
  .option('-p, --port <number>', 'port to listen on', '47291')
  .option('--host <address>', 'listen IP address (default: loopback)', process.env.OVERLEAF_AGENT_HOST || '127.0.0.1')
  .option('-b, --backend <name>', 'agent backend (claude-code, codex, aider, direct)', 'direct')
  .option('--provider <name>', 'direct API protocol: auto, openai or anthropic', process.env.OVERLEAF_AGENT_PROVIDER || 'auto')
  .option('--api-key <key>', 'API key for direct/backend')
  .option('--endpoint <url>', 'custom API endpoint (e.g. dmxapi relay)', '')
  .option('--model <name>', 'model name', '')
  .option('--sandbox <mode>', 'sandbox mode (proposal generation uses read-only)', 'read-only')
  .option('--timeout <ms>', 'default task timeout in ms', '')
  .option('--max-budget-usd <number>', 'max budget per task (USD, for claude-code)', '')
  .option('--agent-token <token>', 'shared secret for authenticating requests', '')
  .option('--wa-host-url <url>', 'WA Host Server URL for API proxy', 'http://127.0.0.1:3050')
  .option('--agent-api-secret <secret>', 'shared secret for agent API token validation', '')
  .option('--max-concurrent-tasks <number>', 'max simultaneously running tasks', '3')
  .option('--log-level <level>', 'log level (debug, info, warn, error)', 'info')
  .parse()

const opts = program.opts()

// Backend-specific defaults: CLI agents need much more time and steps
// than single-shot API calls.
const BACKEND_DEFAULTS = {
  direct:       { model: '', timeout: 120000, maxBudgetUsd: null },
  'claude-code': { model: 'claude-sonnet-4-6', timeout: 600000, maxBudgetUsd: 5.0 },
  codex:        { model: '',            timeout: 600000, maxBudgetUsd: null },
  aider:        { model: 'anthropic/claude-sonnet-4-6', timeout: 600000, maxBudgetUsd: null },
}

const defaults = BACKEND_DEFAULTS[opts.backend] || BACKEND_DEFAULTS.direct

const config = {
  maintenanceConfig: process.env.OVERLEAF_AGENT_MAINTENANCE_CONFIG || '',
  compilerImage: process.env.OVERLEAF_AGENT_COMPILER_IMAGE || '',
  speechPython: process.env.OVERLEAF_SPEECH_PYTHON || '',
  speechModel: process.env.OVERLEAF_SPEECH_MODEL || '',
  host: opts.host,
  port: parseInt(opts.port, 10) || 47291,
  backend: opts.backend,
  apiKey: opts.apiKey,
  provider: opts.provider,
  endpoint: opts.endpoint,
  model: opts.model || process.env.OVERLEAF_AGENT_MODEL || defaults.model,
  maxSteps: 200,   // High ceiling — let the agent decide how many steps it needs
  timeout: parseInt(opts.timeout, 10) || defaults.timeout,
  maxBudgetUsd: opts.maxBudgetUsd ? parseFloat(opts.maxBudgetUsd) : defaults.maxBudgetUsd,
  sandbox: 'read-only',
  agentToken: opts.agentToken || process.env.OVERLEAF_AGENT_TOKEN || '',
  waHostUrl: opts.waHostUrl || process.env.WA_HOST_URL || 'http://127.0.0.1:3050',
  agentApiSecret: opts.agentApiSecret || process.env.OVERLEAF_AGENT_API_SECRET || '',
  maxConcurrentTasks: parseInt(opts.maxConcurrentTasks, 10) || 3,
  logLevel: opts.logLevel || 'info',
}

console.log(`Starting overleaf-agent v0.1.0`)
console.log(`  Port:     ${config.port}`)
console.log(`  Backend:  ${config.backend}`)
console.log(`  Model:    ${config.model}`)
console.log(`  Timeout:  ${config.timeout / 1000}s`)
if (config.backend === 'codex') {
  console.log(`  Sandbox:  ${config.sandbox}`)
}
if (config.maxBudgetUsd) {
  console.log(`  Budget:   $${config.maxBudgetUsd}`)
}
if (config.endpoint) {
  console.log(`  Endpoint: ${config.endpoint}`)
}
if (config.apiKey) {
  console.log('  API Key:  configured')
}
if (config.agentToken) {
  console.log('  Auth:     enabled')
}
console.log(`  WA Host:  ${config.waHostUrl}`)
if (config.agentApiSecret) {
  console.log('  API Sec:  enabled')
}
console.log(`  MaxConc:  ${config.maxConcurrentTasks}`)
console.log(`  LogLvl:   ${config.logLevel}`)

startServer(config).catch(error => {
  console.error(`Agent startup failed: ${error.message}`)
  process.exitCode = 1
})
