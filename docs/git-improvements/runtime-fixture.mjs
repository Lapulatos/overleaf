import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
process.env.STAGING_PASSWORD = (await fs.readFile('/etc/container_environment/STAGING_PASSWORD','utf8')).trim()
const { default: settings } = await import('/overleaf/libraries/settings/index.js')
assert.equal(settings.siteUrl, 'http://127.0.0.1:18081')
assert.ok(settings.mongo.url.endsWith('/prism_reviewed_deletion'))
const { db, ObjectId, connectionPromise } = await import('/overleaf/services/web/app/src/infrastructure/mongodb.mjs')
await connectionPromise
const statePath = '/var/lib/overleaf/git-sync/git-ux-acceptance.json'
let state
try { state=JSON.parse(await fs.readFile(statePath,'utf8')) } catch(error) { if(error.code!=='ENOENT') throw error }
if (state?.seeded) { console.log('FIXTURE:'+JSON.stringify(state)); process.exit(0) }
assert.ok(!state, 'A partial fixture already exists; resume it explicitly rather than create another')
const { default: creation } = await import('/overleaf/services/web/app/src/Features/Project/ProjectCreationHandler.mjs')
const { default: entities } = await import('/overleaf/services/web/app/src/Features/Project/ProjectEntityUpdateHandler.mjs')
const owner = await db.users.findOne({ _id: new ObjectId('6ae57d2fa2564a345a7efb9f') })
assert.ok(owner.email.endsWith('@acceptance.invalid'))
const baseText = '\\documentclass{article}\n\\begin{document}\nOriginal introduction.\nUnchanged separator one.\nUnchanged separator two.\nOriginal conclusion.\n\\end{document}\n'
const webText = baseText.replace('Original introduction.', 'Revised introduction.').replace('Original conclusion.', 'Revised conclusion.')
const project = await creation.promises.createProjectFromSnippet(String(owner._id),'Git UX isolated acceptance '+randomUUID(), webText.split('\n'))
state={projectId:String(project._id), name:project.name, userId:String(owner._id), repositoryKey:randomUUID(), bindingId:randomUUID(), baseText, webText}
await fs.writeFile(statePath,JSON.stringify(state))
const live=await db.projects.findOne({_id:project._id})
await entities.promises.addDoc(state.projectId,String(live.rootFolder[0]._id),'build.aux',['Generated fixture output'],state.userId,'git-ux-acceptance')
const repository=path.join(settings.gitSync.repositoryRoot,state.repositoryKey)
await fs.mkdir(repository,{mode:0o700})
const ownerStat=await fs.stat('/var/lib/overleaf')
await fs.chown(repository,ownerStat.uid,ownerStat.gid)
const run=promisify(execFile)
const git=async(...args)=>(await run('git',['-c','user.name=Git UX Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false',...args],{cwd:repository,uid:ownerStat.uid,gid:ownerStat.gid})).stdout.trim()
await git('init','-b','main')
for (const [name,bytes] of [['main.tex',Buffer.from(baseText)],['pixel.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5mQAAAAASUVORK5CYII=','base64')],['sample.pdf',await fs.readFile('/tmp/git-ux-fixture.pdf')]]) {
 await fs.writeFile(path.join(repository,name),bytes); await fs.chown(path.join(repository,name),ownerStat.uid,ownerStat.gid)
}
await git('add','.'); await git('commit','-m','Initial manuscript and media')
state.mediaCommit=await git('rev-parse','HEAD')
for(let i=0;i<54;i++) await git('commit','--allow-empty','-m',`History fixture ${i+1}`)
state.baseCommit=await git('rev-parse','HEAD')
await git('branch','review-alternative','HEAD~1')
const { default: mongoose } = await import('/overleaf/services/web/app/src/infrastructure/Mongoose.mjs')
await mongoose.connectionPromise
await mongoose.connection.db.collection('gitSyncBindings').insertOne({_id:state.projectId,bindingId:state.bindingId,repositoryKey:state.repositoryKey,revision:1,branch:'refs/heads/main',baseCommit:state.baseCommit,state:'connected',remoteUrl:'https://github.com/overleaf-fixture/git-ux-no-network.git'})
state.seeded=true
await fs.writeFile(statePath,JSON.stringify(state))
console.log('FIXTURE:'+JSON.stringify(state));process.exit(0)
