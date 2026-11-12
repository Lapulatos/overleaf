import { createHash } from 'node:crypto'
import { db, ObjectId } from '../../infrastructure/mongodb.mjs'
const oid = value => new ObjectId(String(value))
const generatedId = (operation, project, kind, id) => createHash('sha256').update(JSON.stringify([operation,project,kind,id])).digest('hex').slice(0,24)
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v)

// These collections are already part of the web database contract. Only new,
// unpublished project IDs may be passed by the restore coordinator. Upsert never
// changes existing text; its provenance predicate rejects ID collisions.
export async function restoreConversations(operationId, workspace) {
  const projectId=workspace.project._id, project_id=oid(projectId)
  const insert=async(collection,kind,sourceId,record)=>{
    const _id=oid(generatedId(operationId,projectId,kind,sourceId))
    const fingerprint=createHash('sha256').update(canonical(record)).digest('hex')
    await collection.updateOne({_id,_backupRestoreId:operationId,_backupRestoreHash:fingerprint},
      {$setOnInsert:{...record,_id,_backupRestoreId:operationId,_backupRestoreHash:fingerprint}},{upsert:true})
    return _id
  }
  const groups=[['GLOBAL',{messages:workspace.messages}],...Object.entries(workspace.threads)]
  for(const [threadId,thread] of groups){
    if(!thread.messages.length) continue
    const room={project_id}
    if(threadId!=='GLOBAL') room.thread_id=oid(threadId)
    if(thread.resolved) room.resolved={user_id:thread.resolved_by_user_id,ts:new Date(thread.resolved_at)}
    const roomId=await insert(db.rooms,'room',threadId,room)
    for(const message of thread.messages){
      const record={room_id:roomId,content:message.content,timestamp:message.timestamp,user_id:message.user_id ? oid(message.user_id) : null}
      if(message.edited_at) record.edited_at=message.edited_at
      await insert(db.messages,'message',message.id,record)
    }
  }
  for(const label of workspace.labels){
    const record={project_id,comment:label.comment,version:label.version,created_at:new Date(label.created_at)}
    if(label.user_id) record.user_id=oid(label.user_id)
    await insert(db.projectHistoryLabels,'label',label.id,record)
  }
}
