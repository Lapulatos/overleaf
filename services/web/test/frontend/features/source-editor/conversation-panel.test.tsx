import { expect } from 'chai'
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { ConversationView } from '@/features/source-editor/extensions/writing-assist/conversation-panel'

const base = '/writing-assist/project/project/conversations'
const conversation = {
  id: 'conversation',
  title: 'My paper',
  activeTaskId: null,
  turns: [],
}
const task = {
  taskId: 'task',
  instruction: 'Explain the assumption',
  status: 'completed',
  summary: 'Independence is assumed.',
  output: '',
  proposals: [],
}
const completed = { ...conversation, turns: [{ ...task }] }

describe('Paper Assistant conversations', function () {
  beforeEach(function(){fetchMock.get('/writing-assist/plugins',{plugins:[]});fetchMock.get(/\/conversations\/[^/]+\/goal$/, {goal:null,task:null})})
  it('keeps sending available while /PLAN runs and shows its execution progress', async function(){
    const project='6ae8c19a1bd2fd256c96e759',url='/writing-assist/project/'+project,chat=url+'/conversations';
    fetchMock.get(url+'/venue-workspace',{userId:'user',plan:null,favorites:null,recommendation:null});fetchMock.get(chat,[]);fetchMock.get(url+'/models',{models:[]});fetchMock.get(url+'/speech',{available:false});
    fetchMock.post(url+'/venue-recommendations',{task:{taskId:'planning',status:'running'}});
    fetchMock.get(url+'/venue-recommendations/planning',{task:{taskId:'planning',status:'running',activity:[{id:'reading',kind:'tool',title:'Reading project manuscript',status:'running'}]}});
    fetchMock.post(chat,conversation);fetchMock.get(chat+'/conversation',{conversation,task:null});
    fetchMock.post(chat+'/conversation/messages',{conversation:completed,task});
    render(<ConversationView projectId={project} dock/>);
    fireEvent.change(screen.getByLabelText('Instructions'),{target:{value:'/PLAN Prefer CCF A'}});
    fireEvent.click(screen.getByRole('button',{name:'Send message'}));
    await screen.findByText('Reading project manuscript');
    fireEvent.change(screen.getByLabelText('Instructions'),{target:{value:'Explain the assumption'}});
    expect((screen.getByRole('button',{name:'Send message'}) as HTMLButtonElement).disabled).to.equal(false);
    fireEvent.click(screen.getByRole('button',{name:'Send message'}));
    await waitFor(()=>expect(fetchMock.callHistory.calls(chat+'/conversation/messages')).to.have.length(1));
    localStorage.removeItem('paper-plan-command:'+project);
  })
  it('retries a failed request in a child branch and retains navigation to its parent', async function(){
    const failed={...task,status:'failed',summary:'Failed: temporary issue'};
    const parent={...conversation,turns:[failed]};const child={...conversation,id:'child',title:'Branch · My paper',parent:{conversationId:'conversation',taskId:'task',edge:'user'},turns:[{...task,taskId:'new-task'}]};
    fetchMock.get(base,[parent]);fetchMock.get(`${base}/conversation`,{conversation:parent,task:failed});fetchMock.post(`${base}/conversation/tasks/task/retry`,{conversation:child,task:{...task,taskId:'new-task'}});fetchMock.get(`${base}/child`,{conversation:child,task:{...task,taskId:'new-task'}});
    render(<ConversationView projectId="project"/>);fireEvent.click(await screen.findByRole('button',{name:'Retry request'}));expect(await screen.findByRole('button',{name:'Back to parent conversation'})).to.exist;expect((screen.getByLabelText('Conversation',{exact:true}) as HTMLSelectElement).value).to.equal('child');fireEvent.click(screen.getByRole('button',{name:'Back to parent conversation'}));expect(await screen.findByRole('button',{name:'Retry request'})).to.exist;
  })
  it('branches at a user message as an editable draft without executing a task', async function(){
    const parent={...conversation,turns:[task]};const child={...conversation,id:'draft-child',parent:{conversationId:'conversation',taskId:'task',edge:'user'}};
    fetchMock.get(base,[parent]);fetchMock.get(`${base}/conversation`,{conversation:parent,task});fetchMock.post(`${base}/conversation/tasks/task/branch`,{conversation:child,task:null,draft:{instruction:task.instruction,scope:[],skills:[]}});fetchMock.get(`${base}/draft-child`,{conversation:child,task:null});
    render(<ConversationView projectId="project"/>);fireEvent.click(await screen.findByLabelText('Branch conversation'));fireEvent.click(screen.getByRole('button',{name:'Branch from request'}));await screen.findByRole('button',{name:'Back to parent conversation'});expect((screen.getByLabelText('Instructions') as HTMLTextAreaElement).value).to.equal(task.instruction);expect(screen.queryByText(task.summary)).to.equal(null);
  })
  it('keeps tool controls inside the composer and preserves the draft when switching tools', async function () {
    fetchMock.get(base, [])
    fetchMock.get('/writing-assist/project/project/models', { models: [{ id: 'model', name: 'Test model', isDefault: true, defaultEffort: 'low', efforts: ['low', 'high'] }] })
    render(<ConversationView projectId="project" dock />)
    await screen.findByRole('option', { name: 'Test model' })
    const composer = screen.getByRole('group', { name: 'Message composer' })
    const draft = screen.getByLabelText('Instructions') as HTMLTextAreaElement
    fireEvent.change(draft, { target: { value: 'Keep my draft' } })
    for (const name of ['Attach image', 'Voice input', 'Send message']) {
      expect(composer.contains(screen.getByRole('button', { name }))).to.equal(true)
    }
    expect(composer.contains(screen.getByRole('combobox', { name: 'Model' }))).to.equal(true)
    fireEvent.click(screen.getByRole('button', { name: 'Attach image' }))
    expect(screen.getByLabelText('Upload image file')).to.exist
    fireEvent.click(screen.getByRole('button', { name: 'Voice input' }))
    expect(document.getElementById('paper-composer-voice')?.hidden).to.equal(false)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.getElementById('paper-composer-voice')?.hidden).to.equal(true)
    expect(draft.value).to.equal('Keep my draft')
  })

  beforeEach(function () {
    fetchMock.get('/writing-assist/project/project/speech', {
      available: false,
    })
  })
  afterEach(function () {
    cleanup()
    fetchMock.removeRoutes().clearHistory()
  })
  it('restores history and sends a follow-up in the same conversation', async function () {
    fetchMock.get(base, [conversation])
    fetchMock.get(`${base}/conversation`, { conversation: completed, task })
    fetchMock.post(`${base}/conversation/messages`, {
      conversation: completed,
      task,
    })
    render(<ConversationView projectId="project" />)
    await screen.findByText('Independence is assumed.')
    fireEvent.change(screen.getByLabelText('Conversation', { exact: true }), {
      target: { value: 'conversation' },
    })
    expect(screen.getByText('Independence is assumed.')).to.exist
    expect(
      (screen.getByLabelText('Instructions') as HTMLTextAreaElement).disabled
    ).to.equal(false)
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'How can I test that?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls(`${base}/conversation/messages`)
      ).to.have.length(1)
    )
    expect(
      JSON.parse(
        fetchMock.callHistory.calls(`${base}/conversation/messages`)[0].options
          .body as string
      )
    ).to.deep.equal({ instruction: 'How can I test that?',scope:[],skills:[] })
  })
  it('creates a conversation before sending its first message', async function () {
    fetchMock.get(base, [])
    fetchMock.post(base, conversation)
    fetchMock.post(`${base}/conversation/messages`, {
      conversation: completed,
      task,
    })
    fetchMock.get(`${base}/conversation`, { conversation: completed, task })
    render(<ConversationView projectId="project" />)
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'Explain the assumption' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }))
    await screen.findByText('Independence is assumed.')
    expect(
      fetchMock.callHistory.calls(`${base}/conversation/messages`)
    ).to.have.length(1)
  })
  it('keeps the transcript visible after task snapshots expire', async function () {
    fetchMock.get(base, [conversation])
    fetchMock.get(`${base}/conversation`, {
      conversation: completed,
      task: null,
    })
    render(<ConversationView projectId="project" />)
    await screen.findByText('Independence is assumed.')
    expect(screen.getByRole('log').textContent).to.contain(
      'Explain the assumption'
    )
    expect(screen.queryByRole('button', { name: 'Accept change' })).to.equal(
      null
    )
  })
  it('cancels an active message and enables a follow-up', async function () {
    const active = { ...conversation, activeTaskId: 'task' }
    fetchMock.get(base, [active])
    fetchMock.get(
      `${base}/conversation`,
      { conversation: active, task: { ...task, status: 'running' } },
      { repeat: 1 }
    )
    fetchMock.get(`${base}/conversation`, {
      conversation,
      task: { ...task, status: 'cancelled' },
    })
    fetchMock.delete(`${base}/conversation/tasks/task`, {
      conversation,
      task: { ...task, status: 'cancelled' },
    })
    render(<ConversationView projectId="project" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel task' }))
    await screen.findByText('Status: cancelled')
    expect(
      (screen.getByLabelText('Instructions') as HTMLTextAreaElement).disabled
    ).to.equal(false)
  })
})

describe('Conversation compile assistance', function () {
  beforeEach(function(){fetchMock.get('/writing-assist/plugins',{plugins:[]});fetchMock.get(/\/conversations\/[^/]+\/goal$/, {goal:null,task:null})})
  beforeEach(function () {
    fetchMock.get('/writing-assist/project/project/speech', {
      available: false,
    })
  })
  afterEach(function () {
    cleanup()
    fetchMock.removeRoutes().clearHistory()
  })
  const diagnostics = {
    errors: [
      {
        key: 'e',
        level: 'error' as const,
        raw: 'Undefined control sequence',
        file: 'main.tex',
        line: 3,
      },
    ],
    hasChanges: true,
  }
  it('prepares an editable request without submitting it', async function () {
    fetchMock.get(base, [])
    render(<ConversationView projectId="project" diagnostics={diagnostics} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Explain compile errors' })
    )
    const textarea = screen.getByLabelText(
      'Instructions'
    ) as HTMLTextAreaElement
    expect(textarea.value).to.contain('main.tex')
    expect(textarea.value).to.contain('Undefined control sequence')
    expect(
      fetchMock.callHistory
        .calls()
        .filter((call) => call.options.method === 'POST')
    ).to.have.length(0)
    fireEvent.change(textarea, { target: { value: 'My existing draft' } })
    expect(
      (
        screen.getByRole('button', {
          name: 'Explain compile errors',
        }) as HTMLButtonElement
      ).disabled
    ).to.equal(true)
    expect(textarea.value).to.equal('My existing draft')
  })
  it('does not prepare an error request while compilation is running', function () {
    fetchMock.get(base, [])
    render(
      <ConversationView
        projectId="project"
        diagnostics={{ ...diagnostics, compiling: true }}
      />
    )
    expect(
      (
        screen.getByRole('button', {
          name: 'Explain compile errors',
        }) as HTMLButtonElement
      ).disabled
    ).to.equal(true)
  })
})

describe('Conversation voice drafts', function () {
  beforeEach(function(){fetchMock.get('/writing-assist/plugins',{plugins:[]});fetchMock.get(/\/conversations\/[^/]+\/goal$/, {goal:null,task:null})})
  beforeEach(function () {
    fetchMock.get('/writing-assist/project/project/speech', {
      available: false,
    })
  })
  beforeEach(function () {
    Object.defineProperty(window, 'SpeechRecognition', {
      configurable: true,
      value: class {},
    })
    fetchMock.get(base, [])
  })
  afterEach(function () {
    cleanup()
    Reflect.deleteProperty(window, 'SpeechRecognition')
    fetchMock.removeRoutes().clearHistory()
  })
  it('appends reviewed speech to the latest typed draft without sending', function () {
    render(<ConversationView projectId="project" />)
    const draft = screen.getByLabelText('Instructions') as HTMLTextAreaElement
    fireEvent.change(draft, { target: { value: 'My original draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Voice input' }))
    fireEvent.change(screen.getByLabelText('Voice transcript'), {
      target: { value: 'Preserve equations.' },
    })
    fireEvent.change(draft, { target: { value: 'My updated draft' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Insert into instructions' })
    )
    expect(draft.value).to.equal('My updated draft\nPreserve equations.')
    expect(
      fetchMock.callHistory
        .calls()
        .filter((call) => call.options.method === 'POST')
    ).to.have.length(0)
  })
  it('retains both drafts if insertion exceeds the request limit', function () {
    render(<ConversationView projectId="project" />)
    const draft = screen.getByLabelText('Instructions') as HTMLTextAreaElement
    fireEvent.change(draft, { target: { value: 'x'.repeat(32000) } })
    fireEvent.click(screen.getByRole('button', { name: 'Voice input' }))
    fireEvent.change(screen.getByLabelText('Voice transcript'), {
      target: { value: 'Preserve equations.' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Insert into instructions' })
    )
    expect(draft.value).to.have.length(32000)
    expect(screen.getByLabelText('Voice transcript')).to.have.property(
      'value',
      'Preserve equations.'
    )
    expect(screen.getByRole('alert').textContent).to.contain('32,000')
  })
})


describe('Conversation polling recovery', function () {
  beforeEach(function(){fetchMock.get('/writing-assist/plugins',{plugins:[]});fetchMock.get(/\/conversations\/[^/]+\/goal$/, {goal:null,task:null})})
  afterEach(function () { cleanup(); fetchMock.removeRoutes().clearHistory() })
  it('retries a transient read failure without resubmitting work', async function () {
    fetchMock.get('/writing-assist/project/project/speech', { available: false })
    fetchMock.get(base, [{ ...conversation, activeTaskId: 'task' }])
    let reads = 0
    fetchMock.get(`${base}/conversation`, () => ++reads === 1
      ? { status: 503, body: { error: 'Local agent is unreachable' } }
      : { conversation, task: { ...task, status: 'failed', summary: 'Task interrupted by restart' } })
    render(<ConversationView projectId="project" />)
    await screen.findByText('Local agent is unreachable')
    await waitFor(() => expect(screen.getByText('Task interrupted by restart')).to.exist, { timeout: 5000 })
    expect(screen.queryByText('Local agent is unreachable')).to.equal(null)
    expect(reads).to.equal(2)
    expect(fetchMock.callHistory.calls().some(call => call.options.method === 'POST')).to.equal(false)
  })
  it('does not retry an authorization failure', async function () {
    fetchMock.get('/writing-assist/project/project/speech', { available: false })
    fetchMock.get(base, [conversation])
    fetchMock.get(`${base}/conversation`, { status: 403, body: { error: 'Project access denied' } })
    render(<ConversationView projectId="project" />)
    await screen.findByText('Project access denied')
    await new Promise(resolve => setTimeout(resolve, 1200))
    expect(fetchMock.callHistory.calls(`${base}/conversation`)).to.have.length(1)
  })
  it('reads back a committed deletion after its response is lost without resending it', async function () {
    const proposal = { id: 'proposal', path: 'old.tex', mode: 'delete-document', before: 'old', after: '', status: 'pending' }
    const pending = { ...task, proposals: [proposal] }
    const done = { ...pending, proposals: [{ ...proposal, status: 'accepted' }] }
    let committed = false
    fetchMock.get(base, [conversation])
    fetchMock.get(`${base}/conversation`, () => ({ conversation: completed, task: committed ? done : pending }))
    const endpoint = `${base}/conversation/tasks/task/proposals/proposal`
    fetchMock.get('/writing-assist/project/project/tasks/task', () => committed ? done : pending)
    fetchMock.post(endpoint, () => { committed = true; throw new TypeError('Connection lost') })
    render(<ConversationView projectId="project" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Delete file' }))
    await screen.findByText('Status: accepted')
    await waitFor(() => expect(screen.queryByRole('alert')).to.equal(null))
    expect(screen.queryByRole('button', { name: 'Delete file' })).to.equal(null)
    expect(fetchMock.callHistory.calls(endpoint)).to.have.length(1)
  })

})

describe('Conversation source-review routing', function () {
  beforeEach(function(){fetchMock.get('/writing-assist/plugins',{plugins:[]});fetchMock.get(/\/conversations\/[^/]+\/goal$/, {goal:null,task:null})})
  afterEach(function () { cleanup(); fetchMock.removeRoutes().clearHistory() })
  it('opens the exact proposal without writing and retains its original decision endpoint', async function () {
    const proposal = { id: 'proposal', docId: 'document', path: 'main.tex', before: 'old', after: 'new', status: 'pending' }
    const reviewed = { ...proposal, status: 'accepted' }
    fetchMock.get(base, [conversation])
    fetchMock.get(`${base}/conversation`, { conversation, task: { ...task, proposals: [proposal] } })
    fetchMock.post(`${base}/conversation/tasks/task/proposals/proposal`, { conversation, task: { ...task, proposals: [reviewed] } })
    let active: import('@/features/source-editor/extensions/writing-assist/agent-editor-review').EditorReview | null = null
    render(<ConversationView projectId="project" onReviewInEditor={review => { active = review }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Review in editor' }))
    const review = active!
    expect(review.proposal.docId).to.equal('document')
    expect(review.isCurrent()).to.equal(true)
    expect(fetchMock.callHistory.calls(`${base}/conversation/tasks/task/proposals/proposal`)).to.have.length(0)
    expect(await review.decide(true)).to.equal(true)
    await waitFor(() => expect(review.isCurrent()).to.equal(false))
    expect(fetchMock.callHistory.calls(`${base}/conversation/tasks/task/proposals/proposal`)).to.have.length(1)
    expect(JSON.parse(fetchMock.callHistory.calls(`${base}/conversation/tasks/task/proposals/proposal`)[0].options.body as string)).to.deep.equal({ accept: true })
  })
})

describe('Current task after a completed goal', function () {
 afterEach(function(){cleanup();fetchMock.removeRoutes().clearHistory()})
 it('shows a new scoped task after the old goal and continues polling it',async function(){
  fetchMock.get('/writing-assist/plugins',{plugins:[]});fetchMock.get('/writing-assist/project/project/speech',{available:false});fetchMock.get(base,[conversation]);
  fetchMock.get(`${base}/conversation/goal`,{goal:{_id:'old-goal',objective:'Old introduction goal',status:'completed',stage:'work',steps:1,reason:'Introduction finished',reviewMode:'ai',elapsedMs:12000,updatedAt:'2026-11-01T00:00:00Z'},task:null});
  let reads=0;
  const current={...task,instruction:'Edit related work',status:'running',summary:'',scope:[{kind:'file',path:'tex/02_related_work.tex'}]};
  fetchMock.get(`${base}/conversation`,()=>({conversation:{...conversation,activeTaskId:'task',turns:[{...current,createdAt:'2026-11-02T00:00:00Z'}]},task:{...current,activity:++reads>1?[{id:'cmd',kind:'command',title:'Run command',command:'cat tex/02_related_work.tex',status:'running'}]:[]}}));
  render(<ConversationView projectId="project"/>);
  await screen.findByText('Edit related work');await screen.findByText('Introduction finished');
  const goal=screen.getByLabelText('Persistent goal');const request=screen.getByText('Edit related work');
  expect(Boolean(goal.compareDocumentPosition(request)&Node.DOCUMENT_POSITION_FOLLOWING)).to.equal(true);
  expect(screen.queryByLabelText('Goal execution time')).to.equal(null);
  expect(screen.getByLabelText('Current task progress').textContent).to.include('tex/02_related_work.tex');
  await screen.findByText('cat tex/02_related_work.tex',{}, {timeout:4000});
  expect(screen.getByLabelText('Current task progress').textContent).to.include('1 actions');
 })
})

describe('Issue-specific reply submission',()=>{
 afterEach(()=>{cleanup();fetchMock.removeRoutes().clearHistory();localStorage.clear()})
 it('continues in the same conversation without consuming the unrelated composer draft',async()=>{
  const issue='TCR-8f31e5fb-0a2a-4625-82b7-67d0310bcaf1-I6';const summary='Confirm the history.\n```json\n'+JSON.stringify({issueOutcomes:[{id:issue,status:'needs-human',summary:'Author confirmation needed.',evidence:[],blockers:['Is this paper under review elsewhere?']}]})+'\n```';const reply={...task,summary,activity:[{id:'message',kind:'message',title:'Reply',status:'completed',text:summary}]};const current={...conversation,turns:[reply]};let sent:any;
  fetchMock.get('/writing-assist/plugins',{plugins:[]});fetchMock.get(/\/conversations\/[^/]+\/goal$/,{goal:null,task:null});fetchMock.get(base,[current]);fetchMock.get(`${base}/conversation`,{conversation:current,task:reply});fetchMock.post(`${base}/conversation/messages`,({options})=>{sent=JSON.parse(String(options.body));return {conversation:current,task:{...reply,taskId:'next',summary:'Awaiting evidence.',activity:[]}}});
  render(<ConversationView projectId="project"/>);const question=await screen.findByRole('textbox',{name:'Is this paper under review elsewhere?'});fireEvent.change(screen.getByLabelText('Instructions'),{target:{value:'Keep this unrelated draft'}});fireEvent.change(question,{target:{value:'I cannot confirm yet; keep the issue unresolved.'}});fireEvent.click(screen.getByRole('button',{name:'Submit answers & continue'}));await waitFor(()=>expect(sent?.instruction).to.include('/resolve-issue '+issue));expect(sent.instruction).to.include('I cannot confirm yet');expect(sent).not.to.have.property('sourceSelection');expect((screen.getByLabelText('Instructions') as HTMLTextAreaElement).value).to.equal('Keep this unrelated draft');
 })
})
