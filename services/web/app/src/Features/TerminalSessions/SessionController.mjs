import {expressify} from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import {listSessions} from './SessionRegistry.mjs'
export default expressify(async(req,res)=>{res.set('Cache-Control','no-store');try{return res.json(await listSessions(String(SessionManager.getLoggedInUserId(req.session)),req.params.projectId))}catch(e){return res.status([400,403,404,409,503].includes(e.status)?e.status:503).json({error:e.status?e.message:'Terminal sessions temporarily unavailable.'})}})
