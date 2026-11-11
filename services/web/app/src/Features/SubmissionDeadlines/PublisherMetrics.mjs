import * as cheerio from 'cheerio'
import {metricKey} from './LetPubMetrics.mjs'
export const publisherMetricPages=[
 {name:'Automated Software Engineering',url:'https://link.springer.com/journal/10515'},
 {name:'Empirical Software Engineering',url:'https://link.springer.com/journal/10664'},
 {name:'International Journal on Software Tools for Technology Transfer',url:'https://link.springer.com/journal/10009'},
]
export function parsePublisherMetrics(html,source,expectedName){
 const $=cheerio.load(html);const name=$('h1').text().trim();if(metricKey(name)!==metricKey(expectedName))throw new Error('Publisher journal identity mismatch')
 const text=$('body').text().replace(/\s+/g,' ');const jif=text.match(/Journal Impact Factor\s+(\d+(?:\.\d+)?)\s*\((20\d\d)\)/);const checked=new Date().toISOString()
 const record={name,checked,status:'official',sources:[],source,sourceLabel:'Publisher'}
 if(jif){const year=Number(jif[2]);record.jif={value:Number(jif[1]),year,release:year+1,edition:`${year}; released ${year+1}`,source}}
 const indexes=text.split('Abstracted and indexed in')[1]?.split('Journal navigation')[0]||''
 if(indexes.includes('Science Citation Index Expanded'))record.sci='SCIE'
 if(indexes.includes('EI Compendex'))record.ei='Indexed (publisher)'
 record.sources.push({url:source,label:'Publisher',fields:['jif','sci','ei'].filter(f=>record[f]),checked})
 return record
}
