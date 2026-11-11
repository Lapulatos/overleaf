import { expect } from 'chai'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { ModelControls } from '@/features/source-editor/extensions/writing-assist/model-controls'
import { ReferenceTools } from '@/features/source-editor/extensions/writing-assist/reference-tools'
const base='/writing-assist/project/project'
const inventory=[{id:'bib',path:'references.bib',error:null,entries:[{key:'cao2024spiking',title:'Spiking networks',unresolved:[]}]}]
describe('Reference checks workspace',function(){
 beforeEach(function(){sessionStorage.clear();fetchMock.get(`${base}/models`,{models:[]});fetchMock.get(`${base}/references/inventory`,inventory)})
 afterEach(function(){cleanup();fetchMock.removeRoutes().clearHistory();sessionStorage.clear()})
 it('submits selected references and a distinct support-check mode without document mutations',async function(){
  const task={taskId:'audit',status:'completed',instruction:'internal audit prompt',summary:'Insufficient full-text evidence. https://arxiv.org/abs/2401.12345',proposals:[]}
  fetchMock.post(`${base}/references/tasks`,task);fetchMock.get(`${base}/tasks/audit`,task)
  render(<ReferenceTools projectId="project" />)
  expect(screen.getByRole('button',{name:'Check citations'}).hasAttribute('disabled')).to.equal(true)
  fireEvent.click(await screen.findByRole('checkbox',{name:/Spiking networks/}))
  fireEvent.click(screen.getByRole('button',{name:'Check citations'}))
  await screen.findByText(/Insufficient full-text evidence/)
  const body=JSON.parse(fetchMock.callHistory.calls(`${base}/references/tasks`)[0].options.body as string)
  expect(body).to.deep.equal({mode:'claims',docId:'bib',keys:['cao2024spiking']})
  expect(screen.queryByText('internal audit prompt')).to.equal(null)
  expect(screen.queryByRole('button',{name:'Accept change'})).to.equal(null)
 })
 it('offers only metadata and citation checks',function(){
  render(<ReferenceTools projectId="project" />)
  const actions=screen.getByRole('group',{name:'Reference check actions'})
  expect(actions.querySelectorAll('button')).to.have.length(2)
  expect(screen.queryByRole('button',{name:'Preview fixes'})).to.equal(null)
  expect(screen.getByRole('button',{name:'Check metadata'})).to.exist
  expect(screen.getByRole('button',{name:'Check citations'})).to.exist
 })
 it('never offers a bibliography-style changing action',function(){
  render(<ReferenceTools projectId="project" />)
  expect(screen.queryByRole('button',{name:'Preview ACM formatting'})).to.equal(null)
 })
})


describe('Reference field application',function(){
 beforeEach(function(){sessionStorage.clear();fetchMock.get(`${base}/models`,{models:[]});fetchMock.get(`${base}/references/inventory`,inventory)})
 afterEach(function(){cleanup();fetchMock.removeRoutes().clearHistory();sessionStorage.clear()})
 it('hides matching values and applies exactly the clicked field from the audited task',async function(){
  const review={docId:'bib',baseHash:'hash',keys:['cao2024spiking'],checkedAt:'2026-11-01T10:00:00Z',entries:[{key:'cao2024spiking',source:'https://api.crossref.org/works/x',identity:null,reason:null,fields:[{field:'title',current:'Matching title hidden',found:'Matching title hidden',status:'matches'},{field:'year',current:'2024',found:'2023',status:'review-difference'},{field:'publisher',current:'',found:'Publisher',status:'missing-in-bibliography'}],actions:[{field:'year',before:'2024',after:'2023'},{field:'publisher',before:'',after:'Publisher'}]}]}
  const task={taskId:'compact',status:'completed',instruction:'internal prompt',summary:'Long evidence report',proposals:[{id:'combined',docId:'bib',path:'references.bib',before:'old',after:'new',status:'pending'}],referenceReview:review}
  fetchMock.post(`${base}/references/tasks`,task);fetchMock.get(`${base}/tasks/compact`,task)
  const applied={...task,taskId:'applied',referenceReview:{...review,appliedCount:1,entries:[{...review.entries[0],fields:review.entries[0].fields.map(f=>f.field==='year'?{...f,current:'2023',status:'matches'}:f),actions:[review.entries[0].actions[1]]}]}}
  fetchMock.post(`${base}/references/apply`,applied);fetchMock.get(`${base}/tasks/applied`,applied)
  render(<ReferenceTools projectId="project" />)
  fireEvent.click(await screen.findByRole('checkbox',{name:/Spiking networks/}));fireEvent.click(screen.getByRole('button',{name:'Check metadata'}))
  await screen.findByText('1 differences');expect(screen.queryByText('Matching title hidden')).to.equal(null)
  expect(screen.getByText('Long evidence report').closest('details')?.open).to.equal(false)
  fireEvent.click(screen.getByRole('button',{name:'Apply cao2024spiking Year'}))
  await screen.findByText('Applied 1 changes')
  expect(JSON.parse(fetchMock.callHistory.calls(`${base}/references/apply`)[0].options.body as string)).to.deep.equal({taskId:'compact',fields:[{key:'cao2024spiking',field:'year'}]})
  expect(screen.queryByRole('button',{name:'Apply cao2024spiking Year'})).to.equal(null)
  expect(screen.getByRole('button',{name:'Apply cao2024spiking Publisher'})).to.exist
 })
})


describe('References reuse assistant settings and recover polling',function(){
 afterEach(function(){cleanup();fetchMock.removeRoutes().clearHistory();sessionStorage.clear()})
 it('uses the dock model and effort without rendering duplicate controls',async function(){
  const project='inherit-settings';const root=`/writing-assist/project/${project}`
  fetchMock.get(`${root}/models`,{models:[{id:'m',name:'Shared model',isDefault:true,defaultEffort:'low',efforts:['low','high']}]})
  fetchMock.get(`${root}/references/inventory`,inventory)
  const task={taskId:'shared',status:'completed',instruction:'',summary:'Shared settings used',proposals:[]}
  fetchMock.post(`${root}/references/tasks`,task);fetchMock.get(`${root}/tasks/shared`,task)
  const mounted=render(<><ModelControls projectId={project} disabled={false} onChange={()=>{}}/><ReferenceTools projectId={project}/></>)
  await screen.findByRole('option',{name:'Shared model'})
  fireEvent.change(screen.getByLabelText('Reasoning effort'),{target:{value:'high'}})
  expect(screen.getAllByLabelText('Reasoning effort')).to.have.length(1)
  fireEvent.click(await screen.findByRole('checkbox',{name:/Spiking networks/}));fireEvent.click(screen.getByRole('button',{name:'Check metadata'}))
  await screen.findByText('Shared settings used')
  expect(JSON.parse(fetchMock.callHistory.calls(`${root}/references/tasks`)[0].options.body as string)).to.include({model:'m',effort:'high'})
  mounted.rerender(<ReferenceTools projectId={project}/> )
  expect(screen.queryByLabelText('Model',{exact:true})).to.equal(null)
  expect(screen.queryByLabelText('Reasoning effort')).to.equal(null)
 })
 it('resumes status polling after a transient failure',async function(){
  this.timeout(8000)
  const root='/writing-assist/project/recovery';let attempts=0
  fetchMock.get(`${root}/references/inventory`,inventory)
  sessionStorage.setItem('reference-check:recovery','retry-task')
  fetchMock.get(`${root}/tasks/retry-task`,()=>++attempts===1?503:{taskId:'retry-task',status:'completed',instruction:'',summary:'Formatting completed',proposals:[]})
  render(<ReferenceTools projectId="recovery"/>)
  await screen.findByText('Formatting completed',{}, {timeout:6000})
  expect(attempts).to.equal(2)
  expect(screen.queryByRole('alert')).to.equal(null)
 })
})

describe('Select all reference batches',function(){
 afterEach(function(){cleanup();fetchMock.removeRoutes().clearHistory();sessionStorage.clear()})
 it('checks all 23 references in 10/10/3 batches and retains each result',async function(){
  const root='/writing-assist/project/batched';const entries=Array.from({length:23},(_,i)=>({key:`key${i}`,title:`Paper ${i}`,unresolved:[]}));let n=0
  fetchMock.get(`${root}/references/inventory`,[{id:'bib',path:'r.bib',entries}])
  fetchMock.post(`${root}/references/tasks`,()=>({taskId:`t${++n}`,status:'completed',instruction:'',summary:`Report ${n}`,proposals:[]}))
  fetchMock.get(/\/writing-assist\/project\/batched\/tasks\/t\d+$/,call=>({taskId:call.url.split('/').pop(),status:'completed',instruction:'',summary:'Stored report',proposals:[]}))
  render(<ReferenceTools projectId="batched"/>);fireEvent.click(await screen.findByRole('button',{name:'Select all'}));expect(screen.getByText('23 selected')).to.exist
  fireEvent.click(screen.getByRole('button',{name:'Check metadata'}));await screen.findByText('23 / 23 references checked · Batch 3 / 3')
  const calls=fetchMock.callHistory.calls(`${root}/references/tasks`).map(c=>JSON.parse(c.options.body as string));expect(calls.map(c=>c.keys.length)).to.deep.equal([10,10,3]);expect(new Set(calls.flatMap(c=>c.keys)).size).to.equal(23)
  expect(screen.getByRole('heading',{name:'Batch 1'})).to.exist;expect(screen.getByRole('heading',{name:'Batch 3'})).to.exist
  expect(JSON.parse(sessionStorage.getItem('reference-batches:batched')!)).to.have.length(3)
 })
 it('stops a running batch and never submits the next batch',async function(){
  const root='/writing-assist/project/stopbatch';const entries=Array.from({length:12},(_,i)=>({key:`k${i}`,title:`P ${i}`,unresolved:[]}))
  fetchMock.get(`${root}/references/inventory`,[{id:'bib',path:'r.bib',entries}]);const task={taskId:'running',status:'running',instruction:'',summary:'',proposals:[]}
  fetchMock.post(`${root}/references/tasks`,task);fetchMock.get(`${root}/tasks/running`,{...task,status:'cancelled'});fetchMock.delete(`${root}/tasks/running`,{...task,status:'cancelled'})
  render(<ReferenceTools projectId="stopbatch"/>);fireEvent.click(await screen.findByRole('button',{name:'Select all'}));fireEvent.click(screen.getByRole('button',{name:'Check citations'}));await waitFor(()=>expect(fetchMock.callHistory.calls(`${root}/references/tasks`)).to.have.length(1))
  fireEvent.click(screen.getByRole('button',{name:'Stop remaining batches'}));await screen.findByText(/Batch 1 \/ 2 · Stopped/,{}, {timeout:4000})
  expect(fetchMock.callHistory.calls(`${root}/references/tasks`)).to.have.length(1)
 })
})
