import {z} from '../../infrastructure/Validation.mjs'
export const defaults={mode:'always',idleMinutes:10,limits:{enabled:false,cpu:null,memoryGiB:null,threads:null,gpuIds:[],image:''}}
export const executionSettings=z.object({mode:z.enum(['always','on-demand']),idleMinutes:z.number().int().min(1).max(120),limits:z.object({enabled:z.boolean(),cpu:z.number().min(.1).max(65536).nullable(),memoryGiB:z.number().min(.125).max(1048576).nullable(),threads:z.number().int().min(1).max(65536).nullable(),gpuIds:z.array(z.number().int().min(0).max(255)).max(16).refine(v=>new Set(v).size===v.length),image:z.string().max(200).regex(/^(?:[a-zA-Z0-9][a-zA-Z0-9._:/@-]*)?$/)}).strict()}).strict().refine(v=>!v.limits.enabled||Boolean(v.limits.image),{message:'Choose a local Docker image.'})
export function settingsFor(node){return node.executionSettings||defaults}
export function validateCapacity(settings,node,caps){
 const l=settings.limits
 if(settings.mode==='on-demand'&&!caps.runnerControl)throw Error('This node does not support managed Runner start/stop.')
 if(!l.enabled)return
 if(!caps.docker)throw Error('Docker is unavailable to this SSH user.')
 if(!caps.images.includes(l.image))throw Error('Choose an image already installed on this node.')
 if(l.cpu!=null&&(!caps.cpuLimit||!Number.isFinite(node.resources?.cpuCount)||l.cpu>node.resources.cpuCount))throw Error('CPU limit is unsupported or exceeds this node.')
 if(l.memoryGiB!=null&&(!caps.memoryLimit||!Number.isFinite(node.resources?.memoryTotal)||l.memoryGiB*1024**3>node.resources.memoryTotal))throw Error('Memory limit is unsupported or exceeds this node.')
 if(l.gpuIds.length&&(!caps.gpuRuntime||l.gpuIds.some(id=>id>=caps.gpuCount)))throw Error('GPU selection requires an available NVIDIA container runtime and valid device IDs.')
}
export function idleExpired(node,activeCount,now=Date.now()){
 return settingsFor(node).mode==='on-demand'&&activeCount===0&&Boolean(node.runnerIdleSince)&&now-new Date(node.runnerIdleSince).getTime()>=settingsFor(node).idleMinutes*60000
}
