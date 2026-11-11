import type { RailElement } from '@/features/ide-react/util/rail-types'
import AgentPanel from './agent-panel'

function ReferencesIcon({ title }: { title: string }) {
  return <><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="5" height="15" rx="1" /><path d="M3 8h5M3 16h5M10 4h4v15h-4zM10 8h4M16 5l3-1 4 14-3 1zM2 21h21" /></svg><span className="visually-hidden">{title}</span></>
}
const entry: RailElement = {
  key: 'writing-assist-agent',
  icon: ReferencesIcon,
  title: 'References',
  component: <AgentPanel />,
}
export default entry
