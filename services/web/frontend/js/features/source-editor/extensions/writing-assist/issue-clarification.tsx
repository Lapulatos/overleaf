import {createContext,useContext,useRef,useState} from 'react'
export type IssueQuestion={id:string;summary:string;questions:string[]}
type ReplyContext={key:string;disabled:boolean;submit:(instruction:string)=>Promise<void>}
export const IssueReplyContext=createContext<ReplyContext|null>(null)
const issueId=/^TCR-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}-I[1-9][0-9]{0,2}$/
export function issueClarifications(text:string){
 const requests:IssueQuestion[]=[];const seen=new Set<string>()
 function consume(raw:string){
  let data;try{data=JSON.parse(raw)}catch{return false}
  if(!Array.isArray(data?.issueOutcomes)||!data.issueOutcomes.length||data.issueOutcomes.some((v:any)=>!issueId.test(v?.id)||!['verified','proposed','needs-human','unresolved'].includes(v.status)||!Array.isArray(v.blockers)||v.blockers.some((q:unknown)=>typeof q!=='string')))return false
  for(const value of data.issueOutcomes){if(value.status==='verified'||seen.has(value.id))continue;seen.add(value.id);const questions=value.blockers.filter((q:string)=>q.trim()).slice(0,10).map((q:string)=>q.slice(0,1500));if(questions.length)requests.push({id:value.id,summary:typeof value.summary==='string'?value.summary.slice(0,3000):'',questions})}
  return true
 }
 const content=text.replace(/```(?:json)?\s*([\s\S]*?)```/g,(block,raw)=>consume(raw)?'':block)
 const clean=consume(content.trim())?'':content.trim()
 return {text:clean,requests}
}
function requestKey(context:string,request:IssueQuestion){let hash=2166136261;for(const c of JSON.stringify(request))hash=Math.imul(hash^c.charCodeAt(0),16777619);return `issue-reply:${context}:${request.id}:${hash>>>0}`}
function QuestionForm({request,context}:{request:IssueQuestion;context:ReplyContext}){
 const key=requestKey(context.key,request)
 const [answers,setAnswers]=useState<string[]>(()=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');if(Array.isArray(value?.answers)&&value.answers.length===request.questions.length&&value.answers.every((a:unknown)=>typeof a==='string'))return value.answers}catch{}return request.questions.map(()=> '')})
 const [sent,setSent]=useState(()=>{try{return JSON.parse(localStorage.getItem(key)||'null')?.sent===true}catch{return false}})
 const [sending,setSending]=useState(false);const [error,setError]=useState('');const lock=useRef(false)
 function update(index:number,value:string){const next=answers.map((a,i)=>i===index?value:a);setAnswers(next);try{localStorage.setItem(key,JSON.stringify({answers:next,sent:false}))}catch{}}
 async function submit(){if(lock.current||context.disabled||answers.some(a=>!a.trim()))return;lock.current=true;setSending(true);setError('');try{
  const instruction=`/resolve-issue ${request.id}\n\nUser clarification:\n${request.questions.map((question,i)=>`${i+1}. Question: ${question}\nAnswer: ${answers[i].trim()}`).join('\n\n')}\n\nContinue investigating this issue using these answers. Distinguish my statements from independently verified evidence. Ask targeted follow-up questions if necessary; do not mark unresolved technical checks as verified merely because I replied.`
  if(instruction.length>30000)throw Error('Please shorten the answers before sending.')
  await context.submit(instruction);setSent(true);try{localStorage.setItem(key,JSON.stringify({answers,sent:true}))}catch{}
 }catch(e){setError(e instanceof Error?e.message:'Could not send your answers. Please try again.')}finally{lock.current=false;setSending(false)}}
 return <section className="paper-issue-clarification" aria-label={`Clarification ${request.id}`}><header><strong>{sent?'Your response':'Your input is needed'}</strong><code>{request.id}</code></header>{request.summary&&<p>{request.summary}</p>}{sent?<><dl>{request.questions.map((q,i)=><div key={i}><dt>{q}</dt><dd>{answers[i]}</dd></div>)}</dl><div className="paper-issue-reply-actions"><span role="status">Answers sent · continued in this conversation.</span><button type="button" disabled={context.disabled} onClick={()=>setSent(false)}>Update answer</button></div></>:<form onSubmit={e=>{e.preventDefault();void submit()}}>{request.questions.map((question,i)=><label key={i}><span>{question}</span><textarea rows={3} maxLength={2400} value={answers[i]} disabled={context.disabled||sending} placeholder="Provide the information relevant to this question…" onChange={e=>update(i,e.target.value)}/></label>)}<div className="paper-issue-reply-actions"><button type="submit" disabled={context.disabled||sending||answers.some(a=>!a.trim())}>{sending?'Sending…':'Submit answers & continue'}</button><span>Your answers are added to this conversation.</span></div>{error&&<p role="alert">{error}</p>}</form>}</section>
}
export function IssueClarificationForms({requests}:{requests:IssueQuestion[]}){const context=useContext(IssueReplyContext);if(!context)return null;return <>{requests.map(request=><QuestionForm key={requestKey(context.key,request)} request={request} context={context}/>)}</>}
