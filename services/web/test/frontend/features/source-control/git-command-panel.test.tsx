import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react'
import {EditorManagerContext} from '@/features/ide-react/context/editor-manager-context'
import {useGitCommand} from '@/features/source-control/git-command-panel'
import type {GitApi} from '@/features/source-control/api'
function Fixture({api,text}:{api:GitApi;text:string}){const git=useGitCommand('fixture',api);return <><button onClick={()=>void git.start(text).catch(()=>{})}>Submit</button>{git.panel}</>}
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
 it('serves help without an editor or API request',async()=>{
  const command=sinon.stub();render(<Fixture api={{command,status:sinon.stub(),initialize:sinon.stub()}} text="/git help pull"/>)
  fireEvent.click(screen.getByText('Submit'));await screen.findByText(/Pull origin\/current branch/);expect(command).not.to.have.been.called
 })
})
