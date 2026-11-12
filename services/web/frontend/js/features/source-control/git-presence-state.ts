import { useSyncExternalStore } from 'react'
import type { PresenceSnapshot } from './git-presence'
const values = new Map<string, PresenceSnapshot | null>()
const listeners = new Map<string, Set<() => void>>()
const viewedCommits = new Map<string, string>()
const intents = new Map<string, Set<(commit: string | null) => void>>()
export function publishGitPresence(project: string, value: PresenceSnapshot | null) {
 values.set(project, value); listeners.get(project)?.forEach(listener => listener())
}
export function onGitViewingIntent(project: string, listener: (commit: string | null) => void) {
 let set = intents.get(project)
 if (!set) intents.set(project, set = new Set())
 set.add(listener)
 listener(viewedCommits.get(project) ?? null)
 return () => { set!.delete(listener) }
}
export function viewGitCommit(project: string | undefined, commit: string | null) {
 if (!project) return
 if (commit) viewedCommits.set(project, commit)
 else viewedCommits.delete(project)
 intents.get(project)?.forEach(listener => listener(commit))
}
export function useGitPresence(project: string | undefined) {
 return useSyncExternalStore(listener => {
  if (!project) return () => {}
  let set = listeners.get(project)
  if (!set) listeners.set(project, set = new Set())
  set.add(listener); return () => { set!.delete(listener) }
 }, () => project ? values.get(project) ?? null : null)
}
