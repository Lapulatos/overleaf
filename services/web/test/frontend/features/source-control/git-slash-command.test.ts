import {expect} from 'chai'
import {gitCommands,parseGitCommand,prepareGitCommand} from '@/features/source-control/git-slash-command'
describe('Paper Assistant /git commands',()=>{
 it('documents every supported command and per-command parameters',()=>{
  const help=parseGitCommand('/git help').help!
  for(const command of gitCommands)expect(help).to.contain('/git '+command.usage)
  expect(parseGitCommand('/git pull --help').help).to.contain('[remote] [branch]')
 })
 it('parses quoted arguments and flags without shell expansion',()=>{
  expect(parseGitCommand('/git commit "Fix paper title" --signoff').body).to.deep.equal({command:'commit',message:'Fix paper title',signoff:true})
  expect(parseGitCommand('/git stage "chapter one.tex"').body).to.deep.equal({command:'stage',paths:['chapter one.tex']})
  expect(parseGitCommand('/git pull upstream main --rebase').body).to.deep.equal({command:'pull',remote:'upstream',branch:'main',rebase:true})
  expect(()=>parseGitCommand('/git pull; rm -rf /')).to.throw('Unknown')
  expect(()=>parseGitCommand('/git push --force')).to.throw('Unknown option')
  expect(()=>parseGitCommand('/git commit "unfinished')).to.throw('Unclosed')
  expect(()=>parseGitCommand('/git stash --staged --include-untracked')).to.throw('one stash')
 })
 it('fills pull defaults and freezes undo fingerprint',async()=>{
  const api={status:async()=>({status:{branch:'paper'}}),command:async()=>({result:{fingerprint:'abc'}})} as any
  expect((await prepareGitCommand(api,parseGitCommand('/git pull').body!)).body).to.deep.equal({command:'pull',remote:'origin',branch:'paper'})
  expect((await prepareGitCommand(api,parseGitCommand('/git undo').body!)).body).to.deep.equal({command:'undoCommit',fingerprint:'abc'})
 })
 it('rejects invalid parameters before mutation',()=>{
  for(const command of ['/git reset HEAD invalid','/git stash-drop -1','/git checkout','/git status extra'])expect(()=>parseGitCommand(command)).to.throw()
 })
 it('freezes the selected commit scope and index preview before confirmation',async()=>{
  const calls:any[]=[]
  const api={command:async(body:any)=>{calls.push(body);return {result:{fingerprint:'a'.repeat(64),paths:['main.tex']}}}} as any
  const prepared=await prepareGitCommand(api,parseGitCommand('/git commit "Reviewed" --all --signoff').body!)
  expect(calls).to.deep.equal([{command:'commitPreview',all:true,amend:false,signoff:true}])
  expect(prepared.body.fingerprint).to.equal('a'.repeat(64))
  expect(prepared.preview).to.deep.equal({fingerprint:'a'.repeat(64),paths:['main.tex']})
 })

})
