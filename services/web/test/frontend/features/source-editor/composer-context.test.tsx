import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { GoalPanel } from '@/features/source-editor/extensions/writing-assist/goal-panel'
import { ConversationView } from '@/features/source-editor/extensions/writing-assist/conversation-panel'
const base='/writing-assist/project/project/conversations'
const conversation={id:'thread',title:'Test',activeTaskId:null,turns:[]}
describe('Composer context and goal controls',function(){
 beforeEach(function(){
  fetchMock.get('/writing-assist/plugins',{plugins:[{id:'s',command:'audit',name:'Audit',description:'Check a paper',enabled:true}]})
  fetchMock.get('/writing-assist/project/project/speech',{available:false})
  fetchMock.get('/writing-assist/project/project/context',[{kind:'folder',path:'tex'},{kind:'file',path:'tex/main.tex'}])
  fetchMock.get(base,[conversation]);fetchMock.get(base+'/thread',{conversation,task:null});fetchMock.get(base+'/thread/goal',{goal:null,task:null},{name:'goal-status'})
 })
 afterEach(function(){cleanup();fetchMock.removeRoutes().clearHistory()})
 it('adds scope and Skill chips using mentions and submits structured context',async function(){
  fetchMock.post(base+'/thread/messages',{conversation,task:null})
  render(<ConversationView projectId="project"/>);await waitFor(()=>{expect((screen.getByLabelText('Conversation',{exact:true}) as HTMLSelectElement).value).to.equal('thread');expect((screen.getByLabelText('Instructions') as HTMLTextAreaElement).disabled).to.equal(false)})
  fireEvent.click(screen.getByRole('button',{name:'Mention files or folders'}))
  fireEvent.click(await screen.findByRole('option',{name:'tex/'}))
  expect(screen.getByRole('button',{name:'Remove scope tex'})).to.exist
  fireEvent.click(screen.getByRole('button',{name:'Skills and commands'}));fireEvent.click(await screen.findByRole('option',{name:'audit'}))
  expect(screen.getByRole('button',{name:'Remove Skill audit'})).to.exist
  fireEvent.change(screen.getByLabelText('Instructions'),{target:{value:'Check this folder'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}))
  await waitFor(()=>expect(fetchMock.callHistory.calls(base+'/thread/messages')).to.have.length(1))
  const body=JSON.parse(fetchMock.callHistory.calls(base+'/thread/messages')[0].options.body as string);expect(body.scope).to.deep.equal([{kind:'folder',path:'tex'}]);expect(body.skills).to.deep.equal(['audit']);expect(body.instruction).to.equal('Check this folder')
 })
 it('starts an explicit automatic goal instead of a normal message',async function(){
  fetchMock.post(base+'/thread/goal',{goal:{status:'active'},task:null})
  render(<ConversationView projectId="project"/>);await waitFor(()=>{expect((screen.getByLabelText('Conversation',{exact:true}) as HTMLSelectElement).value).to.equal('thread');expect((screen.getByLabelText('Instructions') as HTMLTextAreaElement).disabled).to.equal(false)})
  fireEvent.change(screen.getByLabelText('Instructions'),{target:{value:'/goal Finish this objective'}});fireEvent.change(screen.getByLabelText('Review mode'),{target:{value:'ai'}})
  expect(screen.queryByRole('button',{name:'Set a goal'})).to.equal(null)
  fireEvent.change(screen.getByLabelText('Instructions'),{target:{value:'/goal Finish this objective'}});fireEvent.click(screen.getByRole('button',{name:'Start goal'}))
  await waitFor(()=>expect(fetchMock.callHistory.calls(base+'/thread/goal').filter(c=>c.options.method?.toUpperCase()==='POST')).to.have.length(1))
  const call=fetchMock.callHistory.calls(base+'/thread/goal').find(c=>c.options.method?.toUpperCase()==='POST')!;expect(JSON.parse(call.options.body as string)).to.include({objective:'Finish this objective',reviewMode:'ai'});expect(fetchMock.callHistory.calls(base+'/thread/messages')).to.have.length(0)
 })
 it('keeps expanded goal activity inside the transcript and allows drafting while running',async function(){
  fetchMock.modifyRoute('goal-status',{response:{goal:{_id:'g',objective:'Check punctuation',status:'active',stage:'work',steps:2,reviewMode:'ai',reason:'Working',elapsedMs:12000,runningSince:null},task:{taskId:'w',status:'running',instruction:'Internal orchestration instructions',output:'Inspecting main.tex',summary:'',proposals:[]}}})
  render(<ConversationView projectId="project" dock/>);fireEvent.click(screen.getByRole('button',{name:/Conversation & changes/}));
  const goal=await screen.findByRole('region',{name:'Persistent goal'});
  expect(goal.closest('.paper-conversation-content')).not.to.equal(null)
  expect(screen.queryByText('Internal orchestration instructions')).to.equal(null)
  const input=screen.getByLabelText('Instructions') as HTMLTextAreaElement;
  await waitFor(()=>expect(input.disabled).to.equal(false));fireEvent.change(input,{target:{value:'A draft for later'}});expect(input.value).to.equal('A draft for later')
  expect(screen.getByText(/2 rounds completed/)).to.exist;expect(screen.getByLabelText('Goal execution time').closest('.paper-conversation-content')).to.equal(null);expect(screen.getByText(/Elapsed 00:00:12/)).to.exist;expect(screen.queryByRole('button',{name:'Stop goal'})).to.equal(null)
 })
 it('routes /Resume Goal to a fresh goal run without sending a normal message',async function(){
  fetchMock.post(base+'/thread/goal/action',{goal:null,task:null})
  render(<ConversationView projectId="project"/>);await waitFor(()=>{expect((screen.getByLabelText('Conversation',{exact:true}) as HTMLSelectElement).value).to.equal('thread');expect((screen.getByLabelText('Instructions') as HTMLTextAreaElement).disabled).to.equal(false)})
  fireEvent.change(screen.getByLabelText('Instructions'),{target:{value:'/Resume Goal'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}))
  await waitFor(()=>expect(fetchMock.callHistory.calls(base+'/thread/goal/action')).to.have.length(1));expect(JSON.parse(fetchMock.callHistory.calls(base+'/thread/goal/action')[0].options.body as string)).to.deep.equal({action:'resume'});expect(fetchMock.callHistory.calls(base+'/thread/messages')).to.have.length(0)
 })

 it('loads earlier automatic changes as read-only diffs and command activity',async function(){
  fetchMock.modifyRoute('goal-status',{response:{goal:{_id:'g',objective:'Check punctuation',status:'completed',stage:'work',steps:1,reviewMode:'ai',reason:'Done',recent:[{taskId:'previous',summary:'Corrected punctuation',review:{reason:'Verified before applying'},changes:[{path:'main.tex',status:'accepted'}]}]},task:null}})
  fetchMock.get('/writing-assist/project/project/tasks/previous',{taskId:'previous',status:'completed',instruction:'Internal prompt',summary:'Corrected punctuation',output:'',proposals:[{id:'p',path:'main.tex',before:'Old punctuation;\n',after:'New punctuation,\n',status:'accepted'}],activity:[{id:'cmd',kind:'command',title:'Inspect punctuation',command:'Read main.tex',output:'Checked 10 lines',status:'completed'}]})
  render(<GoalPanel projectId="project" conversationId="thread" onState={()=>{}}/>);
  await screen.findByText('Recent progress')
  await screen.findByRole('list',{name:'Execution timeline'});expect(screen.getByText('Read main.tex')).to.exist;expect(screen.getByText('Checked 10 lines')).to.exist;expect(document.querySelector('.paper-task-result')?.textContent).to.include('Old punctuation;');expect(document.querySelector('.paper-task-result')?.textContent).to.include('New punctuation,')
  expect(screen.queryByRole('button',{name:'Accept change'})).to.equal(null)
 })

 it('allows /stop goal while a goal is running and keeps commands out of normal messages',async function(){
  fetchMock.modifyRoute('goal-status',{response:{goal:{_id:'g',objective:'Running',status:'active',stage:'work',steps:0,reviewMode:'ai'},task:null}})
  fetchMock.post(base+'/thread/goal/action',{goal:null,task:null})
  render(<ConversationView projectId="project"/>);await screen.findByText('Running',{exact:true});fireEvent.change(screen.getByLabelText('Instructions'),{target:{value:'/stop goal'}});fireEvent.click(screen.getByRole('button',{name:'Send message'}));await waitFor(()=>expect(fetchMock.callHistory.calls(base+'/thread/goal/action')).to.have.length(1));expect(JSON.parse(fetchMock.callHistory.calls(base+'/thread/goal/action')[0].options.body as string).action).to.equal('stop')
 })

 it('offers plan usage and inserts the current project ID without submitting',async()=>{
  render(<ConversationView projectId="project"/>);await waitFor(()=>expect((screen.getByLabelText('Instructions') as HTMLTextAreaElement).disabled).to.equal(false))
  const input=screen.getByLabelText('Instructions');fireEvent.change(input,{target:{value:'/plan',selectionStart:5}});fireEvent.select(input,{target:{selectionStart:5}})
  fireEvent.click(await screen.findByRole('option',{name:'plan · project ID'}));expect((input as HTMLTextAreaElement).value).to.equal('/plan project=project ')
  expect(fetchMock.callHistory.calls(base+'/thread/messages')).to.have.length(0)
 })

})
