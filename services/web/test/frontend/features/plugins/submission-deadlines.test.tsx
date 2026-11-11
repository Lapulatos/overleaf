import VenueMetrics, {MetricContext} from '@/features/plugins/venue-metrics'
import {VenueBadges,VenueConferenceInfo} from '@/features/plugins/venue-display'
import VenueCountdown from '@/features/plugins/venue-countdown'
import { expect } from 'chai'
import sinon from 'sinon'
import { render,screen,fireEvent,cleanup,within } from '@testing-library/react'
import * as requests from '@/infrastructure/fetch-json'
import SubmissionDeadlines,{nextDeadline,type Venue} from '@/features/plugins/submission-deadlines'
const venue:Venue={id:'AI/test~2027~0',title:'TESTCONF',description:'Test Conference',kind:'conference',year:2027,area:'AI',rank:'A',round:'Main track',website:'https://example.org',sourceUrl:'https://ccfddl.com',events:[{label:'Abstract',original:'Past deadline',timezone:'AoE',utc:new Date(Date.now()-86400000).toISOString()},{label:'Paper',original:'Upcoming deadline',timezone:'AoE',utc:new Date(Date.now()+86400000*5).toISOString()}]}
describe('Submission deadline planner',function(){
 afterEach(function(){cleanup();sinon.restore();localStorage.removeItem('submission-deadlines-tracked')})
 it('shows cutoff timezone, passed abstract warning and persistent tracking',async function(){
  sinon.stub(requests,'getJSON').resolves({venues:[venue],fetched:Date.now(),stale:false});render(<SubmissionDeadlines onBack={()=>{}}/>);
  expect(await screen.findByRole('button',{name:/TESTCONF 2027/})).to.exist;expect(screen.getByText(/Abstract deadline passed/).closest('.venue-row-dates')).to.exist;expect(screen.getByRole('button',{name:/TESTCONF: Paper, Upcoming deadline AoE/})).to.exist;
  fireEvent.click(screen.getByRole('button',{name:'Track TESTCONF Main track'}));expect(JSON.parse(localStorage.getItem('submission-deadlines-tracked')||'[]')).to.deep.equal(['AI/test']);
  fireEvent.change(screen.getByLabelText('Search venues'),{target:{value:'missing'}});expect(screen.getByText(/No matching venues/)).to.exist
 })
 it('retains an elapsed box after the final conference milestone',function(){
  const now=Date.parse('2026-11-04T00:00:00Z');render(<VenueCountdown venue={{...venue,events:[{label:'Paper',original:'',timezone:'UTC',utc:'2026-01-01T00:00:00Z'}],milestones:[{label:'Conference starts',original:'',timezone:'UTC',utc:'2026-10-01T00:00:00Z'}]}} now={now} showOtherDeadlines={false}/>);
  expect(screen.getByText('Last milestone · Conference starts')).to.exist;expect(screen.getByText('34d 0h 0m past')).to.exist;expect(document.querySelector('.venue-countdown.is-past')).to.exist;
 })
 it('keeps detail actions on Tracks and moves the official link and star into the title',async function(){
  sinon.stub(requests,'getJSON').callsFake(async(url:any)=>String(url).includes('/detail')?{venue,fetched:Date.now(),sources:[],requirements:[],templates:[],submission:[]}:{venues:[venue],fetched:Date.now(),stale:false});
  render(<SubmissionDeadlines onBack={()=>{}}/>);fireEvent.click(await screen.findByRole('button',{name:/TESTCONF 2027/}));expect(screen.queryByText('Links & templates')).to.equal(null);expect(screen.queryByText('Submission requirements')).to.equal(null);expect(screen.queryByText('Source access & freshness')).to.equal(null);expect(screen.queryByRole('button',{name:'Check my paper with AI'})).to.equal(null);expect(screen.queryByRole('button',{name:'Convert to new LaTeX ZIP'})).to.equal(null);expect(document.querySelector('.venue-overview')).to.equal(null);expect(document.querySelector('.venue-detail-title-row .venue-star')).to.exist;expect(document.querySelector('.venue-detail-title-row a')?.getAttribute('href')).to.equal(venue.website);fireEvent.click(screen.getByRole('button',{name:'Track TESTCONF'}));expect(screen.getByRole('button',{name:'Untrack TESTCONF'}).getAttribute('aria-pressed')).to.equal('true');
 })
 it('shows journal badges and requirements without a conference timeline',async function(){
  const journal={...venue,id:'journal',kind:'journal',description:'Journal full name',events:[]};
  sinon.stub(requests,'getJSON').callsFake(async(url:any)=>String(url).includes('/detail')?{venue:journal,fetched:Date.now(),sources:[],requirements:[],templates:[],submission:[]}:{venues:[journal],fetched:Date.now(),stale:false});
  render(<SubmissionDeadlines onBack={()=>{}}/>);const button=await screen.findByRole('button',{name:/TESTCONF 2027 \(Journal\)/});expect(screen.queryByText('Submission dates unconfirmed')).to.equal(null);expect(document.querySelector('.venue-axis')).to.equal(null);fireEvent.click(button);expect(screen.queryByText('Links & templates')).to.equal(null);expect(document.querySelector('.venue-detail-timeline')).to.equal(null);expect(document.querySelector('.deadline-heading .venue-type-badge')?.textContent).to.contain('(Journal');expect(document.querySelector('.deadline-heading p')?.textContent).to.equal('Journal full name');
 })
 it('keeps all rank menus stable when blank areas receive focus and closes on outside clicks',async function(){
  sinon.stub(requests,'getJSON').resolves({venues:[venue],fetched:Date.now(),stale:false});render(<SubmissionDeadlines onBack={()=>{}}/>);await screen.findByText('1 venues & rounds');
  for(const menu of Array.from(document.querySelectorAll<HTMLDetailsElement>('.venue-rank-filter'))){menu.open=true;fireEvent.blur(menu.querySelector('summary')!,{relatedTarget:window});expect(menu.open).to.equal(true);fireEvent.blur(menu.querySelector('summary')!,{relatedTarget:null});expect(menu.open).to.equal(true);fireEvent.pointerDown(document.body);expect(menu.open).to.equal(false)}
 })
 it('dismisses ranking menus without discarding selected values',async function(){
  sinon.stub(requests,'getJSON').resolves({venues:[venue],fetched:Date.now(),stale:false});render(<SubmissionDeadlines onBack={()=>{}}/>);await screen.findByText('1 venues & rounds');
  const summary=screen.getByText('CCF · All');const menu=summary.closest('details')!;fireEvent.click(summary);expect(menu.open).to.equal(true);fireEvent.click(screen.getByLabelText('CCF A'));expect(menu.open).to.equal(true);fireEvent.pointerDown(screen.getByLabelText('Search venues'));expect(menu.open).to.equal(false);fireEvent.click(screen.getByText('CCF · 1'));expect((screen.getByLabelText('CCF A') as HTMLInputElement).checked).to.equal(true);fireEvent.mouseLeave(menu);expect(menu.open).to.equal(false);
 })
 it('simplifies source disclosures and star controls for both venue kinds',async function(){
  const journal={...venue,id:'journal-card',kind:'journal',title:'JOURNAL',events:[]};sinon.stub(requests,'getJSON').resolves({venues:[venue,journal],fetched:Date.now(),stale:false});render(<SubmissionDeadlines onBack={()=>{}}/>);await screen.findByText('2 venues & rounds');const card=document.querySelector('[data-venue-id="journal-card"]')!;expect(card.classList.contains('is-journal')).to.equal(true);expect(card.querySelector('.venue-row-dates')).to.equal(null);expect(card.querySelector('details')).to.equal(null);expect(card.querySelector('.venue-star .material-symbols')).to.exist;expect(card.querySelector('a')?.getAttribute('href')).to.equal('https://example.org');const conference=document.querySelector('[data-venue-id="AI/test~2027~0"]')!;expect(conference.querySelector('.venue-row-dates')).to.exist;expect(conference.querySelector('.venue-countdown-events')).to.equal(null);expect(conference.querySelector('.venue-metrics details')).to.equal(null);expect(conference.querySelector('.venue-star .material-symbols')).to.exist;
 })
 it('shows conference dates and location independently only when confirmed',function(){
  const {rerender}=render(<VenueConferenceInfo venue={{...venue,date:'August 15–17, 2027',place:'TBD'}}/>);
  expect(screen.getByText('August 15–17, 2027')).to.exist;expect(screen.queryByText(/Location/)).to.equal(null);
  rerender(<VenueConferenceInfo venue={{...venue,date:'To be confirmed',place:'Hengqin, China'}}/>);expect(screen.getByText('Hengqin, China')).to.exist;expect(screen.queryByText(/Conference dates/)).to.equal(null);
  rerender(<VenueConferenceInfo venue={{...venue,date:'TBA',place:'Tentative location'}}/>);expect(document.querySelector('.venue-conference-info')).to.equal(null);
 })
 it('hides uncertain metrics and ranks and puts primary links first',function(){
  const journal={...venue,id:'unknown-journal',kind:'journal',description:'Test Journal',rank:null,ranks:{ccf:'unknown',core:'N',thcpl:'unknown'}};
  render(<MetricContext.Provider value={{'journal:testjournal':{name:'Test Journal',sci:'Not verified',ei:'Unknown',sources:[{url:'https://example.org/index',label:'Index'},{url:'https://example.org/journal',label:'Publisher'}]}}}><VenueBadges venue={journal}/><VenueMetrics venue={journal}/></MetricContext.Provider>);
  expect(screen.queryByText(/not provided|Not verified|Unknown|Non-CORE/)).to.equal(null);expect(screen.getAllByRole('link')[0].textContent).to.equal('Publisher ↗');cleanup();
  render(<MetricContext.Provider value={{'conference:testconference:2027':{name:'Test Conference',eiPaper:'Not verified',sources:[{url:'https://example.org/index',label:'Index'}]}}}><VenueMetrics venue={venue}/></MetricContext.Provider>);
  expect(screen.queryByText(/EI paper inclusion/)).to.equal(null);expect(screen.getAllByRole('link')[0].textContent).to.equal('Conference Link ↗');expect(screen.getAllByRole('link')[0].getAttribute('href')).to.equal(venue.website);
 })
 it('does not turn an unknown date into a countdown',function(){expect(nextDeadline({...venue,events:[{label:'Paper',original:'TBD',timezone:'PT',utc:null}]},Date.now())).to.equal(undefined)})
 it('combines multiple full-name areas, rank groups and an enabled calendar window',async function(){
  const other={...venue,id:'SE/other~2027~0',title:'OTHER',area:'SE',rank:'N',ranks:{ccf:'N',core:'A*',thcpl:'B'}};
  const distant={...venue,id:'DB/late~2027~0',title:'LATE',area:'DB',events:[{...venue.events[1],utc:new Date(Date.now()+86400000*60).toISOString()}]};
  sinon.stub(requests,'getJSON').resolves({venues:[venue,other,distant],fetched:Date.now(),stale:false});render(<SubmissionDeadlines onBack={()=>{}} workspace/>);
  await screen.findByText('3 venues & rounds');expect((screen.getByLabelText('Window') as HTMLSelectElement).disabled).to.equal(false);
  fireEvent.click(screen.getByRole('button',{name:'Artificial Intelligence'}));fireEvent.click(screen.getByRole('button',{name:'Software Engineering'}));expect(screen.getByText('2 venues & rounds')).to.exist;
  const ccf=screen.getByText('CCF · All');fireEvent.click(ccf);fireEvent.click(screen.getByLabelText('Non-CCF'));expect(screen.getByText('1 venues & rounds')).to.exist;
  fireEvent.click(within(screen.getByRole('group',{name:'CCF rankings'})).getByRole('button',{name:'Clear'}));fireEvent.click(screen.getByRole('button',{name:'Clear areas'}));fireEvent.change(screen.getByLabelText('Window'),{target:{value:'30'}});expect(screen.getByText('2 venues & rounds')).to.exist;
  fireEvent.click(screen.getByRole('button',{name:'Timeline'}));expect(screen.getByText('2 venues & rounds')).to.exist;expect(screen.getAllByText('CORE A*')[0]).to.exist;expect(screen.getAllByText('THCPL B')[0]).to.exist;
  fireEvent.click(screen.getByRole('button',{name:'List'}));expect(screen.getByText('2 venues & rounds')).to.exist
 })

})
