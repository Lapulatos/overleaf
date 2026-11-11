import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compilationDiagnostic } from '../src/project-compile.mjs'

test('missing TeX inputs produce actionable diagnostics without claiming all missing files are system packages', () => {
  for (const file of ['setspace.sty', 'tikzfill.image.sty', 'chapters/results.tex']) {
    const result = compilationDiagnostic("! LaTeX Error: File `" + file + "' not found.")
    assert.equal(result.kind, 'missing-input')
    assert.equal(result.file, file)
    assert.match(result.guidance, /project file or a compiler package/)
    assert.match(result.guidance, /stop compilation retries/)
  }
})
test('ordinary LaTeX syntax errors are not labelled missing dependencies', () => {
  assert.equal(compilationDiagnostic('! Undefined control sequence.\nl.15 \\unknown'), null)
  assert.equal(compilationDiagnostic('Output written on main.pdf'), null)
})

test('missing compiler font is identified without proposing manuscript typography changes', () => {
  const result=compilationDiagnostic('!pdfTeX error: pdflatex (file tcrm1000): Font tcrm1000 at 602 not found')
  assert.equal(result.kind,'missing-font')
  assert.equal(result.file,'tcrm1000')
  assert.match(result.guidance,/Do not change the manuscript typography/)
})
