import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react'
import * as requests from '@/infrastructure/fetch-json'
import VenueConversion,{conversionProgress} from '@/features/plugins/venue-conversion'
import type {Venue} from '@/features/plugins/submission-deadlines'
const venue:Venue={id:'test',title:'Test',description:'Test',kind:'conference',year:2027,area:'AI',rank:'A',round:'Main',website:null,sourceUrl:'https://example.org',events:[]}
const task={taskId:'task',status:'completed',instruction:'convert',summary:'## Converted\nClass changed.\n## Not converted\nPage limit excluded.\n## Needs your decision\nReview anonymity.',output:'',activity:[{id:'compile',kind:'tool',title:'Compile main.tex',status:'completed'}],proposals:[{id:'p',path:'main.tex',before:'old',after:'new',status:'pending'}]}
describe('Independent manuscript conversion',function(){
 beforeEach(function(){localStorage.clear()})
 afterEach(function(){cleanup();sinon.restore();localStorage.clear()})
 it('keeps history hidden until requested and restores it without starting a conversion',async()=>{
  localStorage.setItem('submission-conversion:original:test','task');localStorage.setItem('submission-conversion:original:test:auto','false')
  sinon.stub(requests,'getJSON').resolves({task});const post=sinon.stub(requests,'postJSON')
  render(<VenueConversion projectId="original" venue={venue}/>);expect(screen.queryByRole('dialog')).to.equal(null)
  fireEvent.click(await screen.findByRole('button',{name:'View conversion report'}));expect(await screen.findByRole('dialog')).to.exist
  fireEvent.click(screen.getByRole('button',{name:/close/i}));await waitFor(()=>expect(screen.queryByRole('dialog')).to.equal(null))
  fireEvent.click(screen.getByRole('button',{name:'View conversion report'}));expect(await screen.findByRole('dialog')).to.exist;expect(post.called).to.equal(false)
 })
 it('starts an isolated task and imports the generated ZIP once into a new project',async function(){
  const post=sinon.stub(requests,'postJSON');post.onFirstCall().resolves({task,compliance:{ready:true,issues:[],checks:[]}});post.onSecondCall().resolves({projectId:'new-project'});sinon.stub(requests,'getJSON').resolves({task,compliance:{ready:true,issues:[],checks:[]}});
  render(<VenueConversion projectId="original" venue={venue}/>);fireEvent.click(screen.getByRole('button',{name:'Convert to new LaTeX ZIP'}));
  expect(await screen.findByRole('link',{name:'Open new Overleaf project ↗'})).to.exist;expect(post.callCount).to.equal(2);expect(post.firstCall.args[0]).to.equal('/writing-assist/project/original/submission-conversions');expect(post.secondCall.args[0]).to.equal('/writing-assist/project/original/submission-conversions/task/import');expect(screen.getByRole('link',{name:'Download converted LaTeX ZIP'}).getAttribute('href')).to.include('/task/download');expect(screen.queryByRole('button',{name:/Accept change/})).to.equal(null);expect(screen.getByRole('heading',{name:'Not converted'})).to.exist
 })
 it('does not import when automatic import is disabled, including after remount',async function(){
  const post=sinon.stub(requests,'postJSON').resolves({task,compliance:{ready:true,issues:[],checks:[]}});sinon.stub(requests,'getJSON').resolves({task,compliance:{ready:true,issues:[],checks:[]}});localStorage.setItem('submission-conversion:original:test:auto','false');
  render(<VenueConversion projectId="original" venue={venue}/>);fireEvent.click(screen.getByRole('button',{name:'Convert to new LaTeX ZIP'}));await screen.findByRole('button',{name:'Import ZIP as new project'});expect(post.calledOnce).to.equal(true)
 })
 it('pauses automatic import for compiled output without submission evidence',async function(){const post=sinon.stub(requests,'postJSON').resolves({task});sinon.stub(requests,'getJSON').resolves({task,compliance:{ready:false,issues:['anonymity: unverified'],checks:[]}});render(<VenueConversion projectId="original" venue={venue}/>);fireEvent.click(screen.getByRole('button',{name:'Convert to new LaTeX ZIP'}));await screen.findByText('anonymity: unverified');expect(post.calledOnce).to.equal(true);expect(screen.getByRole('button',{name:'Import draft as new project'})).to.exist})
 it('keeps an uncompiled conversion as a downloadable draft without automatic import',async function(){const draft={...task,activity:[{id:'compile',kind:'tool',title:'Compile main.tex',status:'failed'}]};const post=sinon.stub(requests,'postJSON').resolves({task:draft});sinon.stub(requests,'getJSON').resolves({task:draft});render(<VenueConversion projectId="original" venue={venue}/>);fireEvent.click(screen.getByRole('button',{name:'Convert to new LaTeX ZIP'}));expect(await screen.findByText('Compilation failed')).to.exist;expect(post.calledOnce).to.equal(true);expect(screen.getByRole('link',{name:'Download converted LaTeX ZIP'})).to.exist})
 it('shows an import error without retrying automatically or changing the original',async function(){
  const post=sinon.stub(requests,'postJSON');post.onFirstCall().resolves({task,compliance:{ready:true,issues:[],checks:[]}});post.onSecondCall().rejects(Error('Import needs attention'));sinon.stub(requests,'getJSON').resolves({task,compliance:{ready:true,issues:[],checks:[]}});render(<VenueConversion projectId="original" venue={venue}/>);fireEvent.click(screen.getByRole('button',{name:'Convert to new LaTeX ZIP'}));await screen.findByRole('alert');await waitFor(()=>expect(post.callCount).to.equal(2))
 })
})

describe('Conversion progress summary',function(){
 it('updates the collapsed summary from actual tool activity instead of stale output',function(){
  const active={...task,status:'running',output:'Old commentary',activity:[{id:'source',kind:'tool',title:'fetch_public_source',status:'running'}]} as any
  expect(conversionProgress(active)).to.equal('Reading submission requirements and templates')
  active.activity.push({id:'compile',kind:'tool',title:'compile_project',status:'running'})
  expect(conversionProgress(active)).to.equal('Compiling and checking the converted manuscript')
  active.status='completed'
  expect(conversionProgress(active)).to.include('1 changed files')
  expect(conversionProgress(active)).to.include('review the results')
 })
})
