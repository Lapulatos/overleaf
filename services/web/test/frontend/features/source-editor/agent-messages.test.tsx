import { expect } from 'chai'
import sinon from 'sinon'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UserMessage, AssistantMessage, AgentActivity, MessageCopyButton } from '@/features/source-editor/extensions/writing-assist/agent-messages'
describe('Agent conversation messages', function () {
 afterEach(function () { sinon.restore() })
 it('copies the original assistant text including LaTeX and Markdown', async function () {
  const writeText = sinon.stub().resolves()
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  try {
   const text = 'Use `main.tex` and $x^2$.'
   render(<AssistantMessage text={text} />)
   fireEvent.click(screen.getByRole('button', { name: 'Copy assistant message' }))
   await screen.findByText('Copied')
   expect(writeText.firstCall.args).to.deep.equal([text])
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard') }
 })
 it('reports denied clipboard access without claiming success', async function () {
  const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: sinon.stub().rejects(new Error('denied')) } })
  try {
   render(<MessageCopyButton text="copy me" />)
   fireEvent.click(screen.getByRole('button', { name: 'Copy message' }))
   await waitFor(() => expect(screen.getByRole('status').textContent).to.contain('Clipboard access failed'))
   expect(screen.queryByText('Copied')).to.equal(null)
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard') }
 })
 it('shows the selected file and line range on the user message', function () {
  render(<UserMessage instruction="Polish this" sourceSelection={{path:'tex/main.tex',startLine:4,endLine:7}} />)
  expect(screen.getByText('tex/main.tex · L4–7')).to.exist
 })
 it('renders Markdown without executable HTML', function () {
  const {container}=render(<AssistantMessage text={'Updated `main.tex`.\n\n> A clear result.\n\n<script>alert(1)</script>'} />)
  expect(container.querySelector('code')?.textContent).to.equal('main.tex')
  expect(container.querySelector('blockquote')).to.exist
  expect(container.querySelector('script')).to.equal(null)
 })
 it('keeps completed execution details and public updates reviewable', function () {
  render(<AgentActivity activity={[{id:'1',kind:'command',title:'Run command',status:'completed',command:'cat main.tex',exitCode:0},{id:'2',kind:'message',title:'Assistant update',status:'completed',text:'Checking citations'}]} />)
  expect(screen.getByText('cat main.tex')).to.exist
  expect(screen.getByText('Exit code: 0')).to.exist
  expect(screen.getByText('Checking citations')).to.exist
 })
 it('shows streamed actions in order and renders file diffs before task completion',function(){
  const {container,rerender}=render(<AgentActivity running activity={[{id:'m',kind:'message',title:'Update',status:'completed',text:'Checking source'},{id:'c',kind:'command',title:'Run command',status:'running',command:'Update main.tex',output:'Started'}]}/>);
  expect(container.querySelectorAll('.paper-execution-event')[0].textContent).to.include('Checking source')
  rerender(<AgentActivity running activity={[{id:'m',kind:'message',title:'Update',status:'completed',text:'Checking source'},{id:'c',kind:'command',title:'Run command',status:'completed',command:'Update main.tex',changes:[{path:'main.tex',kind:'edit',before:'Before',after:'After'}]}]}/>);
  expect(container.querySelector('.paper-live-edit')?.textContent).to.include('Before');expect(container.querySelector('.paper-live-edit')?.textContent).to.include('After');expect(screen.getByText('Working… New actions appear here as they happen.')).to.exist
 })

 it('opens project file links through the editor event without page navigation',function(){
  const requests:string[]=[];const listener=(event:Event)=>{event.preventDefault();requests.push((event as CustomEvent).detail.path)};window.addEventListener('paper-open-project-file',listener)
  try{render(<AssistantMessage text="[Open file](tex/main.tex)"/>);fireEvent.click(screen.getByRole('link',{name:'Open file'}));expect(requests).to.deep.equal(['tex/main.tex'])}finally{window.removeEventListener('paper-open-project-file',listener)}
 })
 it('keeps external sources in a separate tab',function(){
  render(<AssistantMessage text="[Source](https://example.org/paper)"/>);const link=screen.getByRole('link',{name:'Source'});fireEvent.click(link);expect(link.getAttribute('target')).to.equal('_blank');expect(link.getAttribute('rel')).to.equal('noopener noreferrer')
 })

 it('renders rich Markdown consistently in compact goal reviews',function(){
 const {container}=render(<AssistantMessage compact text={'## Findings\n\n3. Check authors\n4. Check DOI\n\n| Field | Result |\n| --- | --- |\n| DOI | **Verified** |\n\n```bibtex\n@article{key, title={Example}}\n```\n\n~~Outdated~~\n\n---\n\n<script>alert(1)</script><a href="javascript:alert(1)">unsafe</a>'}/>);
 expect(container.querySelector('h2')?.textContent).to.equal('Findings');
 expect(container.querySelector('ol')?.getAttribute('start')).to.equal('3');
 expect(container.querySelector('table strong')?.textContent).to.equal('Verified');
 expect(container.querySelector('pre code')?.textContent).to.include('@article');
 expect(container.querySelector('del')).to.exist;expect(container.querySelector('hr')).to.exist;
 expect(container.querySelector('script')).to.equal(null);expect(container.querySelector('a')?.hasAttribute('href')).to.equal(false);
 expect(screen.queryByRole('button',{name:'Copy assistant message'})).to.equal(null);
 })
})
