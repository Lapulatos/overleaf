import { expect } from 'chai'
import { onGitViewingIntent, viewGitCommit } from '@/features/source-control/git-presence-state'

describe('Git viewing intent across presence reconnects', () => {
 it('replays the current history position when the transport binds again', () => {
  const project = 'reconnect-project', hash = 'a'.repeat(40), seen: (string | null)[] = []
  viewGitCommit(project, hash)
  let stop = onGitViewingIntent(project, value => seen.push(value))
  expect(seen).to.deep.equal([hash])
  stop()
  stop = onGitViewingIntent(project, value => seen.push(value))
  expect(seen).to.deep.equal([hash, hash])
  viewGitCommit(project, null)
  expect(seen.at(-1)).to.equal(null)
  stop()
  stop = onGitViewingIntent(project, value => seen.push(value))
  expect(seen.at(-1)).to.equal(null)
  stop()
 })
 it('keeps viewing intentions scoped to their workspace', () => {
  viewGitCommit('workspace-a', 'b'.repeat(40))
  let value: string | null = 'unexpected'
  const stop = onGitViewingIntent('workspace-b', commit => { value = commit })
  expect(value).to.equal(null)
  stop(); viewGitCommit('workspace-a', null)
 })
})
