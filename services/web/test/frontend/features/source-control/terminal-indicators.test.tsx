import {expect} from 'chai'
import {render,screen,cleanup} from '@testing-library/react'
import CommitGraph from '@/features/source-control/commit-graph'
import type {TerminalIndicator} from '@/features/source-control/types'
const sessions:TerminalIndicator[]=[{userId:'alice',displayName:'Alice Example',name:'Build',state:'running'},{userId:'bob',displayName:'Bob Example',name:'Check',state:'stopped'}]
describe('Terminal graph user indicators',()=>{
 afterEach(cleanup)
 for(const detailed of [false,true])it(`shows avatars and hover identity in ${detailed?'full':'sidebar'} graph`,()=>{
  const commit={hash:'abc',parents:[],subject:'Commit',author:'Author',email:'',date:'',refs:'main',terminals:sessions}
  const branch={name:'main',ref:'refs/heads/main',commit:'abc',upstream:null,author:'',email:'',date:'',subject:'',remote:false,terminals:sessions}
  const view=render(<CommitGraph commits={[commit]} branches={[branch]} detailed={detailed} onSelect={()=>{}} busy={false}/>)
  expect(screen.getAllByLabelText(/Alice Example\s+Build · Running/)).to.have.length(1)
  expect(screen.getAllByLabelText(/Bob Example\s+Check · Ended/)[0].className).to.include('is-stopped')
  expect(screen.queryByText('Alice Example')).to.equal(null)
  expect(screen.getAllByText('AE')).to.have.length(1)
  view.rerender(<CommitGraph commits={[{...commit,terminals:[]}]} branches={[{...branch,terminals:[]}]} detailed={detailed} onSelect={()=>{}} busy={false}/>)
  expect(screen.queryByLabelText(/Alice Example\s+Build · Running/)).to.equal(null)
 })
})
