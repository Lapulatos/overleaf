import { expect } from 'chai'
import { render,screen,fireEvent,cleanup } from '@testing-library/react'
import sinon from 'sinon'
import DeadlineCalendar,{calendarEvents} from '@/features/plugins/deadline-calendar'
import DeadlineTimeline,{registrationNotice} from '@/features/plugins/deadline-timeline'
import type { Venue } from '@/features/plugins/submission-deadlines'
const now=Date.parse('2026-11-02T00:00:00Z')
const venue:Venue={id:'test',title:'TEST',description:'Test',kind:'conference',year:2027,area:'AI',rank:'A',round:'Main',website:null,sourceUrl:'https://example.org',events:[{label:'Registration',original:'2026-11-01',timezone:'UTC',utc:'2026-11-01T12:00:00Z'},{label:'Abstract',original:'2026-11-03',timezone:'UTC',utc:'2026-11-03T12:00:00Z'},{label:'Paper',original:'2026-11-05',timezone:'UTC',utc:'2026-11-05T12:00:00Z'}]}
describe('Submission calendar and timeline',function(){
 afterEach(cleanup)
 it('places separate milestones on their actual local dates and excludes unknown dates',function(){
  const groups=calendarEvents([venue,{...venue,id:'unknown',events:[{label:'Paper',original:'TBD',timezone:'UTC',utc:null}]}]);expect(groups.size).to.equal(3);expect(groups.get('2026-11-01')![0].event.label).to.equal('Registration')
 })
 it('opens an event and navigates months without an extra undated directory',function(){
  const select=sinon.spy(),move=sinon.spy();render(<DeadlineCalendar venues={[venue,{...venue,id:'journal',title:'JOURNAL',kind:'journal',schedule:'rolling',events:[]}]} now={now} month={new Date(now)} onMonth={move} onSelect={select}/>);
  expect(screen.getByRole('table',{name:'November 2026 submission deadlines'})).to.exist;expect(screen.queryByText(/Track sources loaded/)).to.equal(null);expect(screen.queryByRole('button',{name:'Load more Track dates'})).to.equal(null);expect(document.querySelector('.deadline-calendar-nav')?.nextElementSibling?.className).to.equal('deadline-calendar-legend');
  fireEvent.click(screen.getByRole('button',{name:/TEST 2027\s*Paper/}));expect(select.calledWith(venue)).to.equal(true);
  fireEvent.click(screen.getByRole('button',{name:'Next month'}));expect(move.firstCall.args[0].getMonth()).to.equal(11);
  expect(screen.queryByRole('region',{name:'Venues without confirmed dates'})).to.equal(null);expect(screen.queryByText('JOURNAL')).to.equal(null)
 })
 for(const count of [0,1,2,3,5])it(`selects a day with ${count} events through its date button`,function(){
  const venues=Array.from({length:count},(_,i)=>({...venue,id:`day-${i}`,title:`Venue ${i}`,events:[venue.events[2]]}));const select=sinon.spy();render(<DeadlineCalendar venues={venues} now={now} month={new Date(now)} onMonth={()=>{}} onSelect={select}/>);
  const date=screen.getByRole('button',{name:'Events on 2026-11-05'});fireEvent.click(date);expect(date.getAttribute('aria-pressed')).to.equal('true');expect(screen.getByRole('region',{name:'Selected day events'}).querySelectorAll('button')).to.have.length(count);expect(select.called).to.equal(false);
 })
 it('groups same-day milestones into a venue card with classification and fit',function(){
  const sameDay={...venue,events:[venue.events[2],{...venue.events[2],label:'Artifact'}]};const select=sinon.spy();render(<DeadlineCalendar venues={[sameDay]} fits={{[venue.id]:{score:91,reason:'Fit',sources:[]}}} now={now} month={new Date(now)} onMonth={()=>{}} onSelect={select}/>);fireEvent.click(screen.getByRole('button',{name:'Events on 2026-11-05'}));const panel=screen.getByRole('region',{name:'Selected day events'});expect(panel.querySelectorAll('.venue-summary-card')).to.have.length(1);expect(panel.textContent).to.include('CCF A').and.include('Fit 91/100').and.include('Artifact').and.include('Paper');fireEvent.click(panel.querySelector('button')!);expect(select.calledWith(sameDay)).to.equal(true);
 })
 it('expands crowded days without losing events',function(){
  const venues=Array.from({length:5},(_,i)=>({...venue,id:String(i),title:'Venue'+i,events:[venue.events[2]]}));render(<DeadlineCalendar venues={venues} now={now} month={new Date(now)} onMonth={()=>{}} onSelect={()=>{}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Show all 5 events on 2026-11-05'}));expect(screen.getByRole('region',{name:'Selected day events'}).querySelectorAll('button').length).to.equal(5)
 })
 it('shows a dated axis and warns about passed registration without asserting eligibility',function(){
  render(<DeadlineTimeline venues={[venue]} now={now} onSelect={()=>{}}/>);expect(screen.getAllByText('Registration deadline passed')).to.have.length(1);
  expect(screen.queryByRole('list',{name:'TEST milestones'})).to.equal(null);expect(screen.getByText('Paper / submission')).to.exist;expect(screen.getByText('Abstract / registration')).to.exist;
  expect(registrationNotice({...venue,events:[venue.events[2]]},now)).to.include('not confirmed')
 })
})

describe('Track calendar dates',()=>{
 it('places date-only Track milestones on the published day without timezone invention',()=>{const track={...venue,id:'track',parentVenueId:venue.id,round:'Tool Demonstrations',events:[{label:'Submission',date:'2026-11-10',utc:null,original:'10 November 2026',timezone:'Not confirmed'}]};const groups=calendarEvents([track]);expect(groups.has('2026-11-10')).to.equal(true);const select=sinon.spy();render(<DeadlineCalendar venues={[track]} now={now} month={new Date(now)} onMonth={()=>{}} onSelect={select}/>);fireEvent.click(screen.getByRole('button',{name:/TEST 2027 · Tool Demonstrations.*Submission/}));expect(select.firstCall.args[0].id).to.equal('track');cleanup()})
})
