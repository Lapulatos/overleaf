import type { Task } from './agent-task-result'

// A recovery response belongs to the original task, even after navigation.
export function replaceRecoveredTask<T extends Task | null | undefined>(current: T, recovered: Task): T | Task {
  if (!current || current.taskId !== recovered.taskId || current.projectId !== recovered.projectId) return current
  const before = current.workspaceIdentity
  const after = recovered.workspaceIdentity
  if (Boolean(before) !== Boolean(after)) return current
  if (before && after && (before.projectId !== after.projectId || before.workspaceId !== after.workspaceId || before.branch !== after.branch || before.epoch !== after.epoch)) return current
  return recovered
}
