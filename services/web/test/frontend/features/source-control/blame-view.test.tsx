import { expect } from 'chai'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import sinon from 'sinon'
import BlameView, { parseBlame } from '@/features/source-control/blame-view'

const hash = 'a'.repeat(40)
const output = `${hash} 8 1 2
author Alice 中文
author-time 1700000000
author-tz +0800
summary Revise title
boundary
filename paper.tex
\t  \\section{Title}
${hash} 9 2
author Alice 中文
author-time 1700000000
summary Revise title
filename paper.tex
\t
`

describe('Native blame presentation', () => {
  afterEach(cleanup)
  it('preserves indentation, empty source lines, final line numbers and native commit identity', () => {
    const rows = parseBlame(output)
    expect(rows).to.have.length(2)
    expect(rows[0]).to.deep.equal({ hash, line: 1, author: 'Alice 中文', date: '2023-11-14T22:13:20.000Z', subject: 'Revise title', text: '  \\section{Title}' })
    expect(rows[1].text).to.equal('')
    expect(rows[1].line).to.equal(2)
  })
  it('supports SHA-256 Git object names without treating source lines as metadata', () => {
    const longHash = 'b'.repeat(64)
    const rows = parseBlame(`${longHash} 2 4
author Bob
author-time 0
summary Initial
\tauthor Not Metadata
`)
    expect(rows[0].hash).to.equal(longHash)
    expect(rows[0].author).to.equal('Bob')
    expect(rows[0].text).to.equal('author Not Metadata')
  })
  it('navigates to the exact full commit hash from a displayed line', () => {
    const onCommit = sinon.spy()
    render(<BlameView path="paper.tex" output={output} busy={false} error="" onCommit={onCommit} onClose={() => {}} />)
    fireEvent.click(screen.getAllByRole('button', { name: 'aaaaaaaa' })[0])
    expect(onCommit).to.have.been.calledOnceWithExactly(hash)
    expect(screen.getAllByText('Alice 中文')).to.have.length(2)
    expect(screen.getByText('Committed file version. Select a commit to view its changes.')).to.exist
  })
})
