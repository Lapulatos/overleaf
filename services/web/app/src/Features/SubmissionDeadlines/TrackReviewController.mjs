import {journalReviewTrack} from './JournalProfile.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import {saveCheckReport,savedCheckReport} from './TrackCheckReportStore.mjs'
import {expressify} from '@overleaf/promise-utils'
import {z,parseReq} from '../../infrastructure/Validation.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import {agentService,agentStore} from '../WritingAssist/WritingAssistAgentController.mjs'
import {AgentError} from '../WritingAssist/WritingAssistAgentService.mjs'
import {deadlines} from './DeadlineService.mjs'
import {trackReviewMarker,trackEvidence,trackReviewPrompt,parseTrackReview} from './TrackReview.mjs'
const params=z.object({projectId:z.string().regex(/^[a-f0-9]{24}$/i),taskId:z.string().uuid().optional()})
function handler(start){return expressify(async(req,res)=>{const parsed=parseReq(req,start?z.object({params,body:z.object({venueId:z.string().max(300),mode:z.enum(['organize','check']),model:z.string().max(128).optional(),effort:z.enum(['none','minimal','low','medium','high','xhigh','max','ultra']).optional()})}):z.object({params}));const user=SessionManager.getLoggedInUserId(req.session).toString();const {projectId,taskId}=parsed.params
 try{
  if(start){await agentService.models(user,projectId);const venue=await deadlines.resolve(parsed.body.venueId);if(!venue?.track&&venue?.kind!=='journal')throw new AgentError(404,'Venue not found');const reviewTrack=venue.track||(journalReviewTrack(await deadlines.detail(venue.id)));const snapshot=trackEvidence(reviewTrack);if(!snapshot.evidence.length)throw new AgentError(422,'No sourced requirements are available. Check the official author guide first.');const mode=parsed.body.mode;const task=await agentService.create(user,projectId,trackReviewPrompt(mode,snapshot),{model:parsed.body.model,effort:parsed.body.effort,reportOnly:true,includeProjectAssets:mode==='check',trackReview:{snapshot,mode},extraAssets:[{path:'track-requirements.json',data:Buffer.from(JSON.stringify(snapshot)).toString('base64')}]});return res.status(201).json({task,mode})}
  if(!await AuthorizationManager.promises.canUserWriteProjectContent(user,projectId))throw new AgentError(403,'Project write access required');const saved=await savedCheckReport(taskId,user,projectId);if(saved)return res.json({task:{taskId,status:'completed',summary:'Saved draft check',proposals:[]},mode:'check',result:saved});
  const task=await agentService.get(user,projectId,taskId);const stored=await agentStore.find(taskId,user,projectId);if(!stored?.reportOnly||!stored.trackReview||!stored.instruction.startsWith(trackReviewMarker))throw new AgentError(404,'Track review not found');const {snapshot,mode}=stored.trackReview;if(task.status!=='completed')return res.json({task,mode});try{return res.json({task,mode,result:mode==='check'?await saveCheckReport(task,user,projectId,parseTrackReview(task.summary,snapshot,stored.documents,mode)):parseTrackReview(task.summary,snapshot,stored.documents,mode)})}catch(e){return res.json({task,mode,resultError:e.message})}
 }catch(e){if(e instanceof AgentError)return res.status(e.status).json({error:e.message});throw e}
})}
export default {start:handler(true),get:handler(false)}
