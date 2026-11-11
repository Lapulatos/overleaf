import { expect } from 'chai'
import { compileErrorInstruction } from '@/features/source-editor/extensions/writing-assist/compile-diagnostics'

describe('Compile diagnostic request', function () {
  it('preserves the error location and warns about stale diagnostics', function () {
    const instruction = compileErrorInstruction({
      errors: [
        {
          key: 'e',
          level: 'error',
          raw: 'Undefined control sequence',
          file: 'main.tex',
          line: 3,
        },
      ],
      hasChanges: true,
    })
    expect(instruction).to.contain('Read the current project files using the workspace tools')
    expect(instruction).to.contain('repair in the isolated workspace')
    expect(instruction).to.contain('compile_project')
    expect(instruction).to.contain('I will review them before applying them')
    expect(instruction).not.to.contain('Do not run tools or commands')
    expect(instruction).to.contain('main.tex')
    expect(instruction).to.contain('"line": 3')
    expect(instruction).to.contain('Undefined control sequence')
    expect(instruction).to.contain('editor has changed since compilation')
    expect(instruction).to.contain('Raw compilation log unavailable')
  })
  it('bounds huge logs and reports omitted entries without exceeding message limits', function () {
    const instruction = compileErrorInstruction({
      errors: Array.from({ length: 1000 }, (_, i) => ({
        key: String(i),
        level: 'error',
        raw: '\u0001'.repeat(4000),
        file: 'main.tex',
        line: i + 1,
      })),
      rawLog: 'x'.repeat(200000) + 'FINAL ERROR',
    })
    expect(instruction.length).to.be.lessThan(32000)
    expect(instruction).to.contain('omitted')
    expect(instruction).to.contain('8000 of 200011 characters')
    expect(instruction).to.contain('FINAL ERROR')
  })
})
