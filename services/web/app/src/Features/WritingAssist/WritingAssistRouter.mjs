import RuntimeSettingsController from '../RuntimeNodes/RuntimeSettingsController.mjs'
import SshNodeController from '../RuntimeNodes/SshNodeController.mjs'
import {sessionApprovalController} from '../TerminalSessions/SessionToolRouter.mjs'
import SessionController from '../TerminalSessions/SessionController.mjs'
import RuntimeTerminalController from '../RuntimeNodes/RuntimeTerminalController.mjs'
import RuntimeTaskController from '../RuntimeNodes/RuntimeTaskController.mjs'
import RuntimeNodeController from '../RuntimeNodes/RuntimeNodeController.mjs'
import McpDemoController from '../Mcp/McpDemoController.mjs'
import McpController from '../Mcp/McpController.mjs'
import VenueWorkspaceController from '../SubmissionDeadlines/VenueWorkspaceController.mjs'
import VenueRefreshController from '../SubmissionDeadlines/VenueRefreshController.mjs'
import TrackReviewController from '../SubmissionDeadlines/TrackReviewController.mjs'
import SourceNetworkController from './SourceNetworkController.mjs'
import {fileURLToPath} from 'node:url'
import EnvironmentMaintenanceController from './EnvironmentMaintenanceController.mjs'
import RecommendationController from '../SubmissionDeadlines/RecommendationController.mjs';
import ConversionController from '../SubmissionDeadlines/ConversionController.mjs';
import DeadlineController from '../SubmissionDeadlines/DeadlineController.mjs';
import WritingAssistGoalController, { startGoalWorker } from './WritingAssistGoalController.mjs';
import SkillPluginController from '../Plugins/SkillPluginController.mjs';
import WritingAssistReferenceController from "./WritingAssistReferenceController.mjs";
// @ts-check

import AuthenticationController from "../Authentication/AuthenticationController.mjs";
import WritingAssistController from "./WritingAssistController.mjs";
import WritingAssistAgentController from "./WritingAssistAgentController.mjs";
import WritingAssistSpeechController from "./WritingAssistSpeechController.mjs";
import WritingAssistZoteroController from "./WritingAssistZoteroController.mjs";

import WritingAssistLiteratureController from "./WritingAssistLiteratureController.mjs";
import WritingAssistConversationController from "./WritingAssistConversationController.mjs";

/** @param {any} webRouter */
function apply(webRouter) {
  startGoalWorker();
  webRouter.get('/writing-assist/project/:projectId/terminal-sessions',AuthenticationController.requireLogin(),SessionController);
  const requireLogin = AuthenticationController.requireLogin();
  webRouter.get('/writing-assist/project/:projectId/terminal-approvals',requireLogin,sessionApprovalController);
  webRouter.post('/writing-assist/project/:projectId/terminal-approvals/:operationId',requireLogin,sessionApprovalController);
  webRouter.get('/writing-assist/project/:projectId/venue-workspace',requireLogin,VenueWorkspaceController);
  webRouter.post('/writing-assist/project/:projectId/venue-workspace',requireLogin,VenueWorkspaceController);
  webRouter.get('/writing-assist/project/:projectId/context', requireLogin, WritingAssistConversationController.context);
  webRouter.post('/writing-assist/project/:projectId/venue-recommendations',requireLogin,RecommendationController.start);
  webRouter.get('/writing-assist/project/:projectId/venue-recommendations/:taskId',requireLogin,RecommendationController.get);
  webRouter.post('/writing-assist/project/:projectId/track-reviews',requireLogin,TrackReviewController.start);
  webRouter.get('/writing-assist/project/:projectId/track-reviews/:taskId',requireLogin,TrackReviewController.get);
  const conversion='/writing-assist/project/:projectId/submission-conversions';
  webRouter.post(conversion,requireLogin,ConversionController.start);
  webRouter.get(`${conversion}/:taskId`,requireLogin,ConversionController.status);
  webRouter.get(`${conversion}/:taskId/download`,requireLogin,ConversionController.download);
  webRouter.post(`${conversion}/:taskId/import`,requireLogin,ConversionController.import);
  webRouter.get('/writing-assist/source-network',requireLogin,SourceNetworkController);
  webRouter.post('/writing-assist/source-network',requireLogin,SourceNetworkController);
  webRouter.get('/writing-assist/environment',requireLogin,EnvironmentMaintenanceController);
  webRouter.post('/writing-assist/environment',requireLogin,EnvironmentMaintenanceController);
  webRouter.get('/writing-assist/directories/:name',requireLogin,(req,res)=>{
    if(!['ccf-2026','xidian-2025'].includes(req.params.name))return res.sendStatus(404)
    res.type('application/pdf').sendFile(fileURLToPath(new URL(`../SubmissionDeadlines/data/${req.params.name}.pdf`,import.meta.url)))
  });
  webRouter.post('/writing-assist/runtime-nodes/ssh/:sshAction',requireLogin,SshNodeController);
  webRouter.post('/writing-assist/runtime-nodes/:nodeId/ssh-runner',requireLogin,SshNodeController);
  webRouter.get('/writing-assist/runtime-nodes/:nodeId/settings',requireLogin,RuntimeSettingsController);
  webRouter.post('/writing-assist/runtime-nodes/:nodeId/settings',requireLogin,RuntimeSettingsController);
  webRouter.get('/writing-assist/runtime-nodes', requireLogin, RuntimeNodeController);
  webRouter.get('/writing-assist/runtime-nodes/:nodeId/terminals', requireLogin, RuntimeTerminalController);
  webRouter.post('/writing-assist/runtime-nodes/:nodeId/terminals', requireLogin, RuntimeTerminalController);
  webRouter.post('/writing-assist/runtime-nodes/:nodeId/terminals/:sessionId/:action', requireLogin, RuntimeTerminalController);
  webRouter.get('/writing-assist/runtime-nodes/:nodeId/tasks', requireLogin, RuntimeTaskController);
  webRouter.post('/writing-assist/runtime-nodes/:nodeId/tasks', requireLogin, RuntimeTaskController);
  webRouter.get('/writing-assist/runtime-nodes/:nodeId/tasks/:taskId', requireLogin, RuntimeTaskController);
  webRouter.post('/writing-assist/runtime-nodes/:nodeId/tasks/:taskId/cancel', requireLogin, RuntimeTaskController);
  webRouter.post('/writing-assist/runtime-nodes', requireLogin, RuntimeNodeController);
  webRouter.delete('/writing-assist/runtime-nodes/:nodeId', requireLogin, RuntimeNodeController);
  webRouter.post('/writing-assist/runtime-nodes/:nodeId/remove', requireLogin, RuntimeNodeController);
  const mcp = '/writing-assist/mcp-services';
  webRouter.post(`${mcp}/demo`, requireLogin, McpDemoController);
  webRouter.post(`${mcp}/:serviceId/:action`, requireLogin, McpDemoController);
  webRouter.get(mcp, requireLogin, McpController);
  webRouter.post(mcp, requireLogin, McpController);
  webRouter.put(`${mcp}/:serviceId`, requireLogin, McpController);
  webRouter.delete(`${mcp}/:serviceId`, requireLogin, McpController);
  const plugins = '/writing-assist/plugins';
  webRouter.get('/writing-assist/submission-deadlines/acceptance', requireLogin, DeadlineController.acceptance);
  webRouter.get('/writing-assist/submission-deadlines/location', requireLogin, DeadlineController.location);
  webRouter.get('/writing-assist/submission-deadlines/venue-refresh', requireLogin, VenueRefreshController.status);
  webRouter.post('/writing-assist/submission-deadlines/venue-refresh', requireLogin, VenueRefreshController.start);
  webRouter.post('/writing-assist/submission-deadlines/venue-refresh/pause', requireLogin, VenueRefreshController.pause);
  webRouter.get('/writing-assist/submission-deadlines/metrics', requireLogin, DeadlineController.metrics);
  webRouter.post('/writing-assist/submission-deadlines/metrics/refresh', requireLogin, DeadlineController.refreshMetrics);
  webRouter.get('/writing-assist/submission-deadlines', requireLogin, DeadlineController.list);
  webRouter.get('/writing-assist/submission-deadlines/tracks', requireLogin, DeadlineController.tracks);
  webRouter.get('/writing-assist/submission-deadlines/detail', requireLogin, DeadlineController.detail);
  webRouter.get(plugins, requireLogin, SkillPluginController.list);
  webRouter.post(`${plugins}/discover`, requireLogin, SkillPluginController.discover);
  webRouter.post(`${plugins}/batch`, requireLogin, SkillPluginController.batch);
  webRouter.post(plugins, requireLogin, SkillPluginController.install);
  webRouter.put(`${plugins}/:pluginId`, requireLogin, SkillPluginController.enable);
  webRouter.delete(`${plugins}/:pluginId`, requireLogin, SkillPluginController.remove);
  webRouter.post('/writing-assist/project/:projectId/plugins/invoke', requireLogin, SkillPluginController.invoke);


  const references = "/writing-assist/project/:projectId/references";
  webRouter.get(`${references}/inventory`, requireLogin, WritingAssistReferenceController.inventory);
  webRouter.post(`${references}/tasks`, requireLogin, WritingAssistReferenceController.start);
  webRouter.post(`${references}/claims/apply`, requireLogin, WritingAssistReferenceController.applyClaim);
  webRouter.post(`${references}/apply`, requireLogin, WritingAssistReferenceController.apply);
  webRouter.post(`${references}/import`, requireLogin, WritingAssistReferenceController.import);

  const zotero = "/writing-assist/project/:projectId/zotero";
  webRouter.get(zotero, requireLogin, WritingAssistZoteroController.status);
  webRouter.post(zotero, requireLogin, WritingAssistZoteroController.connect);
  webRouter.delete(
    zotero,
    requireLogin,
    WritingAssistZoteroController.disconnect,
  );
  webRouter.get(
    `${zotero}/items`,
    requireLogin,
    WritingAssistZoteroController.search,
  );
  webRouter.post(
    `${zotero}/preview`,
    requireLogin,
    WritingAssistZoteroController.preview,
  );

  const speech = "/writing-assist/project/:projectId/speech";
  webRouter.get(
    speech,
    requireLogin,
    WritingAssistSpeechController.capabilities,
  );
  webRouter.post(
    speech,
    requireLogin,
    WritingAssistSpeechController.transcribe,
  );

  const literature = "/writing-assist/project/:projectId/literature";
  webRouter.get(
    literature,
    requireLogin,
    WritingAssistLiteratureController.search,
  );
  webRouter.get(
    `${literature}/bibliographies`,
    requireLogin,
    WritingAssistLiteratureController.destinations,
  );
  webRouter.post(
    `${literature}/preview`,
    requireLogin,
    WritingAssistLiteratureController.preview,
  );

  const conversations = "/writing-assist/project/:projectId/conversations";
  const thread = `${conversations}/:conversationId`;
  const conversationTasks = `${thread}/tasks/:taskId`;
  webRouter.get(
    conversations,
    requireLogin,
    WritingAssistConversationController.list,
  );
  webRouter.post(
    conversations,
    requireLogin,
    WritingAssistConversationController.create,
  );
  webRouter.get(thread, requireLogin, WritingAssistConversationController.get);
  webRouter.post(`${conversationTasks}/retry`, requireLogin, WritingAssistConversationController.retry);
  webRouter.post(`${conversationTasks}/branch`, requireLogin, WritingAssistConversationController.branch);
  webRouter.get(`${thread}/goal`, requireLogin, WritingAssistGoalController.get);
  webRouter.post(`${thread}/goal`, requireLogin, WritingAssistGoalController.start);
  webRouter.post(`${thread}/goal/action`, requireLogin, WritingAssistGoalController.action);
  webRouter.post(
    `${thread}/messages`,
    requireLogin,
    WritingAssistConversationController.send,
  );
  webRouter.delete(
    conversationTasks,
    requireLogin,
    WritingAssistConversationController.cancel,
  );
  webRouter.post(
    `${conversationTasks}/proposals/:proposalId`,
    requireLogin,
    WritingAssistConversationController.decide,
  );

  const tasks = "/writing-assist/project/:projectId/tasks";
  webRouter.get(
    "/writing-assist/project/:projectId/models",
    requireLogin,
    WritingAssistAgentController.models,
  );
  webRouter.post(tasks, requireLogin, WritingAssistAgentController.create);
  webRouter.get(
    `${tasks}/:taskId`,
    requireLogin,
    WritingAssistAgentController.get,
  );
  webRouter.delete(
    `${tasks}/:taskId`,
    requireLogin,
    WritingAssistAgentController.cancel,
  );
  webRouter.post(
    `${tasks}/:taskId/proposals/:proposalId`,
    requireLogin,
    WritingAssistAgentController.decide,
  );
  webRouter.get(
    `${tasks}/:taskId/proposals/:proposalId/inspection`,
    requireLogin,
    WritingAssistAgentController.inspect,
  );
  webRouter.post(
    `${tasks}/:taskId/proposals/:proposalId/recover`,
    requireLogin,
    WritingAssistAgentController.recover,
  )
  webRouter.post(`${tasks}/:taskId/proposals/:proposalId/close-unconfirmed`, requireLogin, WritingAssistAgentController.closeUnconfirmed);

  webRouter.post(
    "/writing-assist/check",
    requireLogin,
    WritingAssistController.check,
  );

  webRouter.post(
    "/writing-assist/transform",
    requireLogin,
    WritingAssistController.transform,
  );

  webRouter.get(
    "/writing-assist/config",
    requireLogin,
    WritingAssistController.getConfig,
  );

  webRouter.put(
    "/writing-assist/config",
    requireLogin,
    WritingAssistController.putConfig,
  );

  // Dismiss notebook CRUD.
  webRouter.get(
    "/writing-assist/dismissals",
    requireLogin,
    WritingAssistController.listDismissals,
  );

  webRouter.post(
    "/writing-assist/dismissals",
    requireLogin,
    WritingAssistController.addDismissal,
  );

  webRouter.put(
    "/writing-assist/dismissals/:id",
    requireLogin,
    WritingAssistController.updateDismissal,
  );

  webRouter.delete(
    "/writing-assist/dismissals/:id",
    requireLogin,
    WritingAssistController.deleteDismissal,
  );
}

export default { apply };
