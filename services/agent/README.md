# Overleaf local agent

This service produces manuscript analysis and proposed unified diffs. It does not
write project documents. The authenticated Overleaf Web service presents changes
for review and applies accepted changes through document-updater's version-checked
`/conditional` endpoint.

## Local setup

Requires Node.js 22 or later. From this directory:

```sh
npm ci --ignore-scripts
npm test
```

Set `OVERLEAF_AGENT_TOKEN` in both the daemon and Web environments. Use a private
random secret; do not put it in a URL or commit it. The daemon binds to
`127.0.0.1:47291`. Web uses `OVERLEAF_AGENT_ENDPOINT`, which defaults to that URL.
A containerized Web service needs a separately verified host-network/proxy setup;
container loopback is not the host's loopback. `--host` or `OVERLEAF_AGENT_HOST`
sets the listen IP explicitly. Using `0.0.0.0` exposes the authenticated service on
all IPv4 interfaces, so restrict network access. See
`../../plan/agent-deployment.md` for routing and runtime acceptance requirements.

## Direct API backend

Choose the API protocol and model explicitly:

```sh
# Set OPENAI_API_KEY in the environment first.
npm start -- --backend direct --provider openai --model YOUR_MODEL

# OpenAI-compatible service: OPENAI_BASE_URL or --endpoint is the base URL.
npm start -- --backend direct --provider openai --model YOUR_MODEL --endpoint https://your-provider.example/v1

# Set ANTHROPIC_API_KEY in the environment first.
npm start -- --backend direct --provider anthropic --model YOUR_CLAUDE_MODEL
```

`OVERLEAF_AGENT_MODEL` and `OVERLEAF_AGENT_PROVIDER` are environment alternatives.
The default `auto` protocol selects Anthropic only for `claude-*` models and uses
OpenAI-compatible Chat Completions otherwise. Use an explicit protocol for aliases.
Keys and base URLs only fall back to the selected provider's environment variables.
`--api-key` overrides the provider key, but environment configuration avoids placing
it in process arguments. Endpoint URLs must not contain credentials or query parameters.

The health endpoint checks the configured provider's models endpoint without generating
text. A healthy response proves connectivity, not access to every model. Providers
without a models endpoint may report degraded health while generation remains supported.
Truncated or empty generation responses fail instead of becoming complete suggestions.

## CLI backends

```sh
npm start -- --backend codex
npm start -- --backend claude-code
```

Codex uses its configured model and saved authentication unless explicitly overridden.
An explicit Codex key is passed only to that invocation through `CODEX_API_KEY`.
Codex runs in read-only mode and must emit a completed JSONL turn. Claude Code uses
plan mode. A real Codex synthetic grammar task has passed (see
`../../plan/agent-real-smoke-codex.json`); its patch also passed the Web proposal
validator. This does not establish browser or compile integration. The current
Anthropic environment returned HTTP 401 and needs valid provider credentials.
Passing deterministic tests does not prove model availability in another setup.

## Deployment status

Web task API and UI are implemented, but full browser/runtime acceptance is not yet
complete. Deploying Web alone is insufficient: document-updater must also include the
conditional write endpoint. Review `../../plan/prism-baseline-audit.md` before deploying.

Tests use local fake providers/CLI processes and do not spend API credits. The complete
combined service test command, from the repository root, is:

```sh
node --test services/agent/test/*.test.mjs services/web/test/agent/*.test.mjs
```
