import * as workspace from '@/features/plugins/venue-workspace'
import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react'
import * as requests from '@/infrastructure/fetch-json'
import {parsePlanCommand,usePlanCommand,planResultKey} from '@/features/plugins/plan-command'
const project='6ae8c19a1bd2fd256c96e759',other='aaaaaaaaaaaaaaaaaaaaaaaa'
function Harness(){const command=usePlanCommand(project);return <><output aria-label="Running">{String(command.running)}</output><button onClick={()=>void command.start('/plan 18 months, high-quality venues')}>Start</button>{command.panel}</>}
describe('/plan command',()=>{
 beforeEach(()=>sinon.stub(workspace,'hydrateVenueWorkspace').resolves({userId:'user',plan:null,favorites:null,recommendation:null}))
 afterEach(()=>{cleanup();sinon.restore();localStorage.clear()})
 it('defaults to current project, accepts a project ID, and rejects malformed IDs',()=>{
  expect(parsePlanCommand('/PLAN Prefer CCF A',project)).to.deep.equal({projectId:project,requirements:'Prefer CCF A'})
  expect(parsePlanCommand('/plan project='+other+' journals only',project)).to.deep.equal({projectId:other,requirements:'journals only'})
  expect(()=>parsePlanCommand('/plan project=../private',project)).to.throw('24-character')
  expect(parsePlanCommand('/venues browse',project)).to.equal(null)
 })
 it('starts once, sends user requirements, saves planning options, and opens the completed result',async()=>{
  const post=sinon.stub(requests,'postJSON').resolves({task:{taskId:'task-1',status:'running'}} as any)
  sinon.stub(requests,'getJSON').resolves({task:{taskId:'task-1',status:'completed'},result:{paperSummary:'Read draft',recommendations:[],limitations:[],planning:{months:18,mode:'journal',gapDays:5}}} as any)
  const opened=sinon.spy();window.addEventListener('paper-open-plan',opened)
  render(<Harness/>);fireEvent.click(screen.getByText('Start'))
  await waitFor(()=>expect(opened.callCount).to.equal(1));window.removeEventListener('paper-open-plan',opened)
  expect(post.callCount).to.equal(1);expect(post.firstCall.args[0]).to.equal('/writing-assist/project/'+project+'/venue-recommendations')
  expect((post.firstCall.args[1] as any).body.requirements).to.include('18 months')
  expect(JSON.parse(localStorage.getItem('submission-sequence:'+project)!).months).to.equal(18)
  expect(JSON.parse(localStorage.getItem('submission-sequence:'+project)!).gap).to.equal(5)
  expect(localStorage.getItem(planResultKey(project))).to.include('Read draft')
 })
 it('shows live execution messages and tool activity',async()=>{
  sinon.stub(requests,'postJSON').resolves({task:{taskId:'live',status:'running'}} as any)
  sinon.stub(requests,'getJSON').resolves({task:{taskId:'live',status:'running',output:'Comparing suitable tracks',activity:[{id:'read',kind:'tool',title:'Read manuscript',status:'completed'},{id:'msg',kind:'message',text:'The draft presents a verification tool.',status:'completed'}]}} as any)
  render(<Harness/>);fireEvent.click(screen.getByText('Start'))
  await screen.findByText('Read manuscript');expect(screen.getByText('The draft presents a verification tool.')).to.exist
  expect(screen.getByText('Comparing suitable tracks')).to.exist
 })
 it('releases running state on poll failure and retries the same task',async()=>{
  const post=sinon.stub(requests,'postJSON').resolves({task:{taskId:'recover',status:'running'}} as any)
  const get=sinon.stub(requests,'getJSON');get.onFirstCall().rejects(new Error('Connection lost'));get.onSecondCall().resolves({task:{taskId:'recover',status:'completed',summary:'Done'},result:{recommendations:[]}} as any)
  render(<Harness/>);fireEvent.click(screen.getByText('Start'))
  await screen.findByText('Connection lost');expect(screen.getByLabelText('Running').textContent).to.equal('false')
  fireEvent.click(screen.getByText('Retry status'));await screen.findByText('Submission plan is ready.')
  expect(post.callCount).to.equal(1);expect(get.firstCall.args[0]).to.equal(get.secondCall.args[0])
 })
 it('does not poll forever after completion without a result',async()=>{
  sinon.stub(requests,'postJSON').resolves({task:{taskId:'empty',status:'running'}} as any)
  sinon.stub(requests,'getJSON').resolves({task:{taskId:'empty',status:'completed'}} as any)
  render(<Harness/>);fireEvent.click(screen.getByText('Start'))
  await screen.findByText(/Planning finished without a usable result/)
  expect(screen.getByLabelText('Running').textContent).to.equal('false')
 })

})
