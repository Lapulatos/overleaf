import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import * as requests from '@/infrastructure/fetch-json'
import SubmissionDeadlines,{type Venue} from '@/features/plugins/submission-deadlines'
const venues=[{id:'j1',title:'First Journal',description:'Old fit',kind:'journal',area:'SE',rank:'A',events:[]},{id:'j2',title:'Second Journal',description:'Better fit',kind:'journal',area:'SE',rank:'B',events:[]}] as Venue[]
const result=(better=false)=>({paperSummary:better?'Current manuscript: verification study':'Earlier manuscript',limitations:[],recommendations:venues.map((venue,i)=>({venue,score:better?(i?98:60):(i?70:90),reason:better?'Fits the verification method in main.tex':'Old evidence',sources:[]}))})
const task=(taskId:string,status='completed')=>({taskId,status,instruction:'recommend',summary:'',output:'',proposals:[]})
function setup(newResult:Promise<unknown>,cached=false){
 if(cached)localStorage.setItem('venue-recommendations:project','old')
 localStorage.setItem('submission-sequence:project',JSON.stringify({reviews:{},chosen:['j1']}))
 sinon.stub(requests,'getJSON').callsFake(async (url:unknown)=>String(url).endsWith('/old')?{task:task('old'),result:result()}:String(url).endsWith('/new')?newResult:String(url).includes('/detail?')?{venue:venues[0],sources:[],requirements:[],templates:[],submission:[]}:String(url).includes('/metrics')?{entries:{}}:{venues,fetched:Date.now(),stale:false})
 render(<SubmissionDeadlines workspace projectId="project" onBack={()=>{}}/>)
 fireEvent.click(screen.getByRole('button',{name:'Submission Plan'}))
}
describe('AI planning action',()=>{
 afterEach(()=>{sinon.restore();localStorage.clear()})
 it('refreshes manuscript analysis on explicit AI action even when an older result exists',async()=>{
  const post=sinon.stub(requests,'postJSON').resolves({task:task('new')});setup(Promise.resolve({task:task('new'),result:result(true)}),true)
  await screen.findByRole('combobox',{name:'Target 1'});fireEvent.change(screen.getByLabelText('Planning horizon'),{target:{value:'18'}})
  fireEvent.click(screen.getByLabelText('Allow Warning Conflict'));expect(post.called).to.equal(false)
  fireEvent.click(screen.getByRole('button',{name:'Generate submission plan'}))
  await waitFor(()=>expect(post.callCount).to.equal(1))
  await waitFor(()=>expect((screen.getByRole('combobox',{name:'Target 1'}) as HTMLSelectElement).value).to.include('Second Journal'))
  expect(post.firstCall.args[1]?.body.planning).to.include({months:18,allowWarning:false})
  expect(screen.queryByLabelText('Months')).to.equal(null)
  expect(screen.getByRole('button',{name:'Generate submission plan'}).textContent).to.include('Suggest with AI')
  expect(screen.getByLabelText('Allow Warning Conflict').closest('.sequence-review-toggles')).not.to.equal(null)
 })
 it('entering Plan only reads cached status and never shows AI busy while that read is pending',async()=>{
  let finish!:(value:unknown)=>void;const pending=new Promise(resolve=>{finish=resolve})
  localStorage.setItem('venue-recommendations:project','old')
  const post=sinon.stub(requests,'postJSON')
  sinon.stub(requests,'getJSON').callsFake(async(url:unknown)=>String(url).endsWith('/old')?pending:String(url).includes('/metrics')?{entries:{}}:{venues,fetched:Date.now(),stale:false})
  render(<SubmissionDeadlines workspace projectId="project" onBack={()=>{}}/> )
  fireEvent.click(screen.getByRole('button',{name:'Submission Plan',exact:true}))
  expect(screen.getByRole('button',{name:'Generate submission plan'}).textContent).to.include('Suggest with AI');expect(post.called).to.equal(false)
  finish({task:task('old'),result:result()});await screen.findByRole('combobox',{name:'Target 1'})
  fireEvent.click(screen.getByRole('button',{name:'Card',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Submission Plan',exact:true}));expect(post.called).to.equal(false)
 })
 it('starts manuscript AI once, preserves plan while running, applies fresh fit without the removed explanation panels',async()=>{
  let finish!:(value:unknown)=>void;const pending=new Promise(resolve=>{finish=resolve})
  const post=sinon.stub(requests,'postJSON').resolves({task:task('new','running')});setup(pending)
  await screen.findByRole('button',{name:'Generate submission plan'});expect(post.called).to.equal(false)
  fireEvent.click(screen.getByRole('button',{name:'Generate submission plan'}))
  await waitFor(()=>expect(post.callCount).to.equal(1));expect(post.firstCall.args[0]).to.equal('/writing-assist/project/project/venue-recommendations');expect(post.firstCall.args[1]?.body).to.have.property('planning').that.includes({months:12,allowWarning:true,active:false})
  expect(JSON.parse(localStorage.getItem('submission-sequence:project')!).chosen).to.deep.equal(['j1'])
  await screen.findByRole('button',{name:'Analyzing manuscript…'});expect((screen.getByRole('button',{name:'Analyzing manuscript…'}) as HTMLButtonElement).disabled).to.equal(true)
  expect(screen.getByRole('button',{name:'Analyzing manuscript…'}).querySelector('.venue-busy-indicator')).not.to.equal(null)
  finish({task:task('new'),result:result(true)})
  await waitFor(()=>expect((screen.getByRole('combobox',{name:'Target 1'}) as HTMLSelectElement).value).to.include('Second Journal'))
  expect(JSON.parse(localStorage.getItem('submission-sequence:project')!).chosen.length).to.be.greaterThan(2)
  expect(screen.queryByText('Current manuscript: verification study')).to.equal(null);expect(screen.queryByText('Manuscript analysis & recommendation reasons')).to.equal(null)
  fireEvent.click(screen.getByRole('button',{name:'Card',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Submission Plan',exact:true}));expect(post.callCount).to.equal(1)
 })
 it('applies a completed suggestion once when returning from another view',async()=>{
  let finish!:(value:unknown)=>void;const pending=new Promise(resolve=>{finish=resolve})
  sinon.stub(requests,'postJSON').resolves({task:task('new','running')});setup(pending)
  await screen.findByRole('button',{name:'Generate submission plan'});fireEvent.click(screen.getByRole('button',{name:'Generate submission plan'}));await screen.findByRole('button',{name:'Analyzing manuscript…'})
  fireEvent.click(screen.getByRole('button',{name:'Card',exact:true}));finish({task:task('new'),result:result(true)})
  await waitFor(()=>expect(screen.queryByRole('button',{name:'Analyzing manuscript…'})).to.equal(null))
  fireEvent.click(screen.getByRole('button',{name:'Submission Plan',exact:true}));await waitFor(()=>expect((screen.getByRole('combobox',{name:'Target 1'}) as HTMLSelectElement).value).to.include('Second Journal'))
  fireEvent.click(screen.getByRole('combobox',{name:'Target 1'}));fireEvent.click(screen.getByRole('option',{name:/First Journal/}));fireEvent.click(screen.getByRole('button',{name:'Card',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Submission Plan',exact:true}));expect(JSON.parse(localStorage.getItem('submission-sequence:project')!).chosen[0].split('::plan:')[0]).to.equal('j1')
 })
 it('keeps saved choices when AI request fails',async()=>{
  sinon.stub(requests,'postJSON').rejects(new Error('Model unavailable'));setup(Promise.resolve({}))
  await screen.findByRole('button',{name:'Generate submission plan'});fireEvent.click(screen.getByRole('button',{name:'Generate submission plan'}))
  await waitFor(()=>expect(screen.getAllByText(/Model unavailable/).length).to.be.greaterThan(0))
  expect(JSON.parse(localStorage.getItem('submission-sequence:project')!).chosen).to.deep.equal(['j1'])
 })
 it('keeps the plan when AI finds no suitable candidate',async()=>{
  sinon.stub(requests,'postJSON').resolves({task:task('new')});setup(Promise.resolve({task:task('new'),result:{paperSummary:'Insufficient evidence',recommendations:[],limitations:['No suitable venue']}}))
  await screen.findByRole('button',{name:'Generate submission plan'});fireEvent.click(screen.getByRole('button',{name:'Generate submission plan'}))
  await screen.findByText(/AI found no suitable venues/);expect(JSON.parse(localStorage.getItem('submission-sequence:project')!).chosen).to.deep.equal(['j1'])
 })
})

describe('Plan venue details navigation',()=>{
 afterEach(()=>{sinon.restore();localStorage.clear()})
 it('shows metadata and returns to the saved Plan without rerunning AI',async()=>{
  const post=sinon.stub(requests,'postJSON');setup(Promise.resolve({}),true)
  await screen.findByRole('button',{name:'Details'});expect(screen.getByRole('button',{name:'Details'}).closest('header')).not.to.equal(null)
  expect(screen.getAllByText('CCF A').length).to.be.greaterThan(0)
  const before=localStorage.getItem('submission-sequence:project')
  fireEvent.click(screen.getByRole('button',{name:'Details'}))
  fireEvent.click(await screen.findByRole('button',{name:/Back to plan/}))
  await screen.findByRole('combobox',{name:'Target 1'})
  expect(localStorage.getItem('submission-sequence:project')).to.equal(before);expect(post.called).to.equal(false)
 })
})

describe('Completed /plan handoff',()=>{
 afterEach(()=>{sinon.restore();localStorage.clear()})
 it('applies command settings and results to an already open Plan without another AI call',async()=>{
  const post=sinon.stub(requests,'postJSON');setup(Promise.resolve({task:task('new'),result:result(true)}))
  await screen.findByLabelText('Planning horizon')
  const saved=JSON.parse(localStorage.getItem('submission-sequence:project')!);localStorage.setItem('submission-sequence:project',JSON.stringify({...saved,months:18,gap:5,mode:'journal'}))
  localStorage.setItem('paper-plan-result:project',JSON.stringify(result(true)))
  fireEvent(window,new Event('paper-open-plan'))
  await waitFor(()=>expect((screen.getByLabelText('Planning horizon') as HTMLSelectElement).value).to.equal('18'))
  await waitFor(()=>expect((screen.getByRole('combobox',{name:'Target 1'}) as HTMLSelectElement).value).to.include('Second Journal'))
  expect(post.called).to.equal(false);expect(localStorage.getItem('paper-plan-result:project')).to.equal(null)
 })
})
