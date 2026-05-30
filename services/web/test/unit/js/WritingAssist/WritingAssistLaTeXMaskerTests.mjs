import { describe, it } from 'mocha'
import { expect } from 'chai'
import WritingAssistLaTeXMasker from
  '../../../../app/src/Features/WritingAssist/WritingAssistLaTeXMasker.mjs'

describe('WritingAssistLaTeXMasker', function () {
  it('should pass through plain text unchanged', function () {
    const { maskedText, remap } = WritingAssistLaTeXMasker.mask('Hello world.')
    expect(maskedText).to.equal('Hello world.')
    for (let i = 0; i < maskedText.length; i++) {
      expect(remap(i)).to.equal(i)
    }
  })

  it('should mask LaTeX commands', function () {
    const { maskedText } = WritingAssistLaTeXMasker.mask('Use \\textbf{bold} text.')
    expect(maskedText).to.not.include('textbf')
    expect(maskedText).to.not.include('{bold}')
  })

  it('should mask inline math', function () {
    const { maskedText } = WritingAssistLaTeXMasker.mask('The value $x^2 + y^2$ is positive.')
    expect(maskedText).to.not.include('x^2')
  })

  it('should mask display math', function () {
    const { maskedText } = WritingAssistLaTeXMasker.mask('We have:\\[E = mc^2\\]Thus.')
    expect(maskedText).to.not.include('mc^2')
  })

  it('should mask \\cite and \\ref', function () {
    const { maskedText } = WritingAssistLaTeXMasker.mask(
      'As shown in \\cite{smith2023} and \\ref{fig:main}.'
    )
    expect(maskedText).to.not.include('smith2023')
    expect(maskedText).to.not.include('fig:main')
  })

  it('should strip comments', function () {
    const { maskedText } = WritingAssistLaTeXMasker.mask(
      'Hello % this is a comment\nworld.'
    )
    expect(maskedText).to.not.include('comment')
    expect(maskedText).to.include('world')
  })

  it('should return a valid remap function', function () {
    const original = 'The \\textbf{method} works.'
    const { maskedText, remap } = WritingAssistLaTeXMasker.mask(original)
    expect(typeof remap).to.equal('function')
    expect(typeof maskedText).to.equal('string')
  })
})
