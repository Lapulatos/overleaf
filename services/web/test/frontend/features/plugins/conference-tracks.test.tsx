import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {venueFullName} from '@/features/plugins/venue-display'
import VenueRecommendations from '@/features/plugins/venue-recommendations'
import ConferenceTracks,{TrackGraph,type ConferenceTrack} from '@/features/plugins/conference-tracks'
import * as requests from '@/infrastructure/fetch-json'
import type {Venue} from '@/features/plugins/submission-deadlines'
const venue:Venue={id:'track-test',title:'TEST',description:'Test conference',kind:'conference',year:2027,area:'SE',rank:'A',round:'Main',website:null,sourceUrl:'https://example.org',events:[]}
const tracks:ConferenceTrack[]=['Research papers','Artifact evaluation'].map((title,i)=>({id:`t${i}`,title,url:'https://example.org/'+i,isMain:i===0,status:'retrieved',events:[{label:'Submission',date:`2027-0${i+1}-01`,original:'Date only',utc:null,timezone:'Unconfirmed'}],requirements:[{id:'length',label:'Page limits',excerpts:[{text:i?'Accepted papers only; provide a Docker image.':'10 pages, excluding references.',source:'https://example.org'}]}],supportsLatex:i===0,templates:[],dateNote:'Time unknown'}))
describe('Conference Track branches',function(){
 afterEach(()=>{cleanup();sinon.restore();localStorage.clear()})
 it('distinguishes identically abbreviated journals and conferences by full name',()=>{expect(venueFullName({...venue,title:'ASE',description:'Automated Software Engineering',kind:'journal'})).to.equal('Automated Software Engineering');expect(venueFullName({...venue,title:'ASE',description:'International Conference on Automated Software Engineering'})).to.equal('International Conference on Automated Software Engineering')})
 it('defaults to Main Track and highlights the hovered branch and its points',()=>{const select=sinon.spy();const {container}=render(<TrackGraph tracks={tracks} venue={venue} onSelect={select}/>);expect(container.querySelector('.is-active')?.textContent).to.include('Research papers');fireEvent.mouseEnter(screen.getByRole('button',{name:'Artifact evaluation'}));expect(container.querySelector('.is-active')?.textContent).to.include('Artifact evaluation');fireEvent.click(screen.getByRole('button',{name:/Artifact evaluation: Submission/}));expect(select.firstCall.args[0].id).to.equal('t1')})
 it('keeps requirements collapsed inside each Track and navigation selects its article',async()=>{sinon.stub(requests,'getJSON').resolves({tracks,fetched:Date.now(),notice:'Official tracks'});const {container}=render(<ConferenceTracks venue={venue} projectId="project"/>);await screen.findAllByText('Page limits');const articles=container.querySelectorAll('.track-card');expect(articles).to.have.length(2);expect(container.querySelectorAll('.track-detail')).to.have.length(0);expect(container.querySelectorAll('.track-milestone-number')).to.have.length(0);expect(container.querySelectorAll('.track-full-requirements[open]')).to.have.length(0);fireEvent.click(container.querySelectorAll('.track-navigation-card')[1]);expect(articles[1].classList.contains('is-selected')).to.equal(true);expect(articles[1].querySelector('details')?.open).to.equal(false);expect(screen.getAllByRole('button',{name:'Convert draft to template'}).some(button=>!button.hasAttribute('disabled'))).to.equal(true)})
 it('keeps undated and unavailable Tracks visible without drawing invented points',()=>{const missing={...tracks[1],events:[],status:'unavailable'};const {container}=render(<TrackGraph tracks={[tracks[0],missing]} venue={venue} onSelect={()=>{}}/>);expect(screen.getByRole('button',{name:'Artifact evaluation'})).to.exist;expect(screen.getByText('Source unavailable')).to.exist;expect(container.querySelectorAll('.track-git-dot')).to.have.length(1)})
 it('shows all Track names even when every date is unknown',()=>{render(<TrackGraph tracks={tracks.map(t=>({...t,events:[]}))} venue={venue} onSelect={()=>{}}/>);expect(screen.getAllByText('Dates to confirm')).to.have.length(2);expect(screen.getByText('Artifact evaluation')).to.exist})
 it('sends the exact conference scope when asking AI to compare Tracks',async()=>{
  const task={taskId:'scope-task',status:'running',instruction:'compare',summary:'',output:'Working: commandExecution',proposals:[]}
  const post=sinon.stub(requests,'postJSON').resolves({task});sinon.stub(requests,'getJSON').resolves({task})
  render(<VenueRecommendations projectId="paper" scopeVenueId="conference-id" buttonLabel="Analyze Tracks" onResult={()=>{}} activityTarget={null}/>);
  fireEvent.click(screen.getByRole('button',{name:'Analyze Tracks'}));await screen.findByRole('button',{name:'Recommending…'});expect(post.firstCall.args[1]?.body).to.have.property('venueId','conference-id')
 })

})
