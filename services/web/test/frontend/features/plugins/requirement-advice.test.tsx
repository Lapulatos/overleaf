import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import * as requests from '@/infrastructure/fetch-json'
import RequirementAdvice,{requirementRequest} from '@/features/plugins/requirement-advice'
import type {Venue} from '@/features/plugins/submission-deadlines'
const venue:Venue={id:'journal-test',title:'Target',description:'Target',kind:'journal',year:null,area:'SE',rank:'A',round:'Regular',website:'https://example.org',sourceUrl:'https://example.org',events:[]}
describe('Per-requirement manuscript advice',function(){
 afterEach(function(){cleanup();sinon.restore();localStorage.clear()})
 it('requests real file diffs and never applies them automatically',async function(){const task={taskId:'advice',status:'completed',instruction:'check',summary:'Verified anonymous review requirement.',proposals:[{id:'p',path:'main.tex',before:'author',after:'anonymous',status:'pending'}]};const post=sinon.stub(requests,'postJSON').resolves(task);sinon.stub(requests,'getJSON').resolves(task);render(<RequirementAdvice projectId="p" venue={venue} rule={{id:'review',label:'Anonymity & review'}}/>);fireEvent.click(screen.getByRole('button',{name:'Check & suggest changes'}));expect(await screen.findByText('main.tex')).to.exist;expect(post.calledOnce).to.equal(true);expect(String(post.firstCall.args[1]?.body.instruction)).to.include('actual reviewable file diffs');expect(post.firstCall.args[0]).to.equal('/writing-assist/project/p/tasks')})
 it('limits content-length checks to advice and makes no silent edit request',function(){const prompt=requirementRequest(venue,{id:'length',label:'Page & word limits'});expect(prompt).to.include('Do not edit, shorten text or shrink typography');expect(prompt).not.to.include('make minimal changes ONLY')})
})
