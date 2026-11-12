import EnvironmentMaintenance from './environment-maintenance'
import { MessageAvatar, UserMessage, AssistantMessage, AgentActivity, type Activity, type SourceSelection } from './agent-messages'
import { useState } from 'react'
import { ProposalDiff } from './proposal-diff'
import { OLModal, OLModalHeader, OLModalTitle, OLModalBody, OLModalFooter } from '@/shared/components/ol/ol-modal'
import { FetchError } from '@/infrastructure/fetch-json'
import OLButton from '@/shared/components/ol/ol-button'
import { ApplicationInspection } from './application-inspection'

export type Proposal = {
  id: string
  path: string
  docId?: string
  version?: number
  mode?: string
  before: string
  after: string
  status:
    | 'pending'
    | 'applying'
    | 'accepted'
    | 'rejected'
    | 'conflict'
    | 'uncertain'
    | 'closed-unconfirmed'
}
export type ReferenceFieldChoice = { key: string; field: string }
export type ReferenceReview = {
  baseHash?: string
  path?: string
  appliedCount?: number
  docId: string
  keys: string[]
  checkedAt: string
  entries: { key: string; source: string | null; identity: string | null; reason: string | null;
    verification?: {crossCheckedFields?:string[];verified:boolean;summary:string;reason:string|null;sources:{label:string;url:string}[];officialUnavailable?:boolean;blockedFields?:Record<string,string>} | null
    actions?: {field: string; before: string; after: string}[]
    fields: {field: string; current: string; found: string; status: string;verificationReason?:string|null}[] }[]
}
export type ClaimReview = { checkedAt: string; items: {
 id:string;docId?:string;path:string;line:number;keys:string[];before:string;after:string|null;
 verdict:'supported'|'partial'|'contradicted'|'insufficient';reason:string;source:string|null;quote:string|null;
 status:'pending'|'review'|'accepted';note:string|null;
}[] }
export type Task = {
  workspaceIdentity?: { projectId: string; workspaceId: string; branch: string | null; epoch: number } | null
  projectId?: string
  scope?: {kind:string;path:string}[]
  plugins?: {command:string}[]
  claimReview?: ClaimReview
  referenceReview?: ReferenceReview
  taskId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  instruction: string
  summary: string
  activity?: Activity[]
  sourceSelection?: SourceSelection
  output: string
  proposals: Proposal[]
}

export function message(error: unknown) {
  if (error instanceof FetchError && typeof error.data?.error === 'string')
    return error.data.error
  return error instanceof Error
    ? error.message
    : 'The request failed. Please retry.'
}

export function AgentTaskResult({
  task,
  busy,
  act,
  onReviewInEditor,
  onRecovered,
  hideInstruction = false,
  messageActions,
}: {
  onRecovered?: (task: Task) => void
  messageActions?: React.ReactNode
  hideInstruction?: boolean
  task: Task
  busy: boolean
  act: (proposal: Proposal, accept: boolean) => void
  onReviewInEditor?: (proposal: Proposal) => void
}) {
  const maintenanceEvent=[...(task.activity||[])].reverse().find(item=>item.kind==='tool'&&(item.title==='request_environment_repair'||item.title==='Environment repair proposal · owner confirmation required'))
  return (
    <section aria-label="Task result" className="paper-task-result">
      {!hideInstruction && <UserMessage instruction={task.instruction} sourceSelection={task.sourceSelection} />}
      {!!task.scope?.length && <p className="paper-context-scope">Edit scope: {task.scope.map(s=>s.path+(s.kind==='folder'?'/':'')).join(', ')}</p>}
      {!!task.plugins?.length && <p className="paper-context-scope">Skills: {task.plugins.map(s=>s.command).join(', ')}</p>}
      <div className="paper-assistant-bubble"><div className="paper-reply-header"><MessageAvatar assistant /><span className="paper-task-status" role="status">Status: {task.status}</span></div>
      <AgentActivity activity={task.activity} running={task.status === 'running'} />
      {task.status === 'running' ? <p className="paper-task-progress" role="status">{task.output || 'Reading project context…'}</p> : !task.activity?.some(item=>item.kind==='message'&&item.text?.trim()===task.summary.trim())&&<AssistantMessage text={task.summary} compact={Boolean(messageActions)} />}
      {messageActions}
      </div>
      {maintenanceEvent&&<EnvironmentMaintenance key={`${task.taskId}-${maintenanceEvent.status}`} taskRunning={task.status==='running'}/>}
      {task.proposals.length > 0 && <div className="paper-change-heading"><strong>Changes</strong><span>{task.proposals.length} {task.proposals.length === 1 ? 'file' : 'files'} · Review before applying</span></div>}
      {task.proposals.map(proposal => <ProposalCard key={`${task.projectId}:${task.taskId}:${proposal.id}`} projectId={task.projectId} taskId={task.taskId} proposal={proposal} busy={busy} act={act} onReviewInEditor={onReviewInEditor} onRecovered={onRecovered} />)}
    </section>
  )
}

export function ProposalCard({ proposal, busy, act, onReviewInEditor, projectId, taskId, onRecovered }: { onRecovered?: (task: Task) => void; projectId?: string; taskId?: string; proposal: Proposal; busy: boolean; act: (proposal: Proposal, accept: boolean) => void; onReviewInEditor?: (proposal: Proposal) => void }) {
  const [review, setReview] = useState(false)
  const [recoveredProposal, setRecoveredProposal] = useState<Proposal | null>(null)
  const status = recoveredProposal?.id === proposal.id ? recoveredProposal.status : proposal.status
  const buttons = <>
    {status === 'pending' && <>
      <OLButton variant={proposal.mode === 'delete-document' ? 'danger' : 'primary'} disabled={busy} onClick={() => act(proposal, true)}>
        {proposal.mode === 'delete-document' ? 'Delete file' : 'Accept change'}
      </OLButton>
      <OLButton variant="secondary" disabled={busy} onClick={() => act(proposal, false)}>Reject</OLButton>
    </>}
    {proposal.mode === 'delete-document' && ['applying', 'uncertain'].includes(status) && <OLButton variant="danger" disabled={busy} onClick={() => act(proposal, true)}>Retry deletion</OLButton>}
  </>
  const notice = status === 'closed-unconfirmed' ? 'Closed without retry. The earlier write outcome remains unconfirmed. Inspect the retained evidence and start a new review before further changes.' : status === 'conflict' ? 'The document changed. Run a new task to get a current suggestion.'
    : status === 'uncertain' && proposal.mode !== 'delete-document' ? 'The write could not be confirmed. Check the document before requesting another change.'
      : proposal.mode === 'delete-document' && ['applying', 'uncertain'].includes(status) ? 'Deletion has not been confirmed. Retry this request to check and finish it.' : null
  return <article className="paper-change-card" data-proposal-path={proposal.path}>
    <div className="paper-change-file"><span className="paper-change-file-icon" aria-hidden="true">{proposal.mode === 'delete-document' ? '−' : proposal.mode?.startsWith('create-') ? '+' : '≠'}</span><strong>{proposal.path}</strong><span className={`paper-change-status paper-change-status-${status}`}>Status: {status}</span></div>
    {proposal.mode === 'create-document' && <p className="paper-change-notice">New file — created only after you accept.</p>}
    {proposal.mode === 'delete-document' && <p className="paper-change-notice">Delete this file from the project. Review the removed content below.</p>}
    <details open={status === 'pending' || undefined} className="paper-change-preview">
      <summary>Review changes</summary>
      <ProposalDiff before={proposal.before} after={proposal.after} />
    </details>
    {notice && <p className="paper-change-notice" role="status">{notice}</p>}
    {projectId && taskId && proposal.mode !== 'delete-document' && ['applying', 'uncertain', 'closed-unconfirmed'].includes(status) && <ApplicationInspection projectId={projectId} taskId={taskId} proposalId={proposal.id} onRecovered={task => { setRecoveredProposal(task.proposals.find(value => value.id === proposal.id) || null); onRecovered?.(task) }} />}
    <div className="paper-change-actions">
      {onReviewInEditor && proposal.docId && status === 'pending' && !proposal.mode?.startsWith('create-') && proposal.mode !== 'delete-document' && <button type="button" className="paper-review-open" disabled={busy} onClick={() => onReviewInEditor(proposal)}>Review in editor</button>}
      <button type="button" className="paper-review-open" onClick={() => setReview(true)}>Expand diff</button>{!review && buttons}</div>
    <OLModal show={review} onHide={() => setReview(false)} size="lg" className="paper-review-modal" aria-label={`Review ${proposal.path}`}>
      <OLModalHeader><OLModalTitle>{proposal.path}</OLModalTitle></OLModalHeader>
      <OLModalBody><ProposalDiff before={proposal.before} after={proposal.after} /></OLModalBody>
      <OLModalFooter><p>{notice || `Status: ${status}`}</p>{buttons}<OLButton variant="secondary" onClick={() => setReview(false)}>Close review</OLButton></OLModalFooter>
    </OLModal>
  </article>
}
