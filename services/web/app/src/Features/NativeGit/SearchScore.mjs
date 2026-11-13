// Exact, prefix, substring, then ordered-character matches. Zero means no match.
export function searchScore(value, query) {
 const text=String(value || '').toLowerCase(), needle=query.trim().toLowerCase()
 if(!needle)return 1
 if(text===needle)return 10000
 if(text.startsWith(needle))return 8000-Math.min(text.length,1000)
 const index=text.indexOf(needle)
 if(index>=0)return 6000-Math.min(index,1000)-Math.min(text.length,1000)
 const words=needle.split(/\s+/)
 if(words.length>1&&words.every(word=>text.includes(word)))return 3000-Math.min(text.length,1000)
 if(needle.length<3)return 0
 let last=-1, gaps=0
 for(const character of needle){const next=text.indexOf(character,last+1);if(next<0)return 0;if(last>=0)gaps+=next-last-1;last=next}
 return Math.max(1,1000-gaps-Math.min(text.length,500))
}
