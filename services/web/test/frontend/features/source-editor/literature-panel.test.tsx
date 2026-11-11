import { expect } from 'chai'
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { LiteratureView } from '@/features/source-editor/extensions/writing-assist/literature-panel'
const base = '/writing-assist/project/project'
const citation = {
  doi: '10.1234/paper',
  title: 'A research paper',
  authors: [{ given: 'Ada', family: 'Author', name: '' }],
  year: 2024,
  venue: 'Journal',
  url: 'https://doi.org/10.1234/paper',
  key: 'Author2024',
  bibtex: '@article{Author2024, title={A research paper}}',
  source: 'Crossref',
}
const proposal = {
  id: 'proposal',
  path: 'references.bib',
  before: '',
  after: citation.bibtex,
  status: 'pending',
}
const task = {
  taskId: 'task',
  status: 'completed',
  instruction: 'Import citation',
  summary: 'Source: Crossref',
  proposals: [proposal],
}
async function search() {
  fireEvent.change(screen.getByLabelText('Title, author or DOI'), {
    target: { value: 'paper' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Search references' }))
  await screen.findByText(citation.title)
}
describe('Literature import panel', function () {
  beforeEach(function () {
    sessionStorage.clear()
    fetchMock.get(`${base}/models`, { models: [] })
  })
  afterEach(function () {
    cleanup()
    fetchMock.removeRoutes().clearHistory()
    sessionStorage.clear()
  })
  it('previews source-backed BibTeX without automatically accepting', async function () {
    fetchMock.get(`${base}/literature/bibliographies`, [])
    fetchMock.get(`${base}/literature?q=paper`, { results: [citation] })
    fetchMock.post(`${base}/literature/preview`, { citation, task })
    render(<LiteratureView projectId="project" />)
    await search()
    expect(
      screen
        .getByRole('link', { name: 'DOI: 10.1234/paper' })
        .getAttribute('href')
    ).to.equal(citation.url)
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    await screen.findByRole('button', { name: 'Accept change' })
    expect(
      JSON.parse(
        fetchMock.callHistory.calls(`${base}/literature/preview`)[0].options
          .body as string
      )
    ).to.deep.equal({
      doi: citation.doi,
      destination: { newName: 'references.bib' },
    })
    expect(
      fetchMock.callHistory.calls(`${base}/tasks/task/proposals/proposal`)
    ).to.have.length(0)
    expect(sessionStorage.getItem('writing-assist-citation:project')).to.equal(
      'task'
    )
  })
  it('uses the selected existing bibliography', async function () {
    fetchMock.get(`${base}/literature/bibliographies`, [
      { id: 'bib', path: 'library.bib' },
    ])
    fetchMock.get(`${base}/literature?q=paper`, { results: [citation] })
    fetchMock.post(`${base}/literature/preview`, { citation, task })
    render(<LiteratureView projectId="project" />)
    await screen.findByRole('option', { name: 'library.bib' })
    fireEvent.change(screen.getByLabelText('Bibliography destination'), {
      target: { value: 'bib' },
    })
    await search()
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    await screen.findByRole('button', { name: 'Accept change' })
    expect(
      JSON.parse(
        fetchMock.callHistory.calls(`${base}/literature/preview`)[0].options
          .body as string
      ).destination
    ).to.deep.equal({ docId: 'bib' })
  })
  it('restores an import and requires confirmation before acceptance', async function () {
    sessionStorage.setItem('writing-assist-citation:project', 'task')
    fetchMock.get(`${base}/literature/bibliographies`, [])
    fetchMock.get(`${base}/tasks/task`, task)
    fetchMock.post(`${base}/tasks/task/proposals/proposal`, {
      ...task,
      proposals: [{ ...proposal, status: 'accepted' }],
    })
    render(<LiteratureView projectId="project" />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Accept change' })
    )
    await waitFor(() =>
      expect(
        fetchMock.callHistory.calls(`${base}/tasks/task/proposals/proposal`)
      ).to.have.length(1)
    )
    expect(
      JSON.parse(
        fetchMock.callHistory.calls(`${base}/tasks/task/proposals/proposal`)[0]
          .options.body as string
      )
    ).to.deep.equal({ accept: true })
  })
  it('ignores a delayed restored import after a newer preview is prepared', async function () {
    sessionStorage.setItem('writing-assist-citation:project', 'old')
    let release: ((value: typeof task) => void) | undefined
    fetchMock.get(
      `${base}/tasks/old`,
      () =>
        new Promise((resolve) => {
          release = resolve
        })
    )
    fetchMock.get(`${base}/literature/bibliographies`, [])
    fetchMock.get(`${base}/literature?q=paper`, { results: [citation] })
    fetchMock.post(`${base}/literature/preview`, { citation, task })
    render(<LiteratureView projectId="project" />)
    await waitFor(() => expect(release).to.be.a('function'))
    await search()
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    await screen.findByText('Source: Crossref')
    release?.({ ...task, taskId: 'old', summary: 'Obsolete restored import' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(screen.queryByText('Obsolete restored import')).to.equal(null)
    expect(screen.getByText('Source: Crossref')).to.exist
  })

  it('reports provider failure without preparing an import', async function () {
    fetchMock.get(`${base}/literature/bibliographies`, [])
    fetchMock.get(`${base}/literature?q=paper`, {
      status: 502,
      body: { error: 'Literature provider is unavailable' },
    })
    render(<LiteratureView projectId="project" />)
    fireEvent.change(screen.getByLabelText('Title, author or DOI'), {
      target: { value: 'paper' },
    })
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search references' }))
    expect((await screen.findByRole('alert')).textContent).to.contain(
      'Literature provider is unavailable'
    )
    expect(screen.queryByRole('button', { name: 'Accept change' })).to.equal(
      null
    )
  })
})

describe('Zotero library import panel', function () {
  beforeEach(function () {
    sessionStorage.clear()
    fetchMock.get(`${base}/literature/bibliographies`, [])
  })
  afterEach(function () {
    cleanup()
    fetchMock.removeRoutes().clearHistory()
    sessionStorage.clear()
  })
  it('connects without retaining the key and previews a selected non-DOI item by identity only', async function () {
    const entry = {
      ...citation,
      doi: null,
      source: 'Zotero',
      itemKey: 'ABCDEFGH',
      key: 'Zotero12345_ABCDEFGH',
      url: 'https://www.zotero.org/users/12345/items/ABCDEFGH',
    }
    fetchMock.get(`${base}/zotero`, { connected: false, libraryId: null })
    fetchMock.post(`${base}/zotero`, { connected: true, libraryId: '12345' })
    fetchMock.get(`${base}/zotero/items?q=&start=0`, {
      results: [entry],
      nextStart: null,
    })
    fetchMock.post(`${base}/zotero/preview`, {
      citation: entry,
      task: { ...task, summary: 'Source: Zotero' },
    })
    render(<LiteratureView projectId="project" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    fireEvent.change(screen.getByLabelText('Reference source'), {
      target: { value: 'zotero' },
    })
    fireEvent.change(screen.getByLabelText('Zotero user ID'), {
      target: { value: '12345' },
    })
    fireEvent.change(screen.getByLabelText('Zotero API key'), {
      target: { value: 'PrivateTestKey1234567890' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Connect Zotero' }))
    await screen.findByText('Connected · Library 12345')
    expect(screen.getByLabelText('Zotero API key')).to.have.property(
      'value',
      ''
    )
    expect(JSON.stringify(sessionStorage)).not.to.contain('PrivateTestKey')
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }))
    fireEvent.click(screen.getByRole('button', { name: 'Search references' }))
    await screen.findByText(citation.title)
    expect(screen.getByRole('link', { name: 'View library source' })).to.exist
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }))
    await screen.findByText('Source: Zotero')
    const body = JSON.parse(
      fetchMock.callHistory.calls(`${base}/zotero/preview`)[0].options
        .body as string
    )
    expect(body).to.deep.equal({
      itemKey: 'ABCDEFGH',
      destination: { newName: 'references.bib' },
    })
    expect(
      fetchMock.callHistory
        .calls()
        .some((call) => call.url.includes('/proposals/'))
    ).to.equal(false)
  })
  it('does not overwrite a user ID typed before connection status arrives', async function () {
    let resolve!: (value: { connected: boolean; libraryId: null }) => void
    fetchMock.get(
      `${base}/zotero`,
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    render(<LiteratureView projectId="project" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    fireEvent.change(screen.getByLabelText('Reference source'), {
      target: { value: 'zotero' },
    })
    await waitFor(() => expect(resolve).to.be.a('function'))
    fireEvent.change(screen.getByLabelText('Zotero user ID'), {
      target: { value: '12345' },
    })
    fireEvent.change(screen.getByLabelText('Zotero API key'), {
      target: { value: 'PrivateTestKey1234567890' },
    })
    await act(async () => {
      resolve({ connected: false, libraryId: null })
    })
    expect(screen.getByLabelText('Zotero user ID')).to.have.property(
      'value',
      '12345'
    )
    expect(
      screen.getByRole('button', { name: 'Connect Zotero' })
    ).to.have.property('disabled', false)
  })

  it('disconnect clears library results and disables search', async function () {
    fetchMock.get(`${base}/zotero`, { connected: true, libraryId: '12345' })
    fetchMock.delete(`${base}/zotero`, { connected: false, libraryId: null })
    render(<LiteratureView projectId="project" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    fireEvent.change(screen.getByLabelText('Reference source'), {
      target: { value: 'zotero' },
    })
    fireEvent.click(
      await screen.findByRole('button', { name: 'Disconnect Zotero' })
    )
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Disconnect Zotero' })
      ).to.equal(null)
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }))
    expect(
      screen.getByRole('button', { name: 'Search references' })
    ).to.have.property('disabled', true)
  })
})

describe('Literature settings and retry', function () {
  afterEach(function () { cleanup();fetchMock.removeRoutes().clearHistory();sessionStorage.clear() })
  it('keeps settings separate and retries the actual failed search', async function () {
    fetchMock.get(`${base}/literature/bibliographies`, [])
    fetchMock.get(`${base}/literature?q=paper`, { status: 502, body: { error: 'Temporary search failure' } }, { repeat: 1 })
    fetchMock.get(`${base}/literature?q=paper`, { results: [citation] })
    render(<LiteratureView projectId="project" />)
    expect(screen.getByRole('tabpanel', { name: 'Search' })).to.exist
    expect(screen.queryByRole('combobox', { name: 'Reference source' })).to.equal(null)
    fireEvent.change(screen.getByLabelText('Title, author or DOI'), { target: { value: 'paper' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search references' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Retry search' }))
    await screen.findByText(citation.title)
    expect(fetchMock.callHistory.calls(`${base}/literature?q=paper`)).to.have.length(2)
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    expect(screen.getByRole('combobox', { name: 'Reference source' })).to.exist
    expect(screen.queryByRole('button', { name: 'Search references' })).to.equal(null)
  })
})

describe('Literature batch selection', function () {
  afterEach(function () { cleanup(); fetchMock.removeRoutes().clearHistory(); sessionStorage.clear() })
  it('previews selected references together and clears selection after success', async function () {
    fetchMock.get(`${base}/literature/bibliographies`, [])
    const second = { ...citation, key: 'Second', title: 'Second paper', doi: '10.1234/second' }
    fetchMock.get(`${base}/literature?q=paper`, { results: [citation, second] })
    fetchMock.post(`${base}/literature/preview`, { task })
    render(<LiteratureView projectId="project" />)
    await search()
    fireEvent.click(screen.getByLabelText(`Select ${citation.title}`))
    expect(screen.getByRole('button', { name: 'Preview selected (1)' })).to.have.property('disabled', false)
    fireEvent.click(screen.getByLabelText('Select loaded references'))
    fireEvent.click(screen.getByRole('button', { name: 'Preview selected (2)' }))
    await screen.findByText('Source: Crossref')
    const calls = fetchMock.callHistory.calls(`${base}/literature/preview`)
    expect(JSON.parse(calls[0].options.body as string)).to.deep.equal({ dois: [citation.doi, second.doi], destination: { newName: 'references.bib' } })
    expect(screen.getByRole('button', { name: 'Preview selected (0)' })).to.have.property('disabled', true)
  })
  it('retains selection on failed preview and clears it when source changes', async function () {
    fetchMock.get(`${base}/literature/bibliographies`, [])
    fetchMock.get(`${base}/literature?q=paper`, { results: [citation] })
    fetchMock.post(`${base}/literature/preview`, { status: 502, body: { error: 'Provider failed' } })
    fetchMock.get(`${base}/zotero`, { connected: true, libraryId: '12345' })
    render(<LiteratureView projectId="project" />);await search()
    fireEvent.click(screen.getByLabelText(`Select ${citation.title}`))
    fireEvent.click(screen.getByRole('button', { name: 'Preview selected (1)' }))
    await screen.findByRole('alert')
    expect(screen.getByLabelText(`Select ${citation.title}`)).to.have.property('checked', true)
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByLabelText(`Select ${citation.title}`)).to.have.property('checked', false)
    fireEvent.click(screen.getByLabelText(`Select ${citation.title}`))
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    fireEvent.change(screen.getByLabelText('Reference source'), { target: { value: 'zotero' } })
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }))
    expect(screen.queryByLabelText(`Select ${citation.title}`)).to.equal(null)
  })
  it('preserves Zotero selections when loading more and sends only selected item identities', async function () {
    const first = { ...citation, source: 'Zotero', itemKey: 'ABCDEFGH' }
    const second = { ...first, key: 'Other', title: 'Other Zotero paper', itemKey: 'BCDEFGHI' }
    fetchMock.get(`${base}/literature/bibliographies`, [])
    fetchMock.get(`${base}/zotero`, { connected: true, libraryId: '12345' })
    fetchMock.get(`${base}/zotero/items?q=LLM&start=0`, { results: [first], nextStart: 20 })
    fetchMock.get(`${base}/zotero/items?q=LLM&start=20`, { results: [second], nextStart: null })
    fetchMock.post(`${base}/zotero/preview`, { task })
    render(<LiteratureView projectId="project" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Settings' }))
    fireEvent.change(screen.getByLabelText('Reference source'), { target: { value: 'zotero' } })
    await screen.findByRole('button', { name: 'Disconnect Zotero' })
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }))
    fireEvent.change(screen.getByLabelText('Title, author or year'), { target: { value: 'LLM' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search references' }))
    fireEvent.click(await screen.findByLabelText(`Select ${first.title}`))
    fireEvent.click(screen.getByRole('button', { name: 'Load more references' }))
    fireEvent.click(await screen.findByLabelText(`Select ${second.title}`))
    expect(screen.getByLabelText(`Select ${first.title}`)).to.have.property('checked', true)
    fireEvent.click(screen.getByRole('button', { name: 'Preview selected (2)' }))
    await screen.findByText('Source: Crossref')
    expect(JSON.parse(fetchMock.callHistory.calls(`${base}/zotero/preview`)[0].options.body as string)).to.deep.equal({ itemKeys: ['ABCDEFGH', 'BCDEFGHI'], destination: { newName: 'references.bib' } })
  })

})

describe('Reference file import', function(){
 beforeEach(function(){sessionStorage.clear();fetchMock.get(`${base}/literature/bibliographies`,[])})
 afterEach(function(){cleanup();fetchMock.removeRoutes().clearHistory();sessionStorage.clear()})
 it('accepts dropped RIS text and sends a reviewed enriched import request',async function(){
  fetchMock.post(`${base}/references/import`,{task});fetchMock.get(`${base}/tasks/task`,task)
  render(<LiteratureView projectId="project" />)
  fireEvent.click(screen.getByRole('button',{name:'Import reference files'}))
  const text='TY  - JOUR\nTI  - Test\nER  -'
  const file=new File([text],'references.ris',{type:'text/plain'})
  Object.defineProperty(file,'text',{value:async()=>text})
  fireEvent.drop(screen.getByRole('region',{name:'Drop reference file'}),{dataTransfer:{files:[file]}})
  await screen.findByText('references.ris')
  fireEvent.click(screen.getByRole('button',{name:'Preview reference import'}))
  await waitFor(()=>expect(fetchMock.callHistory.calls(`${base}/references/import`)).to.have.length(1))
  const body=JSON.parse(fetchMock.callHistory.calls(`${base}/references/import`)[0].options.body as string)
  expect(body).to.deep.equal({bibtex:text,enrich:true,destination:{newName:'references.bib'}})
  expect(screen.getByLabelText('Bibliography destination').closest('details')?.open).to.equal(true)
 })
})
