import type {Venue} from './submission-deadlines'
// Group annual catalog rounds for browsing only. Planning keeps the original IDs.
export function mergeConferenceRounds(rows:Venue[],catalog:Venue[]=rows){
 const key=(v:Venue)=>v.kind==='conference'&&!v.parentVenueId?`${v.id.split('~')[0]}:${v.year}`:v.id
 const seen=new Set<string>();return rows.flatMap(v=>{const id=key(v);if(seen.has(id))return [];seen.add(id)
  const rounds=catalog.filter(other=>key(other)===id)
  return [{...v,...(rounds.length>1?{submissionRounds:rounds,round:`${rounds.length} submission cycles`}:{})}]
 })
}
