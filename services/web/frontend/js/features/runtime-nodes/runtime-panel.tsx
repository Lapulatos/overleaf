import RuntimeNodes from '@/features/settings/components/runtime-nodes'
import RailPanelHeader from '@/features/ide-react/components/rail/rail-panel-header'
export function RuntimeRailIcon({title='Runtime environments'}:{title?:string}) {
 return <><svg className="ide-rail-tab-link-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M15 6.5h3M15 17.5h3"/></svg><span className="visually-hidden">{title}</span></>
}
export default function RuntimePanel() {
 return <div className="runtime-panel"><RailPanelHeader title="Runtime environments"/><div className="runtime-panel-body"><RuntimeNodes compact/></div></div>
}
