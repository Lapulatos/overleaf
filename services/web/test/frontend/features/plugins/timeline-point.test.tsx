import {expect} from 'chai'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import TimelinePoint from '@/features/plugins/timeline-point'
import {VenueAxis} from '@/features/plugins/venue-display'
import type {Venue} from '@/features/plugins/submission-deadlines'
describe('Immediate milestone information',()=>{
 afterEach(cleanup)
 it('shows tooltip synchronously on hover/focus without a native title delay',()=>{render(<TimelinePoint label="Paper date"><strong>Paper deadline</strong><span>2027-03-01</span></TimelinePoint>);const button=screen.getByRole('button',{name:'Paper date'});expect(button.hasAttribute('title')).to.equal(false);fireEvent.mouseEnter(button);expect(screen.getByRole('tooltip').textContent).to.include('2027-03-01');fireEvent.mouseLeave(button);expect(screen.queryByRole('tooltip')).to.equal(null);fireEvent.focus(button);expect(screen.getByRole('tooltip')).to.exist;fireEvent.keyDown(button,{key:'Escape'});expect(screen.queryByRole('tooltip')).to.equal(null)})
 it('uses the same immediate tooltip for ordinary conference timeline points',()=>{const venue={title:'ICSE',events:[{label:'Paper',utc:'2027-03-01T00:00:00Z',original:'2027-03-01 00:00',timezone:'UTC'}]} as Venue;render(<VenueAxis venue={venue} now={0}/>);fireEvent.mouseEnter(screen.getByRole('button',{name:/ICSE: Paper/}));expect(screen.getByRole('tooltip').textContent).to.include('UTC')})
})
