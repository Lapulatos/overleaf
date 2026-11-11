import {expect} from 'chai'
import sinon from 'sinon'
import {render,screen,fireEvent,cleanup} from '@testing-library/react'
import * as requests from '@/infrastructure/fetch-json'
import SourceNetworkSettings from '@/features/settings/components/source-network-settings'
describe('Source network settings',function(){
 afterEach(function(){cleanup();sinon.restore()})
 it('saves custom settings without displaying a stored password, then tests saved settings',async function(){
 const state={mode:'environment',url:'',username:'',hasPassword:false,environmentProxyConfigured:true};sinon.stub(requests,'getJSON').resolves(state);const post=sinon.stub(requests,'postJSON');post.onFirstCall().resolves({...state,mode:'custom',url:'http://127.0.0.1:7890',hasPassword:true});post.onSecondCall().resolves({ok:true,url:'https://conf.researchr.org/',httpStatus:200,elapsedMs:100})
 render(<SourceNetworkSettings/>);fireEvent.change(await screen.findByLabelText('Connection mode'),{target:{value:'custom'}});fireEvent.change(screen.getByLabelText('Proxy address'),{target:{value:'http://127.0.0.1:7890'}});fireEvent.change(screen.getByLabelText('Password (optional)'),{target:{value:'test-secret'}});fireEvent.click(screen.getByRole('button',{name:'Save source proxy settings'}));await screen.findByText('Saved. New source requests will use these settings.');expect((screen.getByLabelText('Password (optional)') as HTMLInputElement).value).to.equal('');expect(post.firstCall.args[1]?.body).to.include({mode:'custom',password:'test-secret'});fireEvent.click(screen.getByRole('button',{name:'Test saved settings'}));expect(await screen.findByText('Source reachable · HTTP 200')).to.exist
 })
 it('shows owner authorization errors without exposing settings or saving',async function(){sinon.stub(requests,'getJSON').rejects(Error('Only the configured computer owner'));render(<SourceNetworkSettings/>);expect(await screen.findByRole('alert')).to.exist;expect(screen.queryByRole('button',{name:'Save source proxy settings'})).to.equal(null)})
})
