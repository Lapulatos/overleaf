import {expect} from 'chai'
import sinon from 'sinon'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import VenueLocationSettings from '@/features/settings/components/venue-location-settings'
import {locationEnabled,requestCurrentLocation,setLocationEnabled} from '@/features/plugins/venue-location-preferences'
import {VenueConferenceInfo} from '@/features/plugins/venue-display'
import {VenueLocationProvider} from '@/features/plugins/venue-location-context'
import type {Venue} from '@/features/plugins/submission-deadlines'
const venue:Venue={id:'conference-test',title:'Conference',description:'Test',kind:'conference',year:2027,area:'AI',rank:null,round:'',website:'https://example.org/2027',sourceUrl:'',events:[],place:'Hengqin, China',date:'August 15–17, 2027'}
describe('Conference location permission',function(){
 let original:PropertyDescriptor|undefined
 beforeEach(function(){original=Object.getOwnPropertyDescriptor(navigator,'geolocation');localStorage.clear();setLocationEnabled(false)})
 afterEach(function(){cleanup();setLocationEnabled(false);if(original)Object.defineProperty(navigator,'geolocation',original);else delete (navigator as {geolocation?:unknown}).geolocation;sinon.restore()})
 it('defaults off and never reads location without opt-in',async function(){
  const read=sinon.spy();Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:read}});render(<VenueLocationSettings/>);expect((screen.getByRole('checkbox') as HTMLInputElement).checked).to.equal(false)
  try{await requestCurrentLocation();throw Error('unexpected success')}catch(error){expect(String(error)).to.contain('disabled')};expect(read.called).to.equal(false)
 })
 it('enables via the settings switch and clears permission preference when disabled',async function(){
  const read=sinon.stub().callsFake(success=>success({coords:{latitude:31,longitude:121,accuracy:100}}));Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:read}});render(<VenueLocationSettings/>);fireEvent.click(screen.getByRole('checkbox'));await screen.findByText('Location enabled for this browser.');expect(locationEnabled()).to.equal(true);expect(read.calledOnce).to.equal(true);expect(localStorage.getItem('venue-location-coordinates')).to.equal(null);fireEvent.click(screen.getByRole('checkbox'));expect(locationEnabled()).to.equal(false)
 })
 it('handles denial without retaining an enabled preference',async function(){
  Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(_success:unknown,error:(e:{code:number})=>void)=>error({code:1})}});render(<VenueLocationSettings/>);fireEvent.click(screen.getByRole('checkbox'));await screen.findByText(/Location permission was denied/);expect(locationEnabled()).to.equal(false)
 })
 it('discards a position that arrives after the setting is disabled',async function(){
  let resolve:(position:unknown)=>void=()=>{};Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition:(success:typeof resolve)=>{resolve=success}}});setLocationEnabled(true);const request=requestCurrentLocation();setLocationEnabled(false);resolve({coords:{latitude:31,longitude:121,accuracy:100}});try{await request;throw Error('unexpected success')}catch(error){expect(String(error)).to.contain('turned off')}
 })
 it('makes confirmed physical places clickable, while online and unknown places stay noninteractive',function(){
  const {rerender}=render(<VenueLocationProvider><VenueConferenceInfo venue={venue}/></VenueLocationProvider>);expect(screen.getByRole('button',{name:'Hengqin, China ↗'})).to.exist
  rerender(<VenueLocationProvider><VenueConferenceInfo venue={{...venue,place:'TBD'}}/></VenueLocationProvider>);expect(screen.queryByText(/Location/)).to.equal(null)
  rerender(<VenueLocationProvider><VenueConferenceInfo venue={{...venue,place:'Online'}}/></VenueLocationProvider>);expect(screen.queryByRole('button',{name:'Online ↗'})).to.equal(null);expect(screen.getByText('Online')).to.exist
 })
})
