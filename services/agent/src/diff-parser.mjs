// @ts-check
/**
 * Unified diff parser for agent daemon output.
 *
 * Parses unified diff text produced by LLM backends (Claude Code, Codex, etc.)
 * and resolves diff hunks to Overleaf document IDs via a file map.
 *
 * Supports:
 * - Multi-file diffs (`--- a/path` / `+++ b/path` headers)
 * - Multi-hunk per file
 * - LLM-abbreviated format (missing line counts treated as 1)
 * - Graceful degradation: unknown paths → skipped, malformed → partial parse
 */

/**
 * @typedef {Object} DiffHunk
 * @property {string} filePath - Normalized file path (e.g. "main.tex", "chapters/intro.tex")
 * @property {string} [docId] - Overleaf document ID (resolved from fileMap)
 * @property {number} [version] - Document version at read time (from fileMap)
 * @property {string[]} removeLines - Lines starting with '-' (context + removed)
 * @property {string[]} addLines - Lines starting with '+' (context + added)
 * @property {number} [oldStart] - Line number in original file
 * @property {number} [newStart] - Line number in new file
 */

/**
 * @typedef {Object} FileEntry
 * @property {string} docId - Overleaf document ID
 * @property {number} version - Document version at read time
 * @property {string} [path] - Normalized file path
 */

/**
 * @typedef {Object} ParsedDiff
 * @property {DiffHunk[]} hunks - All parsed diff hunks
 * @property {string[]} skippedPaths - File paths not found in fileMap
 * @property {string[]} errors - Parse error messages
 */

/**
 * Normalize a file path from diff headers.
 * Strips leading "a/" or "b/" prefixes and normalizes separators.
 *
 * @param {string} rawPath - Raw path from diff header (e.g. "a/main.tex")
 * @returns {string} Normalized path (e.g. "main.tex")
 */
export function normalizePath(rawPath) {
  if (!rawPath || rawPath === '/dev/null') return ''
  // Strip a/ or b/ prefix used by git-style diffs
  let path = rawPath.replace(/^[ab]\//, '')
  // Normalize backslashes to forward slashes
  path = path.replace(/\\/g, '/')
  // Remove leading ./ if present
  if (path.startsWith('./')) path = path.slice(2)
  // Collapse repeated slashes
  path = path.replace(/\/+/g, '/')
  // Remove trailing slash
  path = path.replace(/\/$/, '')
  return path
}

/**
 * Resolve a file path to a docId using the file map.
 *
 * @param {string} filePath - Normalized file path
 * @param {Record<string, FileEntry>} fileMap - Map from path to doc info
 * @returns {FileEntry|null} Matching entry or null
 */
export function resolveDocId(filePath, fileMap) {
  if (!fileMap || !filePath) return null

  // Try exact match first
  if (fileMap[filePath]) return fileMap[filePath]

  // Try matching just the filename (for "main.tex" → "/main.tex" etc.)
  const basename = filePath.split('/').pop()
  if (basename) {
    for (const [path, entry] of Object.entries(fileMap)) {
      if (path.split('/').pop() === basename) return entry
    }
  }

  return null
}

/**
 * Parse a unified diff range specification.
 * Handles: "5", "5,3", "5,0"
 *
 * @param {string} range - Diff range string (e.g. "5,3")
 * @returns {{ start: number, count: number }}
 */
function parseRange(range) {
  const parts = range.split(',')
  const start = parseInt(parts[0], 10)
  // Default count to 1 if missing (LLMs sometimes omit it)
  const count = parts.length > 1 ? parseInt(parts[1], 10) : 1
  return { start: isNaN(start) ? 1 : start, count: isNaN(count) ? 1 : count }
}

/**
 * Parse unified diff text into structured hunks.
 *
 * @param {string} diffText - Raw unified diff text from LLM output
 * @param {Record<string, FileEntry>} [fileMap] - Map from path to {docId, version}
 * @returns {ParsedDiff}
 */
export function parseUnifiedDiff(diffText, fileMap = {}) {
  /** @type {DiffHunk[]} */
  const hunks = []
  /** @type {string[]} */
  const skippedPaths = []
  /** @type {string[]} */
  const errors = []

  if (!diffText || typeof diffText !== 'string') {
    return { hunks, skippedPaths, errors }
  }

  const lines = diffText.split('\n')
  let currentFilePath = ''
  let currentDocId = ''
  let currentVersion = 0
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // File header: --- a/path
    if (line.startsWith('--- ')) {
      const rawPath = line.slice(4).trim()
      currentFilePath = normalizePath(rawPath)
      i++
      continue
    }

    // File header: +++ b/path
    if (line.startsWith('+++ ')) {
      const rawPath = line.slice(4).trim()
      const newPath = normalizePath(rawPath)
      // Use +++ path if --- was /dev/null or missing
      if (!currentFilePath || currentFilePath === '') {
        currentFilePath = newPath
      }
      // Try to resolve docId
      const entry = resolveDocId(currentFilePath, fileMap)
      if (entry) {
        currentDocId = entry.docId
        currentVersion = entry.version
      } else if (currentFilePath && currentFilePath !== '/dev/null') {
        // Only skip if we have a real path that's not in the fileMap
        // Don't skip yet — might resolve on a later hunk
      }
      i++
      continue
    }

    // Hunk header: @@ -oldRange +newRange @@
    const hunkMatch = line.match(
      /^@@\s+-(\d+(?:,\d+)?)\s+\+(\d+(?:,\d+)?)\s+@@/
    )
    if (hunkMatch) {
      const oldRange = parseRange(hunkMatch[1])
      const newRange = parseRange(hunkMatch[2])
      /** @type {string[]} */
      const removeLines = []
      /** @type {string[]} */
      const addLines = []

      i++
      // Collect hunk body lines
      while (i < lines.length) {
        const bodyLine = lines[i]
        // Stop at next file header, hunk header, or diff separator
        if (
          bodyLine.startsWith('--- ') ||
          bodyLine.startsWith('+++ ') ||
          bodyLine.startsWith('@@ ') ||
          bodyLine.startsWith('diff --git')
        ) {
          break
        }
        if (bodyLine.startsWith('-')) {
          removeLines.push(bodyLine.slice(1))
        } else if (bodyLine.startsWith('+')) {
          addLines.push(bodyLine.slice(1))
        } else if (bodyLine.startsWith(' ')) {
          // Context line — belongs to both sides
          removeLines.push(bodyLine.slice(1))
          addLines.push(bodyLine.slice(1))
        } else if (bodyLine === '') {
          // Empty context line (blank line in document)
          removeLines.push('')
          addLines.push('')
        } else {
          // Non-standard line (e.g. "\ No newline at end of file") — skip
        }
        i++
      }

      // Only add hunk if it has actual changes (not just context)
      const hasChanges =
        removeLines.length > 0 || addLines.length > 0

      if (hasChanges && currentFilePath) {
        const entry = resolveDocId(currentFilePath, fileMap)
        if (entry || currentDocId) {
          hunks.push({
            filePath: currentFilePath,
            docId: entry?.docId || currentDocId,
            version: entry?.version ?? currentVersion,
            removeLines,
            addLines,
            oldStart: oldRange.start,
            newStart: newRange.start,
          })
        } else if (currentFilePath !== '/dev/null') {
          if (!skippedPaths.includes(currentFilePath)) {
            skippedPaths.push(currentFilePath)
          }
        }
      }

      continue
    }

    // diff --git header — reset file context
    if (line.startsWith('diff --git')) {
      currentFilePath = ''
      currentDocId = ''
      currentVersion = 0
      i++
      continue
    }

    // Skip non-diff lines (context, noise)
    i++
  }

  return { hunks, skippedPaths, errors }
}

/**
 * Apply a diff hunk to a content string, producing new lines.
 *
 * Strategy: Find the removed lines in the original content, replace them
 * with the added lines. If the exact removed lines aren't found, fall back
 * to line-range-based replacement.
 *
 * @param {DiffHunk} hunk - The diff hunk to apply
 * @param {string[]} originalLines - The original document lines
 * @returns {{ lines: string[], applied: boolean }}
 */
export function applyHunkToContent(hunk, originalLines) {
  if (!hunk.removeLines || hunk.removeLines.length === 0) {
    // Pure addition — insert at newStart position
    const insertAt = Math.min(
      Math.max(0, (hunk.newStart || 1) - 1),
      originalLines.length
    )
    const newLines = [
      ...originalLines.slice(0, insertAt),
      ...hunk.addLines,
      ...originalLines.slice(insertAt),
    ]
    return { lines: newLines, applied: true }
  }

  // Try to find the exact removed lines in the original
  const removeText = hunk.removeLines.join('\n')
  const originalText = originalLines.join('\n')
  const matchIndex = originalText.indexOf(removeText)

  if (matchIndex !== -1) {
    // Exact match — replace
    const before = originalText.slice(0, matchIndex)
    const after = originalText.slice(matchIndex + removeText.length)
    const newText = before + hunk.addLines.join('\n') + after
    return { lines: newText.split('\n'), applied: true }
  }

  // Fallback: line-range-based replacement
  // Use oldStart as 1-based line index
  const startLine = Math.max(0, (hunk.oldStart || 1) - 1)
  const endLine = Math.min(startLine + hunk.removeLines.length, originalLines.length)

  // Verify the lines at the range roughly match (fuzzy: ignore whitespace)
  const originalChunk = originalLines.slice(startLine, endLine).join('').replace(/\s+/g, '')
  const removeChunk = hunk.removeLines.join('').replace(/\s+/g, '')

  if (originalChunk === removeChunk) {
    // Whitespace-only differences — apply range-based replacement
    const newLines = [
      ...originalLines.slice(0, startLine),
      ...hunk.addLines,
      ...originalLines.slice(endLine),
    ]
    return { lines: newLines, applied: true }
  }

  // Could not apply — return original
  return { lines: originalLines, applied: false }
}

/**
 * Extract diff blocks from LLM output text.
 * Handles markdown-wrapped diffs (```diff ... ```) and bare diffs.
 *
 * @param {string} output - Raw LLM output text
 * @returns {string[]} Array of diff text blocks
 */
export function extractDiffBlocks(output) {
  if (!output || typeof output !== 'string') return []

  const blocks = []

  // Pattern 1: Markdown code blocks with diff language tag
  const mdPattern = /```diff\n([\s\S]*?)```/g
  let match
  while ((match = mdPattern.exec(output)) !== null) {
    blocks.push(match[1])
  }

  // Pattern 2: Bare diff blocks (starts with --- or @@ without code fence)
  if (blocks.length === 0) {
    const hasDiffMarkers =
      output.includes('--- ') && output.includes('+++ ') &&
      output.includes('@@ ')
    if (hasDiffMarkers) {
      // Extract the diff portion (from first --- or @@ to end of diff content)
      const diffStart = output.search(/^(--- |\@@ )/m)
      if (diffStart !== -1) {
        blocks.push(output.slice(diffStart))
      }
    }
  }

  return blocks
}
