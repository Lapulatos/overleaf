import { expect } from 'chai'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { ConversationView } from '@/features/source-editor/extensions/writing-assist/conversation-panel'
const base = '/writing-assist/project/project/conversations'
describe('Assistant dock model selection', function () {
  afterEach(function () { cleanup(); fetchMock.removeRoutes().clearHistory() })
  it('sends the selected model and a supported effort with the message', async function () {
    const conversation = { id: 'chat', title: 'Draft', activeTaskId: null, turns: [] }
    fetchMock.get(base, [conversation])
    fetchMock.get(`${base}/chat`, { conversation, task: null })
    fetchMock.get('/writing-assist/project/project/speech', { available: false })
    fetchMock.get('/writing-assist/project/project/models', { models: [
      { id: 'model-a', name: 'Model A', isDefault: true, defaultEffort: 'low', efforts: ['low', 'high'] },
      { id: 'model-b', name: 'Model B', isDefault: false, defaultEffort: 'medium', efforts: ['medium'] },
    ] })
    fetchMock.post(`${base}/chat/messages`, { conversation, task: null })
    render(<ConversationView projectId="project" dock />)
    await screen.findByRole('option', { name: 'Model A' })
    fireEvent.change(screen.getByLabelText('Reasoning effort'), { target: { value: 'high' } })
    fireEvent.change(screen.getByLabelText('Model', { exact: true }), { target: { value: 'model-b' } })
    expect((screen.getByLabelText('Reasoning effort') as HTMLSelectElement).value).to.equal('medium')
    await waitFor(() => expect((screen.getByLabelText('Instructions') as HTMLTextAreaElement).disabled).to.equal(false))
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Revise this paper' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await waitFor(() => expect(fetchMock.callHistory.calls(`${base}/chat/messages`)).to.have.length(1))
    expect(JSON.parse(fetchMock.callHistory.calls(`${base}/chat/messages`)[0].options.body as string)).to.deep.equal({ instruction: 'Revise this paper', model: 'model-b', effort: 'medium' })
    expect(screen.getByRole('button', { name: 'Hide conversation' })).to.exist
  })
})
