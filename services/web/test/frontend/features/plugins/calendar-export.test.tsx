import { expect } from 'chai'
import { render, screen, fireEvent } from '@testing-library/react'
import sinon from 'sinon'
import { calendarFile, conferenceCalendarEntries, planCalendarEntries } from '@/features/plugins/calendar-export'
import CalendarExportActions from '@/features/plugins/calendar-export-actions'
import type { Venue, DeadlineEvent } from '@/features/plugins/submission-deadlines'
const event = (label:string, utc:string|null, date?:string):DeadlineEvent => ({label,utc,date,original:'Official date',timezone:'AoE'})
const conference = {id:'cav27',title:'CAV',year:2027,description:'Verification',kind:'conference',events:[event('Paper','2027-01-22T11:59:00Z')],milestones:[],sourceUrl:'https://example.com/cav'} as Venue
const journal = {...conference,id:'tse',title:'TSE',kind:'journal'}
describe('Venue calendar exports',()=>{
 it('exports conference and Track dates, excludes journals and deduplicates milestones',()=>{
  const entries=conferenceCalendarEntries([{...conference,milestones:conference.events,trackSearch:[{id:'tools',title:'Tool Papers',events:[event('Decision',null,'2027-03-01'),event('Unconfirmed',null)]}]},journal])
  expect(entries).to.have.length(2);expect(entries[1].title).to.include('Tool Papers');expect(entries[1].allDay).to.equal(true)
  const ics=calendarFile(entries,'Conferences',new Date('2026-11-07T00:00:00Z'))
  expect(ics).to.include('DTSTART:20270122T115900Z');expect(ics).to.include('DTSTART;VALUE=DATE:20270301');expect(ics).to.include('DTEND;VALUE=DATE:20270302');expect(ics).not.to.include('TSE')
 })
 it('includes journal plan dates and stable project-specific IDs after rescheduling',()=>{
  const step={venue:journal,start:Date.parse('2027-01-04T00:00Z'),end:Date.parse('2027-04-04T00:00Z'),conditional:true,withdrawal:false,reason:'Estimated review'}
  const entries=planCalendarEntries([step],'project1');expect(entries).to.have.length(2);expect(entries[1].title).to.include('estimated')
  expect(entries[0].id).to.equal(planCalendarEntries([{...step,start:step.start+86400000}],'project1')[0].id)
  expect(entries[0].id).not.to.equal(planCalendarEntries([step],'project2')[0].id)
 })
 it('escapes text and folds UTF-8 content without injecting calendar properties',()=>{
  const entries=conferenceCalendarEntries([conference]);entries[0].title='测试'.repeat(60)+'\nINJECTED;,\\'
  const ics=calendarFile(entries,'Calendar\nInjected')
  expect(ics.match(/BEGIN:VEVENT/g)).to.have.length(1)
  expect(ics.replace(/\r\n /g,'')).to.include('\\nINJECTED\\;\\,\\\\')
  for(const line of ics.split('\r\n'))expect(new TextEncoder().encode(line).length).to.be.at.most(75)
  expect(ics).to.include('X-WR-CALNAME:Calendar\\nInjected')
 })
 it('omits invalid dates rather than fabricating dates',()=>{
  expect(conferenceCalendarEntries([{...conference,events:[event('Bad',null,'2027-02-30')]}])).to.have.length(0)
 })
 it('downloads ICS and explains import without hiding either provider',()=>{
  Object.defineProperty(URL,'createObjectURL',{configurable:true,value:()=> 'blob:test'});Object.defineProperty(URL,'revokeObjectURL',{configurable:true,value:()=>{}})
  const click=sinon.stub(HTMLAnchorElement.prototype,'click')
  try{render(<CalendarExportActions entries={conferenceCalendarEntries([conference])} name="CAV"/>);fireEvent.click(screen.getByRole('button',{name:'Google Calendar'}));expect(click.calledOnce).to.equal(true);expect(screen.getByRole('status').textContent).to.include('Import & export');fireEvent.click(screen.getByRole('button',{name:'iCloud Calendar'}));expect(screen.getByRole('status').textContent).to.include('choose an iCloud calendar');expect(screen.getAllByRole('button')).to.have.length(2)}finally{click.restore()}
 })
})
