import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { ApplicationInspection } from '@/features/source-editor/extensions/writing-assist/application-inspection'
import { AgentTaskResult, type Task } from '@/features/source-editor/extensions/writing-assist/agent-task-result'
const url='/writing-assist/project/project/tasks/task/proposals/proposal/inspection'
const result={checkedAt:'2026-11-11T00:00:00Z',workspaceMatches:false,comparison:'matches-proposal',baseline:{content:'Old text'},proposed:{content:'New text'},current:{path:'main.tex',version:4,content:'New text'}}
describe('interrupted AI write inspection',()=>{
 afterEach(()=>{cleanup();fetchMock.removeRoutes().clearHistory()})
 it('fetches only on demand and offers evidence without retry or settlement',async()=>{
  fetchMock.get(url,result)
  render(<ApplicationInspection projectId="project" taskId="task" proposalId="proposal" />)
  expect(fetchMock.callHistory.called(url)).to.equal(false)
  fireEvent.click(screen.getByRole('button',{name:'Inspect write'}))
  await screen.findByText('Current text matches the proposed text.')
  expect(screen.getByRole('alert').textContent).to.contain('workspace has changed')
  expect(screen.getByText(/Matching text does not prove/)).to.exist
  expect(screen.queryByRole('button',{name:'Accept change'})).to.equal(null)
  expect(screen.queryByRole('button',{name:/Retry/})).to.equal(null)
  expect(fetchMock.callHistory.calls().every(call=>String(call.options.method).toUpperCase()==='GET')).to.equal(true)
 })
 it('clears previous result and download when refreshed access fails',async()=>{
  let allowed=true;fetchMock.get(url,()=>allowed?result:403)
  render(<ApplicationInspection projectId="project" taskId="task" proposalId="proposal" />)
  fireEvent.click(screen.getByRole('button',{name:'Inspect write'}));await screen.findByText('Current text matches the proposed text.')
  allowed=false;fireEvent.click(screen.getByRole('button',{name:'Inspect again'}))
  await screen.findByText(/Inspection unavailable/)
  expect(screen.queryByText('Current text matches the proposed text.')).to.equal(null)
  expect((screen.getByRole('button',{name:'Download recovery snapshot'}) as HTMLButtonElement).disabled).to.equal(true)
 })
 it('shows server acknowledgement separately from unresolved task settlement',async()=>{
  fetchMock.get(url,{...result,acknowledgement:{state:'server-acknowledged',acknowledgedAt:'2026-11-11T01:00:00Z'}})
  render(<ApplicationInspection projectId="project" taskId="task" proposalId="proposal" />)
  fireEvent.click(screen.getByRole('button',{name:'Inspect write'}))
  await screen.findByText(/The document service acknowledged this operation/)
  expect(screen.getByText(/Final task settlement remains unconfirmed/)).to.exist
  expect(screen.queryByRole('button',{name:/Retry/})).to.equal(null)
 })
 for(const status of ['applying','uncertain'] as const)it(`renders inspection for ${status} task card`,async()=>{
  fetchMock.get(url,result)
  const task:Task={projectId:'project',taskId:'task',status:'completed',instruction:'Edit',summary:'Result',output:'',proposals:[{id:'proposal',path:'main.tex',before:'Old text',after:'New text',status}]}
  render(<AgentTaskResult task={task} busy={false} act={()=>{throw Error('must not write')}} />)
  fireEvent.click(screen.getByRole('button',{name:'Inspect write'}));await screen.findByText('Current text matches the proposed text.')
 })
 it('requires explicit confirmation and reports recovered status without document writes',async()=>{
  fetchMock.get(url,{...result,acknowledgement:{state:'server-acknowledged',acknowledgedAt:'2026-11-11T01:00:00Z'}})
  const recoveryUrl=url.replace('/inspection','/recover')
  fetchMock.post(recoveryUrl,{proposals:[{id:'proposal',status:'accepted'}]})
  let recovered=0
  render(<ApplicationInspection projectId="project" taskId="task" proposalId="proposal" onRecovered={()=>recovered++} />)
  fireEvent.click(screen.getByRole('button',{name:'Inspect write'}))
  const confirm=await screen.findByRole('button',{name:'Confirm acknowledged write'})
  expect(fetchMock.callHistory.called(recoveryUrl)).to.equal(false)
  fireEvent.click(confirm)
  await screen.findByText('Task recovery confirmed. The document was not rewritten.')
  expect(recovered).to.equal(1)
  expect(fetchMock.callHistory.calls().length).to.equal(2)
  expect(screen.queryByRole('button',{name:'Confirm acknowledged write'})).to.equal(null)
 })
 it('clears acknowledgement when recovery fails and requires inspection again',async()=>{
  fetchMock.get(url,{...result,acknowledgement:{state:'server-acknowledged',acknowledgedAt:'2026-11-11T01:00:00Z'}})
  fetchMock.post(url.replace('/inspection','/recover'),409)
  render(<ApplicationInspection projectId="project" taskId="task" proposalId="proposal" onRecovered={()=>{throw Error('must not confirm')}} />)
  fireEvent.click(screen.getByRole('button',{name:'Inspect write'}))
  fireEvent.click(await screen.findByRole('button',{name:'Confirm acknowledged write'}))
  await screen.findByText(/Task recovery could not be confirmed/)
  expect(screen.queryByRole('button',{name:'Confirm acknowledged write'})).to.equal(null)
 })

 it('ignores a late confirmation after closing the inspection',async()=>{
  fetchMock.get(url,{...result,acknowledgement:{state:'server-acknowledged',acknowledgedAt:'2026-11-11T01:00:00Z'}})
  let finish!: (value: object) => void
  fetchMock.post(url.replace('/inspection','/recover'),()=>new Promise(resolve=>{finish=resolve}))
  let recovered=0
  render(<ApplicationInspection projectId="project" taskId="task" proposalId="proposal" onRecovered={()=>recovered++} />)
  fireEvent.click(screen.getByRole('button',{name:'Inspect write'}))
  fireEvent.click(await screen.findByRole('button',{name:'Confirm acknowledged write'}))
  fireEvent.click(screen.getByRole('button',{name:'Close inspection'}))
  await act(async()=>{finish({proposals:[{id:'proposal',status:'accepted'}]});await new Promise(resolve=>setTimeout(resolve,0))})
  expect(recovered).to.equal(0)
 })

 it('passes the recovered task including specialized review back to its parent',async()=>{
  fetchMock.get(url,{...result,acknowledgement:{state:'server-acknowledged',acknowledgedAt:'2026-11-11T01:00:00Z'}})
  const task:Task={projectId:'project',taskId:'task',status:'completed',instruction:'Edit',summary:'Result',output:'',proposals:[{id:'proposal',path:'main.tex',before:'Old text',after:'New text',status:'uncertain'}]}
  const recovered={...task,summary:'Applied checked fields.',proposals:[{...task.proposals[0],status:'accepted'}],referenceReview:{appliedCount:1,entries:[]}}
  fetchMock.post(url.replace('/inspection','/recover'),recovered)
  let returned:Task|undefined
  render(<AgentTaskResult task={task} busy={false} act={()=>{throw Error('must not write')}} onRecovered={value=>{returned=value}} />)
  fireEvent.click(screen.getByRole('button',{name:'Inspect write'}))
  fireEvent.click(await screen.findByRole('button',{name:'Confirm acknowledged write'}))
  await screen.findByText('Status: accepted')
  expect(returned).to.deep.equal(recovered)
 })

 it('closes only after explicit decision with reviewed fingerprint, without claiming success',async()=>{
  const fingerprint='a'.repeat(64)
  fetchMock.get(url,{...result,status:'uncertain',fingerprint,acknowledgement:null})
  const closeUrl=url.replace('/inspection','/close-unconfirmed')
  fetchMock.post(closeUrl,{taskId:'task',projectId:'project',proposals:[{id:'proposal',status:'closed-unconfirmed'}]})
  render(<ApplicationInspection projectId="project" taskId="task" proposalId="proposal" />)
  fireEvent.click(screen.getByRole('button',{name:'Inspect write'}))
  const close=await screen.findByRole('button',{name:'Close without retry'})
  expect(fetchMock.callHistory.called(closeUrl)).to.equal(false)
  fireEvent.click(close)
  await screen.findByText('Closed without retry. The earlier write outcome remains unconfirmed; evidence is retained.')
  expect(screen.queryByText('Task recovery confirmed. The document was not rewritten.')).to.equal(null)
  const call=fetchMock.callHistory.calls(closeUrl)[0]
  expect(JSON.parse(String(call.options.body))).to.deep.equal({fingerprint,decision:'close-without-retry'})
  expect(screen.queryByRole('button',{name:'Close without retry'})).to.equal(null)
 })
 it('keeps closed-unconfirmed evidence inspectable without another closure action',async()=>{
  fetchMock.get(url,{...result,status:'closed-unconfirmed',fingerprint:'b'.repeat(64),acknowledgement:null})
  render(<ApplicationInspection projectId="project" taskId="task" proposalId="proposal" />)
  fireEvent.click(screen.getByRole('button',{name:'Inspect write'}))
  await screen.findByText('Closed without retry. The earlier write outcome remains unconfirmed; evidence is retained.')
  expect(screen.queryByRole('button',{name:'Close without retry'})).to.equal(null)
  expect((screen.getByRole('button',{name:'Download recovery snapshot'}) as HTMLButtonElement).disabled).to.equal(false)
 })

})
