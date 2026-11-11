import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import {UndatedVenues} from '@/features/plugins/deadline-calendar'
import type {Venue} from '@/features/plugins/submission-deadlines'
const venues:Venue[]=Array.from({length:14},(_,i)=>({id:`j${i}`,title:`Journal ${i}`,description:`Full journal name ${i}`,kind:'journal',year:null,area:'SE',rank:'A',round:'',website:null,sourceUrl:'https://example.org',events:[]}))
describe('Undated venue directory',function(){
 afterEach(cleanup)
 it('paginates existing filter order and resets when filtered results change',function(){
  const select=sinon.spy();const {rerender}=render(<UndatedVenues venues={venues} onSelect={select}/>);
  expect(screen.getAllByRole('button',{name:/View requirements/})).to.have.length(6)
  fireEvent.click(screen.getByRole('button',{name:'Next'}));expect(screen.getByText('7–12 of 14')).to.exist
  fireEvent.click(screen.getByRole('button',{name:'View requirements for Journal 6'}));expect(select.firstCall.args[0]).to.equal(venues[6])
  rerender(<UndatedVenues venues={[venues[13]]} onSelect={select}/>);expect(screen.getByRole('button',{name:'View requirements for Journal 13'})).to.exist;expect(screen.queryByRole('button',{name:'Next'})).to.equal(null)
 })
 it('separates conferences, omits dated journals, and expands on request',async function(){
  const dated={...venues[0],id:'dated',title:'Dated journal',events:[{label:'Paper',utc:'2027-02-01T00:00:00Z',original:'',timezone:'UTC'}]}
  const {container}=render(<UndatedVenues venues={[...venues,dated,{...venues[0],kind:'conference',id:'conference',title:'Conference'}]} onSelect={()=>{}}/>);
  expect(screen.queryByText('Dated journal')).to.equal(null);expect(screen.queryByRole('button',{name:'View requirements for Conference'})).to.equal(null)
  const group=container.querySelectorAll('details')[1];group.open=true;fireEvent(group,new Event('toggle'))
  expect(await screen.findByRole('button',{name:'View requirements for Conference'})).to.exist
 })
})
