import test from 'node:test'
import assert from 'node:assert/strict'
import { workspaceIdentity, assertWorkspaceIdentity } from '../../app/src/Features/WritingAssist/WritingAssistWorkspaceIdentity.mjs'
import { AgentError } from '../../app/src/Features/WritingAssist/WritingAssistAgentService.mjs'

test('server record produces root and child identities without exposing project metadata', () => {
  assert.equal(workspaceIdentity('p', {}), null)
  assert.deepEqual(workspaceIdentity('p', {gitWorkspaceFenceEnabled:true,gitWorkspaceEpoch:2,name:'private'}),
    {projectId:'p',workspaceId:'p',branch:null,epoch:2})
  assert.deepEqual(workspaceIdentity('child', {gitWorkspaceEpoch:3,gitWorkspace:{logicalProjectId:'root',branch:'draft',state:'ready'}}),
    {projectId:'root',workspaceId:'child',branch:'draft',epoch:3})
})

test('missing, archived, preparing and invalid epoch workspaces fail closed', () => {
  assert.throws(() => workspaceIdentity('p', null), {status:404})
  for (const state of ['archived','preparing','failed'])
    assert.throws(() => workspaceIdentity('p', {gitWorkspace:{state},gitWorkspaceEpoch:1}), {status:409})
  for (const epoch of [undefined,0,-1,1.5,'1',NaN])
    assert.throws(() => workspaceIdentity('p', {gitWorkspaceFenceEnabled:true,gitWorkspaceEpoch:epoch}), {status:409})
})

test('enabling or disabling fencing invalidates captured or legacy identity', () => {
  const identity = workspaceIdentity('p', {gitWorkspaceFenceEnabled:true,gitWorkspaceEpoch:1})
  assertWorkspaceIdentity(null, null)
  assertWorkspaceIdentity(identity, {...identity})
  assert.throws(() => assertWorkspaceIdentity(undefined, identity), {code:'AI_WORKSPACE_CHANGED'})
  assert.throws(() => assertWorkspaceIdentity(identity, null), {code:'AI_WORKSPACE_CHANGED'})
  assert.throws(() => assertWorkspaceIdentity(identity, null), error => error instanceof AgentError && error.status === 409)
  assert.throws(() => workspaceIdentity('p', null), error => error instanceof AgentError && error.status === 404)
})
