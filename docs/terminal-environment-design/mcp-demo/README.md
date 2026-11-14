# Local read-only MCP demo

Uses the official `@modelcontextprotocol/sdk` 1.32.2, pinned by package-lock.json. Two real MCP tools: `get_current_time` and `echo_message`. The SDK client gateway `/inspect` connects over Streamable HTTP to the SDK server `/mcp`; every request performs a handshake and closes its transport. UI verification timestamps describe the last successful test, not a permanent live session.

Start from this directory: `docker compose up -d --build`. The deployment used the equivalent `docker run` resource/network arguments in compose.yaml. Requires the existing external network `overleaf-agent-acceptance_default`.

No host/project mounts, host-published ports, Docker socket, or credentials. Runs as node user, read-only root, all capabilities dropped, no-new-privileges, 128 MiB / 0.5 CPU / 64 PIDs. The two tools contain no shell or filesystem operations. The internal gateway only connects to its own local server; it cannot accept a user-supplied destination.

The authenticated web routes validate account ownership and permit only the exact demo URL and two reviewed tool names. General HTTP targets, stdio spawning, OAuth and Paper Assistant dynamic tools are not enabled by this demo. The gateway is internal-network-only and has no independent authentication; it exposes only these public, non-sensitive demo outputs. It is not a production general-purpose broker.

References: [official v1 client documentation](https://ts.sdk.modelcontextprotocol.io/client), [official SDK](https://github.com/modelcontextprotocol/typescript-sdk).

Stop this demo only: `docker compose stop mcp-demo`. Existing web, Git and Terminal services are unaffected. Cards retain their last-test timestamp; subsequent test/call reports unavailability. Do not interpret the timestamp as current health.
