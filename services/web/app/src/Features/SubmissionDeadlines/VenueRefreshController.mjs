import {expressify} from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import {z,parseReq} from '../../infrastructure/Validation.mjs'
import {venueRefreshStatus,startVenueRefresh,pauseVenueRefresh} from './VenueDatabaseRefresh.mjs'
export default {
 status:expressify(async(req,res)=>res.json({job:await venueRefreshStatus()})),
 start:expressify(async(req,res)=>{const {body}=parseReq(req,z.object({body:z.object({projectId:z.string().regex(/^[a-f0-9]{24}$/i),model:z.string().max(128).optional(),effort:z.enum(['none','minimal','low','medium','high','xhigh','max','ultra']).optional(),venueIds:z.array(z.string().max(300)).max(100).optional()})}));try{res.status(202).json({job:await startVenueRefresh(SessionManager.getLoggedInUserId(req.session).toString(),body.projectId,body)})}catch(e){res.status(e.status||502).json({error:e.status?e.message:'Venue database update could not start. Check AI model access and retry.'})}}),
 pause:expressify(async(req,res)=>res.json({job:await pauseVenueRefresh(SessionManager.getLoggedInUserId(req.session).toString())}))
}
