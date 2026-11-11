import {expect} from 'chai'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import sinon from 'sinon'
import TrackNavigation,{trackNavigationState} from '../../../../frontend/js/features/plugins/track-navigation'
import type {ConferenceTrack} from '../../../../frontend/js/features/plugins/conference-tracks'
const now=new Date(2027,0,10,16).getTime()
const track={id:'demo',title:'Demo',status:'retrieved',events:[],requirements:[],templates:[],isMain:false,supportsLatex:false,url:'https://example.org',dateNote:''} as ConferenceTrack
const event=(date:string,label='Submission deadline')=>({date,label,utc:null,original:date,timezone:'Time not confirmed'})
describe('Track navigation cards',()=>{
 afterEach(cleanup)
 it('keeps past submission red while displaying the next decision date',()=>{const state=trackNavigationState({...track,events:[event('2027-01-05'),event('2027-02-10','Decision')]},now);expect(state.color).to.equal('closed');expect(state.milestone?.label).to.equal('Decision');expect(state.countdown).to.equal('31d left')})
 it('uses a later submission round and does not treat camera-ready as a new submission',()=>{expect(trackNavigationState({...track,events:[event('2027-01-05'),event('2027-02-01')]},now).color).to.equal('open');expect(trackNavigationState({...track,events:[event('2027-01-05'),event('2027-02-01','Camera-ready submission'),event('2027-03-01','Major revision submission')]},now).color).to.equal('closed')})
 it('keeps date-only deadlines today pending and unknown deadlines neutral',()=>{expect(trackNavigationState({...track,events:[event('2027-01-10')]},now)).to.include({color:'soon',countdown:'Today'});expect(trackNavigationState({...track,events:[event('2027-02-10','Decision')]},now).color).to.equal('unknown');expect(trackNavigationState({...track,events:[event('2027-02-30')]},now).milestone).to.equal(undefined)})
 it('allows clicking an expired Track card',()=>{const select=sinon.spy();const closed={...track,events:[event('2000-01-01')]};const {container}=render(<TrackNavigation tracks={[closed]} onSelect={select}/>);expect(container.querySelector('.is-closed')).to.exist;fireEvent.click(screen.getByRole('button'));expect(select.firstCall.args[0]).to.equal(closed)})
})
