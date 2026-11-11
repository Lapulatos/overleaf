import {submissionStatus} from '@/features/plugins/venue-status'
import VenueMetrics from '@/features/plugins/venue-metrics'
import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import * as requests from '@/infrastructure/fetch-json'
import SubmissionDeadlines,{type Venue} from '@/features/plugins/submission-deadlines'
import {sortVenues} from '@/features/plugins/venue-sort'
const a:Venue={id:'a',title:'AI Venue',description:'AI venue',kind:'conference',area:'AI',rank:'B',ranks:{ccf:'B',core:'A*',thcpl:'N'},year:2027,round:'Main',website:null,sourceUrl:'https://example.org',events:[{label:'Paper',original:'future',timezone:'UTC',utc:new Date(Date.now()+86400000*10).toISOString()}]}
const b:Venue={...a,events:[],id:'b',title:'Theory Venue',area:'CT',rank:'A',ranks:{ccf:'A',core:'B',thcpl:'A'}}
describe('Manuscript venue recommendations',function(){
 afterEach(function(){sinon.restore();localStorage.clear()})
 it('combines independent calendar and recommendation switches without rerunning on view changes',async function(){
  const task={taskId:'task',status:'completed',instruction:'recommend',summary:'',output:'',proposals:[]};const post=sinon.stub(requests,'postJSON').resolves({task});
  const result={paperSummary:'A learning-based method',limitations:['Coverage is limited'],recommendations:[{venue:a,score:95,reason:'Learning fit',sources:[]},{venue:b,score:70,reason:'Theory fit',sources:[]}]};
  sinon.stub(requests,'getJSON').callsFake(async(url:any)=>String(url).includes('/venue-recommendations/')?{task,result}:{venues:[a,b,{...b,id:'c',title:'Other journal',kind:'journal'}],fetched:Date.now(),stale:false});
  const {container}=render(<SubmissionDeadlines workspace projectId="project" onBack={()=>{}}/>);
  await screen.findByText('2 venues & rounds');expect((screen.getByLabelText('Window') as HTMLSelectElement).value).to.equal('90');fireEvent.change(screen.getByLabelText('Window'),{target:{value:'all'}});expect(screen.getByRole('button',{name:'Calendar',exact:true}).getAttribute('aria-pressed')).to.equal('true');expect(screen.queryByRole('region',{name:'Recommended venues'})).to.equal(null)
  fireEvent.click(screen.getByRole('button',{name:'Recommend',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Recommend venues',exact:true}));await screen.findByText('2 of 2 recommendations match filters');expect(screen.getByRole('button',{name:'Recommend',exact:true}).getAttribute('aria-pressed')).to.equal('true');const calendar=container.querySelector('.deadline-calendar')!;const cards=screen.getByRole('region',{name:'Recommended venues'});expect(calendar.compareDocumentPosition(cards)&Node.DOCUMENT_POSITION_FOLLOWING).to.not.equal(0)
  fireEvent.click(screen.getByRole('button',{name:'Calendar',exact:true}));await screen.findByRole('region',{name:'Recommended venues'});expect(container.querySelector('.deadline-calendar')).to.equal(null);expect(screen.getByRole('region',{name:'Recommended venues'}).querySelectorAll('.venue-recommendation-names button:not(.venue-location-link)')).to.have.length(2);expect(post.callCount).to.equal(1);expect(screen.getByLabelText('Window')).to.exist;fireEvent.change(screen.getByLabelText('Search venues'),{target:{value:'Theory'}});expect(screen.getByRole('region',{name:'Recommended venues'}).querySelectorAll('.venue-recommendation-names button:not(.venue-location-link)')).to.have.length(1);fireEvent.change(screen.getByLabelText('Search venues'),{target:{value:''}});expect(screen.queryByText('Manuscript analysis & recommendation notes')).to.equal(null)
  fireEvent.click(screen.getByRole('button',{name:'Re-recommend venues'}));await waitFor(()=>expect(post.callCount).to.equal(2));expect(screen.getByRole('region',{name:'Recommended venues'})).to.exist
  fireEvent.click(screen.getByRole('button',{name:'Calendar',exact:true}));expect(screen.getByRole('button',{name:'Recommend',exact:true}).getAttribute('aria-pressed')).to.equal('true')
  fireEvent.click(screen.getByRole('button',{name:'Recommend',exact:true}));expect(screen.getByRole('button',{name:'Calendar',exact:true}).getAttribute('aria-pressed')).to.equal('true');expect(screen.getByText('3 venues & rounds')).to.exist;expect(post.callCount).to.equal(2)
  fireEvent.click(screen.getByRole('button',{name:'Card'}));expect(container.querySelector('.deadline-cards-grid')).to.exist;expect(container.querySelector('.venue-row-timeline')).to.equal(null);expect(screen.queryByText(/Manuscript fit/)).to.equal(null);expect(screen.queryByText('Learning fit')).to.equal(null)
  fireEvent.click(screen.getByRole('button',{name:'Timeline'}));expect(container.querySelector('.venue-fit')).to.equal(null)
  fireEvent.click(screen.getByRole('button',{name:'Recommend',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Timeline'}));expect(screen.getByText('Learning fit')).to.exist
  fireEvent.click(screen.getByRole('button',{name:'Recommend',exact:true}));expect(screen.queryByText('Learning fit')).to.equal(null);expect(post.callCount).to.equal(2)
 })
 it('hides recommendation execution details from the planner',async function(){
  const task={taskId:'running',status:'running',instruction:'recommend',summary:'',output:'Reading abstract',proposals:[]};sinon.stub(requests,'postJSON').resolves({task});sinon.stub(requests,'getJSON').callsFake(async(url:any)=>String(url).includes('/venue-recommendations/')?{task}:{venues:[a,b],fetched:Date.now(),stale:false});
  render(<SubmissionDeadlines projectId="running-project" onBack={()=>{}}/>);fireEvent.click(screen.getByRole('button',{name:'Recommend',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Recommend venues'}));
  const busy=await screen.findByRole('button',{name:'Recommending…'});expect(busy.getAttribute('aria-busy')).to.equal('true');
  expect(screen.queryByText('Reading abstract')).to.equal(null);expect(screen.queryByText(/Recommendation activity/)).to.equal(null);expect(screen.queryByRole('button',{name:'Ask AI to shortlist'})).to.equal(null);
 })
 it('distinguishes closed papers, elapsed registration and unknown schedules',function(){
  const now=Date.parse('2026-11-03T00:00:00Z');const event=(label:string,utc:string)=>({label,utc,timezone:'UTC',original:utc});
  expect(submissionStatus({...a,events:[event('Paper','2026-09-25T00:00:00Z')],milestones:[event('Decision','2026-12-17T00:00:00Z')]},now).kind).to.equal('closed');
  expect(submissionStatus({...a,events:[event('Abstract','2026-11-01T00:00:00Z'),event('Paper','2026-11-12T00:00:00Z')]},now).kind).to.equal('gated');
  expect(submissionStatus({...a,events:[]},now).kind).to.equal('unknown');
  expect(submissionStatus({...a,events:[event('Paper','2026-11-03T00:00:00Z')]},now).kind).to.equal('closed');
 })
 it('shows dated publisher metrics only for the matching journal',function(){
  const {rerender}=render(<VenueMetrics venue={{...a,kind:'journal',id:'journal-csur'}}/>);
  expect(screen.getByText('JIF · 30.4 (2025)')).to.exist;expect(screen.queryByText('CAS division · Not verified')).to.equal(null);
  rerender(<VenueMetrics venue={{...a,id:'journal-csur'}}/>);expect(screen.queryByText('JIF · 30.4 (2025)')).to.equal(null);expect(screen.queryByText('EI proceedings · Not verified')).to.equal(null);
 })
 it('sorts by relevance and independent ranking systems without mutating input',function(){const items=[a,b];expect(sortVenues(items,'relevance',{a:95,b:70},Date.now())[0].id).to.equal('a');expect(sortVenues(items,'ccf',{},Date.now())[0].id).to.equal('b');expect(sortVenues(items,'core',{},Date.now())[0].id).to.equal('a');expect(sortVenues(items,'thcpl',{},Date.now())[0].id).to.equal('b');expect(items[0]).to.equal(a)})
 it('filters multiple Xidian categories and sorts unknown entries last',async function(){
  const classification=(category:string)=>({label:'西电 '+category,category,basis:'Policy',page:3,source:'/policy',conditions:[],rulesPage:32});
  const one={...a,id:'one',title:'First class',xidian:classification('1类贡献度')};const two={...a,id:'two',title:'Second class',xidian:classification('2类贡献度')};const unknown={...a,id:'unknown',title:'Unknown'};
  sinon.stub(requests,'getJSON').resolves({venues:[unknown,two,one],fetched:Date.now(),stale:false});render(<SubmissionDeadlines onBack={()=>{}}/>);await screen.findByText('3 venues & rounds');
  fireEvent.change(screen.getByLabelText('Sort by'),{target:{value:'xidian'}});expect(screen.getAllByRole('article').map(e=>e.getAttribute('data-venue-id'))).to.deep.equal(['one','two','unknown']);
  fireEvent.click(screen.getByText('Xidian category · All'));fireEvent.click(screen.getByLabelText('Xidian · Category 1'));expect(screen.getAllByRole('article')).to.have.length(1);fireEvent.click(screen.getByLabelText('Xidian · Category 2'));expect(screen.getAllByRole('article')).to.have.length(2);
 })

})

describe('Inline Plan navigation',()=>{
 afterEach(()=>{sinon.restore();localStorage.clear()})
 it('opens Submission Plan below area filters and preserves view switching',async()=>{
  sinon.stub(requests,'getJSON').resolves({venues:[a,b],fetched:Date.now(),stale:false});const {container}=render(<SubmissionDeadlines workspace projectId="plan-navigation" onBack={()=>{}}/>);await screen.findByLabelText('Search venues');fireEvent.click(screen.getByRole('button',{name:'Submission Plan'}));const planner=screen.getByRole('region',{name:'Submission planner'});expect(screen.queryByRole('dialog')).to.equal(null);expect(screen.getByRole('button',{name:'Submission Plan',exact:true}).getAttribute('aria-pressed')).to.equal('true');expect(screen.getByRole('group',{name:'Research areas'}).compareDocumentPosition(planner)&Node.DOCUMENT_POSITION_FOLLOWING).to.not.equal(0);expect(screen.queryByRole('button',{name:'Plan submission sequence'})).to.equal(null);fireEvent.click(screen.getByRole('button',{name:'Timeline',exact:true}));expect(container.querySelector('.submission-planner')).to.equal(null)
 })
})
