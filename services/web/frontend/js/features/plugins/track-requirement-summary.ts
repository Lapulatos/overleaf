import type {ConferenceTrack} from './conference-tracks'
export function trackRequirementSummary(track:ConferenceTrack){
 const texts=(id:string)=>track.requirements.find(r=>r.id===id)?.excerpts.map(e=>e.text).join(' ')||''
 // Initial-submission limits must not be replaced by the later revision allowance.
 const length=texts('length').split(/major revisions?|revised (?:papers|submissions)|camera.ready/i)[0]
 const pages:{label:string;value:string}[]=[]
 const number='(\\d+)\\s*(?:[-–]\\s*)?pages?'
 const body=new RegExp(number+'\\s+(?:for|of)\\s+(?:all\\s+)?(?:text|body|content)','i').exec(length)||new RegExp(number+'[^.!?]{0,35}exclud(?:ing|es?)\\s+(?:the\\s+)?references','i').exec(length)
 const total=/brief communications?|information sheet/i.test(length)?null:new RegExp(number,'i').exec(length)
 if(body||total)pages.push({label:body?'Body':'Paper',value:(body||total)![1]})
 const refs=new RegExp(number+'\\s+(?:for|of)\\s+(?:the\\s+)?references','i').exec(length)||/references[^.!?]{0,20}?(\d+)\s*pages?/i.exec(length)
 if(refs)pages.push({label:'References',value:refs[1]})
 else if(/exclud(?:ing|es?)\s+(?:the\s+)?references/i.test(length))pages.push({label:'References',value:'Excluded from limit'})
 const appendix=new RegExp(number+'\\s+(?:for|of)\\s+(?:the\\s+)?append(?:ix|ices)','i').exec(length)||/append(?:ix|ices)[^.!?]{0,20}?(\d+)\s*pages?/i.exec(length)
 if(appendix)pages.push({label:'Appendix',value:appendix[1]})
 else if(/includ(?:ing|es?)\s+(?:the\s+)?append(?:ix|ices)/i.test(length))pages.push({label:'Appendix',value:'Included in limit'})
 const brief=/brief communications?[^.!?]{0,55}?(\d+)[- ](?:printed[- ]?)?pages?/i.exec(length);if(brief)pages.push({label:'Brief communication',value:brief[1]})
 const abstract=/abstracts?[^.!?]{0,30}?(\d+)\s*[-–]\s*(\d+)\s*words/i.exec(length);if(abstract)pages.push({label:'Abstract',value:abstract[1]+'–'+abstract[2]+' words'})
 const anonymity=texts('anonymity').split(/(?<=[.!?])\s+/).filter(s=>!/single.{0,12}(?:or|and).{0,12}double|could vary|depending on|not (?:confirmed|established)/i.test(s)).join(' ')
 const review=/double[-\s](?:blind|anonymous|anonymized)/i.test(anonymity)?'Double-blind':/single[-\s](?:blind|anonymous|anonymized)/i.test(anonymity)?'Single-blind':/non[-\s]?blind|not anonymous|not anonymi[sz]ed|open review/i.test(anonymity)?'Non-blind':null
 const format=texts('format');const templates=[]
 if(/\bACM\b|acmart|acmsmall|sigconf/i.test(format)){templates.push('ACM');if(/acmsmall/i.test(format))templates.push('acmsmall');else if(/sigconf/i.test(format))templates.push('sigconf')}
 if(/\bIEEE\b|IEEEtran/i.test(format))templates.push('IEEE')
 if(/\bLNCS\b|llncs/i.test(format))templates.push('Springer LNCS')
 if(/Springer Nature|sn-jnl/i.test(format))templates.push('Springer Nature');else if(/\bNature\b/i.test(format))templates.push('Nature')
 if(/elsarticle|Elsevier/i.test(format))templates.push('Elsevier · elsarticle')
 if(!templates.length&&/\bLaTeX\b/i.test(format))templates.push('LaTeX')
 const layoutText=track.requirements.flatMap(r=>r.excerpts.map(e=>e.text)).join(' ').replace(/[–—−]/g,'-').split(/(?<=[.!?;])\s+/).filter(s=>!/camera.ready|final version|published version|no.{0,100}(?:column|layout).{0,100}(?:established|confirmed)|not.{0,20}confirmation/i.test(s)).join(' ')
 const single=/\b(?:single|one|1)[- ]column\b/i.test(layoutText);const double=/\b(?:double|two|2)[- ]column\b/i.test(layoutText);const layout=single!==double?(single?'Single-column':'Double-column'):null

 return {pages,review,layout,format:templates.join(' · ')||null}
}
