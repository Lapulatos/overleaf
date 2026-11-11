import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
process.env.STAGING_PASSWORD=(await fs.readFile('/etc/container_environment/STAGING_PASSWORD','utf8')).trim()
const {default:settings}=await import('/overleaf/libraries/settings/index.js')
assert.equal(settings.siteUrl,'http://127.0.0.1:18081')
const {default:mongoose}=await import('/overleaf/services/web/app/src/infrastructure/Mongoose.mjs');await mongoose.connectionPromise
const db=mongoose.connection.db
const filename='/var/lib/overleaf/git-sync/git-ux-acceptance.json',state=JSON.parse(await fs.readFile(filename,'utf8'))
assert.equal(state.seeded,undefined)
const project=await db.collection('projects').findOne({_id:new mongoose.Types.ObjectId(state.projectId)})
assert.equal(project.name,state.name);assert.ok(state.name.startsWith('Git UX isolated acceptance '))
const owner=await fs.stat('/var/lib/overleaf'),run=promisify(execFile)
const git=async(...args)=>(await run('git',args,{cwd:path.join(settings.gitSync.repositoryRoot,state.repositoryKey),uid:owner.uid,gid:owner.gid})).stdout.trim()
assert.equal(await git('rev-list','--count','HEAD'),'55')
state.baseCommit=await git('rev-parse','HEAD');state.mediaCommit=await git('rev-list','--max-parents=0','HEAD')
const bindings=db.collection('gitSyncBindings');assert.equal(await bindings.findOne({_id:state.projectId}),null)
await bindings.insertOne({_id:state.projectId,bindingId:state.bindingId,repositoryKey:state.repositoryKey,revision:1,branch:'refs/heads/main',baseCommit:state.baseCommit,state:'connected',remoteUrl:'https://github.com/overleaf-fixture/git-ux-no-network.git'})
state.seeded=true;await fs.writeFile(filename,JSON.stringify(state));console.log('FIXTURE:'+JSON.stringify(state));process.exit(0)
