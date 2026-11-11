import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,waitFor,within} from '@testing-library/react'
import SubmissionSequencePlanner from '@/features/plugins/submission-sequence-planner'
import * as trackSource from '@/features/plugins/conference-tracks'
import {plannerTracks,reviewWindow} from '@/features/plugins/planner-venues'
import type {Venue} from '@/features/plugins/submission-deadlines'
function selectVenue(label:string,id:string){const input=screen.getByRole('combobox',{name:label});if(input.getAttribute('aria-expanded')!=='true')fireEvent.click(input);const icon=document.querySelector(`[data-venue-option="${id}"]`)!;fireEvent.click(icon.closest('[role=option]')!)}
const journals=[{id:'J1',title:'First Journal',description:'First',kind:'journal',rank:'A',events:[],year:null},{id:'J2',title:'Second Journal',description:'Second',kind:'journal',rank:'B',events:[],year:null}] as unknown as Venue[]
describe('Inline submission planner',()=>{
 afterEach(()=>{localStorage.clear();sinon.restore()})
 it('renders inline, adds via chart plus, shows one editor, and deletes only explicitly',()=>{
  render(<SubmissionSequencePlanner venues={journals} scores={{}} projectId="dynamic"/>);expect(screen.queryByRole('dialog')).to.equal(null);expect(screen.getByRole('heading',{name:'Submission planner'})).to.exist
  fireEvent.change(screen.getByLabelText('Estimated review duration (days)'),{target:{value:'30'}});fireEvent.click(screen.getByRole('button',{name:'Add next submission choice'}));expect(screen.queryByLabelText('Target 1')).to.equal(null);selectVenue('Target 2','J2');expect(document.querySelectorAll('.sequence-candidate')).to.have.length(1);fireEvent.click(screen.getByRole('button',{name:/^1\. First Journal \(Journal\)/}));expect(document.querySelectorAll('.sequence-chart-row:not(.is-under-review)')).to.have.length(2);fireEvent.click(screen.getByRole('button',{name:'Remove this choice'}));expect(document.querySelectorAll('.sequence-chart-row:not(.is-under-review)')).to.have.length(1);expect(screen.queryByRole('dialog',{name:'Choose submission target'})).to.equal(null)
  fireEvent.change(screen.getByLabelText('Planning horizon'),{target:{value:'18'}});expect((screen.getByLabelText('Planning horizon') as HTMLSelectElement).value).to.equal('18');expect(screen.queryByLabelText('Months')).to.equal(null);expect(screen.queryByLabelText('Optional effective withdrawal date')).to.equal(null)
 })
 it('ignores legacy withdrawal values and persists explicit journal estimates',()=>{
  localStorage.setItem('submission-sequence:test',JSON.stringify({reviews:{},withdrawals:{J1:'2099-01-01'},chosen:['J1']}));render(<SubmissionSequencePlanner venues={journals} scores={{}} projectId="test"/>);fireEvent.change(screen.getByLabelText('Estimated review duration (days)'),{target:{value:'60'}});expect(document.querySelector('.sequence-bar.conditional')).to.exist;expect(JSON.parse(localStorage.getItem('submission-sequence:test')!).reviews.J1).to.equal(60)
 })
 it('requires a specific under-review Track and places it before subsequent choices',async()=>{
  const now=Date.now(),e=(label:string,n:number)=>({label,utc:new Date(now+n*86400000).toISOString(),timezone:'UTC',original:''})
  const conf={id:'C',title:'CAV',description:'Verification',kind:'conference',year:2027,events:[],rank:'A'} as unknown as Venue
  const track={id:'C::track:research',title:'Research Papers',url:'https://example.org/research',isMain:true,status:'retrieved',events:[e('Paper',-10),e('Decision',20)],requirements:[],templates:[],supportsLatex:true,dateNote:''}
  sinon.stub(trackSource,'loadTracks').resolves({tracks:[track],fetched:now,notice:''})
  render(<SubmissionSequencePlanner venues={journals} catalog={[...journals,conf]} scores={{}} projectId="review"/>);fireEvent.click(screen.getByLabelText('This manuscript is under review or submitted'));fireEvent.change(screen.getByLabelText('Search venue or Track'),{target:{value:'CAV'}});fireEvent.click(screen.getByRole('combobox',{name:'Under Review or Submitted'}));await screen.findByRole('option',{name:/CAV 2027.*Research Papers/});expect(screen.queryByLabelText('Under-review conference Track')).to.equal(null);selectVenue('Under Review or Submitted',track.id);await waitFor(()=>expect(document.querySelector('.is-under-review')?.textContent).to.include('CAV 2027 (Conference) · Research Papers'));expect(screen.queryByLabelText('Estimated review outcome date')).to.equal(null);expect(document.querySelector('.sequence-chart-row')?.className).to.include('is-under-review')
  const review=reviewWindow(plannerTracks(conf,[track])[0],now);expect(review.end).to.equal(now+20*86400000)
 })
})

describe('Planner milestone labels',()=>{
 it('retains all dated Track milestones and adds the shared conference start',async()=>{const {plannerMilestones,plannerName}=await import('@/features/plugins/planner-venues');const ev=(label:string,date:string)=>({label,date,original:date,timezone:'AoE',utc:null});const parent={...journals[0],kind:'conference',year:2027,events:[ev('Conference starts','2027-07-12')]} as Venue;const v={...parent,events:[ev('Paper','2027-01-02'),ev('Author response starts','2027-02-03'),ev('Decision','2027-03-04')],track:{title:'Research Papers'}} as Venue;const points=plannerMilestones(v,parent);expect(points.map(p=>p.short)).to.deep.equal(['Paper','Response','Decision','Conference']);expect(plannerName(v)).to.include('(Conference) · Research Papers');expect(plannerName(journals[0])).to.include('(Journal)')})
})

describe('Preserve the user submission plan',()=>{
 afterEach(()=>{localStorage.clear();sinon.restore()})
 it('does not remove choices on review toggles, review selection/date changes, or venue filters',()=>{
  localStorage.setItem('submission-sequence:preserve',JSON.stringify({chosen:['J1','J2'],reviews:{J1:30,J2:40}}));render(<SubmissionSequencePlanner venues={journals} catalog={journals} scores={{}} projectId="preserve"/>);const ids=()=>JSON.parse(localStorage.getItem('submission-sequence:preserve')!).chosen
  fireEvent.click(screen.getByLabelText('This manuscript is under review or submitted'));expect(ids()).to.deep.equal(['J1','J2']);selectVenue('Under Review or Submitted','J1');expect(ids()).to.deep.equal(['J1','J2']);fireEvent.change(screen.getByLabelText('Estimated review outcome date'),{target:{value:'2027-03-01'}});expect(ids()).to.deep.equal(['J1','J2']);fireEvent.click(screen.getByLabelText('This manuscript is under review or submitted'));expect(ids()).to.deep.equal(['J1','J2']);expect(document.querySelectorAll('.sequence-chart-row:not(.is-under-review)')).to.have.length(2);expect(document.querySelector('.is-under-review')).to.equal(null);fireEvent.change(screen.getByLabelText('Venue type'),{target:{value:'conference'}});expect(ids()).to.deep.equal(['J1','J2']);expect(document.querySelectorAll('.sequence-chart-row')).to.have.length(2)
 })
 it('freezes the displayed initial suggestion before toggling review state',()=>{
  render(<SubmissionSequencePlanner venues={journals} scores={{}} projectId="initial"/>);const id='J1';fireEvent.click(screen.getByLabelText('This manuscript is under review or submitted'));expect(JSON.parse(localStorage.getItem('submission-sequence:initial')!).chosen).to.deep.equal([id]);fireEvent.click(screen.getByLabelText('This manuscript is under review or submitted'));expect((screen.getByRole('combobox',{name:'Target 1'}) as HTMLSelectElement).value).to.include('First Journal')
 })
})

describe('Arrange submission targets',()=>{
 afterEach(()=>localStorage.clear())
 it('inserts between choices and preserves targets through keyboard and drag reordering',()=>{
  const third={...journals[0],id:'J3',title:'Third Journal'}
  localStorage.setItem('submission-sequence:arrange',JSON.stringify({chosen:['J1','J2'],reviews:{J1:30,J2:30,J3:30}}))
  render(<SubmissionSequencePlanner venues={[...journals,third]} scores={{}} projectId="arrange"/>);
  const ids=()=>JSON.parse(localStorage.getItem('submission-sequence:arrange')!).chosen
  fireEvent.click(screen.getByRole('button',{name:'Insert submission before choice 2'}));selectVenue('Target 2','J3');expect(ids()).to.deep.equal(['J1','J3','J2'])
  fireEvent.keyDown(screen.getByRole('button',{name:'Drag choice 2 to reorder'}),{key:'ArrowUp'});expect(ids()).to.deep.equal(['J3','J1','J2'])
  fireEvent.dragStart(screen.getByRole('button',{name:'Drag choice 1 to reorder'}),{dataTransfer:{setData:()=>{}}});fireEvent.drop(document.querySelectorAll('.sequence-chart-row')[2]);expect(ids()).to.deep.equal(['J1','J2','J3'])
  fireEvent.click(screen.getByLabelText('This manuscript is under review or submitted'));fireEvent.click(screen.getByLabelText('This manuscript is under review or submitted'));expect(ids()).to.deep.equal(['J1','J2','J3'])
 })
 it('keeps targets with visible deadline conflicts after moving a journal before a conference',()=>{
  const now=Date.now(),event=(label:string,days:number)=>({label,utc:new Date(now+days*86400000).toISOString(),original:'',timezone:'UTC'})
  const conf={...journals[0],id:'C',kind:'conference',title:'Conference',track:{title:'Research Papers'},events:[event('Paper submission',10),event('Notification',30)]} as Venue
  localStorage.setItem('submission-sequence:conflict',JSON.stringify({chosen:['C','J1'],reviews:{J1:60}}))
  render(<SubmissionSequencePlanner venues={[conf,...journals]} scores={{}} projectId="conflict"/>);fireEvent.keyDown(screen.getByRole('button',{name:'Drag choice 2 to reorder'}),{key:'ArrowUp'});expect(JSON.parse(localStorage.getItem('submission-sequence:conflict')!).chosen).to.deep.equal(['J1','C']);expect(document.querySelectorAll('.sequence-chart-row')[1].className).to.include('is-conflicted');expect(document.querySelector('.sequence-conflict-reason')).to.equal(null);expect(screen.queryByRole('button',{name:/Move choice/})).to.equal(null);expect(document.querySelectorAll('.sequence-global-today')).to.have.length(1);expect(document.querySelector('.sequence-months')?.textContent).to.match(/20\d\d Q[1-4]/);fireEvent.click(document.querySelector('.sequence-milestone')!);expect(document.querySelector('.sequence-selected-guide')).to.exist;expect(screen.getByRole('button',{name:'Clear selected dates'})).to.exist;expect(document.querySelector('.sequence-legend')?.textContent).not.to.include('Selected date ·');fireEvent.click(document.querySelectorAll('.sequence-milestone')[1]);expect(document.querySelectorAll('.sequence-selected-guide')).to.have.length(2);fireEvent.click(document.querySelector('.sequence-milestone')!);expect(document.querySelectorAll('.sequence-selected-guide')).to.have.length(1)
 })
})

describe('Planner snapping',()=>{it('snaps within eight pixels and leaves distant dates unchanged',async()=>{const {snapPlannerDate}=await import('@/features/plugins/planner-venues');expect(snapPlannerDate(102,[100,200],1000,500)).to.equal(100);expect(snapPlannerDate(140,[100,200],1000,500)).to.equal(140)})})

describe('All participants in a conflict',()=>{afterEach(()=>localStorage.clear());it('highlights every overlapping journal without inline reason text',()=>{const start=Date.now()+86400000;const third={...journals[0],id:'J3',title:'Third'};localStorage.setItem('submission-sequence:all-conflicts',JSON.stringify({chosen:['J1','J2','J3'],reviews:{},windows:Object.fromEntries(['J1','J2','J3'].map((id,i)=>[id,{start:start+i*86400000,end:start+(10+i)*86400000}]))}));render(<SubmissionSequencePlanner venues={[...journals,third]} scores={{}} projectId="all-conflicts"/>);expect(document.querySelectorAll('.sequence-chart-row.is-conflicted')).to.have.length(3);expect(document.querySelector('.sequence-conflict-reason')).to.equal(null);expect(document.querySelectorAll('.sequence-conflict-guide').length).to.be.greaterThan(1);fireEvent.click(document.querySelectorAll('.sequence-chart-row')[0]);expect((screen.getByRole('combobox',{name:'Target 1'}) as HTMLSelectElement).value).to.include('First Journal');fireEvent.click(screen.getByRole('button',{name:'Insert submission before choice 2'}));expect(screen.getByRole('dialog',{name:'Choose submission target'})).to.exist})})

describe('Review contact is not overlap',()=>{afterEach(()=>localStorage.clear());it('does not color touching journals even with a preparation gap',()=>{const start=Date.now()+86400000;localStorage.setItem('submission-sequence:touch',JSON.stringify({chosen:['J1','J2'],reviews:{},gap:7,windows:{J1:{start,end:start+10*86400000},J2:{start:start+10*86400000,end:start+20*86400000}}}));render(<SubmissionSequencePlanner venues={journals} scores={{}} projectId="touch"/>);expect(document.querySelectorAll('.sequence-conflict-band')).to.have.length(0);expect(document.querySelectorAll('.sequence-chart-row.is-conflicted')).to.have.length(0);fireEvent.click(document.querySelector('.sequence-resize-handle')!);expect(document.querySelectorAll('.sequence-selected-guide')).to.have.length(1);fireEvent.click(document.querySelector('.sequence-chart-row')!);fireEvent.click(screen.getByRole('button',{name:'Remove this choice'}));expect(document.querySelectorAll('.sequence-chart-row')).to.have.length(1);expect(document.querySelectorAll('.sequence-selected-guide')).to.have.length(0);expect(screen.queryByRole('dialog')).to.equal(null)})})
describe('Insertion ranking',()=>{afterEach(()=>localStorage.clear());it('puts available venues first and sorts those by descending fit',()=>{const third={...journals[0],id:'J3',title:'Third Journal'};localStorage.setItem('submission-sequence:rank',JSON.stringify({chosen:[],reviews:{},windows:{J1:{start:0,end:86400000}}}));render(<SubmissionSequencePlanner venues={[{...journals[0],kind:'conference',track:{title:'Research Papers'}} as Venue,journals[1],third]} scores={{J1:100,J2:60,J3:90}} projectId="rank"/>);fireEvent.click(screen.getByRole('button',{name:'Add next submission choice'}));const choices=[...document.querySelectorAll('.sequence-insert-results>button')];expect(choices.map(e=>e.textContent)).to.satisfy((labels:string[])=>labels[0].includes('Third Journal')&&labels[1].includes('Second Journal')&&labels[2].includes('First Journal'));expect((choices[2] as HTMLButtonElement).disabled).to.equal(true)})})

describe('Journal draft insertion with unknown prior outcome',()=>{afterEach(()=>localStorage.clear());it('allows choosing a journal while leaving its date pending',()=>{render(<SubmissionSequencePlanner venues={journals} scores={{}} projectId="pending-journal"/>);fireEvent.click(screen.getByLabelText('This manuscript is under review or submitted'));fireEvent.click(screen.getByRole('button',{name:'Add next submission choice'}));const button=document.querySelector('.sequence-insert-results>button') as HTMLButtonElement;expect(button.disabled).to.equal(false);expect(button.textContent).to.include('start date pending');fireEvent.click(button);expect(JSON.parse(localStorage.getItem('submission-sequence:pending-journal')!).chosen).to.have.length(2);expect(document.querySelectorAll('.sequence-chart-row:not(.is-under-review)')).to.have.length(2)})})

describe('Full review duration with conditional checkpoint',()=>{afterEach(()=>localStorage.clear());it('draws the conference bar through final notification with one conflict label across both severities',()=>{const now=Date.now(),day=86400000,e=(label:string,n:number)=>({label,utc:new Date(now+n*day).toISOString(),original:'',timezone:'UTC'});const conference={id:'C',title:'Conference',description:'Full name',kind:'conference',track:{title:'Research Papers'},year:2027,events:[e('Paper',1),e('Author response starts',20),e('Initial notification',30),e('Final notification',50)]} as unknown as Venue;localStorage.setItem('submission-sequence:phases',JSON.stringify({chosen:['C','J1'],reviews:{},windows:{J1:{start:now+10*day,end:now+40*day}}}));render(<SubmissionSequencePlanner venues={[conference,...journals]} scores={{}} projectId="phases"/>);const rows=document.querySelectorAll('.sequence-chart-row');expect(rows[0].querySelector('.sequence-bar')?.getAttribute('aria-label')).to.include(new Date(now+50*day).toLocaleDateString('en-CA'));for(const row of rows){expect(row.querySelector('.sequence-conflict-band.fatal')).to.exist;expect(row.querySelector('.sequence-conflict-band.warning')).to.exist;expect(row.querySelectorAll('.sequence-conflict-band > span')).to.have.length(1)}})})

describe('Rolling journal alternatives',()=>{afterEach(()=>localStorage.clear());it('reschedules a replacement instead of reusing its former window and never calls a journal unavailable',()=>{
 const start=Date.now()+86400000;localStorage.setItem('submission-sequence:replace',JSON.stringify({chosen:['J1'],reviews:{},windows:{J2:{start:0,end:86400000},J1:{start,end:start+30*86400000}}}))
 render(<SubmissionSequencePlanner venues={journals} scores={{}} projectId="replace"/>);
 expect(screen.queryByText('Unavailable alternatives')).to.equal(null)
 selectVenue('Target 1','J2')
 const saved=JSON.parse(localStorage.getItem('submission-sequence:replace')!);expect(saved.chosen).to.deep.equal(['J2']);expect(saved.windows.J2).to.equal(undefined);expect(document.querySelectorAll('.sequence-chart-row.is-conflicted')).to.have.length(0)
})})

describe('Grouped timeline legend',()=>{it('keeps conflict areas, date lines, review bars and milestones in separate groups',()=>{render(<SubmissionSequencePlanner venues={journals} scores={{}}/>);expect(screen.getByRole('group',{name:'Conflicts'}).querySelectorAll('i')).to.have.length(2);expect(screen.getByRole('group',{name:'Date guides'}).querySelectorAll('i')).to.have.length(2);expect(screen.getByRole('group',{name:'Review periods'}).querySelectorAll('i')).to.have.length(3);expect(screen.getByRole('group',{name:'Milestones'}).querySelectorAll('i')).to.have.length(6)})})

describe('Simplified timeline',()=>{afterEach(()=>localStorage.clear());it('persists compact labels and restores details without changing choices',()=>{
 const conference={...journals[0],id:'C',title:'CAV',description:'International Conference on Computer-Aided Verification',kind:'conference',year:2027,track:{title:'Tool Papers'},events:[{label:'Paper submission',date:'2027-01-20',original:'',timezone:''},{label:'Notification',date:'2027-04-23',original:'',timezone:''}]} as Venue
 localStorage.setItem('submission-sequence:compact',JSON.stringify({chosen:['C','J1'],reviews:{}}));render(<SubmissionSequencePlanner venues={[conference,...journals]} scores={{}} projectId="compact"/>);
 fireEvent.click(screen.getByRole('button',{name:'Simplify timeline'}));expect(document.querySelector('.sequence-chart.is-compact')).to.exist;expect(document.querySelector('.sequence-journal-summary')).to.equal(null)
 const name=document.querySelector('.sequence-row-label')!;expect(name.querySelector('.sequence-name')!.textContent).to.equal('1. CAV 2027 (Conference)');expect(name.getAttribute('title')).to.include('Computer-Aided Verification').and.include('Track: Tool Papers')
 expect(JSON.parse(localStorage.getItem('submission-sequence:compact')!).compact).to.equal(true)
 fireEvent.click(screen.getByRole('button',{name:'Insert submission before choice 2'}));expect(screen.getByRole('dialog',{name:'Choose submission target'})).to.exist
 fireEvent.click(screen.getByRole('button',{name:'Expand timeline'}));expect(document.querySelector('.sequence-journal-summary')).to.exist;expect(document.querySelector('.sequence-row-label')!.textContent).to.include('Tool Papers');expect(JSON.parse(localStorage.getItem('submission-sequence:compact')!).chosen).to.deep.equal(['C','J1'])
})})

describe('Per-row deletion',()=>{afterEach(()=>localStorage.clear());it('removes the clicked unselected row only, also in compact mode, without opening insertion',()=>{
 const third={...journals[0],id:'J3',title:'Third Journal'};localStorage.setItem('submission-sequence:trash',JSON.stringify({chosen:['J1','J2','J3'],reviews:{},compact:true,windows:{J1:{start:Date.now(),end:Date.now()+86400000}}}))
 render(<SubmissionSequencePlanner venues={[...journals,third]} scores={{}} projectId="trash"/>);
 fireEvent.click(screen.getByRole('button',{name:'Remove choice 1: First Journal (Journal)'}));const saved=JSON.parse(localStorage.getItem('submission-sequence:trash')!);expect(saved.chosen).to.deep.equal(['J2','J3']);expect(saved.windows.J1).to.equal(undefined);expect(screen.queryByRole('dialog')).to.equal(null)
 fireEvent.click(screen.getByRole('button',{name:'Remove choice 2: Third Journal (Journal)'}));expect(JSON.parse(localStorage.getItem('submission-sequence:trash')!).chosen).to.deep.equal(['J2'])
})})

describe('Journal duration while prior date is pending',()=>{afterEach(()=>localStorage.clear());it('retains the default estimate even without a start date',()=>{localStorage.setItem('submission-sequence:duration-pending',JSON.stringify({chosen:['J1'],reviews:{},active:true}));render(<SubmissionSequencePlanner venues={journals} scores={{}} projectId="duration-pending"/>);const input=screen.getByLabelText('Estimated review duration (days)') as HTMLInputElement;expect(Number(input.value)).to.be.within(89,92);fireEvent.change(input,{target:{value:'45'}});expect(input.value).to.equal('45')})});
describe('Repeated journal plans',()=>{afterEach(()=>localStorage.clear());it('inserts the same journal twice with independent duration and deletion',()=>{localStorage.setItem('submission-sequence:repeat',JSON.stringify({chosen:['J1'],reviews:{J1:30}}));render(<SubmissionSequencePlanner venues={journals} scores={{}} projectId="repeat"/>);fireEvent.click(screen.getByRole('button',{name:'Add next submission choice'}));selectVenue('Target 2','J1');const saved=()=>JSON.parse(localStorage.getItem('submission-sequence:repeat')!);expect(saved().chosen[0]).to.equal('J1');expect(saved().chosen[1]).to.match(/^J1::plan:/);fireEvent.change(screen.getByLabelText('Estimated review duration (days)'),{target:{value:'45'}});expect(saved().reviews.J1).to.equal(30);expect(saved().reviews[saved().chosen[1]]).to.equal(45);fireEvent.click(screen.getByRole('button',{name:'Remove choice 1: First Journal (Journal)'}));expect(saved().chosen).to.have.length(1);expect((screen.getByLabelText('Estimated review duration (days)') as HTMLInputElement).value).to.equal('45')})})

describe('Adaptation card',()=>{
 afterEach(()=>{localStorage.clear();sinon.restore()})
 for(const [title,key,label] of [['Tool Papers','tool-paper','Tool'],['Datasets','dataset-paper','Dataset'],['Tool and Data Showcase','tool-data','Tool / Dataset'],['Research Papers','new-research','Research paper'],['Workshop','workshop','Workshop'],['Poster Track','poster','Poster'],['Industrial Experience','industry','Industry / experience'],['Doctoral Symposium','phd','Doctoral symposium'],['Journal First','journal-first','Journal first'],['Survey Papers','survey','Survey / review'],['Tutorial','tutorial','Tutorial'],['Artifact Evaluation','artifact','Artifact evaluation'],['Replication','replication','Replication / negative results'],['Short Papers','short','Short paper']])it(`marks new ${label} manuscripts while keeping rewriting instructions in the card`,()=>{
  const now=Date.now(),events=[{label:'Paper submission',utc:new Date(now+20*86400000).toISOString(),original:'',timezone:'UTC'},{label:'Decision',utc:new Date(now+60*86400000).toISOString(),original:'',timezone:'UTC'}]
  const tool={id:'tool',title:'CAV',description:'Verification',kind:'conference',events,track:{title},manuscriptVariant:{kind:'adapted',key,summary:'Build a distinct tool contribution',changes:['Add a runnable demonstration']}} as Venue
  localStorage.setItem('submission-sequence:adapted',JSON.stringify({chosen:['tool'],reviews:{}}))
  render(<SubmissionSequencePlanner venues={[tool]} scores={{tool:88}} projectId="adapted"/>)
  expect(screen.getByRole('region',{name:'Adapted manuscript plan'}).textContent).to.include('Add a runnable demonstration')
  expect(document.querySelector('.sequence-chart-body')!.textContent).not.to.include('runnable demonstration')
  expect(document.querySelector('.sequence-chart-body .sequence-new-manuscript')!.getAttribute('aria-label')).to.equal('New manuscript')
  for(const target of ['.sequence-chart-body','.sequence-candidate header']) {
   const icons=Array.from(document.querySelectorAll(target+' .sequence-paper-type')).map(e=>e.getAttribute('aria-label'))
   expect(icons).to.deep.equal(label==='Tool / Dataset'?['Tool','Dataset']:[label])
  }
  expect(document.querySelector('.sequence-new-manuscript')!.getAttribute('title')).to.include(key)
 })
})

describe('Journal date controls',()=>{
 afterEach(()=>{localStorage.clear();sinon.restore()})
 it('synchronizes typed dates and duration while preserving a manually chosen start',()=>{
  localStorage.setItem('submission-sequence:dates',JSON.stringify({chosen:['J1'],reviews:{J1:90}}))
  render(<SubmissionSequencePlanner venues={journals} scores={{}} projectId="dates"/>)
  fireEvent.change(screen.getByLabelText('Submission date'),{target:{value:'2030-01-10'}})
  fireEvent.change(screen.getByLabelText('Review outcome date'),{target:{value:'2030-04-10'}})
  expect((screen.getByLabelText('Estimated review duration (days)') as HTMLInputElement).value).to.equal('90')
  fireEvent.change(screen.getByLabelText('Estimated review duration (days)'),{target:{value:'30'}})
  expect((screen.getByLabelText('Submission date') as HTMLInputElement).value).to.equal('2030-01-10')
  expect((screen.getByLabelText('Review outcome date') as HTMLInputElement).value).to.equal('2030-02-09')
  expect(JSON.parse(localStorage.getItem('submission-sequence:dates')!).windows.J1.start).to.equal(Date.parse('2030-01-10T00:00:00'))
  fireEvent.change(screen.getByLabelText('Review outcome date'),{target:{value:'2030-01-01'}})
  expect(screen.getByRole('alert').textContent).to.include('must be after')
  expect((screen.getByLabelText('Review outcome date') as HTMLInputElement).value).to.equal('2030-02-09')
 })
})

it('keeps a date-only end edit at whole review days even when the start has a time of day',()=>{
 const clock=sinon.useFakeTimers({now:Date.parse('2026-11-06T15:00:00Z'),toFake:['Date']})
 try{
  localStorage.setItem('submission-sequence:date-clock',JSON.stringify({chosen:['J1'],reviews:{J1:90}}))
  render(<SubmissionSequencePlanner venues={journals} scores={{}} projectId="date-clock"/>)
  fireEvent.change(screen.getByLabelText('Review outcome date'),{target:{value:'2027-02-06'}})
  expect((screen.getByLabelText('Estimated review duration (days)') as HTMLInputElement).value).to.equal('92')
 }finally{clock.restore();localStorage.clear()}
})

describe('Submitted future conference Tracks',()=>{
 afterEach(()=>{localStorage.clear();sinon.restore()})
 it('lets an author select an already-submitted Track before its first official milestone',async()=>{
  const now=Date.now(),e=(label:string,n:number)=>({label,utc:new Date(now+n*86400000).toISOString(),original:'',timezone:'UTC'})
  const conf={id:'future',title:'CAV',description:'Verification',kind:'conference',year:2027,events:[]} as Venue
  const track={id:'future::track:tool',title:'Tool Papers',url:'https://example.org/tool',isMain:false,status:'retrieved',events:[e('Abstract submission',20),e('Paper submission',30),e('Author response starts',60),e('Final notification',90)],requirements:[],templates:[],supportsLatex:true,dateNote:''}
  sinon.stub(trackSource,'loadTracks').resolves({tracks:[track],fetched:now,notice:''})
  localStorage.setItem('submission-sequence:submitted',JSON.stringify({chosen:['J1'],reviews:{}}))
  render(<SubmissionSequencePlanner venues={journals} catalog={[...journals,conf]} scores={{}} projectId="submitted"/>)
  fireEvent.click(screen.getByLabelText('This manuscript is under review or submitted'));fireEvent.change(screen.getByLabelText('Search venue or Track'),{target:{value:'CAV'}})
  fireEvent.click(screen.getByRole('combobox',{name:'Under Review or Submitted'}));await screen.findByRole('option',{name:/CAV 2027.*Tool Papers/})
  selectVenue('Under Review or Submitted',track.id)
  expect(JSON.parse(localStorage.getItem('submission-sequence:submitted')!).reviewId).to.equal(track.id)
  expect(JSON.parse(localStorage.getItem('submission-sequence:submitted')!).chosen).to.deep.equal(['J1'])
  expect(document.querySelector('.is-under-review')?.textContent).to.include('CAV 2027')
 })
})

describe('Current submitted venue card',()=>{
 afterEach(()=>{localStorage.clear();sinon.restore()})
 it('shows an editable journal card and two endpoints even without any future choices',()=>{
  localStorage.setItem('submission-sequence:current',JSON.stringify({chosen:[],reviews:{},active:true,reviewId:'J1'}))
  render(<SubmissionSequencePlanner venues={journals} catalog={journals} scores={{}} projectId="current"/>)
  expect(screen.getByRole('region',{name:'Current submission choice'}).textContent).to.include('Under Review or Submitted')
  expect(document.querySelectorAll('.is-under-review .sequence-resize-handle')).to.have.length(2)
  expect(screen.queryByRole('button',{name:'Remove this choice'})).to.equal(null)
  fireEvent.change(screen.getByLabelText('Submission date'),{target:{value:'2030-01-10'}})
  fireEvent.change(screen.getByLabelText('Review outcome date'),{target:{value:'2030-04-10'}})
  expect((screen.getByLabelText('Estimated review duration (days)') as HTMLInputElement).value).to.equal('90')
  const state=JSON.parse(localStorage.getItem('submission-sequence:current')!)
  expect(state.chosen).to.deep.equal([]);expect(state.currentWindow.start).to.equal(Date.parse('2030-01-10T00:00:00'));expect(state.reviewEstimate).to.equal('2030-04-10')
  fireEvent.click(document.querySelector('.is-under-review .sequence-resize-handle')!)
  expect(document.querySelectorAll('.sequence-selected-guide')).to.have.length(1)
 })
 it('opens the submitted journal card by clicking its row while retaining future choices',()=>{
  localStorage.setItem('submission-sequence:current-click',JSON.stringify({chosen:['J2'],reviews:{},active:true,reviewId:'J1'}))
  render(<SubmissionSequencePlanner venues={journals} catalog={journals} scores={{}} projectId="current-click"/>)
  fireEvent.click(document.querySelector('.is-under-review .sequence-row-label')!)
  expect(screen.getByRole('region',{name:'Current submission choice'}).textContent).to.include('First Journal')
  expect(JSON.parse(localStorage.getItem('submission-sequence:current-click')!).chosen).to.deep.equal(['J2'])
  fireEvent.click(screen.getByRole('button',{name:/^1\. Second Journal \(Journal\)/}))
  expect(screen.getByRole('combobox',{name:'Target 1'})).to.exist
 })
})

describe('Historical submitted Track with a known outcome',()=>{
 afterEach(()=>{localStorage.clear();sinon.restore()})
 it('keeps historical outcome dates and displays a later fixed Track without a false conflict',()=>{
  const now=Date.now(),event=(label:string,days:number)=>({label,utc:new Date(now+days*86400000).toISOString(),original:'',timezone:'UTC'})
  const previous={id:'old::track:research',title:'FSE',kind:'conference',year:2026,description:'FSE',events:[event('Paper submission',-300),event('Author response',-220),event('Final notification',-200)],track:{id:'old::track:research',title:'Research Papers',isMain:true}} as unknown as Venue
  const next={id:'next::track:research',title:'ISSTA',kind:'conference',year:2027,description:'ISSTA',events:[event('Paper submission',60),event('Final notification',160)],track:{id:'next::track:research',title:'Research Papers',isMain:true}} as unknown as Venue
  const window=reviewWindow(previous,now);expect(window.end).to.equal(now-200*86400000);expect(window.estimated).to.equal(false)
  localStorage.setItem('submission-sequence:historical',JSON.stringify({active:true,reviewId:previous.id,chosen:[next.id],reviews:{},months:18}))
  render(<SubmissionSequencePlanner venues={[next]} catalog={[previous,next]} scores={{}} projectId="historical"/> )
  const row=document.querySelector('.sequence-chart-row:not(.is-under-review)')!
  expect(row.className).not.to.include('is-conflicted');expect(row.querySelector('.sequence-bar')).to.exist
  expect(screen.queryByText(/Select the current submission and its Track, then confirm/)).to.equal(null)
  expect(row.textContent).not.to.include('Submission date unconfirmed')
 })
})

describe('Manual insertion from the full venue catalog',()=>{
 afterEach(()=>{localStorage.clear();sinon.restore()})
 it('finds and inserts TOSEM or TSE even when AI did not recommend either',()=>{
  const tosem={...journals[0],id:'tosem',title:'TOSEM',description:'ACM Transactions on Software Engineering and Methodology'},tse={...journals[0],id:'tse',title:'TSE',description:'IEEE Transactions on Software Engineering'}
  localStorage.setItem('submission-sequence:all-venues',JSON.stringify({chosen:['J1'],reviews:{}}))
  render(<SubmissionSequencePlanner venues={[journals[0]]} catalog={[journals[0],tosem,tse]} scores={{J1:90}} projectId="all-venues"/> )
  fireEvent.click(screen.getByRole('button',{name:'Add next submission choice'}));fireEvent.change(screen.getByLabelText('Search insertion targets'),{target:{value:'TOSEM'}})
  const entry=screen.getByRole('button',{name:/TOSEM \(ACM Transactions/});expect(entry.textContent).to.include('Fit unknown');fireEvent.click(entry)
  expect(JSON.parse(localStorage.getItem('submission-sequence:all-venues')!).chosen).to.deep.equal(['J1','tosem'])
  fireEvent.click(screen.getByRole('button',{name:'Add next submission choice'}));fireEvent.change(screen.getByLabelText('Search insertion targets'),{target:{value:'TSE'}});expect(screen.getByRole('button',{name:/TSE \(IEEE Transactions/})).to.exist
  fireEvent.change(screen.getByLabelText('Search insertion targets'),{target:{value:''}});fireEvent.click(screen.getByRole('button',{name:'Prioritize AI-recommended targets'}));expect(screen.getByRole('button',{name:/TSE \(IEEE Transactions/})).to.exist;expect(screen.getByRole('img',{name:'AI recommended'})).to.exist
  fireEvent.click(screen.getByRole('button',{name:'Prioritize AI-recommended targets'}));expect(screen.getByRole('button',{name:/TSE \(IEEE Transactions/})).to.exist
 })
 it('does not auto-recommend unassessed catalog journals',async()=>{
  const unassessed={...journals[0],id:'top',title:'Unassessed',rank:'A'}
  render(<SubmissionSequencePlanner venues={[journals[1]]} catalog={[journals[1],unassessed]} scores={{J2:90}} projectId="assessed-only" recommendationVersion={1}/> )
  await waitFor(()=>{const ids=JSON.parse(localStorage.getItem('submission-sequence:assessed-only')!).chosen;expect(ids.length).to.be.greaterThan(1);expect(ids.every((id:string)=>id.startsWith('J2'))).to.equal(true)})
 })
})

describe('Area-aware submitted venue menu',()=>{
 afterEach(()=>localStorage.clear())
 it('groups matching areas first, keeps other areas selectable and shows all without filters',()=>{
  const se={...journals[0],area:'Software Engineering'},bio={...journals[1],area:'Interdisciplinary'}
  localStorage.setItem('submission-sequence:areas',JSON.stringify({reviews:{},chosen:[],active:true}))
  const props={venues:[se,bio],catalog:[se,bio],scores:{},projectId:'areas'}
  const view=render(<SubmissionSequencePlanner {...props} selectedAreas={['Software Engineering']}/>);fireEvent.click(screen.getByRole('combobox',{name:'Under Review or Submitted'}))
  expect(screen.getByText('Selected areas')).to.exist;expect(screen.getByText('Other areas')).to.exist
  const options=within(screen.getByRole('listbox',{name:'Under Review or Submitted'})).getAllByRole('option');expect(options[0].textContent).to.include('First Journal');expect(options[1].closest('li')?.className).to.equal('sequence-other-area');expect(options[1].hasAttribute('disabled')).to.equal(false)
  fireEvent.click(options[1]);expect(JSON.parse(localStorage.getItem('submission-sequence:areas')!).reviewId).to.equal('J2')
  view.rerender(<SubmissionSequencePlanner {...props}/>);fireEvent.click(screen.getByRole('combobox',{name:'Under Review or Submitted'}));expect(screen.queryByText('Other areas')).to.equal(null);expect(within(screen.getByRole('listbox',{name:'Under Review or Submitted'})).getAllByRole('option')).to.have.length(2)
 })
})

describe('Persistent quality preference',()=>{
 afterEach(()=>localStorage.clear())
 it('places the quality checkbox first and replans from existing scores without AI',()=>{
  const suggest=sinon.spy();const targets=[{...journals[0],rank:'A'},{...journals[1],rank:'B'}]
  localStorage.setItem('submission-sequence:quality-toggle',JSON.stringify({reviews:{},chosen:['J2'],months:12}))
  render(<SubmissionSequencePlanner venues={targets} scores={{J1:80,J2:98}} projectId="quality-toggle" onSuggest={suggest}/>);
  const checkbox=screen.getByRole('checkbox',{name:'Prioritize quality'});expect(checkbox).to.equal(document.querySelector('.sequence-review-toggles input'));expect((checkbox as HTMLInputElement).checked).to.equal(true);expect(screen.queryByRole('button',{name:'Prioritize quality'})).to.equal(null)
  fireEvent.click(checkbox);expect(JSON.parse(localStorage.getItem('submission-sequence:quality-toggle')!).prioritizeQuality).to.equal(false);expect(JSON.parse(localStorage.getItem('submission-sequence:quality-toggle')!).chosen[0]).to.equal('J2')
  fireEvent.click(checkbox);expect(JSON.parse(localStorage.getItem('submission-sequence:quality-toggle')!).chosen[0]).to.equal('J1');expect(suggest.called).to.equal(false)
 })
})

describe('Insertion relevance without hiding the catalog',()=>{afterEach(()=>localStorage.clear());it('ranks related journals first and keeps lower-fit entries selectable in both AI modes',()=>{const relevant={...journals[0],id:'relevant',title:'Related',area:'SE'},other={...journals[0],id:'other',title:'Unrelated',area:'AI'};render(<SubmissionSequencePlanner venues={[relevant]} catalog={[other,relevant]} scores={{relevant:95,other:20}} projectId="relevance"/>);fireEvent.click(screen.getByRole('button',{name:'Add next submission choice'}));let rows=document.querySelectorAll('.sequence-insert-results>button');expect(rows[0].textContent).to.include('Related');expect(rows[1].classList.contains('sequence-less-related')).to.equal(true);expect((rows[1] as HTMLButtonElement).disabled).to.equal(false);fireEvent.click(screen.getByRole('button',{name:'Prioritize AI-recommended targets'}));rows=document.querySelectorAll('.sequence-insert-results>button');expect(rows.length).to.equal(2);expect(rows[0].textContent).to.include('Related');fireEvent.click(rows[1]);expect(JSON.parse(localStorage.getItem('submission-sequence:relevance')!).chosen).to.include('other')})})
