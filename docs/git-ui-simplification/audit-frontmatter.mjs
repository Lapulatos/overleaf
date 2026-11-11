import {getGitSyncRuntime} from '/overleaf/services/web/app/src/Features/GitSync/GitSyncRuntime.mjs'
import ProjectGetter from '/overleaf/services/web/app/src/Features/Project/ProjectGetter.mjs'
import ProjectEntityHandler from '/overleaf/services/web/app/src/Features/Project/ProjectEntityHandler.mjs'
import DocumentUpdaterHandler from '/overleaf/services/web/app/src/Features/DocumentUpdater/DocumentUpdaterHandler.mjs'
import mongoose from '/overleaf/services/web/app/src/infrastructure/Mongoose.mjs'
import {createHash} from 'node:crypto'
await mongoose.connectionPromise
const db=mongoose.connection.db
const project='6aebe9278850b5fc9924feda',user='6ae57d2fa2564a345a7efb9f'
const runtime=await getGitSyncRuntime();await runtime.authorize(project,user,'read')
const binding=await db.collection('gitSyncBindings').findOne({_id:project})
const reader=await runtime.readerFor(binding)
const tree=await ProjectGetter.promises.getProject(project,{rootFolder:1})
const doc=ProjectEntityHandler.getAllEntitiesFromProject(tree).docs.find(x=>x.path.replace(/^\//,'')==='tex/frontmatter.tex')
const content=doc?await DocumentUpdaterHandler.promises.getDocument(project,doc.doc._id.toString(),-1):null
const current={files:new Map(content?[['tex/frontmatter.tex',Buffer.from(content.lines.join('\n'))]]:[])}
const refs=await reader.branches(),file='tex/frontmatter.tex'
const hash=bytes=>bytes?createHash('sha256').update(bytes).digest('hex'):null
const entries=[]
for(const ref of refs){const snap=await reader.snapshot(ref.id);entries.push({ref:ref.ref,commit:ref.id,subject:ref.subject,hash:hash(snap.files.get(file)),bytes:snap.files.get(file)?.length})}
const operations=await db.collection('gitSyncOperations').find({projectId:project,comparison:'branch-switch'},{projection:{_id:1,createdAt:1,'binding.branch':1,targetBranch:1,baseCommit:1,remoteCommit:1,status:1,checkoutHasLocalChanges:1}}).sort({createdAt:-1}).limit(8).toArray()
console.log('AUDIT:'+JSON.stringify({currentBranch:binding.branch,baseCommit:binding.baseCommit,file,liveHash:hash(current.files.get(file)),liveBytes:current.files.get(file)?.length,refs:entries,operations}));process.exit(0)
