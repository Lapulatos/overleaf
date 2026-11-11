import {expect} from 'chai'
import {render,screen,cleanup,fireEvent} from '@testing-library/react'
import JournalDetail,{JournalCover} from '@/features/plugins/journal-detail'
import type {Venue} from '@/features/plugins/submission-deadlines'
const venue={id:'journal-fixture',title:'AEI',description:'Advanced Engineering Informatics',kind:'journal',website:'https://example.org/journal',events:[]} as unknown as Venue
const detail={journal:{articleTypes:['Original research','Reviews'],topics:['Knowledge representation'],guide:'https://example.org/guide'},requirements:[],templates:[],submission:[],sources:[]}
describe('Journal detail',()=>{
 afterEach(cleanup)
 it('shows article types and scope without a conference timeline or empty Track section',()=>{const {container}=render(<JournalDetail venue={venue} detail={detail}/>);expect(screen.getByText('Original research')).to.exist;expect(screen.getByRole('link',{name:'Author guide ↗'}).getAttribute('href')).to.equal('https://example.org/guide');expect(container.querySelector('.venue-detail-tracks')).to.equal(null);expect(container.textContent).not.to.match(/undefined|Not verified/);expect(container.textContent).not.to.match(/0$/)})
 it('reuses requirements only when sourced evidence exists',()=>{render(<JournalDetail venue={venue} detail={{...detail,requirements:[{id:'scope',label:'Scope',excerpts:[{text:'Research on knowledge-intensive engineering.',source:'https://example.org/guide'}]}]}}/>);expect(screen.getByText('View requirements')).to.exist;expect(screen.getByRole('link',{name:'Official author guide ↗'})).to.exist})
 it('omits a missing or failed cover without a broken image placeholder',()=>{const {rerender}=render(<JournalCover title="AEI"/>);expect(screen.queryByRole('img')).to.equal(null);rerender(<JournalCover title="AEI" profile={{cover:'https://ars.els-cdn.com/content/image/X14740346.jpg'}}/>);fireEvent.error(screen.getByRole('img'));expect(screen.queryByRole('img')).to.equal(null)})
})
describe('Journal coverage gaps',()=>{
 afterEach(cleanup)
 it('does not render an empty Publishing card for any journal without source data',()=>{render(<JournalDetail venue={{...venue,website:null}} detail={{...detail,journal:null}}/>);expect(screen.queryByRole('region',{name:'Journal submission'})).to.equal(null);expect(screen.getByRole('status').textContent).to.include('Official journal details')})
})
