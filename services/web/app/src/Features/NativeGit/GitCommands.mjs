import { gitOutput } from './GitOutput.mjs'
import { graphSettingsSchema } from './GraphSettings.mjs'
import { z } from '@overleaf/validation-tools'

const text = z.string().min(1).max(1024).refine(value => !/[\0\r\n]/.test(value))
const paths = z.array(text).min(1).max(20000)
const command = (name, fields = {}) => z.object({ command: z.literal(name), ...fields }).strict()
export const commandSchema = z.discriminatedUnion('command', [
  command('accessPolicy'), command('setAccessPolicy', { mode: z.enum(['read-only','workspace-write','auto-review','full-access','extended']), directories: z.array(z.string().max(1024)).max(4).default([]), approval: z.string().uuid().optional() }),
  command('graphSettings'), command('saveGraphSettings', { settings: graphSettingsSchema }),
  command('changeRemote', { name: text, expectedUrl: text, fetchUrl: text, pushUrl: text }),
  command('terminalApprove', { directories: z.array(z.string().regex(/^\/var\/lib\/overleaf\/[^,]+$/)).min(1).max(4) }),
  command('terminalOpen', { mode: z.enum(['read-only', 'workspace-write', 'auto-review', 'full-access', 'extended']).default('workspace-write'), directories: z.array(z.string().max(1024)).max(4).default([]), approval: z.string().uuid().optional() }), command('terminalPoll', { id: z.string().uuid() }), command('terminalClose', { id: z.string().uuid() }), command('terminalInput', { id: z.string().uuid(), input: z.string().max(65536) }), command('terminalResize', { id: z.string().uuid(), cols: z.number().int().min(2).max(500), rows: z.number().int().min(2).max(200) }),
  command('terminalRun', { id: z.string().uuid(), text: z.string().min(1).max(16384), approval: z.string().uuid().optional() }),
  command('terminalInfo'), command('terminalRead', { operation: z.enum(['status', 'log', 'diff', 'branch', 'remote', 'pwd']), staged: z.boolean().optional() }),
  command('gitOutput'), command('ignoredFiles'), command('stage', { paths, force: z.boolean().optional() }), command('unstage', { paths }),
  command('generateMessage'), command('amendDetails'),
  command('clone', {url:text,branch:text.optional(),name:z.string().trim().min(1).max(150),operationId:z.string().uuid(),username:text.optional(),token:z.string().min(1).max(16000).optional()}),
  command('connect', { url: text, branch: text.optional(), username: text.optional(), token: z.string().min(1).max(16000).optional() }),
  command('commit', { message: z.string().trim().min(1).max(64000), amend: z.boolean().optional(), all: z.boolean().optional(), signoff: z.boolean().optional(), expectedHead: text.optional(), expectedBranch: text.nullable().optional() }),
  command('diff', { paths: z.array(text).max(20000).optional(), staged: z.boolean().optional(), from: text.optional(), to: text.optional() }),
  command('graph', { showRemotes: z.boolean().optional(), showTags: z.boolean().optional(), showStashes: z.boolean().optional(), includeReflogs: z.boolean().optional(), firstParent: z.boolean().optional(), hiddenRemotes: z.array(text).max(100).optional(), refs: z.array(text).max(100).optional(), query: text.optional(), skip: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(), ref: text.optional(), all: z.boolean().optional(), limit: z.number().int().min(1).max(1000).optional() }),
  command('show', { ref: text, path: text }),
  command('commitDiff', { ref: text }),
  command('commitDetails', { ref: text }),
  command('commitFiles', { ref: text }),
  command('commitFileDiff', { ref: text, path: text }),
  command('commitFilePreview', { ref: text, path: text }),
  command('fileDiff', { path: text, staged: z.boolean().optional() }),
  command('filePreview', { path: text, staged: z.boolean().optional() }),
  command('fileHunks', { path: text, staged: z.boolean().optional() }),
  command('applyHunks', { path: text, staged: z.boolean().optional(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/), selected: z.array(z.number().int().nonnegative()).min(1).max(10000) }),
  command('fileHistory', { path: text, ref: text.optional(), limit: z.number().int().min(1).max(1000).optional() }),
  command('conflictDetails', { path: text }),
  command('resolveConflict', { path: text, fingerprint: z.string().regex(/^[a-f0-9]{64}$/), choice: z.enum(['current', 'incoming', 'edited']), text: z.string().max(2 * 1024 * 1024).optional() }),
  command('blame', { path: text, ref: text.optional() }),
  command('createBranch', { name: text, from: text.optional() }),
  command('trackBranch', { name: text, remoteRef: text }),
  command('renameBranch', { from: text, to: text }), command('deleteBranch', { name: text }),
  command('checkout', { name: text }), command('checkoutDetached', { ref: text }),
  command('merge', { ref: text, expectedBranch: text.optional() }), command('rebase', { ref: text }),
  command('cherryPick', { ref: text }), command('revert', { ref: text }),
  command('undoDetails'), command('undoCommit', { fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }),
  command('resetDetails', { ref: text }),
  command('reset', { ref: text, mode: z.enum(['soft', 'mixed', 'hard']), fingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional() }),
  command('continueOperation', { operation: z.enum(['merge', 'rebase', 'cherry-pick', 'revert']), action: z.enum(['continue', 'abort', 'skip']) }),
  command('discardDetails', { path: text }),
  command('discardAllDetails', { paths }), command('discardAll', { paths, fingerprint: z.string().regex(/^[a-f0-9]{64}$/) }),
  command('discard', { paths, fingerprint: z.string().regex(/^[a-f0-9]{64}$/).optional() }), command('stash', { message: text.optional(), mode: z.enum(['tracked','include-untracked','staged']).optional() }), command('stashes'),
  command('applyStash', { index: z.number().int().nonnegative(), pop: z.boolean().optional(), expectedHash: text.optional() }),
  command('dropStash', { index: z.number().int().nonnegative(), expectedHash: text.optional() }),
  command('stashDiff', { index: z.number().int().nonnegative(), expectedHash: text.optional() }),
  command('dropAllStashes', { expectedHashes: z.array(z.string().regex(/^[a-f0-9]{40,64}$/)).max(20000) }),
  command('createWorktree', { name: text, from: text.optional() }),
  command('worktrees'),
  command('cleanWorktree', { id: z.string().regex(/^[a-f0-9]{64}$/), expectedHead: z.string().regex(/^[a-f0-9]{40,64}$/) }),
  command('tags'), command('createTag', { name: text, ref: text.optional() }), command('deleteTag', { name: text }),
  command('remotes'), command('removeRemote', { name: text, expectedUrl: text.optional() }),
  command('addRemote', { name: text, url: text }),
  command('fetch', { remote: text.default('origin'), prune: z.boolean().optional() }),
  command('pull', { remote: text.default('origin'), branch: text, rebase: z.boolean().optional() }),
  command('push', { remote: text.default('origin'), branch: text, publish: z.boolean().optional() }),
  command('sync', { remote: text.default('origin'), branch: text }),
  command('remoteRef', {remote:text,kind:z.enum(['branch','tag']),name:text}),
  command('deleteRemoteRef', {remote:text,kind:z.enum(['branch','tag']),name:text,expectedHash:z.string().regex(/^[a-f0-9]{40,64}$/)}),
  command('pushTags', {remote:text}),
  command('credentialStatus', { target: z.enum(['fetch','push']).optional(), remote: text.default('origin') }),
  command('saveCredential', { target: z.enum(['fetch','push']).optional(), remote: text.default('origin'), username: text, token: z.string().min(1).max(16000) }),
  command('removeCredential', { target: z.enum(['fetch','push']).optional(), remote: text.default('origin') }),
  command('resumeTransfer'), command('cancelTransfer'),
])

// Explicit dispatch only. Never expose arbitrary Git arguments, config, shell,
// filesystem paths, environment overrides or user-supplied repository objects.
export async function executeGitCommand(workspace, input, author) {
  const c = commandSchema.parse(input)
  const run = action => workspace.run(async repo => {
    if (author) await repo.author(author.name, author.email)
    return action(repo)
  })
  const mutate = action => workspace.mutate(async repo => {
    if (author) await repo.author(author.name, author.email)
    return action(repo)
  })
  switch (c.command) {
    case 'terminalInfo': return run(async repo => ({ directory: repo.directory, branch: (await repo.status()).branch }))
    case 'terminalRead': return run(async repo => {
      const args = { status: ['status', '--short', '--branch'], log: ['log', '-50', '--graph', '--oneline', '--decorate'], diff: ['diff', '--no-ext-diff', '--no-textconv', '--no-color', ...(c.staged ? ['--cached'] : []), '--'], branch: ['branch', '-avv'], remote: ['remote', '-v'] }
      return { directory: repo.directory, output: c.operation === 'pwd' ? repo.directory : (await repo.git.raw(args[c.operation])).slice(0, 200000) }
    })
    case 'changeRemote': return run(repo => repo.changeRemote(c))
    case 'gitOutput': return run(repo => gitOutput(repo.directory))
    case 'ignoredFiles': return run(repo => repo.ignoredFiles())
    case 'stage': return run(repo => repo.stage(c.paths, c.force))
    case 'unstage': return run(repo => repo.unstage(c.paths))
    case 'amendDetails': return run(repo => repo.amendDetails())
    case 'commit': return run(repo => repo.commit(c.message, c))
    case 'diff': return run(repo => repo.diff(c))
    case 'graph': return run(repo => repo.graph(c))
    case 'show': return run(repo => repo.show(c.ref, c.path))
    case 'commitDiff': return workspace.readHistory(repo => repo.commitDiff(c.ref))
    case 'commitDetails': return workspace.readHistory(repo => repo.commitDetails(c.ref))
    case 'commitFiles': return workspace.readHistory(repo => repo.commitFiles(c.ref))
    case 'commitFilePreview': return workspace.readHistory(repo => repo.commitFilePreview(c.ref, c.path))
    case 'commitFileDiff': return workspace.readHistory(repo => repo.commitFileDiff(c.ref, c.path))
    case 'fileDiff': return run(repo => repo.fileDiff(c.path, c.staged))
    case 'filePreview': return run(repo => repo.filePreview(c.path, c.staged))
    case 'fileHunks': return run(repo => repo.fileHunks(c.path, c.staged))
    case 'applyHunks': return run(repo => repo.applyHunks(c.path, c.selected, c.fingerprint, c.staged))
    case 'fileHistory': return run(repo => repo.fileHistory(c.path, c))
    case 'conflictDetails': return run(repo => repo.conflictDetails(c.path))
    case 'resolveConflict': return mutate(repo => repo.resolveConflict(c.path, c.fingerprint, c.choice, c.text))
    case 'blame': return run(repo => repo.blame(c.path, c.ref))
    case 'createBranch': return run(repo => repo.createBranch(c.name, c.from))
    case 'trackBranch': return run(repo => repo.trackBranch(c.name, c.remoteRef))
    case 'renameBranch': return run(repo => repo.renameBranch(c.from, c.to))
    case 'deleteBranch': return run(repo => repo.deleteBranch(c.name))
    case 'checkout': return workspace.switchBranch(c.name)
    case 'checkoutDetached': return workspace.checkoutDetached(c.ref)
    case 'merge': return mutate(repo => repo.merge(c.ref, c.expectedBranch))
    case 'rebase': return mutate(repo => repo.rebase(c.ref))
    case 'cherryPick': return mutate(repo => repo.cherryPick(c.ref))
    case 'revert': return mutate(repo => repo.revert(c.ref))
    case 'undoDetails': return run(repo => repo.undoDetails())
    case 'undoCommit': return run(repo => repo.undoCommit(c.fingerprint))
    case 'resetDetails': return run(repo => repo.resetDetails(c.ref))
    case 'reset': return mutate(repo => repo.reset(c.ref, c.mode, c.fingerprint))
    case 'continueOperation': return mutate(repo => repo.continueOperation(c.operation, c.action))
    case 'discardAllDetails': return run(repo => repo.discardAllDetails(c.paths))
    case 'discardAll': return mutate(repo => repo.discardAll(c.paths, c.fingerprint))
    case 'discardDetails': return run(repo => repo.discardDetails(c.path))
    case 'discard': return mutate(repo => repo.discard(c.paths, c.fingerprint))
    case 'stash': return mutate(repo => repo.stash(c.message,c))
    case 'stashDiff': return run(repo => repo.stashDiff(c.index, c.expectedHash))
    case 'stashes': return run(repo => repo.stashes())
    case 'applyStash': return mutate(repo => repo.applyStash(c.index, { pop: c.pop, expectedHash: c.expectedHash }))
    case 'dropStash': return run(repo => repo.dropStash(c.index, c.expectedHash))
    case 'dropAllStashes': return run(repo => repo.dropAllStashes(c.expectedHashes))
    case 'createWorktree': return run(repo => repo.createWorktree(c.name,c.from))
    case 'worktrees': return run(repo => repo.managedWorktrees())
    case 'cleanWorktree': return run(repo => repo.cleanWorktree(c.id, c.expectedHead))
    case 'tags': return run(repo => repo.tags())
    case 'createTag': return run(repo => repo.createTag(c.name, c.ref))
    case 'deleteTag': return run(repo => repo.deleteTag(c.name))
    case 'remotes': return run(repo => repo.remotes())
    case 'addRemote': return run(repo => repo.addRemote(c.name, c.url))
    case 'removeRemote': return run(repo => repo.removeRemote(c.name, c.expectedUrl))
    case 'resumeTransfer': return workspace.resumeSwitch()
    case 'cancelTransfer': return workspace.cancelSwitch()
    default: throw new Error('Command requires a dedicated service')
  }
}
