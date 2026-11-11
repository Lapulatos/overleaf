// Official providers/publishers win conflicts. Preserve raw observations separately.
export function combineMetricSnapshots(supplemental,official,year=new Date().getUTCFullYear()){
 const entries={}
 for(const key of new Set([...Object.keys(supplemental),...Object.keys(official)])){
  const extra=supplemental[key]||{},primary=official[key]||{}
  const sources=[...(primary.sources||[]),...(extra.source?[{url:extra.source,label:'LetPub',checked:extra.checked}]:[])]
  const entry={...extra,...primary,sources}
  const metric=primary.jif||extra.jif
  const release=metric?.release||Number(metric?.edition?.match(/20\d\d-(20\d\d)/)?.[1])
  entry.jif=release>=year?metric:null
  const jcrRelease=Number((primary.jcrEdition||extra.jcrEdition||'').match(/(?:released |20\d\d-)(20\d\d)/)?.[1])
  if(jcrRelease<year||!jcrRelease)entry.jcr=[]
  if(Number(entry.cas?.edition)<year)entry.cas=null
  if(Number(entry.xinrui?.edition)<year)entry.xinrui=null
  if(primary.jif&&extra.jif&&primary.jif.value!==extra.jif.value)entry.auditNote=`Official JIF ${primary.jif.value}; LetPub ${extra.jif.value}. Official value displayed.`
  entries[key]=entry
 }
 return entries
}
