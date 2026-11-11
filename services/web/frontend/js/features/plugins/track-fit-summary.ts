import type {Fit} from './venue-recommendations'
function shorten(text:string){const clean=text.trim().replace(/\s+/g,' ');if(clean.length<=160)return clean;const cut=clean.lastIndexOf(' ',157);return clean.slice(0,cut>=95?cut:157)+'…'}
const split=(text:string)=>text.split(/(?<=[.!?])\s+|;\s*/).map(s=>s.trim()).filter(Boolean)
export function trackFitSummary(item:Fit){
 const reasons=(item.briefReasons?.length?item.briefReasons:split(item.reason).filter(s=>!/^Required:|^Abstract deadline:|^Paper deadline:/i.test(s))).slice(0,2).map(shorten)
 const text=item.eligibility?.reason||''
 const problems=split(text).filter(s=>/\bunmet\b|unconfirmed|unknown|missing|not met|needs? confirmation|not verified/i.test(s)&&!/not a (?:stated )?prerequisite|no .{0,25}prerequisite/i.test(s))
 const issues=item.eligibility?.status==='met'?[]:(item.prerequisiteIssues?.length?item.prerequisiteIssues:problems.length?problems:split(text)).slice(0,3).map(shorten)
 return {reasons,issues}
}
