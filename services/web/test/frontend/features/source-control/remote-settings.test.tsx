import { expect } from 'chai'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import sinon from 'sinon'
import RemoteSettings from '@/features/source-control/remote-settings'

describe('Repository credentials settings', () => {
  afterEach(cleanup)
  it('configures push credentials separately when remote URLs differ', async () => {
    const command=sinon.stub().callsFake(async body=>body.command==='remotes'?{result:[{name:'origin',refs:{fetch:'https://read.test/paper.git',push:'https://write.test/paper.git'}}]}:{result:{configured:false,username:''}})
    render(<RemoteSettings api={{command,status:sinon.stub(),initialize:sinon.stub()}} onClose={()=>{}}/>)
    const select=await screen.findByLabelText('Credential destination')
    await waitFor(()=>expect((select as HTMLSelectElement).disabled).to.equal(false))
    fireEvent.change(select,{target:{value:'push'}})
    await waitFor(()=>expect(command).to.have.been.calledWith({command:'credentialStatus',remote:'origin',target:'push'}))
    await waitFor(()=>expect((screen.getByLabelText('Username') as HTMLInputElement).disabled).to.equal(false))
    fireEvent.change(screen.getByLabelText('Username'),{target:{value:'author'}})
    fireEvent.change(screen.getByLabelText('Repository access token'),{target:{value:'audit-token'}})
    fireEvent.click(screen.getByRole('button',{name:'Save token'}))
    await waitFor(()=>expect(command).to.have.been.calledWith({command:'saveCredential',remote:'origin',target:'push',username:'author',token:'audit-token'}))
  })
  it('removes only the confirmed remote address and leaves normal settings actions separate', async () => {
    const url = 'https://example.test/paper.git'
    const command = sinon.stub().callsFake(async body => {
      if (body.command === 'remotes') return { result: [{ name: 'origin', refs: { fetch: url, push: url } }] }
      if (body.command === 'credentialStatus') return { result: { configured: false, username: '' } }
      return { result: null }
    })
    render(<RemoteSettings api={{ command, status: sinon.stub(), initialize: sinon.stub() }} onClose={() => {}} />)
    const remove = await screen.findByRole('button', { name: 'Remove remote…' })
    await waitFor(() => expect((remove as HTMLButtonElement).disabled).to.equal(false))
    fireEvent.click(remove)
    expect(command.callCount).to.equal(2)
    expect(screen.getByText(/Local branches, commits and project files stay intact/)).to.exist
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove remote' }))
    await screen.findByText('No remote configured. Add a remote from Repository actions.')
    expect(command.thirdCall.args[0]).to.deep.equal({ command: 'removeRemote', name: 'origin', expectedUrl: url })
  })
  it('keeps a masked configured state after saving without returning or reusing the token', async () => {
    const command = sinon.stub().callsFake(async body => {
      if (body.command === 'remotes') return { result: [{ name: 'origin', refs: { fetch: 'https://example.test/paper.git', push: 'https://example.test/paper.git' } }] }
      if (body.command === 'credentialStatus') return { result: { configured: false, username: '' } }
      return { result: { configured: body.command === 'saveCredential' } }
    })
    render(<RemoteSettings api={{ command, status: sinon.stub(), initialize: sinon.stub() }} onClose={() => {}} />)
    const username = await screen.findByLabelText('Username')
    await waitFor(() => expect((username as HTMLInputElement).disabled).to.equal(false))
    fireEvent.change(username, { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText('Repository access token'), { target: { value: 'fixture-token' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save token' }))
    await screen.findByText('Token configured')
    const token = screen.getByLabelText('Repository access token') as HTMLInputElement
    expect(token.type).to.equal('password')
    expect(token.value).to.equal('')
    expect(token.placeholder).to.equal('••••••••••••')
    expect((screen.getByRole('button', { name: 'Replace token' }) as HTMLButtonElement).disabled).to.equal(true)
    expect(command.thirdCall.args[0]).to.deep.equal({ command: 'saveCredential', remote: 'origin', username: 'alice', token: 'fixture-token' })
    expect(screen.queryByText('Push')).to.equal(null)
    fireEvent.click(screen.getByRole('button', { name: 'Remove token' }))
    await waitFor(() => expect(screen.queryByText('Token configured')).to.equal(null))
    expect(token.placeholder).to.equal('Access token')
  })
})
