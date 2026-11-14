import {expect} from 'chai'
import {mentions,mentionText,referencedScope,restoreMentionDraft,readProjectDrop} from '@/features/source-editor/extensions/writing-assist/composer-mentions'

describe('Inline reference serialization',()=>{
 it('round trips spaces, unicode, quotes and folders',()=>{
  for(const item of [{kind:'file' as const,path:'章节/研究 "一".tex'},{kind:'folder' as const,path:'my figures'}]){
   expect(mentions('请查看'+mentionText(item)+'，保留正文。')[0].item).to.deep.equal(item)
  }
 })
 it('keeps scope until the last duplicate is removed and ignores email addresses',()=>{
  const known=[{kind:'file' as const,path:'main.tex'}]
  expect(referencedScope('@main.tex and @main.tex',known)).to.deep.equal(known)
  expect(referencedScope('removed first; @main.tex',known)).to.deep.equal(known)
  expect(referencedScope('email user@main.tex',known)).to.deep.equal([])
 })
 it('restores historical attachment-only drafts without duplicating inline references',()=>{
  const scope=[{kind:'folder' as const,path:'tex'},{kind:'file' as const,path:'main.tex'}]
  expect(restoreMentionDraft('Check @main.tex',scope)).to.equal('Check @main.tex\n@tex/')
 })
 it('rejects malformed, cross-project, traversal and oversized drag payloads',()=>{
  expect(readProjectDrop('{','p')).to.deep.equal([])
  expect(readProjectDrop(JSON.stringify({projectId:'p',items:[{kind:'file',path:'../other.tex'}]}),'p')).to.deep.equal([])
  expect(readProjectDrop(JSON.stringify({projectId:'p',items:Array(31).fill({kind:'file',path:'main.tex'})}),'p')).to.deep.equal([])
 })
})
