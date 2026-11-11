import {expect} from 'chai'
import {render,screen} from '@testing-library/react'
import VenueCountdown,{remainingTime} from '@/features/plugins/venue-countdown'
import type {Venue} from '@/features/plugins/submission-deadlines'
const now=Date.parse('2026-11-03T00:00:00Z')
const event=(label:string,utc:string|null)=>({label,utc,timezone:'UTC',original:utc||'TBD'})
const venue:Venue={id:'test',title:'Test',description:'Test',kind:'conference',year:2027,area:'AI',rank:'A',round:'Main',website:null,sourceUrl:'https://example.org',events:[event('Paper','2026-11-06T01:05:00Z'),event('Abstract','2026-11-04T00:00:00Z')]}
describe('Venue deadline countdowns',function(){
 it('uses UTC elapsed duration and handles boundary and unknown dates',function(){expect(remainingTime('2026-11-06T01:05:00Z',now)).to.equal('3d 1h 5m left');expect(remainingTime('2026-11-02T12:00:00-12:00',now)).to.equal('Closed');expect(remainingTime('2026-11-03T00:00:30Z',now)).to.equal('Less than 1 min left');expect(remainingTime(null,now)).to.equal('Date unconfirmed')})
 it('emphasizes the earliest submission cutoff and lists abstract and paper separately',function(){const {container,rerender}=render(<VenueCountdown venue={venue} now={now}/>);expect(screen.getByText('Next submission deadline · Abstract')).to.exist;expect(screen.getByText('3d 1h 5m left')).to.exist;expect(container.querySelector('.is-urgent')).to.exist;rerender(<VenueCountdown venue={venue} now={now} compact/>);expect(screen.getByText('Next deadline · Abstract')).to.exist;expect(screen.getByText('1d 0h 0m left')).to.exist;expect(container.querySelector('.venue-countdown-events')).to.equal(null)})
 it('labels post-submission events as milestones without reopening the paper deadline',function(){render(<VenueCountdown venue={{...venue,events:[event('Paper','2026-10-01T00:00:00Z')],milestones:[event('Decision','2026-11-10T00:00:00Z')]}} now={now}/>);expect(screen.getByText('Next milestone · not a submission deadline · Decision')).to.exist;expect(screen.queryByText('Closed')).to.equal(null)})
})
