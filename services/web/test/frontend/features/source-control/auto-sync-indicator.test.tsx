import {expect} from 'chai'
import {render,screen,cleanup} from '@testing-library/react'
import AutoSyncIndicator from '@/features/source-control/auto-sync-indicator'
import CommitGraph from '@/features/source-control/commit-graph'
describe('Automatic sync indicators',()=>{
 afterEach(cleanup)
 it('labels paused sync and removes disabled icon',()=>{
  const view=render(<AutoSyncIndicator policy={{enabled:true,state:'paused'}}/>)
  expect(screen.getByLabelText('Automatic sync · Paused').title).to.equal('Automatic sync · Paused')
  view.rerender(<AutoSyncIndicator policy={{enabled:false,state:'disabled'}}/>)
  expect(screen.queryByLabelText('Automatic sync · Paused')).to.equal(null)
 })
 for(const detailed of [false,true])it(`toggles matching branch icon in ${detailed?'full':'sidebar'} graph`,()=>{
  const commit={hash:'abc',parents:[],subject:'Commit',author:'Author',email:'',date:'',refs:'main'}
  const branch={name:'main',ref:'refs/heads/main',commit:'abc',upstream:null,author:'',email:'',date:'',subject:'',remote:false,autoSync:{enabled:true,state:'scheduled'}}
  const view=render(<CommitGraph commits={[commit]} branches={[branch]} detailed={detailed} onSelect={()=>{}} busy={false}/>)
  expect(screen.getByLabelText('Automatic sync').closest('.native-git-ref')?.textContent).to.include('main')
  view.rerender(<CommitGraph commits={[commit]} branches={[{...branch,autoSync:undefined}]} detailed={detailed} onSelect={()=>{}} busy={false}/>)
  expect(screen.queryByLabelText('Automatic sync')).to.equal(null)
 })
})
