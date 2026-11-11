export const DOCUMENT_PERMISSION_PROFILE = 'overleaf_task'
// Per-process overrides; never modify the operator's Codex configuration.
export const DOCUMENT_CONFIG_OVERRIDES = [
  'default_permissions="overleaf_task"',
  'permissions.overleaf_task={filesystem={":minimal"="read",":workspace_roots"={"."="write"}},network={enabled=false}}',
  'mcp_servers={}',
  'features.apps=false',
  'features.browser_use=false',
  'features.computer_use=false',
  'features.multi_agent=false',
  'features.multi_agent_v2=false',
  'features.hooks=false',
  'features.codex_hooks=false',
  'features.plugin_hooks=false',
  'features.memory_tool=false',
  'features.skip_host_skill_discovery=true',
  'skills.include_instructions=false',
  'web_search="disabled"',
  'project_doc_max_bytes=0',
  'shell_environment_policy.inherit="none"',
  'shell_environment_policy.set={PATH="/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin"}',
]
