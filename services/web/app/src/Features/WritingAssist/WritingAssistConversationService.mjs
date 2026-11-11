import { boundedActivity } from './WritingAssistActivity.mjs'
import { randomUUID } from 'node:crypto'
import { AgentError } from './WritingAssistAgentService.mjs'

function boundedText(value, bytes) {
  const buffer = Buffer.from(String(value || ''))
  if (buffer.length <= bytes) return buffer.toString()
  return (
    buffer.subarray(0, Math.max(0, bytes - 32)).toString('utf8') +
    '\n[Transcript text truncated]'
  )
}

const MAX_TURNS = 50
const terminal = new Set(['completed', 'failed', 'cancelled', 'timeout'])

export function conversationContext(turns, budget = 32000) {
  const selected = []
  let used = 0
  for (const turn of [...turns].reverse()) {
    if (!terminal.has(turn.status)) continue
    const item = {
      user: turn.instruction,
      sourceSelection: turn.sourceSelection,
      scope: turn.scope,
      plugins: turn.plugins,
      assistant: turn.summary || '',
      images: turn.attachments?.map(({ name, width, height }) => ({
        name,
        width,
        height,
      })),
      status: turn.status,
      changes: (turn.proposals || []).map(({ path, status }) => ({
        path,
        status,
      })),
    }
    const size = JSON.stringify(item).length
    // Keep complete recent turns, never misleading fragments of old answers.
    if (used + size > budget || selected.length === 12) break
    selected.unshift(item)
    used += size
  }
  return { turns: selected, omittedTurns: turns.length - selected.length }
}

export function createConversationService({ store, canWrite }) {
  async function authorize(userId, projectId) {
    if (!(await canWrite(userId, projectId)))
      throw new AgentError(403, 'Project write access required')
  }
  async function owned(userId, projectId, conversationId) {
    await authorize(userId, projectId)
    const conversation = await store.find(conversationId, userId, projectId)
    if (!conversation) throw new AgentError(404, 'Conversation not found')
    return conversation
  }
  return {
    async create(userId, projectId, title = 'New conversation') {
      await authorize(userId, projectId)
      if (typeof title !== 'string' || !title.trim() || title.length > 160)
        throw new AgentError(400, 'Conversation title must be 1–160 characters')
      const now = new Date()
      const conversation = {
        id: randomUUID(),
        userId,
        projectId,
        title: title.trim(),
        revision: 0,
        activeTaskId: null,
        turns: [],
        createdAt: now,
        updatedAt: now,
      }
      await store.create(conversation)
      return conversation
    },
    async list(userId, projectId) {
      await authorize(userId, projectId)
      return await store.list(userId, projectId, 50)
    },
    get: owned,
    async fork(userId, projectId, conversationId, taskId, edge, requestId) {
      const source=await owned(userId,projectId,conversationId)
      const index=source.turns.findIndex(turn=>turn.taskId===taskId)
      if(index<0)throw new AgentError(404,'Message not found in this conversation')
      if(!['user','assistant'].includes(edge))throw new AgentError(400,'Invalid branch point')
      if(edge==='assistant'&&!terminal.has(source.turns[index].status))throw new AgentError(409,'Wait for this reply before branching after it')
      const parent={conversationId,taskId,edge}
      const previous=await store.find(requestId,userId,projectId)
      if(previous){if(JSON.stringify(previous.parent)!==JSON.stringify(parent))throw new AgentError(409,'Branch request already used');return previous}
      const now=new Date()
      const branch={id:requestId,userId,projectId,title:('Branch · '+source.title).slice(0,160),parent,revision:0,activeTaskId:null,turns:source.turns.slice(0,index+(edge==='assistant'?1:0)).map(turn=>({...structuredClone(turn),inherited:true})),createdAt:now,updatedAt:now}
      try{await store.create(branch)}catch(error){if(error.code!==11000)throw error;const existing=await store.find(requestId,userId,projectId);if(!existing||JSON.stringify(existing.parent)!==JSON.stringify(parent))throw new AgentError(409,'Branch request changed');return existing}
      return branch
    },
    async beginTurn(
      userId,
      projectId,
      conversationId,
      instruction,
      attachments = [],
      sourceSelection,
      request
    ) {
      const conversation = await owned(userId, projectId, conversationId)
      if (
        typeof instruction !== 'string' ||
        !instruction.trim() ||
        instruction.length > 32000
      )
        throw new AgentError(400, 'Message must be 1–32,000 characters')
      if (conversation.activeTaskId)
        throw new AgentError(409, 'Wait for the current reply or cancel it')
      if (conversation.turns.length >= MAX_TURNS)
        throw new AgentError(409, 'Start a new conversation after 50 turns')
      const turn = {
        taskId: randomUUID(),
        instruction: instruction.trim(),
        attachments,
        sourceSelection,
        request,
        status: 'submitting',
        summary: '',
        proposals: [],
        createdAt: new Date(),
      }
      if (!(await store.claim(conversation.id, conversation.revision, turn)))
        throw new AgentError(
          409,
          'Conversation changed; refresh before sending'
        )
      return { turn, history: conversationContext(conversation.turns) }
    },
    // Called with an owner-authorized task result, never with browser-supplied
    // assistant text. Task orchestration must reconcile submissions on restart.
    async recordResult(userId, projectId, conversationId, result) {
      const conversation = await owned(userId, projectId, conversationId)
      if (!terminal.has(result.status)) return
      const turn = conversation.turns.find(
        (turn) => turn.taskId === result.taskId
      )
      if (!turn || (terminal.has(turn.status) && turn.status !== result.status))
        return
      const fields = {
        scope: result.scope,
        plugins: result.plugins,
        status: result.status,
        summary: boundedText(result.summary, 64000),
        activity: boundedActivity(result.activity),
        proposals: (result.proposals || [])
          .slice(0, 100)
          .map(({ path, status }) => ({
            path: boundedText(path, 512),
            status: boundedText(status, 32),
          })),
      }
      // A poll can complete after a newer accept/reject response. Review states
      // never move backwards, even if that stale result is reconciled later.
      for (const proposal of fields.proposals) {
        const previous = turn.proposals?.find(
          (item) => item.path === proposal.path
        )
        if (
          previous &&
          previous.status !== 'pending' &&
          ['pending', 'applying'].includes(proposal.status)
        ) {
          proposal.status = previous.status
        }
      }
      if (
        turn.status === fields.status &&
        turn.summary === fields.summary &&
        JSON.stringify(turn.proposals) === JSON.stringify(fields.proposals)
      )
        return
      await store.settle(
        conversationId,
        result.taskId,
        fields,
        conversation.revision
      )
    },
  }
}
