import Path from 'node:path'
import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises'
import { GitRepository } from './GitRepository.mjs'
import { WorkspaceStore } from './WorkspaceStore.mjs'
import { writeWorktree } from './WorktreeFiles.mjs'

export async function restoreGit(directory, manifest, plan, targetRoot) {
  const repoDirectory=Path.join(targetRoot,'repository')
  const repository=await GitRepository.init(repoDirectory,{worktreeRoot:Path.join(targetRoot,'worktrees')},'backup-restore-bootstrap')
  const gitdir=Path.join(repoDirectory,'.git')
  for(const entry of manifest.entries){
    if(!/^git\/(objects\/|refs\/|logs\/|HEAD$|packed-refs$|shallow$|index$)/.test(entry.path)) continue
    const dest=Path.join(gitdir,entry.path.slice(4))
    await mkdir(Path.dirname(dest),{recursive:true,mode:0o700})
    await copyFile(Path.join(directory,entry.path),dest)
  }
  await repository.git.raw(['fsck','--full','--no-reflogs'])
  const states=[]
  for(const workspace of plan.workspaces){
    const internal=workspace.sourceId!==plan.sourceProjectId
    const bindingPath=internal?`control/workspace-bindings/${workspace.sourceId}/workspace.json`:'control/binding/workspace.json'
    const previous=JSON.parse(await readFile(Path.join(directory,bindingPath)))
    const repo=internal ? (previous.branch ? await repository.branchWorktree(previous.branch) : await repository.detachedWorktree(previous.commit || 'HEAD')) : repository
    const prefix=`workspaces/${workspace.sourceId}/files/`, files=new Map()
    for(const entry of manifest.entries.filter(e=>e.path.startsWith(prefix))) files.set(entry.path.slice(prefix.length),await readFile(Path.join(directory,entry.path)))
    await writeWorktree(repo.directory,files)
    if(internal){
      const oldGitdirEntry=manifest.entries.filter(e=>/^git\/worktrees\/[^/]+\/gitdir$/.test(e.path))
      for(const entry of oldGitdirEntry){
        if(Path.dirname((await readFile(Path.join(directory,entry.path),'utf8')).trim())!==previous.directory) continue
        const index=entry.path.replace(/gitdir$/,'index')
        if(manifest.entries.some(e=>e.path===index)) await copyFile(Path.join(directory,index),Path.join((await repo.git.raw(['rev-parse','--absolute-git-dir'])).trim(),'index'))
      }
    }
    // Conflict indexes belong to the old operation, whose leases are not valid
    // in this new project. Retain the archived index as evidence, and expose all
    // current file contents as unstaged edits for a fresh explicit resolution.
    const stagingReset=!!(await repo.git.raw(['ls-files','-u'])).trim()
    if(stagingReset) await repo.git.raw(['reset','--mixed','HEAD'])
    const binding=new WorkspaceStore(internal?Path.join(targetRoot,'workspace-bindings',workspace.project._id):Path.join(targetRoot,'binding'))
    await binding.write({directory:repo.directory,branch:previous.branch})
    states.push({workspaceId:workspace.project._id,head:await repo.head(),stagingReset,sourceOperationRetained:!!(previous.pending||previous.mutationTaskId)})
  }
  return states
}
