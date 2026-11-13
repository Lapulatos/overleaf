import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,cleanup,waitFor,within,act} from '@testing-library/react'
import {EditorManagerContext} from '@/features/ide-react/context/editor-manager-context'
import {useGitCommand} from '@/features/source-control/git-command-panel'
import type {GitApi} from '@/features/source-control/api'
function Fixture({api,text,projectId='fixture'}:{api:GitApi;text:string;projectId?:string}){const git=useGitCommand(projectId,api);return <><button onClick={()=>void git.start(text).catch(()=>{})}>Submit</button>{git.panel}</>}
describe('Paper Assistant Git command execution',()=>{
 afterEach(cleanup)
 for(const mode of ['workspace-write','auto-review','full-access','read-only'])it(`enforces ${mode} for pull and saves editor before execution`,async()=>{
  const command=sinon.stub().callsFake(async body=>({result:body.command==='accessPolicy'?{mode}:{completed:true}}))
  const api={command,status:sinon.stub().resolves({status:{branch:'main'}}),initialize:sinon.stub()}
  const awaitBufferedOps=sinon.stub().resolves(),hasUnsavedChanges=sinon.stub().returns(false)
  render(<EditorManagerContext.Provider value={{openDocs:{awaitBufferedOps,hasUnsavedChanges}} as any}><Fixture api={api} text="/git pull"/></EditorManagerContext.Provider>)
  fireEvent.click(screen.getByText('Submit'))
  if(mode==='read-only'){await screen.findByText(/Read Only mode blocks/);expect(command.getCalls().some(c=>c.args[0].command==='pull')).to.equal(false);return}
  if(mode==='workspace-write'){await screen.findByRole('button',{name:'Run Git operation'});expect(command.getCalls().some(c=>c.args[0].command==='pull')).to.equal(false);fireEvent.click(screen.getByRole('button',{name:'Run Git operation'}))}
  await waitFor(()=>expect(command).to.have.been.calledWith({command:'pull',remote:'origin',branch:'main'}))
  expect(awaitBufferedOps).to.have.been.called
 })
 it('offers shared merge review from slash pull without applying files',async()=>{
  const task={id:'review-task',state:'conflicted',revision:1,remainingPaths:['main.tex'],targetBranch:'main',sourceRef:'refs/remotes/origin/main',leaseGeneration:0}
  const command=sinon.stub().callsFake(async body=>body.command==='pull'?{result:task,reviewRequired:true,collaboration:{drafts:true,apply:true}}:{result:body.command==='accessPolicy'?{mode:'full-access'}:body.command==='mergeDraftReview'?{id:task.id,revision:task.revision,files:[{path:'main.tex',conflicted:true}]}:body.command==='mergeDraftList'?[task]:[]})
  const api={command,status:sinon.stub().resolves({status:{branch:'main'}}),initialize:sinon.stub()}
  render(<EditorManagerContext.Provider value={{openDocs:{awaitBufferedOps:async()=>{},hasUnsavedChanges:()=>false}} as any}><Fixture api={api} text="/git pull"/></EditorManagerContext.Provider>)
  fireEvent.click(screen.getByText('Submit'))
  await screen.findByText(/Files have not been updated/)
  fireEvent.click(screen.getByRole('button',{name:'Review merge task'}))
  const dialog=await screen.findByRole('dialog',{name:'Shared merge tasks'})
  await within(dialog).findByText('main.tex')
  expect(command.getCalls().some(c=>c.args[0].command==='mergeDraftApply')).to.equal(false)
 })
 it('does not offer a late pull result in a different workspace',async()=>{
  let finish!:(value:any)=>void
  const command=sinon.stub().callsFake(async body=>body.command==='accessPolicy'?{result:{mode:'full-access'}}:new Promise(resolve=>{finish=resolve}))
  const api={command,status:sinon.stub().resolves({status:{branch:'main'}}),initialize:sinon.stub()}
  const view=(id:string)=><EditorManagerContext.Provider value={{openDocs:{awaitBufferedOps:async()=>{},hasUnsavedChanges:()=>false}} as any}><Fixture api={api} projectId={id} text="/git pull"/></EditorManagerContext.Provider>
  const rendered=render(view('old'))
  fireEvent.click(screen.getByText('Submit'))
  await waitFor(()=>expect(finish).to.be.a('function'))
  rendered.rerender(view('new'))
  await act(async()=>{finish({result:{id:'old-task',state:'ready-to-apply'},reviewRequired:true,collaboration:{apply:true}})})
  expect(screen.queryByRole('button',{name:'Review merge task'})).to.equal(null)
  expect(screen.queryByText(/old-task/)).to.equal(null)
 })
 it('serves help without an editor or API request',async()=>{
  const command=sinon.stub();render(<Fixture api={{command,status:sinon.stub(),initialize:sinon.stub()}} text="/git help pull"/>)
  fireEvent.click(screen.getByText('Submit'));await screen.findByText(/Pull origin\/current branch/);expect(command).not.to.have.been.called
 })
})
