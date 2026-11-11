import {expect} from 'chai'
import {trackAvailability} from '@/features/plugins/venue-track-availability'
import type {Venue} from '@/features/plugins/submission-deadlines'
import type {ConferenceTrack} from '@/features/plugins/conference-tracks'
const now=Date.parse('2026-11-04T12:00:00Z')
const venue={id:'availability-fixture',kind:'conference',round:'ARR January cycle',events:[{label:'Paper',utc:'2026-01-05T00:00:00Z'}]} as Venue
const track=(title:string,date:string|undefined,isMain=false)=>({id:title,title,isMain,url:'https://example.org/call',supportsLatex:false,dateNote:'',status:'retrieved',events:date?[{label:'Paper submission deadline',date,utc:null,original:date,timezone:'AoE'}]:[],requirements:[],templates:[]} as ConferenceTrack)
describe('Track availability summaries',()=>{
 it('separates closed and still-open Tracks and omits unknown dates',()=>{const result=trackAvailability(venue,[track('Research Papers','2026-10-02',true),track('Industry Papers','2027-01-23'),track('Artifact Evaluation',undefined)],now);expect(result.closed).to.deep.equal(['Research Papers']);expect(result.open).to.deep.equal(['Industry Papers'])})
 it('names only the exact catalog round until Track dates are available',()=>{expect(trackAvailability(venue,undefined,now)).to.deep.equal({closed:['ARR January cycle'],open:[]})})
 it('does not treat revisions as reopened submissions or unavailable dates as closed',()=>{const closed=track('Research','2026-10-02',true);closed.events.push({label:'Major revision submission',date:'2027-03-05',utc:null,timezone:'',original:''});const unknown={...track('Other','2026-10-02'),status:'unavailable'};expect(trackAvailability(venue,[closed,unknown],now)).to.deep.equal({closed:['Research'],open:[]})})
})
