import {expressify} from '@overleaf/promise-utils'
import {z,parseReq} from '../../infrastructure/Validation.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import {venueWorkspaceStore} from './VenueWorkspaceStore.mjs'
const params=z.object({projectId:z.string().regex(/^[a-f0-9]{24}$/i)})
import {venueWorkspaceBody as body} from './VenueWorkspaceSchema.mjs'
export default expressify(async(req,res)=>{const parsed=parseReq(req,z.object({params,...(req.method==='POST'?{body}:{})}));const user=SessionManager.getLoggedInUserId(req.session).toString(),project=parsed.params.projectId;if(!await AuthorizationManager.promises.canUserReadProject(user,project))return res.sendStatus(403);if(req.method==='POST'){const {expectedUserId,...patch}=parsed.body;if(expectedUserId&&expectedUserId!==user)return res.sendStatus(403);await venueWorkspaceStore.save(user,project,patch);}const saved=await venueWorkspaceStore.load(user,project);res.json({userId:user,plan:saved?.plan||null,favorites:saved?.favorites||null,recommendation:saved?.recommendation||null})})
