import { useSyncExternalStore } from 'react'
export type DockedNodeTerminal = { nodeId: string; nodeName: string; sessionId: string }
let nodes: DockedNodeTerminal[] = []
const listeners = new Set<() => void>()
export const useDockedNodeTerminals = () => useSyncExternalStore(
  callback => { listeners.add(callback); return () => { listeners.delete(callback) } },
  () => nodes
)
export function dockNodeTerminal(node: DockedNodeTerminal) {
  nodes = [...nodes.filter(item => item.nodeId !== node.nodeId), node]
  listeners.forEach(callback => callback())
  window.dispatchEvent(new CustomEvent('runtime-terminal-dock', { detail: node }))
}
export function returnNodeTerminal(nodeId: string) {
  nodes = nodes.filter(item => item.nodeId !== nodeId)
  listeners.forEach(callback => callback())
}
