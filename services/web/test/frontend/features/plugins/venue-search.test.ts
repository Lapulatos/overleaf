import {mergeConferenceRounds} from '@/features/plugins/venue-rounds'
import {expect} from 'chai'
import {matchesVenueSearch,venueSearchPriority} from '@/features/plugins/venue-search'
import type {Venue} from '@/features/plugins/submission-deadlines'
const venue={id:'icpc',title:'ICPC',description:'IEEE International Conference on Program Comprehension',kind:'conference',year:2027,round:'Research',events:[],trackSearch:[{id:'era',title:'Early Research Achievements (ERA)',events:[]}]} as unknown as Venue
 describe('Venue and Track search',()=>{
  for(const query of ['Early Research Achievements','ERA','Early Research Achievements (ERA)','  early   research  ','achievements early','Early Research Achievments','ICPC ERA 2027'])it(`matches ${query}`,()=>expect(matchesVenueSearch(venue,query)).to.equal(true))
  it('does not match an unrelated Track or use a short acronym inside another word',()=>{expect(matchesVenueSearch(venue,'Tool Demonstration')).to.equal(false);expect(matchesVenueSearch({...venue,trackSearch:[],description:'General camera systems'},'ERA')).to.equal(false)})
  it('searches the selected Track rather than every sibling Track',()=>expect(matchesVenueSearch({...venue,track:{title:'Research Papers'} as Venue['track']},'ERA')).to.equal(false))
 })

describe('Punctuated venue abbreviations',()=>{
 const sp={...venue,title:'S&P',description:'IEEE Symposium on Security and Privacy',trackSearch:[]}
 const isca={...venue,title:'ISCA',description:'International Symposium on Computer Architecture',round:'Main papers',trackSearch:[]}
 for(const query of ['S&P','S & P','s & p','S and P'])it(`matches only the intended abbreviation: ${query}`,()=>{expect(matchesVenueSearch(sp,query)).to.equal(true);expect(matchesVenueSearch(isca,query)).to.equal(false)})
 it('prioritizes exact venue names over descriptive matches',()=>{expect(venueSearchPriority(sp,'S & P')).to.equal(2);expect(venueSearchPriority({...isca,description:'Related S&P workshop'},'S&P')).to.equal(0)})
})

it('groups annual rounds for display while preserving their original planning entries',()=>{
 const first={...venue,id:'sp~2027~0',title:'S&P',round:'First deadline'},second={...venue,id:'sp~2027~1',title:'S&P',round:'Second deadline'};const source=[first,second];const rows=mergeConferenceRounds([second],source);expect(rows).to.have.length(1);expect(rows[0].submissionRounds).to.deep.equal(source);expect(rows[0].id).to.equal(second.id);expect(first.round).to.equal('First deadline');expect(mergeConferenceRounds(source)).to.have.length(1);expect(mergeConferenceRounds([...source,{...first,id:'sp~2026~0',year:2026}])).to.have.length(2)
})
