import {expect} from 'chai'
import {render,screen,fireEvent,cleanup,within,waitFor} from '@testing-library/react'
import sinon from 'sinon'
import {SourceControlView} from '@/features/source-control/source-control-panel'
const snapshot={connected:true,branches:[],graph:[{hash:'a'.repeat(40),parents:[],author:'Audit',email:'audit@example.test',date:'2026-01-01T00:00:00Z',subject:'Initial',refs:''}],status:{branch:'main',detached:false,upstream:null,ahead:0,behind:0,conflicted:[],files:[{path:'staged.tex',index:'M',workingTree:' '},{path:'working.tex',index:' ',workingTree:'M'}]}}
describe('Git menu action audit',()=>{
 afterEach(cleanup)
 for(const root of ['Repository actions','More changes actions'])for(const scope of ['auto','staged','all'])for(const variant of ['normal','amend','signoff']){
  const label=(scope==='auto'?'Commit':scope==='staged'?'Commit Staged':'Commit All')+(variant==='amend'?' (Amend)':variant==='signoff'?' (Signed Off)':'')
  it(`${root}: ${label} sends correct native commit flags`,async()=>{
   const command=sinon.stub().callsFake(async body=>body.command==='commitPreview'?{result:{fingerprint:'f'.repeat(64),paths:['staged.tex']}}:body.command==='amendDetails'?{result:{head:'a'.repeat(40),branch:'main',message:'Previous'}}:snapshot)
   render(<SourceControlView api={{status:sinon.stub().resolves(snapshot),initialize:sinon.stub(),command}}/>)
   fireEvent.click(await screen.findByRole('button',{name:root,exact:true}));fireEvent.click(screen.getByRole('button',{name:'Commit submenu'}));fireEvent.click(within(screen.getByRole('menu',{name:'Commit actions'})).getByText(label,{exact:true}))
   const dialog=await screen.findByRole('dialog')
   fireEvent.change(within(dialog).getByRole('textbox',{name:'Commit message'}),{target:{value:'Audit message'}})
   fireEvent.click(within(dialog).getByRole('button',{name:variant==='amend'?'Amend commit':'Commit',exact:true}))
   await waitFor(()=>expect(command).to.have.been.calledWith({command:'commit',fingerprint:'f'.repeat(64),message:'Audit message',all:scope==='all',amend:variant==='amend',signoff:variant==='signoff',...(variant==='amend'?{expectedHead:'a'.repeat(40),expectedBranch:'main'}:{})}))
  })
 }
 const cases=[
  {group:'Pull, Push',label:'Sync…',command:'sync',fields:{},expected:{remote:'origin',branch:'main'}},
  {group:'Pull, Push',label:'Pull (Rebase)…',command:'pull',fields:{},expected:{remote:'origin',branch:'main',rebase:true}},
  {group:'Pull, Push',label:'Pull from…',command:'pull',fields:{Remote:'mirror',Branch:'source'},expected:{remote:'mirror',branch:'source'}},
  {group:'Pull, Push',label:'Push to…',command:'push',fields:{Remote:'mirror',Branch:'source'},expected:{remote:'mirror',branch:'source',publish:false}},
  {group:'Pull, Push',label:'Fetch (Prune)…',command:'fetch',fields:{},expected:{remote:'origin',prune:true}},
  {group:'Branch',label:'Publish branch…',command:'push',fields:{},expected:{remote:'origin',branch:'main',publish:true}},
  {group:'Branch',label:'Rename branch…',command:'renameBranch',fields:{'New name':'renamed'},expected:{from:'main',to:'renamed'}},
  {group:'Branch',label:'Delete merged branch…',command:'deleteBranch',fields:{'Branch name':'old'},expected:{name:'old'}},
  {group:'Branch',label:'Rebase onto…',command:'rebase',fields:{'Branch, tag or commit':'base'},expected:{ref:'base'}},
  {group:'Commit',label:'Cherry-pick…',command:'cherryPick',fields:{'Branch, tag or commit':'base'},expected:{ref:'base'}},
  {group:'Commit',label:'Revert commit…',command:'revert',fields:{'Branch, tag or commit':'base'},expected:{ref:'base'}},
  {group:'Remote',label:'Add remote…',command:'addRemote',fields:{'HTTPS repository URL':'https://example.test/repo.git'},expected:{name:'origin',url:'https://example.test/repo.git'}},
  {group:'Stash',label:'Stash',command:'stash',fields:{},expected:{message:'Unfinished work',mode:'tracked'}},
  {group:'Stash',label:'Stash (Include Untracked)',command:'stash',fields:{},expected:{message:'Unfinished work',mode:'include-untracked'}},
  {group:'Stash',label:'Stash Staged',command:'stash',fields:{},expected:{message:'Unfinished work',mode:'staged'}},
  {group:'Tags',label:'Create tag…',command:'createTag',fields:{'Tag name':'v1'},expected:{name:'v1',ref:'HEAD'}},
  {group:'Tags',label:'Delete tag…',command:'deleteTag',fields:{'Tag name':'v1'},expected:{name:'v1'}},
  {group:'Tags',label:'Push Tags…',command:'pushTags',fields:{},expected:{remote:'origin'}},
  {group:'Worktrees',label:'Create Worktree…',command:'createWorktree',fields:{'New branch name':'parallel'},expected:{name:'parallel',from:'HEAD'}},
 ]
 for(const item of cases)it(`${item.group}: ${item.label} dispatches the selected operation`,async()=>{
  const command=sinon.stub().resolves(snapshot)
  render(<SourceControlView api={{status:sinon.stub().resolves(snapshot),initialize:sinon.stub(),command}}/>)
  if (['renameBranch','deleteBranch'].includes(item.command)) {fireEvent.click(await screen.findByRole('button',{name:/^main/}));fireEvent.click(screen.getByText(item.label,{exact:true}))} else {fireEvent.click(await screen.findByRole('button',{name:'Repository actions'}));fireEvent.click(screen.getByRole('button',{name:item.group+' submenu'}));fireEvent.click(within(screen.getByRole('menu',{name:item.group+' actions'})).getByText(item.label,{exact:true}))}
  const dialog=await screen.findByRole('dialog')
  for(const [label,value] of Object.entries(item.fields))fireEvent.change(within(dialog).getByRole('textbox',{name:label}),{target:{value}})
  fireEvent.submit(dialog.querySelector('form')!)
  await waitFor(()=>{const request=command.args.find(([b])=>b.command===item.command)?.[0];expect(request).to.deep.include({command:item.command,...item.expected});if(item.command==='pull')expect(request.operationId).to.match(/^[a-f0-9-]{36}$/)})
 })
})
