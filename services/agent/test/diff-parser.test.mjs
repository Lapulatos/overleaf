// @ts-check
/**
 * Unit tests for diff-parser.mjs
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePath,
  resolveDocId,
  parseUnifiedDiff,
  applyHunkToContent,
  extractDiffBlocks,
} from '../src/diff-parser.mjs'

// ── normalizePath ──────────────────────────────────────────────────────────

describe('normalizePath', () => {
  it('strips a/ prefix', () => {
    assert.equal(normalizePath('a/main.tex'), 'main.tex')
  })

  it('strips b/ prefix', () => {
    assert.equal(normalizePath('b/refs.bib'), 'refs.bib')
  })

  it('returns empty for /dev/null', () => {
    assert.equal(normalizePath('/dev/null'), '')
  })

  it('normalizes backslashes', () => {
    assert.equal(normalizePath('chapters\\intro.tex'), 'chapters/intro.tex')
  })

  it('strips leading ./', () => {
    assert.equal(normalizePath('./main.tex'), 'main.tex')
  })

  it('collapses repeated slashes', () => {
    assert.equal(normalizePath('chapters//intro.tex'), 'chapters/intro.tex')
  })

  it('returns empty for null', () => {
    assert.equal(normalizePath(null), '')
  })
})

// ── resolveDocId ───────────────────────────────────────────────────────────

describe('resolveDocId', () => {
  const fileMap = {
    'main.tex': { docId: 'abc123', version: 5 },
    'refs.bib': { docId: 'def456', version: 3 },
    'chapters/intro.tex': { docId: 'ghi789', version: 2 },
  }

  it('finds exact match', () => {
    const result = resolveDocId('main.tex', fileMap)
    assert.equal(result.docId, 'abc123')
  })

  it('finds by basename when exact match fails', () => {
    const result = resolveDocId('refs.bib', fileMap)
    assert.equal(result.docId, 'def456')
  })

  it('returns null for unknown file', () => {
    const result = resolveDocId('unknown.tex', fileMap)
    assert.equal(result, null)
  })

  it('returns null for empty path', () => {
    const result = resolveDocId('', fileMap)
    assert.equal(result, null)
  })

  it('returns null for null fileMap', () => {
    const result = resolveDocId('main.tex', null)
    assert.equal(result, null)
  })
})

// ── parseUnifiedDiff ───────────────────────────────────────────────────────

describe('parseUnifiedDiff', () => {
  const fileMap = {
    'main.tex': { docId: 'abc123', version: 5 },
    'refs.bib': { docId: 'def456', version: 3 },
  }

  it('parses single hunk, single file', () => {
    const diff = `--- a/main.tex
+++ b/main.tex
@@ -10,3 +10,3 @@
 \\documentclass{article}
-\\usepackage{foo}
+\\usepackage{bar}
 \\begin{document}`
    const result = parseUnifiedDiff(diff, fileMap)
    assert.equal(result.hunks.length, 1)
    assert.equal(result.hunks[0].filePath, 'main.tex')
    assert.equal(result.hunks[0].docId, 'abc123')
    assert.equal(result.hunks[0].removeLines.length, 3)
    assert.equal(result.hunks[0].addLines.length, 3)
  })

  it('parses multiple files in one diff', () => {
    const diff = `--- a/main.tex
+++ b/main.tex
@@ -1,2 +1,2 @@
-old line 1
+new line 1
 context
--- a/refs.bib
+++ b/refs.bib
@@ -5,2 +5,2 @@
-@article{old,
+@article{new,
 context2`
    const result = parseUnifiedDiff(diff, fileMap)
    assert.equal(result.hunks.length, 2)
    assert.equal(result.hunks[0].filePath, 'main.tex')
    assert.equal(result.hunks[1].filePath, 'refs.bib')
    assert.equal(result.hunks[0].docId, 'abc123')
    assert.equal(result.hunks[1].docId, 'def456')
  })

  it('skips paths not in fileMap', () => {
    const diff = `--- a/unknown.tex
+++ b/unknown.tex
@@ -1,1 +1,1 @@
-old
+new`
    const result = parseUnifiedDiff(diff, fileMap)
    assert.equal(result.hunks.length, 0)
    assert.equal(result.skippedPaths.length, 1)
    assert.equal(result.skippedPaths[0], 'unknown.tex')
  })

  it('returns empty for null input', () => {
    const result = parseUnifiedDiff(null, fileMap)
    assert.equal(result.hunks.length, 0)
  })

  it('returns empty for empty string', () => {
    const result = parseUnifiedDiff('', fileMap)
    assert.equal(result.hunks.length, 0)
  })

  it('handles LLM-abbreviated format (missing line counts)', () => {
    const diff = `--- main.tex
+++ main.tex
@@ -10 +10 @@
-old
+new`
    const result = parseUnifiedDiff(diff, fileMap)
    assert.equal(result.hunks.length, 1)
    assert.equal(result.hunks[0].filePath, 'main.tex')
  })

  it('handles pure addition (no remove lines)', () => {
    const diff = `--- /dev/null
+++ b/newfile.tex
@@ -0,0 +1,3 @@
+line1
+line2
+line3`
    // newfile.tex not in fileMap → skipped
    const result = parseUnifiedDiff(diff, {})
    assert.equal(result.hunks.length, 0)
  })
})

// ── applyHunkToContent ─────────────────────────────────────────────────────

describe('applyHunkToContent', () => {
  const originalLines = [
    'line1',
    'line2',
    'line3',
    'line4',
    'line5',
  ]

  it('applies a hunk that replaces lines', () => {
    const hunk = {
      filePath: 'test.tex',
      removeLines: ['line2', 'line3'],
      addLines: ['line2_modified', 'line3_modified'],
      oldStart: 2,
      newStart: 2,
    }
    const result = applyHunkToContent(hunk, originalLines)
    assert.equal(result.applied, true)
    assert.deepEqual(result.lines, [
      'line1',
      'line2_modified',
      'line3_modified',
      'line4',
      'line5',
    ])
  })

  it('applies a pure addition hunk', () => {
    const hunk = {
      filePath: 'test.tex',
      removeLines: [],
      addLines: ['inserted_line'],
      oldStart: 0,
      newStart: 3,
    }
    const result = applyHunkToContent(hunk, originalLines)
    assert.equal(result.applied, true)
    assert.deepEqual(result.lines, [
      'line1',
      'line2',
      'inserted_line',
      'line3',
      'line4',
      'line5',
    ])
  })

  it('fails gracefully when removeLines not found', () => {
    const hunk = {
      filePath: 'test.tex',
      removeLines: ['nonexistent_line'],
      addLines: ['replacement'],
      oldStart: 2,
      newStart: 2,
    }
    const result = applyHunkToContent(hunk, originalLines)
    assert.equal(result.applied, false)
    assert.deepEqual(result.lines, originalLines)
  })
})

// ── extractDiffBlocks ──────────────────────────────────────────────────────

describe('extractDiffBlocks', () => {
  it('extracts markdown-wrapped diff blocks', () => {
    const output = `Here is my analysis:

\`\`\`diff
--- a/main.tex
+++ b/main.tex
@@ -1,1 +1,1 @@
-old
+new
\`\`\`

That's the change.`
    const blocks = extractDiffBlocks(output)
    assert.equal(blocks.length, 1)
    assert.ok(blocks[0].includes('--- a/main.tex'))
  })

  it('extracts bare diff blocks when no code fence', () => {
    const output = `--- a/main.tex
+++ b/main.tex
@@ -1,1 +1,1 @@
-old
+new`
    const blocks = extractDiffBlocks(output)
    assert.equal(blocks.length, 1)
  })

  it('returns empty for text without diffs', () => {
    const blocks = extractDiffBlocks('No changes needed.')
    assert.equal(blocks.length, 0)
  })

  it('returns empty for null input', () => {
    const blocks = extractDiffBlocks(null)
    assert.equal(blocks.length, 0)
  })
})