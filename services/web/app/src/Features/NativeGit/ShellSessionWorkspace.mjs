const sessionCommands = new Set(['shellDraftStart','shellDraftGet','shellDraftHistory','shellDraftInput','shellDraftPoll','shellDraftResize','shellDraftRun','shellDraftRename','shellDraftDelete','shellDraftSeal','shellDraftReview','shellDraftFile'])
// Only private-session actions may follow this routing. Applying to the editor
// keeps its original workspace/save barrier and cannot follow a client target.
export async function shellSessionWorkspace({command,store,logicalProjectId,actorId,currentWorkspaceId}) {
 if(!sessionCommands.has(command.command))return currentWorkspaceId
 const task=await store.read(command.id)
 if(task.kind!=='shell-draft' || task.logicalProjectId!==logicalProjectId || task.createdBy!==actorId)throw Object.assign(new Error('Terminal session does not belong to this user and project'),{status:403})
 if(task.deletedAt)throw Object.assign(new Error('Terminal session was deleted'),{status:404})
 return task.workspaceId
}
