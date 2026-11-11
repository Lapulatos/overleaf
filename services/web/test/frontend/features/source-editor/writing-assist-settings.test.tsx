import { expect } from 'chai'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import WritingAssistSettings from '@/features/source-editor/extensions/writing-assist/config-panel'
import { DEFAULT_CONFIG } from '../../../../types/writing-assist'

describe('Writing Assist local agent settings', function () {
  afterEach(function () {
    cleanup()
    fetchMock.removeRoutes().clearHistory()
  })

  it('saves an explicit local provider without credentials and limits concurrency', async function () {
    fetchMock.get('/writing-assist/config', DEFAULT_CONFIG)
    fetchMock.put('/writing-assist/config', 204)
    render(<WritingAssistSettings />)
    fireEvent.change(await screen.findByLabelText('LLM provider'), {
      target: { value: 'agent' },
    })
    expect(screen.queryByLabelText('API key')).to.equal(null)
    expect(screen.queryByLabelText('Model')).to.equal(null)
    expect(
      (
        screen.getByLabelText(
          'Concurrent sentence checks (1–12)'
        ) as HTMLInputElement
      ).disabled
    ).to.equal(true)
    fireEvent.click(
      screen.getByRole('button', { name: 'Save Writing Assist settings' })
    )
    await screen.findByText('Saved')
    const calls = fetchMock.callHistory.calls('/writing-assist/config', {
      method: 'PUT',
    })
    const body = JSON.parse(calls[0].options.body as string)
    expect(body.provider).to.equal('agent')
    expect(body.concurrency).to.equal(1)
    expect(body.timeoutMs).to.equal(60000)
    expect(body).not.to.have.property('agent')
    expect(body).not.to.have.property('apiKey')
    fireEvent.change(screen.getByLabelText('LLM provider'), {
      target: { value: 'openai' },
    })
    await waitFor(() => expect(screen.getByLabelText('API key')).to.exist)
    expect((screen.getByLabelText('Model') as HTMLInputElement).value).to.equal(
      'gpt-4o'
    )
  })
})
