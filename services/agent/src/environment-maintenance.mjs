import {readFile,writeFile,mkdir,rename} from 'node:fs/promises'
import {join} from 'node:path'
import {randomUUID} from 'node:crypto'
import {execFile} from 'node:child_process'
import {promisify} from 'node:util'
import {diagnoseEnvironment} from './environment-diagnosis.mjs'
const exec=promisify(execFile)
const failure=(status,message)=>Object.assign(new Error(message),{status})
export async function createEnvironmentMaintenance(config,{busy=()=>false,run=exec,diagnose=diagnoseEnvironment}={}){
 if(!config.maintenanceConfig)return null
 const operator=JSON.parse(await readFile(config.maintenanceConfig,'utf8'))
 if(!/^[a-f0-9]{24}$/.test(operator.ownerUserId)||!operator.container||!operator.composePath||!operator.stateDirectory)throw Error('Invalid operator maintenance configuration')
 await mkdir(operator.stateDirectory,{recursive:true,mode:0o700})
 const statePath=join(operator.stateDirectory,'state.json');let state={enabled:false,plan:null,events:[]};let locked=false
 try{state=JSON.parse(await readFile(statePath,'utf8'));if(['diagnosing','building','activating','rolling-back'].includes(state.plan?.status))state.plan.status='interrupted'}catch(e){if(e.code!=='ENOENT')throw e}
 if(state.diagnosis?.status==='running')state.diagnosis={...state.diagnosis,status:'failed',error:'Agent restarted during diagnosis; run AI check again'}
 if(state.plan?.status==='active'&&state.diagnosis?.status==='resolved')state.diagnosis.action='compiler-repair'
 if(state.compilerImage)config.compilerImage=state.compilerImage
 const save=async()=>{const tmp=statePath+'.'+randomUUID();await writeFile(tmp,JSON.stringify(state),{mode:0o600});await rename(tmp,statePath)}
 const audit=(action)=>{state.events=[...state.events,{at:new Date().toISOString(),action}].slice(-100)}
 const check=(user,grant=true)=>{if(user!==operator.ownerUserId)throw failure(403,'Only the configured computer owner may manage this environment');if(grant&&!state.enabled)throw failure(403,'Enable environment maintenance in Settings first')}
 const inspect=async()=>JSON.parse((await run('docker',['inspect',operator.container],{maxBuffer:2000000})).stdout)[0]
 const publicState=()=>({enabled:state.enabled,scope:'Managed Overleaf compiler only',container:operator.container,plan:state.plan,events:state.events,diagnosis:state.diagnosis})
 async function status(user){check(user,false);return publicState()}
 async function permission(user,enabled){check(user,false);if(typeof enabled!=='boolean')throw failure(400,'enabled must be boolean');if(locked)throw failure(409,'Wait for the current environment operation before changing permission');state.enabled=enabled;audit(enabled?'Environment maintenance enabled; each operation still requires confirmation':'Environment maintenance revoked');await save();return publicState()}
 async function prepare(user,internal=false){check(user);if(locked&&!internal)throw failure(409,'Environment operation is running');const info=await inspect();const id=randomUUID();state.plan={id,status:'prepared',createdAt:new Date().toISOString(),container:operator.container,previousImage:info.Image,previousCompiler:config.compilerImage,packages:['acmart', 'xkeyval', 'xstring', 'iftex', 'microtype', 'etoolbox', 'booktabs', 'refcount', 'totpages', 'environ', 'trimspaces', 'setspace', 'framed', 'zref', 'natbib', 'hyperref', 'hyperxmp', 'ifmtarg', 'kvoptions', 'kvsetkeys', 'kvdefinekeys', 'auxhook', 'bitset', 'bigintcalc', 'intcalc', 'infwarerr', 'letltxmacro', 'gettitlestring', 'pdfescape', 'pdftexcmds', 'ltxcmds', 'hycolor', 'hopatch', 'stringenc', 'graphics', 'xcolor', 'draftwatermark', 'everypage', 'geometry', 'ncctools', 'cmap', 'libertine', 'inconsolata', 'newtx', 'caption', 'float', 'comment', 'fancyhdr', 'pbalance', 'preprint', 'xpatch', 'fontaxes', 'mweights', 'textcase', 'everyshi', 'algorithms', 'algorithmicx', 'pgf', 'pgfplots', 'multirow', 'colortbl', 'placeins'],imageTag:`overleaf-compiler-repair:${id}`,dockerfile:`ARG BASE_IMAGE\nFROM \u0024{BASE_IMAGE}\nUSER root\nRUN tlmgr --repository https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/2025/tlnet-final install acmart xkeyval xstring iftex microtype etoolbox booktabs refcount totpages environ trimspaces setspace framed zref natbib hyperref hyperxmp ifmtarg kvoptions kvsetkeys kvdefinekeys auxhook bitset bigintcalc intcalc infwarerr letltxmacro gettitlestring pdfescape pdftexcmds ltxcmds hycolor hopatch stringenc graphics xcolor draftwatermark everypage geometry ncctools cmap libertine inconsolata newtx caption float comment fancyhdr pbalance preprint xpatch fontaxes mweights textcase everyshi algorithms algorithmicx pgf pgfplots multirow colortbl placeins && kpsewhich xkeyval.sty && kpsewhich acmart.cls\n`,impact:'Build downloads TeX packages into a NEW Docker image. Activation restarts only the managed Overleaf container and changes the compiler image for future Agent tasks. Manuscript volumes are retained. Other containers, macOS settings, personal files and arbitrary commands are outside this permission.',log:''};audit('Prepared repair plan '+id);await save();return publicState()}
 async function analyze(user,issue='',{fromAgent=false}={}){
  check(user);if(locked||(!fromAgent&&busy()))throw failure(409,'Wait for the current task or environment operation');if(typeof issue!=='string'||issue.length>4000)throw failure(400,'Issue must be at most 4000 characters')
  locked=true;const previous=state.plan;const priorFailure=previous?.error?previous:state.lastFailure;state.diagnosis={status:'running',progress:'Inspecting managed compiler and maintenance logs',startedAt:new Date().toISOString()};await save()
  void (async()=>{try{
   const info=await inspect();const metadata=await run('docker',['run','--rm','--platform','linux/amd64','--network','none','--read-only','--entrypoint','sh',info.Image,'-c','tlmgr --version; kpsewhich xkeyval.sty; kpsewhich acmart.cls; true'],{timeout:30000,maxBuffer:100000})
   const evidence={issue,managedImage:info.Image,compilerImage:config.compilerImage,texLive:metadata.stdout,previousFailure:priorFailure?{status:priorFailure.status,error:priorFailure.error,log:priorFailure.log?.slice(-16000),packages:priorFailure.packages}:null,planStatus:previous?.status}
   const result=await diagnose(evidence,{onProgress:delta=>{state.diagnosis.progress=(state.diagnosis.progress+delta).slice(-12000)}})
   state.diagnosis={...result,status:'completed',evidence,completedAt:new Date().toISOString()};audit('Codex diagnosed environment: '+result.action)
   if(result.action==='compiler-repair'&&previous?.status!=='activation-failed'){
    // A new immutable proposal needs a new confirmation; past failed approval is not reused.
    await prepare(user,true)
    const plan=state.plan;plan.diagnosis=result;plan.packages=[...new Set([...(previous?.packages||[]),...result.packages])];plan.dockerfile=plan.packages.length?plan.dockerfile.replace(/install .*? && kpsewhich/,`install ${plan.packages.join(' ')} && kpsewhich`):plan.dockerfile.replace(/RUN tlmgr .*? && kpsewhich/,'RUN kpsewhich')
   }
  }catch(e){state.diagnosis={...state.diagnosis,status:'failed',error:String(e.message).slice(0,2000)};audit('AI diagnosis failed')}finally{locked=false;await save()}})()
  return publicState()
 }
 async function recover(user,plan){
  check(user);if(state.plan!==plan||plan.automation.owner!==user)throw failure(409,'Maintenance authorization no longer matches this plan')
  if(plan.automation.attempts>=plan.automation.maxAttempts){plan.automation.stoppedReason='AI recovery reached three attempts; review evidence before further changes';await save();return}
  if(busy()){plan.automation.stoppedReason='Another Agent task is running; automatic activation deferred';await save();return}
  locked=true;plan.automation.attempts++;state.diagnosis={status:'running',progress:'Codex is choosing the next repair action from the failed execution'};await save()
  const options=plan.status==='activation-failed'&&plan.validation?['retry-activation','use-pid-column','stop']:['rebuild','add-packages','stop']
  const evidence={mode:'authorized-auto-repair',attempt:plan.automation.attempts,recoveryOptions:options,authorizedScope:'Only this compiler image, TeX Live package repairs and activation. No project edits, arbitrary host commands or system settings.',previousFailure:{status:plan.status,error:plan.error,log:plan.log.slice(-18000)},validatedImage:plan.validation?plan.imageId:null,packages:plan.packages,history:plan.automation.history}
  const decision=await diagnose(evidence);state.diagnosis={...decision,status:'completed',evidence,completedAt:new Date().toISOString()};plan.automation.history.push({at:new Date().toISOString(),...decision});audit('Codex recovery decision: '+decision.repairAction);await save()
  if(!options.includes(decision.repairAction)||decision.action!=='compiler-repair'||decision.repairAction==='stop'){locked=false;plan.automation.stoppedReason=decision.explanation;await save();return}
  // Recheck grant and exact target after inference; never follow model-provided shell commands.
  check(user);if((await inspect()).Image!==plan.previousImage)throw Error('Managed container changed; automatic recovery requires review')
  let next
  if(['retry-activation','use-pid-column'].includes(decision.repairAction)){if(decision.repairAction==='use-pid-column')plan.processColumns='pid,comm';next='activate'}
  else{if(decision.repairAction==='add-packages'){
   if(!decision.packages.length)throw Error('AI selected package repair without naming packages')
   plan.packages=[...new Set([...plan.packages,...decision.packages])];plan.dockerfile=plan.dockerfile.replace(/install .*? && kpsewhich/,`install ${plan.packages.join(' ')} && kpsewhich`)
  }plan.status='prepared';next='repair'}
  plan.log+='\nAI recovery: '+decision.rootCause+'\nAction: '+decision.repairAction
  locked=false;await save();await operate(user,plan.id,next,plan.id,{automatic:true})
 }
 async function operate(user,id,action,confirmation,{automatic=false}={}){check(user);if(confirmation!==id)throw failure(400,'Explicit confirmation of this exact plan is required');if(locked)throw failure(409,'Environment operation is running');const plan=state.plan;if(!plan||plan.id!==id)throw failure(404,'Repair plan not found');const allowed={build:'prepared',repair:'prepared',activate:'built',rollback:'active'};if(!allowed[action]||!(plan.status===allowed[action]||['rollback','activate'].includes(action)&&plan.status==='activation-failed'))throw failure(409,'Action is not available for this plan');if(busy())throw failure(409,'Wait for running Agent tasks to finish');locked=true;let info;try{info=await inspect()}catch(e){locked=false;throw e}if(info.Image!==(action==='rollback'?plan.imageId:plan.previousImage)){locked=false;throw failure(409,'Managed image changed; prepare a new plan')} if(action==='repair'&&!automatic)plan.automation={authorized:true,owner:user,attempts:0,maxAttempts:3,startedAt:new Date().toISOString(),history:[]};plan.status=['build','repair'].includes(action)?'building':(action==='activate'||action==='repair')?'activating':'rolling-back';audit((automatic?'AI executes authorized ':'User confirmed ')+action+' '+id);await save()
 const execute=async()=>{try{
  const dir=join(operator.stateDirectory,id);await mkdir(dir,{recursive:true,mode:0o700})
  if(action==='build'||action==='repair'){
   const baseTag=`overleaf-compiler-base:${id}`;await run('docker',['tag',plan.previousImage,baseTag]);const tagged=(await run('docker',['image','inspect',baseTag,'--format','{{.Id}}'])).stdout.trim();if(tagged!==plan.previousImage)throw Error('Base image tag did not match the approved image');
   await writeFile(join(dir,'Dockerfile'),plan.dockerfile,{mode:0o600});const result=await run('docker',['build','--platform','linux/amd64','--build-arg',`BASE_IMAGE=${baseTag}`,'-t',plan.imageTag,dir],{timeout:1200000,maxBuffer:8000000});plan.log=(result.stdout+result.stderr).slice(-24000)
   plan.imageId=(await run('docker',['image','inspect',plan.imageTag,'--format','{{.Id}}'])).stdout.trim();if(!/^sha256:[a-f0-9]{64}$/.test(plan.imageId))throw Error('Built image could not be verified');const smoke=await run('docker',['run','--rm','--platform','linux/amd64','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','2g','--tmpfs','/tmp:rw,size=256m','--entrypoint','sh',plan.imageId,'-c','cd /tmp && printf "%s\\n" "\\\\documentclass[sigconf]{acmart}" "\\\\begin{document}Compiler verification.\\\\end{document}" > main.tex && TEXMFVAR=/tmp/texmf-var TEXMFCONFIG=/tmp/texmf-config latexmk -norc -pdf -interaction=nonstopmode -halt-on-error -latexoption=-no-shell-escape main.tex'],{timeout:90000,maxBuffer:2000000});plan.log+='\nACM smoke test passed\n'+smoke.stdout.slice(-4000);plan.validation='ACM template compiled successfully in an isolated container';plan.status='built'
  }
  if(action!=='build'){
   if(action==='repair'){plan.status='activating';await save()}
   if(busy())throw Error('Agent became busy; activation was not performed')
   const current=await inspect();if(current.Image!==info.Image)throw Error('Managed image changed before activation')
   // Never interrupt a running browser compilation.
   const processes=(await run('docker',['top',operator.container,'-eo',plan.processColumns||'pid,comm'])).stdout;if(/^(?:\s*\d+\s+)?(?:latexmk|pdflatex|xelatex|lualatex|bibtex)\s*$/m.test(processes))throw Error('A LaTeX compilation is running; retry after it finishes')
   const image=(action==='activate'||action==='repair')?plan.imageId:plan.previousImage;const override=join(dir,'override.json');await writeFile(override,JSON.stringify({services:{[operator.service||'candidate-web']:{image}}}),{mode:0o600})
   const values=Object.fromEntries(current.Config.Env.map(v=>{const i=v.indexOf('=');return [v.slice(0,i),v.slice(i+1)]}));const env={...process.env};for(const key of ['OVERLEAF_AGENT_TOKEN','WRITING_ASSIST_ZOTERO_ENCRYPTION_KEY','GIT_SYNC_CREDENTIAL_KEY'])if(values[key])env[key]=values[key]
   await run('docker',['compose','-p',operator.composeProject||'overleaf-deletion-acceptance','-f',operator.composePath,'-f',override,'up','-d','--no-build','--pull','never',operator.service||'candidate-web'],{env,timeout:120000,maxBuffer:2000000})
   if((await inspect()).Image!==image)throw Error('Container image did not match activation target')
   config.compilerImage=(action==='activate'||action==='repair')?plan.imageId:plan.previousCompiler;state.compilerImage=config.compilerImage;plan.status=(action==='activate'||action==='repair')?'active':'rolled-back';plan.log+=`\n${action}: container and future Agent compiler use ${image}`
  }
  delete plan.error;if(state.diagnosis){state.diagnosis={...state.diagnosis,status:'resolved',action:'compiler-repair',rootCause:'已完成维护修复',explanation:plan.validation+'；运行容器和 Agent 编译镜像已切换并核验。'}}
  audit(action+' completed '+id)
 }catch(e){plan.status=plan.status==='activating'?'activation-failed':'failed';plan.error=String(e.message).slice(0,1000);plan.log+=(String(e.stdout||'')+String(e.stderr||'')).slice(-16000);state.lastFailure={id:plan.id,status:plan.status,error:plan.error,log:plan.log,packages:plan.packages};audit(action+' failed '+id)}finally{locked=false;await save();if(['failed','activation-failed'].includes(plan.status)&&['build','repair','activate'].includes(action)){if(plan.automation?.authorized)await recover(user,plan).catch(async e=>{locked=false;plan.automation.stoppedReason=e.message;state.diagnosis={...state.diagnosis,status:'failed',error:e.message};await save()});else await analyze(user,'The approved compiler repair failed. Identify its root cause from the recorded log and propose a corrected repair.').catch(()=>{})}}}
 void execute();return publicState()
 }
 return {status,permission,prepare,analyze,operate,isBusy:()=>locked}
}
