export function conferenceOverview(paragraphs,venue,url,heading=''){
 if(venue?.kind!=='conference')return null
 const normalize=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim()
 const name=normalize(venue.description);const acronym=normalize(venue.title)
 const candidates=paragraphs.filter(text=>text.length>=80&&/\b(?:is|are|brings|provides|aims|focuses|covers|offers|serves|welcomes|dedicated|concerned|combines)\b/i.test(text)&&/conference|symposium|forum|researchers|research community/i.test(text)&&!/(?:cookie|privacy policy|all rights reserved|must be submitted|page limit)/i.test(text)).filter(text=>{const normalized=normalize(text);return name&&normalized.includes(name)||acronym&&(' '+normalized+' ').includes(' '+acronym+' ')})
 if(!candidates.length&&(' '+normalize(heading)+' ').includes(' '+acronym+' '))candidates.push(...paragraphs.filter(text=>text.length>=80&&/is (?:a|an|considered)|brings together|provides? a forum|aims? to|concerned with|focus|combines|dedicated to/i.test(text)&&/conference|symposium|forum|research|field|engineering/i.test(text)&&!/(?:cookie|privacy policy|all rights reserved|must be submitted|page limit)/i.test(text)))
 candidates.sort((a,b)=>Number(/brings together|provides? a forum|aims? to|dedicated to|focus(?:es|ed)? on|international forum/i.test(b))-Number(/brings together|provides? a forum|aims? to|dedicated to|focus(?:es|ed)? on|international forum/i.test(a)))
 if(!candidates.length)return null
 const paragraph=candidates[0];const sentences=paragraph.split(/(?<=[.!?])\s+(?=[A-Z])/);let text='';for(const sentence of sentences.slice(0,2)){if((text+sentence).length>560)break;text+=(text?' ':'')+sentence}if(!text)text=paragraph.slice(0,550).replace(/\s+\S*$/,'')+'…'
 return {text:text.trim(),source:url}
}
