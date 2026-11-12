import { shellReviewOverview, shellReviewFile } from './ShellDraftReview.mjs'
import { publicShellDraft } from './ShellDraftService.mjs'

// Only server-derived identities and policy are sent to the runner. Clients
// cannot supply a mount path, owner, mode escalation or runner attempt id.
export function shellDraftTerminal(request) {
  const send = (action, body) => request({ ...body, action, project: body.logicalProjectId, user: body.actorId })
  return { start: body => send('draft-start', body), stop: body => send('draft-stop', body), session: body => send(body.action, body) }
}
export async function executeShellDraftCommand({ drafts, command, policy, startEnabled = false }) {
  switch (command.command) {
    case 'shellDraftPoll': return drafts.session(command.id, 'poll', command)
    case 'shellDraftInput': return drafts.session(command.id, 'input', command)
    case 'shellDraftRun': return drafts.session(command.id, 'run', command)
    case 'shellDraftResize': return drafts.session(command.id, 'resize', command)
    case 'shellDraftList': return drafts.list()
    case 'shellDraftGet': return publicShellDraft(await drafts.get(command.id))
    case 'shellDraftPrepare': return publicShellDraft(await drafts.prepare(command.operationId))
    case 'shellDraftSeal': return publicShellDraft(await drafts.seal(command.id, command.revision))
    case 'shellDraftStart': {
      if (!startEnabled) throw Object.assign(new Error('Shell draft startup awaits safe-import acceptance'), { status: 409 })
      const task = await drafts.start(command.id, command.revision, policy.mode)
      return { ...publicShellDraft(task), sessionId: task.sessionId }
    }
    case 'shellDraftReview': return shellReviewOverview(await drafts.review(command.id))
    case 'shellDraftFile': return shellReviewFile(await drafts.review(command.id), command.path, command.fingerprint)
    default: throw Object.assign(new Error('Unknown shell draft command'), { status: 400 })
  }
}
