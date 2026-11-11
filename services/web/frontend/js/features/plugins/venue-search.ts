import type {Venue} from './submission-deadlines'
const words=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]
function near(a:string,b:string){
 if(a.length<5||Math.abs(a.length-b.length)>1)return false
 let i=0,j=0,edits=0
 while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;continue}if(++edits>1)return false;if(a.length>=b.length)i++;if(b.length>=a.length)j++}
 return edits+(i<a.length||j<b.length?1:0)<=1
}
export function matchesVenueSearch(venue:Venue,query:string){
 const terms=words(query.replace(/\b([a-z])\s+and\s+([a-z])\b/gi,'$1 & $2'));if(!terms.length)return true
 const trackNames=venue.track?[venue.track.title]:(venue.trackSearch||[]).map(t=>t.title)
 const text=[venue.title,venue.description,venue.round,String(venue.year||''),...trackNames].filter(Boolean).join(' ')
 const tokens=words(text)
 return terms.every(term=>tokens.some(token=>token===term||(term.length>=3&&token.startsWith(term))||near(term,token)))
}

// Exact names stay ahead of topic matches; the selected sort orders ties.
export function venueSearchPriority(venue:Venue,query:string){
 const key=(text:string)=>words(text.replace(/\band\b/gi,'')).join('')
 const q=key(query);if(!q)return 0
 if([venue.title,`${venue.title} ${venue.year||''}`,venue.description].some(name=>name&&key(name)===q))return 2
 const tracks=venue.track?[venue.track.title]:(venue.trackSearch||[]).map(track=>track.title)
 return tracks.some(name=>key(name)===q)?1:0
}
