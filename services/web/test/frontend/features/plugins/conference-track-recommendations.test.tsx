import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,waitFor} from '@testing-library/react'
import * as requests from '@/infrastructure/fetch-json'
import ConferenceTrackRecommendations from '@/features/plugins/conference-track-recommendations'
import type {Venue} from '@/features/plugins/submission-deadlines'
const venue={id:'conference',title:'CAV',kind:'conference'} as Venue
const track={...venue,id:'track-one',parentVenueId:venue.id,round:'Research Papers',website:'https://example.org/research',track:{title:'Research Papers'}} as Venue
const task={taskId:'task-track',status:'completed',instruction:'recommend',summary:'',output:'',proposals:[]}
const result={paperSummary:'Verification method',limitations:[],recommendations:[{venue:track,score:95,reason:'Fits the verification contribution.',sources:[],eligibility:{status:'unconfirmed',reason:'Artifact availability needs confirmation.'}}]}
describe('Conference Track fit',()=>{
 afterEach(()=>{sinon.restore();localStorage.clear()})
 it('requests only this conference and exposes the best Track and unresolved eligibility',async()=>{
  const post=sinon.stub(requests,'postJSON').resolves({task});sinon.stub(requests,'getJSON').resolves({task,result});const select=sinon.spy()
  render(<ConferenceTrackRecommendations projectId="project" venue={venue} onSelect={select}/>);fireEvent.click(screen.getByRole('button',{name:'Recommend Tracks for my paper'}));await screen.findByText(/Recommended Tracks · 1/);expect(document.querySelector('details.venue-track-results')?.hasAttribute('open')).to.equal(false);fireEvent.click(screen.getByText(/Recommended Tracks · 1/));await screen.findByText('Best fit · Research Papers');expect(screen.queryByText(/Recommendation activity/)).to.equal(null);expect(post.firstCall.args[1]?.body).to.include({venueId:'conference'});expect(document.querySelector('.venue-track-brief')?.textContent).to.include('Artifact availability needs confirmation.');fireEvent.click(screen.getByRole('button',{name:'Best fit · Research Papers'}));expect(select.calledWith(track)).to.equal(true)
 })
 it('reopens saved Track results without starting another analysis',async()=>{
  localStorage.setItem('venue-recommendations:project:conference',task.taskId);const post=sinon.stub(requests,'postJSON');sinon.stub(requests,'getJSON').resolves({task,result});render(<ConferenceTrackRecommendations projectId="project" venue={venue} onSelect={()=>{}}/>);await screen.findByText(/Recommended Tracks · 1/);expect(document.querySelector('details.venue-track-results')?.hasAttribute('open')).to.equal(false);fireEvent.click(screen.getByText(/Recommended Tracks · 1/));await screen.findByText('Best fit · Research Papers');await waitFor(()=>expect(post.callCount).to.equal(0))
 })
})
