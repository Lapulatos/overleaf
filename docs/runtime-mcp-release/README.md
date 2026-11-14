# Runtime environments and MCP checkpoint

This checkpoint includes the runtime-node service and UI, MCP configuration UI and demo connection, SSH terminal adapter, and required Paper Assistant session/file-reference integration.

## Included capabilities

- Register official GitLab Runner clients, or enroll via SSH with host-key verification and reverse forwarding for nodes that cannot reach the coordinator directly.
- Display separate Runner, SSH and monitoring states; summarize CPU, memory and GPU usage with expandable details.
- Per-node settings: always-on or on-demand Runner, idle timeout, and optional per-task Docker CPU/memory/GPU limits. Runner sleep does not stop SSH or terminals. Library thread settings are environment variables, not an OS thread cap.
- Persistent SSH/tmux terminals: input/output, history, rename, search, batch deletion and docking beside Paper Assistant. Remote sessions are independent of paper branches.
- Unique session references and approved Agent tools for reading output, executing commands and transferring files.
- MCP cards below Plugins, HTTP/stdio configuration and the supported demo connection. Configuration storage does not imply arbitrary MCP services are automatically accessible to the Agent.

## Source map

- `services/web/app/src/Features/RuntimeNodes/`: enrollment, monitoring, Runner protocol, tasks and execution settings.
- `services/runtime-terminal/`: SSH transport, reverse tunnels, remote helpers and persistent terminal lifecycle. `package-lock.json` pins ssh2.
- `services/web/app/src/Features/TerminalSessions/` and `services/agent/src/terminal-session-tools.mjs`: session references, authorization and tools.
- `services/web/app/src/Features/Mcp/`: MCP configuration and demo handlers.
- `services/web/frontend/js/features/settings/components/runtime-*`: runtime cards, settings, tasks and terminals.
- `services/web/frontend/js/features/mcp/`: MCP UI.
- `docs/terminal-environment-design/mcp-demo/`: official SDK demo server, dependency lockfile, Dockerfile and Compose deployment.
- `files.json`: exact source/configuration files selected for this checkpoint. This README and release plan are additional documentation.

## Deployment requirements

Keep private configuration outside the repository. The adapter reads `OVERLEAF_REMOTE_TERMINAL_CONFIG`, a JSON file containing `port`, a strong service `token`, `nodes` and optional `coordinatorPorts`. An empty `nodes` object allows subsequent SSH enrollment. The adapter binds loopback only; its managed credentials sidecar must remain private and retain the same encryption token.

Install adapter dependencies with `npm ci --prefix services/runtime-terminal`, then start `services/runtime-terminal/server.mjs` with the configuration environment variable. Remote hosts require Python 3, tmux and the official GitLab Runner. Docker resource limits require Docker access; selected NVIDIA GPUs additionally require a working NVIDIA container runtime. Images are required locally; tasks do not automatically pull images.

The Web service reads `/etc/overleaf/remote-terminal.json` containing the adapter `endpoint`, matching `token` and `nodeIds` allowlist for static nodes. Protect this file and the host adapter configuration with mode 0600. Provide a reachable bridge from the Web container to the loopback adapter; do not publish the token-bearing adapter as an unauthenticated public service. Use the existing deployment supervisor; this checkpoint does not install a macOS login item or guarantee host-reboot recovery.

Node management requires an administrator or the configured `runtimeNodes.ownerUserId`. The committed fixture settings preserve the existing deployment owner; new deployments must configure their own owner. Paper Assistant session tools also require the existing native Git shell service and its private configuration, plus a `siteUrl` reachable by the Agent.

## Verification scope

Release verification passed: 20 backend/Agent tests, 19 frontend tests, syntax checks for 49 scripts, staged dependency closure and credential scan. The staged production build succeeded with 3 warnings: one review-panel export warning and two bundle-size warnings. Build output and local deployment credentials are not committed. Earlier Chrome/Firefox checks on ports 18081 and 18082 are preserved in the local feature evidence directories; this commit operation does not change the live deployments or rerun remote jobs.

Unrelated automatic-sync and message-copy-button changes remain in the working tree.
