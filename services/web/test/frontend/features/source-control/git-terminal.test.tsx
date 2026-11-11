import { expect } from 'chai'
import sinon from 'sinon'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import GitTerminal from '@/features/source-control/git-terminal'
describe('Repository PTY terminal', () => {
 afterEach(cleanup)
 it('streams shell input and output and closes its server session on unmount', async () => {
  let send!: (value: string) => void
  const terminal = { open: sinon.stub(), onData: (cb: typeof send) => { send = cb }, resize: sinon.stub(), focus: sinon.stub(), write: sinon.stub(), writeln: sinon.stub(), dispose: sinon.stub() }
  const command = sinon.stub().callsFake(async c => ({ result: c.command === 'terminalOpen' ? { id: 'session', directory: '/server/repo' } : c.command === 'terminalPoll' ? { output: 'shell output', exited: false } : {} }))
  const view=render(<GitTerminal createTerminal={async () => terminal as any} api={{ command, status: sinon.stub(), initialize: sinon.stub() }} onClose={() => {}} onChanged={() => {}} />)
  await screen.findByText('/server/repo')
  send('python3 --version | cat\r')
  await waitFor(() => expect(command).to.have.been.calledWith({ command: 'terminalInput', id: 'session', input: 'python3 --version | cat\r' }))
  await waitFor(() => expect(terminal.write).to.have.been.calledWith('shell output'))
  const divider = screen.getByRole('separator', { name: 'Resize terminal' })
  fireEvent.keyDown(divider, { key: 'ArrowUp' })
  expect(divider.getAttribute('aria-valuenow')).to.equal('250')
  view.unmount()
  expect(command).to.have.been.calledWith({ command: 'terminalClose', id: 'session' })
  expect(terminal.dispose).to.have.been.calledOnce
 })
 it('follows output at the bottom, preserves scrollback, and returns on input', async () => {
  let send!: (value:string)=>void, scroll!: ()=>void
  const buffer={active:{viewportY:0,baseY:0}}
  const terminal={open:sinon.stub(),onData:(cb:typeof send)=>{send=cb},onScroll:(cb:typeof scroll)=>{scroll=cb},buffer,resize:sinon.stub(),focus:sinon.stub(),write:(_s:string,done:()=>void)=>done(),writeln:sinon.stub(),dispose:sinon.stub(),scrollToBottom:sinon.stub()}
  const command=sinon.stub().callsFake(async c=>({result:c.command==='terminalOpen'?{id:'scroll-session',directory:'/scroll/repo'}:c.command==='terminalPoll'?{output:'line\r\n',exited:false}:{}}))
  render(<GitTerminal createTerminal={async()=>terminal as any} api={{command,status:sinon.stub(),initialize:sinon.stub()}} onClose={()=>{}} onChanged={()=>{}} />)
  await screen.findByText('/scroll/repo')
  await waitFor(()=>expect(terminal.scrollToBottom).to.have.been.called)
  buffer.active.baseY=20;buffer.active.viewportY=5
  const {act}=await import('@testing-library/react')
  act(()=>scroll())
  await screen.findByRole('button',{name:'Back to bottom ↓'})
  terminal.scrollToBottom.resetHistory()
  await new Promise(resolve=>setTimeout(resolve,180))
  expect(terminal.scrollToBottom).not.to.have.been.called
  act(()=>send('ls\r'))
  expect(terminal.scrollToBottom).to.have.been.calledOnce
  expect(screen.queryByRole('button',{name:'Back to bottom ↓'})).to.equal(null)
 })

 it('requires a command approval token without sending raw input', async () => {
  const terminal={open:sinon.stub(),onData:sinon.stub(),resize:sinon.stub(),focus:sinon.stub(),write:sinon.stub(),writeln:sinon.stub(),dispose:sinon.stub()}
  const command=sinon.stub().callsFake(async c=>({result:c.command==='accessPolicy'?{mode:'auto-review',directories:[]}:c.command==='terminalOpen'?{id:'review-session',directory:'/review/repo'}:c.command==='terminalPoll'?{output:'',exited:false}:c.command==='terminalRun'&&!c.approval?{approvalRequired:true,approval:'one-use',reason:'Review this write'}:{}}))
  render(<GitTerminal createTerminal={async()=>terminal as any} api={{projectId:'review-mode-fixture',command,status:sinon.stub(),initialize:sinon.stub()}} onClose={()=>{}} onChanged={()=>{}} />)
  await screen.findByRole('textbox',{name:'Reviewed terminal command'})
  await screen.findByText('/review/repo')
  fireEvent.change(screen.getByRole('textbox'),{target:{value:'touch draft'}})
  fireEvent.click(screen.getByRole('button',{name:'Review and run'}))
  await screen.findByText('Review this write')
  fireEvent.click(screen.getByRole('button',{name:'Approve this command'}))
  await waitFor(()=>expect(command).to.have.been.calledWith({command:'terminalRun',id:'review-session',text:'touch draft',approval:'one-use'}))
  expect(command.getCalls().some(call=>call.args[0].command==='terminalInput')).to.equal(false)
 })

})
