import { validateImages } from "@overleaf/validation-tools/image-input.mjs";
import { AgentError } from "./WritingAssistAgentService.mjs";

const terminal = new Set(["completed", "failed", "cancelled", "timeout"]);

export function createConversationTasks({ conversations, tasks, isGoalActive }) {
  async function get(userId, projectId, conversationId) {
    let conversation = await conversations.get(
      userId,
      projectId,
      conversationId,
    );
    const taskId =
      conversation.activeTaskId || (!conversation.turns.at(-1)?.inherited ? conversation.turns.at(-1)?.taskId : null);
    let task = null;
    if (taskId) {
      try {
        task = await tasks.get(userId, projectId, taskId);
      } catch (error) {
        if (error.status !== 404) throw error;
        const turn = conversation.turns.find((turn) => turn.taskId === taskId);
        if (
          conversation.activeTaskId &&
          Date.now() - new Date(turn.createdAt).getTime() > 120000
        ) {
          task = {
            taskId,
            status: "failed",
            proposals: [],
            summary:
              "This turn was interrupted before task creation. Send a new message to continue.",
          };
        }
        // Completed transcript survives task snapshot expiration. A just-created
        // reservation may precede its task record by a few milliseconds.
      }
      if (task && terminal.has(task.status)) {
        await conversations.recordResult(
          userId,
          projectId,
          conversationId,
          task,
        );
        conversation = await conversations.get(
          userId,
          projectId,
          conversationId,
        );
      }
    }
    return { conversation, task };
  }
  async function requireTurn(userId, projectId, conversationId, taskId) {
    const conversation = await conversations.get(
      userId,
      projectId,
      conversationId,
    );
    if (!conversation.turns.some((turn) => turn.taskId === taskId && !turn.inherited))
      throw new AgentError(404, "Task is not part of this conversation");
  }
  const api = {
    get,
    async branch(userId,projectId,conversationId,taskId,{edge='assistant',requestId}){
      const {conversation:source}=await get(userId,projectId,conversationId)
      const turn=source.turns.find(t=>t.taskId===taskId)
      if(!turn)throw new AgentError(404,'Message not found')
      const conversation=await conversations.fork(userId,projectId,conversationId,taskId,edge,requestId)
      return {conversation,task:null,...(edge==='user'?{draft:{instruction:turn.instruction,scope:turn.request?.scope||turn.scope||[],skills:turn.request?.skills||turn.plugins?.map(p=>p.command)||[]},notice:turn.attachments?.length||turn.sourceSelection?'Reattach the image or reselect the passage before sending this branched request.':undefined}:{})}
    },
    async retry(userId,projectId,conversationId,taskId,{requestId}){
      const {conversation:source}=await get(userId,projectId,conversationId)
      const turn=source.turns.find(t=>t.taskId===taskId)
      if(!turn)throw new AgentError(404,'Message not found')
      if(!['failed','timeout','cancelled'].includes(turn.status))throw new AgentError(409,'Only failed, timed-out or cancelled requests can be retried')
      let request=turn.request||{scope:turn.scope,skills:turn.plugins?.map(p=>p.command),sourceSelection:turn.sourceSelection}
      try{request=await tasks.retryRequest?.(userId,projectId,taskId)||request}catch(error){if(error.status!==404)throw error}
      if(turn.attachments?.length&&!request.images?.length)throw new AgentError(409,'The original image is no longer retained. Branch from this request and reattach the image.')
      if(request.sourceSelection)await tasks.resolveSelection(userId,projectId,request.sourceSelection)
      const branch=await conversations.fork(userId,projectId,conversationId,taskId,'user',requestId)
      if(branch.turns.some(t=>!t.inherited)||branch.activeTaskId)return get(userId,projectId,branch.id)
      try{return await api.send(userId,projectId,branch.id,turn.instruction,request.images,request)}catch(error){
        const current=await conversations.get(userId,projectId,branch.id)
        if(current.turns.some(t=>!t.inherited))return get(userId,projectId,branch.id)
        throw error
      }
    },
    async send(
      userId,
      projectId,
      conversationId,
      instruction,
      attachments,
      selection = {},
    ) {
      if (isGoalActive && await isGoalActive(userId,projectId,conversationId)) throw new AgentError(409,"Pause the active goal before sending a separate message")
      await get(userId, projectId, conversationId);
      let images;
      try {
        images = validateImages(attachments);
      } catch (error) {
        throw new AgentError(400, error.message);
      }
      const sourceSelection = selection.sourceSelection
        ? await tasks.resolveSelection(userId, projectId, selection.sourceSelection)
        : undefined;
      const { turn, history } = await conversations.beginTurn(
        userId,
        projectId,
        conversationId,
        instruction,
        images.map(({ name, mime, width, height }) => ({
          name,
          mime,
          width,
          height,
        })),
        sourceSelection,
        {model:selection.model,effort:selection.effort,scope:selection.scope,skills:selection.skills,sourceSelection},
      );
      try {
        const task = await tasks.create(userId, projectId, turn.instruction, {
          taskId: turn.taskId,
          history,
          sourceSelection,
          images,
          scope:selection.scope,
          skills:selection.skills,
          model: selection.model,
          effort: selection.effort,
          isActive: async () =>
            (await conversations.get(userId, projectId, conversationId))
              .activeTaskId === turn.taskId,
        });
        return {
          conversation: await conversations.get(
            userId,
            projectId,
            conversationId,
          ),
          task,
        };
      } catch (error) {
        let result = {
          taskId: turn.taskId,
          status: "failed",
          summary: "Message could not be submitted. No changes were applied.",
          proposals: [],
        };
        try {
          result = await tasks.get(userId, projectId, turn.taskId);
        } catch {
          /* No task record exists if authorization/storage failed early. */
        }
        if (terminal.has(result.status))
          await conversations.recordResult(
            userId,
            projectId,
            conversationId,
            result,
          );
        throw error;
      }
    },
    async cancel(userId, projectId, conversationId, taskId) {
      await requireTurn(userId, projectId, conversationId, taskId);
      let result;
      try {
        result = await tasks.cancel(userId, projectId, taskId);
      } catch (error) {
        if (error.status !== 404) throw error;
        result = {
          taskId,
          status: "cancelled",
          summary: "Cancelled before submission",
          proposals: [],
        };
      }
      await conversations.recordResult(
        userId,
        projectId,
        conversationId,
        result,
      );
      return await get(userId, projectId, conversationId);
    },
    async decide(
      userId,
      projectId,
      conversationId,
      taskId,
      proposalId,
      accept,
    ) {
      await requireTurn(userId, projectId, conversationId, taskId);
      try {
        const result = await tasks.decide(
          userId,
          projectId,
          taskId,
          proposalId,
          accept,
        );
        await conversations.recordResult(
          userId,
          projectId,
          conversationId,
          result,
        );
        return {
          conversation: await conversations.get(
            userId,
            projectId,
            conversationId,
          ),
          task: result,
        };
      } catch (error) {
        // Preserve the original error if reconciliation also fails.
        try {
          const result = await tasks.get(userId, projectId, taskId);
          await conversations.recordResult(
            userId,
            projectId,
            conversationId,
            result,
          );
        } catch {}
        throw error;
      }
    },
  };
  return api;
}
