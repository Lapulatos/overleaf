import { goalStore } from './WritingAssistGoalStore.mjs';
import { expressify } from "@overleaf/promise-utils";
import SessionManager from "../Authentication/SessionManager.mjs";
import AuthorizationManager from "../Authorization/AuthorizationManager.mjs";
import { z, parseReq } from "../../infrastructure/Validation.mjs";
import { AgentError } from "./WritingAssistAgentService.mjs";
import { agentService } from "./WritingAssistAgentController.mjs";
import { createConversationService } from "./WritingAssistConversationService.mjs";
import { conversationStore } from "./WritingAssistConversationStore.mjs";
import { createConversationTasks } from "./WritingAssistConversationTasks.mjs";

export const conversations = createConversationService({
  store: conversationStore,
  canWrite: (userId, projectId) =>
    AuthorizationManager.promises.canUserWriteProjectContent(userId, projectId),
});
const lifecycle = createConversationTasks({
  conversations,
  tasks: agentService,
  isGoalActive: async (user,project,conversation) => { const goal=await goalStore.find(user,project,conversation);return goal && ["active","waiting_review"].includes(goal.status) },
});
const projectParams = z.object({
  projectId: z.string().regex(/^[a-f\d]{24}$/i),
});
const conversationParams = projectParams.extend({
  conversationId: z.string().uuid(),
});
const taskParams = conversationParams.extend({ taskId: z.string().uuid() });
const schemas = {
  list: z.object({ params: projectParams }),
  context: z.object({ params: projectParams }),
  create: z.object({
    params: projectParams,
    body: z.object({ title: z.string().trim().min(1).max(160).optional() }),
  }),
  get: z.object({ params: conversationParams }),
  send: z.object({
    params: conversationParams,
    body: z.object({
      instruction: z.string().trim().min(1).max(32000),
      model: z
        .string()
        .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/)
        .optional(),
      effort: z
        .enum([
          "none",
          "minimal",
          "low",
          "medium",
          "high",
          "xhigh",
          "max",
          "ultra",
        ])
        .optional(),
      scope: z.array(z.object({kind:z.enum(["file","folder"]),path:z.string().min(1).max(240)})).max(30).optional(),
      skills: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/)).max(5).optional(),
      sourceSelection: z.object({
        docId: z.string().regex(/^[a-f\d]{24}$/i),
        from: z.number().int().min(0), to: z.number().int().positive(),
        text: z.string().min(1).max(16000),
      }).optional(),
      images: z
        .array(
          z.object({
            name: z.string().max(200),
            mime: z.enum(["image/png", "image/jpeg"]),
            data: z.string().max(2796204),
          }),
        )
        .max(1)
        .optional(),
    }),
  }),
  branch: z.object({params:taskParams,body:z.object({edge:z.enum(['user','assistant']),requestId:z.string().uuid()})}),
  retry: z.object({params:taskParams,body:z.object({requestId:z.string().uuid()})}),
  cancel: z.object({ params: taskParams }),
  decide: z.object({
    params: taskParams.extend({ proposalId: z.string().uuid() }),
    body: z.object({ accept: z.boolean() }),
  }),
};
function handler(action) {
  return expressify(async (req, res) => {
    const { params, body } = parseReq(req, schemas[action]);
    const { projectId, conversationId, taskId, proposalId } = params;
    const userId = SessionManager.getLoggedInUserId(req.session).toString();
    try {
      let result;
      if (action === "context") result = await agentService.context(userId, projectId);
      else if (action === "list")
        result = await conversations.list(userId, projectId);
      else if (action === "create")
        result = await conversations.create(userId, projectId, body.title);
      else if (action === "send")
        result = await lifecycle.send(
          userId,
          projectId,
          conversationId,
          body.instruction,
          body.images,
          { model: body.model, effort: body.effort, scope:body.scope, skills:body.skills, sourceSelection: body.sourceSelection },
        );
      else if(action==='branch'||action==='retry')
        result=await lifecycle[action](userId,projectId,conversationId,taskId,body);
      else if (action === "decide")
        result = await lifecycle.decide(
          userId,
          projectId,
          conversationId,
          taskId,
          proposalId,
          body.accept,
        );
      else
        result = await lifecycle[action](
          userId,
          projectId,
          conversationId,
          taskId,
        );
      res
        .status(action === "create" || action === "send" ? 201 : 200)
        .json(result);
    } catch (error) {
      if (!(error instanceof AgentError)) throw error;
      res.status(error.status).json({ error: error.message });
    }
  });
}
export default Object.fromEntries(
  Object.keys(schemas).map((action) => [action, handler(action)]),
);
