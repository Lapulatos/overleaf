import { expect } from 'chai'
import { createEntityInTree } from '@/features/file-tree/util/mutate-in-tree'

describe('File creation notification replay', function () {
  it('inserts a new document once and preserves later rename/move state', function () {
    const root = { _id: 'root', name: 'rootFolder', docs: [], fileRefs: [], folders: [] }
    const event = { _id: 'doc', name: 'new.tex', type: 'doc', rev: 1 }
    const created = createEntityInTree(root, 'root', event)
    expect(created.docs).to.have.length(1)
    expect(createEntityInTree(created, 'root', event)).to.equal(created)
    const moved = { ...root, folders: [{ _id: 'folder', name: 'tex', docs: [{ _id: 'doc', name: 'renamed.tex' }], folders: [], fileRefs: [] }] }
    expect(createEntityInTree(moved, 'root', event)).to.equal(moved)
    expect(moved.folders[0].docs[0].name).to.equal('renamed.tex')
    expect(root.docs).to.have.length(0)
  })
})
