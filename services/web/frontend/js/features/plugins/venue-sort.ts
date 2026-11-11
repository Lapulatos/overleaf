import type {Venue} from './submission-deadlines'
import {areaName,rating} from './venue-display'
import {venueMetricKey,journalImpactFactor,journalQuartile,type MetricSnapshot} from './venue-metrics'
const weights:Record<string,number>={'A*':0,A:1,B:2,C:3,N:4,unknown:5}
export function sortVenues(venues:Venue[],sort:string,scores:Record<string,number>,now:number,metrics:Record<string,MetricSnapshot>={}){
 const deadline=(v:Venue)=>Math.min(...v.events.filter(e=>e.utc&&Date.parse(e.utc)>now).map(e=>Date.parse(e.utc!)))
 return [...venues].sort((a,b)=>{let value=0;if(sort==='relevance')value=(scores[b.id]??-1)-(scores[a.id]??-1);else if(['ccf','core','thcpl'].includes(sort))value=(weights[rating(a,sort)]??5)-(weights[rating(b,sort)]??5);else if(sort==='xidian'){const order=['顶尖成果A类','顶尖成果B类','1类贡献度','2类贡献度','3类贡献度','unknown'];const rank=(v:Venue)=>{const i=order.indexOf(rating(v,'xidian'));return i<0?5:i};value=rank(a)-rank(b)}else if(sort==='jif')value=(journalImpactFactor(b,metrics[venueMetricKey(b)])??-1)-(journalImpactFactor(a,metrics[venueMetricKey(a)])??-1);else if(sort==='jcr')value=(journalQuartile(a,metrics[venueMetricKey(a)])??5)-(journalQuartile(b,metrics[venueMetricKey(b)])??5);else if(sort==='area')value=areaName(a.area).localeCompare(areaName(b.area));else value=deadline(a)-deadline(b);return (Number.isNaN(value)?0:value)||a.title.localeCompare(b.title)||a.id.localeCompare(b.id)})
}
