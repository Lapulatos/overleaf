import {AgentTaskResult} from '@/features/source-editor/extensions/writing-assist/agent-task-result'
import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent} from '@testing-library/react'
import * as requests from '@/infrastructure/fetch-json'
import EnvironmentMaintenance from '@/features/source-editor/extensions/writing-assist/environment-maintenance'
describe('Environment confirmation boundary',function(){
 afterEach(()=>sinon.restore())
 it('does not mutate on opening settings and requires confirmation of each exact plan',async function(){
  sinon.stub(requests,'getJSON').resolves({enabled:true,scope:'Compiler',container:'managed',events:[],plan:{id:'plan-id',status:'built',container:'managed',previousImage:'old-image',imageId:'new-image',previousCompiler:'old-compiler',packages:['xkeyval'],dockerfile:'FROM old-image',impact:'Restarts managed container only',log:'Built'}});const post=sinon.stub(requests,'postJSON').resolves({enabled:true,events:[],plan:null});render(<EnvironmentMaintenance/>);fireEvent.click(await screen.findByRole('button',{name:'Review & confirm repair'}));expect(post.callCount).to.equal(0);const confirm=screen.getByRole('button',{name:'Confirm and execute'}) as HTMLButtonElement;expect(confirm.disabled).to.equal(true);fireEvent.click(screen.getByRole('checkbox',{name:'I authorize automatic compiler repair and restart'}));fireEvent.click(confirm);expect(post.firstCall.args[1]?.body).to.deep.equal({action:'activate',planId:'plan-id',confirmation:'plan-id'})
 })
 it('offers the same review and authorization inside Paper Assistant after a maintenance tool call',async function(){
  sinon.stub(requests,'getJSON').resolves({enabled:true,events:[],plan:{id:'chat-plan',status:'prepared',packages:['xkeyval'],previousImage:'old',dockerfile:'FROM old',log:'',impact:'Compiler only'}});const post=sinon.stub(requests,'postJSON').resolves({enabled:true,events:[],plan:null});
  render(<AgentTaskResult task={{taskId:'chat',status:'completed',instruction:'编译维护',summary:'已准备维护',output:'',proposals:[],activity:[{id:'tool',kind:'tool',status:'completed',title:'Environment repair proposal · owner confirmation required'}]}} busy={false} act={()=>{}}/>);
  fireEvent.click(await screen.findByRole('button',{name:'Review & confirm repair'}));expect(post.callCount).to.equal(0);expect((screen.getByRole('button',{name:'Confirm and execute'}) as HTMLButtonElement).disabled).to.equal(true);fireEvent.click(screen.getByRole('checkbox',{name:'I authorize automatic compiler repair and restart'}));fireEvent.click(screen.getByRole('button',{name:'Confirm and execute'}));expect(post.firstCall.args[1]?.body).to.deep.equal({action:'repair',planId:'chat-plan',confirmation:'chat-plan'})
 })

})
