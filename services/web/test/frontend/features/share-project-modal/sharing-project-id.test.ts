import { expect } from 'chai'
import { sharingProjectId } from '@/features/share-project-modal/utils/api'

describe('sharing project identity', function () {
  const root = '6af40820d9a4263b7a7c0e12'
  const workspace = 'e862a1d037cf8d10f1d4336e'
  const other = '6ced4d536fe7a363cad6eb3e'
  it('uses logical project membership from a branch editor', function () {
    expect(sharingProjectId(workspace, `/project/${root}/workspace/${workspace}`)).to.equal(root)
  })
  it('keeps another explicitly requested project unchanged', function () {
    expect(sharingProjectId(other, `/project/${root}/workspace/${workspace}`)).to.equal(other)
  })
  it('keeps the ordinary project route unchanged', function () {
    expect(sharingProjectId(root, `/project/${root}`)).to.equal(root)
  })
})
