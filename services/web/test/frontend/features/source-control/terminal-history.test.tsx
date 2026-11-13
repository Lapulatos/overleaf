import {expect} from 'chai'
import {render,cleanup,waitFor} from '@testing-library/react'
import sinon from 'sinon'
import TerminalHistory from '@/features/source-control/terminal-history'
describe('Read-only terminal history',()=>{
 afterEach(cleanup)
 it('passes saved control sequences intact without registering input, then disposes',async()=>{
  const output='prompt\r\x1b[2Kprompt\r\nresult'
  const terminal={open:sinon.spy(),write:sinon.spy(),resize:sinon.spy(),dispose:sinon.spy(),scrollToBottom:sinon.spy(),onData:sinon.spy(),cols:80,rows:24}
  const view=render(<TerminalHistory output={output} createTerminal={async()=>terminal as any}/>)
  await waitFor(()=>expect(terminal.write.calledOnce).to.equal(true))
  expect(terminal.write.firstCall.args[0]).to.equal(output)
  expect(terminal.onData.called).to.equal(false)
  view.unmount();expect(terminal.dispose.calledOnce).to.equal(true)
 })
})
