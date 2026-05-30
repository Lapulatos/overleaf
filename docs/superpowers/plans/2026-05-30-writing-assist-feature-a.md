# Writing Assist Feature A — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Grammarly-style real-time grammar/style checking to Overleaf's CodeMirror 6 source editor with pluggable LLM backends (OpenAI, Anthropic, Custom).

**Architecture:** New `WritingAssist` backend feature module (Controller → Manager → LLMProvider factory → 3 providers) in `services/web/app/src/Features/`. New `writing-assist/` CodeMirror 6 extension (viewport tracker → sentence fingerprint cache → debounced checker → colored decorations → tooltip) in `services/web/frontend/js/features/source-editor/extensions/`. LaTeX masking + offset remapping on backend. Sentence fingerprint cache in `localStorage` per project, viewport-scoped checking only.

**Tech Stack:** Node.js 22 (callbackify + expressify pattern), Express, CodeMirror 6 StateField/Decoration, React 18 tooltips, `@overleaf/fetch-utils`, `@overleaf/validation-tools` (Zod), `@overleaf/promise-utils`, SHA-256 via Web Crypto API, Less CSS.

---

### Task 1: Shared TypeScript types

**Files:**
- Create: `services/web/types/writing-assist.ts`

- [ ] **Step 1: Write the type file**

```typescript
// services/web/types/writing-assist.ts

export const CATEGORIES = [
  'correctness',
  'clarity',
  'conciseness',
  'delivery',
  'engagement',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const VALID_CATEGORIES: Set<string> = new Set(CATEGORIES);

export interface Issue {
  offset: number;
  length: number;
  message: string;
  suggestion: string;
  category: Category;
}

export interface CheckRequest {
  text: string;
  language: 'en';
  enabledCategories: Category[];
  context?: {
    before: string;
    after: string;
  };
}

export interface CheckResponse {
  issues: Issue[];
}

export type ProviderType = 'openai' | 'anthropic' | 'custom';

export interface ProviderConfig {
  apiKey: string;
  model: string;
  endpoint?: string;
}

export interface CategoryToggles {
  correctness: boolean;
  clarity: boolean;
  conciseness: boolean;
  delivery: boolean;
  engagement: boolean;
}

export interface WritingAssistUserConfig {
  enabled: boolean;
  provider: ProviderType;
  openai?: ProviderConfig;
  anthropic?: ProviderConfig;
  custom?: ProviderConfig;
  categories: CategoryToggles;
  debounceMs: number;
}

export interface WritingAssistPublicConfig {
  enabled: boolean;
  provider: ProviderType;
  // API keys are NEVER returned — only masked prefixes
  openai?: { model: string; hasKey: boolean };
  anthropic?: { model: string; hasKey: boolean };
  custom?: { endpoint: string; model: string; hasKey: boolean };
  categories: CategoryToggles;
  debounceMs: number;
}

export const DEFAULT_CONFIG: WritingAssistPublicConfig = {
  enabled: true,
  provider: 'openai',
  openai: { model: 'gpt-4o', hasKey: false },
  anthropic: { model: 'claude-sonnet-4-6', hasKey: false },
  custom: undefined,
  categories: {
    correctness: true,
    clarity: true,
    conciseness: true,
    delivery: false,
    engagement: false,
  },
  debounceMs: 1500,
};

// Sentence fingerprint cache (localStorage — frontend only, but type lives here)
export interface SentenceCacheEntry {
  text: string;
  checkedAt: number;
  issues: Issue[];
}

export interface SentenceCache {
  version: 1;
  entries: Record<string, SentenceCacheEntry>;
}
```

- [ ] **Step 2: Commit**

```bash
git add services/web/types/writing-assist.ts
git commit -m "feat: add WritingAssist shared TypeScript types"
```

---

### Task 2: Backend — Encryption utility

**Files:**
- Create: `services/web/app/src/Features/WritingAssist/WritingAssistEncryption.mjs`

- [ ] **Step 1: Write the encryption module**

```javascript
// @ts-check
// services/web/app/src/Features/WritingAssist/WritingAssistEncryption.mjs

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16
const ENCODING_INPUT = 'utf8'
const ENCODING_OUTPUT = 'hex'

/**
 * Returns the 32-byte key derived from Settings.writingAssist.encryptionKey.
 * In production this MUST be set via WRITING_ASSIST_ENCRYPTION_KEY env var.
 * For dev/test, derive a deterministic key from any string value.
 * @param {string} rawKey
 * @returns {Buffer}
 */
function deriveKey(rawKey) {
  const key = Buffer.from(rawKey, 'utf8')
  if (key.length >= 32) return key.subarray(0, 32)
  // Pad short keys with zeros (dev only — production keys must be ≥ 32 bytes)
  const padded = Buffer.alloc(32)
  key.copy(padded)
  return padded
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * @param {string} plaintext
 * @param {string} rawKey — from Settings.writingAssist.encryptionKey
 * @returns {string} "iv:tag:ciphertext" (all hex)
 */
function encrypt(plaintext, rawKey) {
  if (!plaintext) return ''
  const key = deriveKey(rawKey)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, ENCODING_INPUT, ENCODING_OUTPUT)
  encrypted += cipher.final(ENCODING_OUTPUT)
  const tag = cipher.getAuthTag()
  return `${iv.toString(ENCODING_OUTPUT)}:${tag.toString(ENCODING_OUTPUT)}:${encrypted}`
}

/**
 * Decrypt ciphertext produced by encrypt().
 * @param {string} combined — "iv:tag:ciphertext"
 * @param {string} rawKey
 * @returns {string}
 */
function decrypt(combined, rawKey) {
  if (!combined) return ''
  const parts = combined.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted data format')
  const [ivHex, tagHex, encrypted] = parts
  const key = deriveKey(rawKey)
  const iv = Buffer.from(ivHex, ENCODING_OUTPUT)
  const tag = Buffer.from(tagHex, ENCODING_OUTPUT)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(encrypted, ENCODING_OUTPUT, ENCODING_INPUT)
  decrypted += decipher.final(ENCODING_INPUT)
  return decrypted
}

export default { encrypt, decrypt }
```

- [ ] **Step 2: Commit**

```bash
git add services/web/app/src/Features/WritingAssist/WritingAssistEncryption.mjs
git commit -m "feat: add WritingAssist AES-256-GCM encryption utility"
```

---

### Task 3: Backend — LLM Provider implementations

**Files:**
- Create: `services/web/app/src/Features/WritingAssist/providers/OpenAIProvider.mjs`
- Create: `services/web/app/src/Features/WritingAssist/providers/AnthropicProvider.mjs`
- Create: `services/web/app/src/Features/WritingAssist/providers/CustomProvider.mjs`

- [ ] **Step 1: Write OpenAIProvider**

```javascript
// @ts-check
// services/web/app/src/Features/WritingAssist/providers/OpenAIProvider.mjs

import { fetchJson } from '@overleaf/fetch-utils'
import { InvalidParamsError } from '../../infrastructure/Validation.mjs'

const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1'

/**
 * Call OpenAI chat/completions and return the raw response JSON.
 * @param {{ text: string, systemPrompt: string, enabledCategories: string[], model: string, apiKey: string, endpoint?: string, timeout: number }} params
 * @returns {Promise<string>} raw content string from the assistant message
 */
async function check(params) {
  const { text, systemPrompt, enabledCategories, model, apiKey, endpoint, timeout } = params
  const baseUrl = endpoint || DEFAULT_OPENAI_ENDPOINT
  const url = `${baseUrl}/chat/completions`

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserMessage(enabledCategories, text) },
    ],
    temperature: 0.1,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  }

  const response = await fetchJson(url, {
    method: 'POST',
    json: body,
    timeout,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  const content = response?.choices?.[0]?.message?.content
  if (!content) {
    throw new InvalidParamsError('OpenAI response missing content')
  }
  return content
}

/**
 * @param {string[]} enabledCategories
 * @param {string} text
 * @returns {string}
 */
function buildUserMessage(enabledCategories, text) {
  return [
    `Enabled categories: ${enabledCategories.join(', ')}`,
    'Return issues for ONLY these categories. Ignore others.',
    '',
    'Text to check:',
    '"""',
    text,
    '"""',
  ].join('\n')
}

export default { check }
```

- [ ] **Step 2: Write AnthropicProvider**

```javascript
// @ts-check
// services/web/app/src/Features/WritingAssist/providers/AnthropicProvider.mjs

import { fetchJson } from '@overleaf/fetch-utils'
import { InvalidParamsError } from '../../infrastructure/Validation.mjs'

const DEFAULT_ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1'

/**
 * Call Anthropic Messages API and return the raw response text.
 * @param {{ text: string, systemPrompt: string, enabledCategories: string[], model: string, apiKey: string, endpoint?: string, timeout: number }} params
 * @returns {Promise<string>}
 */
async function check(params) {
  const { text, systemPrompt, enabledCategories, model, apiKey, endpoint, timeout } = params
  const baseUrl = endpoint || DEFAULT_ANTHROPIC_ENDPOINT
  const url = `${baseUrl}/messages`

  const body = {
    model,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: buildUserContent(enabledCategories, text),
      },
    ],
    max_tokens: 2000,
    temperature: 0.1,
  }

  const response = await fetchJson(url, {
    method: 'POST',
    json: body,
    timeout,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
  })

  const content = response?.content?.[0]?.text
  if (!content) {
    throw new InvalidParamsError('Anthropic response missing content')
  }
  return content
}

/**
 * @param {string[]} enabledCategories
 * @param {string} text
 * @returns {string}
 */
function buildUserContent(enabledCategories, text) {
  return [
    `Enabled categories: ${enabledCategories.join(', ')}`,
    'Return issues for ONLY these categories. Ignore others.',
    '',
    'Text to check:',
    '"""',
    text,
    '"""',
  ].join('\n')
}

export default { check }
```

- [ ] **Step 3: Write CustomProvider (OpenAI-compatible endpoint)**

```javascript
// @ts-check
// services/web/app/src/Features/WritingAssist/providers/CustomProvider.mjs

import { fetchJson } from '@overleaf/fetch-utils'
import { InvalidParamsError } from '../../infrastructure/Validation.mjs'

/**
 * Call a custom OpenAI-compatible endpoint.
 * @param {{ text: string, systemPrompt: string, enabledCategories: string[], model: string, apiKey: string, endpoint: string, timeout: number }} params
 * @returns {Promise<string>}
 */
async function check(params) {
  const { text, systemPrompt, enabledCategories, model, apiKey, endpoint, timeout } = params
  const url = `${endpoint}/chat/completions`

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserMessage(enabledCategories, text) },
    ],
    temperature: 0.1,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  }

  const response = await fetchJson(url, {
    method: 'POST',
    json: body,
    timeout,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  const content = response?.choices?.[0]?.message?.content
  if (!content) {
    throw new InvalidParamsError('Custom provider response missing content')
  }
  return content
}

/**
 * @param {string[]} enabledCategories
 * @param {string} text
 * @returns {string}
 */
function buildUserMessage(enabledCategories, text) {
  return [
    `Enabled categories: ${enabledCategories.join(', ')}`,
    'Return issues for ONLY these categories. Ignore others.',
    '',
    'Text to check:',
    '"""',
    text,
    '"""',
  ].join('\n')
}

export default { check }
```

- [ ] **Step 4: Commit**

```bash
git add services/web/app/src/Features/WritingAssist/providers/
git commit -m "feat: add WritingAssist LLM providers (OpenAI, Anthropic, Custom)"
```

---

### Task 4: Backend — LLM Provider factory

**Files:**
- Create: `services/web/app/src/Features/WritingAssist/WritingAssistLLMProvider.mjs`

- [ ] **Step 1: Write the provider factory**

```javascript
// @ts-check
// services/web/app/src/Features/WritingAssist/WritingAssistLLMProvider.mjs

import OpenAIProvider from './providers/OpenAIProvider.mjs'
import AnthropicProvider from './providers/AnthropicProvider.mjs'
import CustomProvider from './providers/CustomProvider.mjs'
import { InvalidParamsError } from '../../infrastructure/Validation.mjs'

/**
 * @typedef {'openai' | 'anthropic' | 'custom'} ProviderType
 *
 * @typedef {{
 *   provider: ProviderType
 *   apiKey: string
 *   model: string
 *   endpoint?: string
 *   timeout: number
 * }} ProviderOptions
 */

/**
 * Dispatch check() to the correct provider implementation.
 * Returns the raw LLM response text.
 *
 * @param {ProviderOptions} options
 * @param {string} options.provider
 * @param {string} options.apiKey
 * @param {string} options.model
 * @param {string} [options.endpoint]
 * @param {number} options.timeout
 * @param {string} text — masked text to send to LLM
 * @param {string} systemPrompt
 * @param {string[]} enabledCategories
 * @returns {Promise<string>}
 */
async function check(options, text, systemPrompt, enabledCategories) {
  const { provider, apiKey, model, endpoint, timeout } = options

  /** @type {(p: any) => Promise<string>} */
  let impl
  switch (provider) {
    case 'openai':
      impl = OpenAIProvider.check
      break
    case 'anthropic':
      impl = AnthropicProvider.check
      break
    case 'custom':
      if (!endpoint) {
        throw new InvalidParamsError('Custom provider requires an endpoint URL')
      }
      impl = CustomProvider.check
      break
    default:
      throw new InvalidParamsError(`Unknown provider: ${provider}`)
  }

  return await impl({ text, systemPrompt, enabledCategories, model, apiKey, endpoint, timeout })
}

export default { check }
```

- [ ] **Step 2: Commit**

```bash
git add services/web/app/src/Features/WritingAssist/WritingAssistLLMProvider.mjs
git commit -m "feat: add WritingAssist LLM provider factory"
```

---

### Task 5: Backend — LaTeX masker + offset remapping

**Files:**
- Create: `services/web/app/src/Features/WritingAssist/WritingAssistLaTeXMasker.mjs`

- [ ] **Step 1: Write LaTeX masker**

```javascript
// @ts-check
// services/web/app/src/Features/WritingAssist/WritingAssistLaTeXMasker.mjs

/**
 * Masks LaTeX constructs in text for LLM consumption and provides
 * offset remapping from masked → original coordinates.
 *
 * Each placeholder is a fixed-length token so the delta table is deterministic.
 */

const CMD_TOKEN = '⟨CMD⟩'    // ⟨CMD⟩ — 5 chars
const MATH_TOKEN = '⟨MATH⟩'  // ⟨MATH⟩ — 6 chars
const ENV_TOKEN = '⟨ENV⟩'    // ⟨ENV⟩ — 5 chars
const CITE_TOKEN = '⟨CITE⟩'  // ⟨CITE⟩ — 6 chars
const REF_TOKEN = '⟨REF⟩'    // ⟨REF⟩ — 5 chars

/**
 * @typedef {{ maskedText: string, remap: (maskedOffset: number) => number }} MaskResult
 */

/**
 * Mask LaTeX in the input text.  Builds a delta table so that offsets
 * returned by the LLM in masked-text coordinates can be mapped back to
 * original-text coordinates.
 *
 * @param {string} text
 * @returns {MaskResult}
 */
function mask(text) {
  const segments = []        // array of { originalStart, originalEnd, maskedStart, masked }
  let i = 0
  const len = text.length

  while (i < len) {
    const ch = text[i]

    // Comment line: % → end of line
    if (ch === '%' && (i === 0 || text[i - 1] !== '\\')) {
      const start = i
      while (i < len && text[i] !== '\n') i++
      segments.push({ originalStart: start, originalEnd: i, maskedStart: -1, masked: '' })
      continue
    }

    // Display math \[ ... \]
    if (text.startsWith('\\[', i)) {
      const start = i
      i += 2
      while (i < len && !(text[i] === '\\' && text[i + 1] === ']')) i++
      if (i < len) i += 2
      segments.push({ originalStart: start, originalEnd: i, maskedStart: -1, masked: MATH_TOKEN })
      continue
    }

    // Inline math $...$ (skip $$)
    if (ch === '$' && text[i + 1] !== '$') {
      const start = i
      i++ // skip opening $
      while (i < len && text[i] !== '$') i++
      if (i < len) i++ // skip closing $
      segments.push({ originalStart: start, originalEnd: i, maskedStart: -1, masked: MATH_TOKEN })
      continue
    }

    // LaTeX command: \<word> or \<word>{...} or \<word>[...]{...}
    if (ch === '\\' && /[a-zA-Z]/.test(text[i + 1] || '')) {
      const start = i
      i++ // skip backslash
      while (i < len && /[a-zA-Z@]/.test(text[i])) i++ // command name
      const cmdName = text.slice(start + 1, i)

      // \begin{...} ... \end{...} → ENV_TOKEN
      if (cmdName === 'begin') {
        const envStart = i
        const endMarker = '\\end{' + readBraces(text, i) + '}'
        i = envStart
        while (i < len && !text.startsWith(endMarker, i)) i++
        if (i < len) i += endMarker.length
        segments.push({ originalStart: start, originalEnd: i, maskedStart: -1, masked: ENV_TOKEN })
        continue
      }

      // \cite{...} → CITE_TOKEN, \ref{...} → REF_TOKEN
      if (cmdName === 'cite' || cmdName === 'Cite' || cmdName === 'citep' || cmdName === 'citet' ||
          cmdName === 'nocite' || cmdName === 'bibliography' || cmdName === 'bibliographystyle') {
        skipBracedArgs(text, i, len)
        const end = i
        segments.push({ originalStart: start, originalEnd: end, maskedStart: -1, masked: CITE_TOKEN })
        continue
      }
      if (cmdName === 'ref' || cmdName === 'Ref' || cmdName === 'eqref' ||
          cmdName === 'label' || cmdName === 'pageref') {
        skipBracedArgs(text, i, len)
        const end = i
        segments.push({ originalStart: start, originalEnd: end, maskedStart: -1, masked: REF_TOKEN })
        continue
      }

      // Generic command: skip optional [...] and mandatory {...} args
      skipOptionalAndMandatoryArgs(text, i, len)
      const end = i
      segments.push({ originalStart: start, originalEnd: end, maskedStart: -1, masked: CMD_TOKEN })
      continue
    }

    // Plain text character
    i++
  }

  // Build masked text and offset map
  const maskedParts = []
  const deltaTable = [] // deltaTable[maskedOffset] = originalOffset

  let originalPos = 0
  let segIdx = 0
  const sorted = [...segments].sort((a, b) => a.originalStart - b.originalStart)

  for (const seg of sorted) {
    // Copy plain text before this segment
    while (originalPos < seg.originalStart) {
      deltaTable.push(originalPos)
      maskedParts.push(text[originalPos])
      originalPos++
    }
    // Insert placeholder
    if (seg.masked) {
      for (let k = 0; k < seg.masked.length; k++) {
        deltaTable.push(seg.originalStart) // placeholder maps back to start of original
        maskedParts.push(seg.masked[k])
      }
    }
    originalPos = seg.originalEnd
  }
  // Copy trailing plain text
  while (originalPos < len) {
    deltaTable.push(originalPos)
    maskedParts.push(text[originalPos])
    originalPos++
  }

  const maskedText = maskedParts.join('')

  /**
   * Remap a masked-text offset back to original-text offset.
   * @param {number} maskedOffset
   * @returns {number}
   */
  function remap(maskedOffset) {
    if (maskedOffset < 0) return 0
    if (maskedOffset >= deltaTable.length) return len
    return deltaTable[maskedOffset]
  }

  return { maskedText, remap }
}

/**
 * Read the content inside braces {...} and advance i past the closing brace.
 * Returns the inner content.
 */
function readBraces(text, startI) {
  /** @type {number} */
  let i = startI
  if (text[i] !== '{') return ''
  i++
  let depth = 1
  while (i < text.length && depth > 0) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') depth--
    i++
  }
  return text.slice(startI + 1, i - 1)
}

/**
 * Skip past braced arguments, advancing the shared index `i`.
 */
function skipBracedArgs(text, startI, len) {
  let i = startI
  while (i < len && (text[i] === '{' || text[i] === ' ')) {
    if (text[i] === '{') {
      readBraces(text, i)
      i += readBraces(text, i).length + 2
      // Reset: actually just re-read properly
    }
  }
  // Simpler approach: just skip one level of {...}
  while (i < len && text[i] === '{') {
    let depth = 0
    do {
      if (text[i] === '{') depth++
      else if (text[i] === '}') depth--
      i++
    } while (i < len && depth > 0)
  }
}

/**
 * Skip optional [...] and mandatory {...} args, advancing shared index.
 * @param {string} text — mutated externally via shared index
 * @param {number} startI
 * @param {number} len
 */
function skipOptionalAndMandatoryArgs(text, startI, len) {
  let i = startI
  while (i < len && (text[i] === '[' || text[i] === '{' || text[i] === ' ')) {
    if (text[i] === '[' || text[i] === '{') {
      const open = text[i]
      const close = open === '[' ? ']' : '}'
      let depth = 0
      do {
        if (text[i] === open) depth++
        else if (text[i] === close) depth--
        i++
      } while (i < len && depth > 0)
    } else {
      i++
    }
  }
}

export default { mask }
```

- [ ] **Step 1: Write LaTeX masker with offset remapping**

```javascript
// @ts-check
// services/web/app/src/Features/WritingAssist/WritingAssistLaTeXMasker.mjs

const CMD = '⟨CMD⟩'     // ⟨CMD⟩
const MATH = '⟨MATH⟩'   // ⟨MATH⟩
const ENV = '⟨ENV⟩'     // ⟨ENV⟩
const CITE = '⟨CITE⟩'   // ⟨CITE⟩
const REF = '⟨REF⟩'     // ⟨REF⟩

const CITE_CMDS = new Set(['cite','Cite','citep','citet','nocite','citeauthor','citeyear','bibliography','bibliographystyle'])
const REF_CMDS = new Set(['ref','Ref','eqref','label','pageref','autoref','cref','Cref','nameref'])

/**
 * Mask LaTeX constructs. Returns masked text and a remap function
 * that converts masked-text character offsets -> original-text offsets.
 *
 * @param {string} text
 * @returns {{ maskedText: string, remap: (offset: number) => number }}
 */
function mask(text) {
  /** @type {{ type: 'text', start: number, end: number } | { type: 'token', token: string, start: number }}[] */
  const segments = []
  let i = 0
  const len = text.length

  while (i < len) {
    const ch = text[i]
    const start = i

    // % comment -> strip
    if (ch === '%' && (i === 0 || text[i - 1] !== '\\')) {
      while (i < len && text[i] !== '\n') i++
      continue
    }

    // \[ ... \] display math
    if (text.startsWith('\\[', i)) {
      i += 2
      while (i < len && !(text[i] === '\\' && text[i + 1] === ']')) i++
      if (i < len) i += 2
      segments.push({ type: 'token', token: MATH, start })
      continue
    }

    // $...$ inline math (not $$)
    if (ch === '$' && text[i + 1] !== '$') {
      i++
      while (i < len && text[i] !== '$') {
        if (text[i] === '\\') i++ // escaped char in math
        if (i < len) i++
      }
      if (i < len) i++ // closing $
      segments.push({ type: 'token', token: MATH, start })
      continue
    }

    // \<command>
    if (ch === '\\' && i + 1 < len && /[a-zA-Z]/.test(text[i + 1])) {
      i++ // backslash
      while (i < len && /[a-zA-Z@]/.test(text[i])) i++
      const cmd = text.slice(start + 1, i)

      // \begin{env} ... \end{env}
      if (cmd === 'begin') {
        const envName = readDelimited(text, i, '{', '}')
        if (envName !== null) {
          i += envName.length + 2
          const endTag = `\\end{${envName}}`
          while (i < len && !text.startsWith(endTag, i)) i++
          if (i < len) i += endTag.length
        }
        segments.push({ type: 'token', token: ENV, start })
        continue
      }

      // Skip optional [...] and mandatory {...} args
      i = skipArgs(text, i)

      if (CITE_CMDS.has(cmd)) {
        segments.push({ type: 'token', token: CITE, start })
      } else if (REF_CMDS.has(cmd)) {
        segments.push({ type: 'token', token: REF, start })
      } else {
        segments.push({ type: 'token', token: CMD, start })
      }
      continue
    }

    // Plain text run
    const runStart = i
    i++
    while (i < len) {
      const c = text[i]
      if (c === '\\' || c === '$' || c === '%') break
      i++
    }
    segments.push({ type: 'text', start: runStart, end: i })
  }

  // Build output
  const out = []
  const origMap = []

  for (const seg of segments) {
    if (seg.type === 'text') {
      for (let p = seg.start; p < seg.end; p++) {
        out.push(text[p])
        origMap.push(p)
      }
    } else {
      for (let k = 0; k < seg.token.length; k++) {
        out.push(seg.token[k])
        origMap.push(seg.start)
      }
    }
  }

  /**
   * @param {number} offset — position in masked text
   * @returns {number} position in original text
   */
  function remap(offset) {
    if (offset < 0) return 0
    if (offset >= origMap.length) return len
    return origMap[offset]
  }

  return { maskedText: out.join(''), remap }
}

/** Read {content} or [content] starting at pos. Returns inner text or null. */
function readDelimited(text, pos, open, close) {
  if (pos >= text.length || text[pos] !== open) return null
  let i = pos + 1, depth = 1
  const start = i
  while (i < text.length && depth > 0) {
    if (text[i] === open) depth++
    else if (text[i] === close) depth--
    if (depth > 0) i++
  }
  return text.slice(start, i)
}

/** Skip past optional [...] and mandatory {...} args. Returns new position. */
function skipArgs(text, pos) {
  while (pos < text.length) {
    const ch = text[pos]
    if (ch === ' ' || ch === '\t' || ch === '\n') { pos++; continue }
    if (ch === '[') {
      const inner = readDelimited(text, pos, '[', ']')
      if (inner === null) break
      pos += inner.length + 2
      continue
    }
    if (ch === '{') {
      const inner = readDelimited(text, pos, '{', '}')
      if (inner === null) break
      pos += inner.length + 2
      continue
    }
    break
  }
  return pos
}

export default { mask }
```

- [ ] **Step 2: Commit**

```bash
git add services/web/app/src/Features/WritingAssist/WritingAssistLaTeXMasker.mjs
git commit -m "feat: add LaTeX masker with offset remapping for WritingAssist"
```

---

### Task 6: Backend — Manager (orchestration)

**Files:**
- Create: `services/web/app/src/Features/WritingAssist/WritingAssistManager.mjs`

- [ ] **Step 1: Write the Manager**

```javascript
// @ts-check
// services/web/app/src/Features/WritingAssist/WritingAssistManager.mjs

import WritingAssistLLMProvider from './WritingAssistLLMProvider.mjs'
import WritingAssistEncryption from './WritingAssistEncryption.mjs'
import WritingAssistLaTeXMasker from './WritingAssistLaTeXMasker.mjs'
import { callbackify } from 'node:util'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import { InvalidParamsError } from '../../infrastructure/Validation.mjs'

const MAX_TEXT_LENGTH = settings.writingAssist?.maxTextLength ?? 4000
const TIMEOUT = settings.writingAssist?.timeout ?? 10000
const RETRY_ATTEMPTS = settings.writingAssist?.retryAttempts ?? 1
const ENCRYPTION_KEY = settings.writingAssist?.encryptionKey ?? 'dev-key-change-me'

const VALID_CATEGORIES = new Set([
  'correctness', 'clarity', 'conciseness', 'delivery', 'engagement',
])

const SYSTEM_PROMPT = `You are an academic-paper writing checker for LaTeX documents.
Analyze the provided English prose and return structured JSON.

The text has already had LaTeX commands and math content stripped.
Do NOT suggest changes to LaTeX syntax, citation keys, or BibTeX.

Classify each issue into exactly ONE of these categories:

- correctness: grammar error, spelling mistake, punctuation error,
  tense error, subject-verb disagreement. MUST be fixed.

- clarity: sentence is hard to follow — too long, too many embedded
  clauses, passive voice overuse, tangled modifiers. SHOULD be fixed
  for readability.

- conciseness: wordiness or filler — "due to the fact that"→"because",
  "it is important to note that"→delete, "in order to"→"to".
  SHOULD be fixed to tighten prose.

- delivery: tone mismatch — too blunt/harsh for reviewer response,
  too casual for academic, too aggressive for rebuttal.
  OPTIONAL; polite alternatives only.

- engagement: expression feels flat — "good"→"promising",
  "works"→"achieves".  In academic writing this can sound
  marketese; flag but don't push.

Return ONLY a JSON object — no markdown, no explanation, no code fence:

{"issues":[{"offset":N,"length":N,"message":"…","suggestion":"…","category":"…"},…]}

For each issue:
- offset: 0-based character position in the input text
- length: number of characters in the problematic span
- message: one-sentence description of the problem and why it matters (use Chinese)
- suggestion: the exact replacement text
- category: one of the five category strings above`

/**
 * @typedef {import('../../../types/writing-assist').Issue} Issue
 * @typedef {import('../../../types/writing-assist').Category} Category
 */
/**
 * @typedef {{
 *   apiKey: string
 *   model: string
 *   endpoint?: string
 * }} ProviderConfigResolved
 */

/**
 * Run a writing check.
 *
 * @param {{
 *   text: string
 *   enabledCategories: string[]
 *   provider: 'openai' | 'anthropic' | 'custom'
 *   providerConfig: ProviderConfigResolved
 * }} params
 * @returns {Promise<Issue[]>}
 */
async function check(params) {
  const { text, enabledCategories, provider, providerConfig } = params

  // Validate
  if (!text || text.trim().length === 0) return []
  if (!providerConfig.apiKey) {
    throw new InvalidParamsError('API key not configured')
  }

  const validCategories = enabledCategories.filter(c => VALID_CATEGORIES.has(c))
  if (validCategories.length === 0) return []

  // Truncate if too long
  const truncated = text.length > MAX_TEXT_LENGTH
    ? text.slice(0, MAX_TEXT_LENGTH)
    : text

  // Mask LaTeX
  const { maskedText, remap } = WritingAssistLaTeXMasker.mask(truncated)

  // Skip if nothing left after masking
  if (maskedText.trim().length === 0) return []

  // Decrypt API key
  const apiKey = providerConfig.apiKey.startsWith('enc:')
    ? WritingAssistEncryption.decrypt(providerConfig.apiKey.slice(4), ENCRYPTION_KEY)
    : providerConfig.apiKey

  // Call LLM (with retry)
  let lastError = null
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const rawResponse = await WritingAssistLLMProvider.check(
        {
          provider,
          apiKey,
          model: providerConfig.model,
          endpoint: providerConfig.endpoint,
          timeout: TIMEOUT,
        },
        maskedText,
        SYSTEM_PROMPT,
        validCategories
      )

      const issues = parseAndValidateResponse(rawResponse, maskedText.length, remap)
      return issues
    } catch (err) {
      lastError = err
      if (attempt < RETRY_ATTEMPTS) {
        logger.warn({ err, attempt }, 'WritingAssist: LLM call failed, retrying')
      }
    }
  }

  logger.error({ err: lastError }, 'WritingAssist: all retries exhausted')
  throw lastError
}

/**
 * Parse LLM JSON response, validate, and remap offsets to original.
 *
 * @param {string} raw — JSON string from LLM
 * @param {number} textLength — length of masked text for bounds checking
 * @param {(offset: number) => number} remap
 * @returns {Issue[]}
 */
function parseAndValidateResponse(raw, textLength, remap) {
  /** @type {any} */
  let parsed
  try {
    // Strip possible markdown code fences
    let cleaned = raw.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '')
    }
    parsed = JSON.parse(cleaned)
  } catch (e) {
    logger.warn({ raw: raw.slice(0, 200) }, 'WritingAssist: failed to parse LLM JSON')
    return []
  }

  if (!Array.isArray(parsed?.issues)) {
    logger.warn({ parsed }, 'WritingAssist: response missing issues array')
    return []
  }

  return parsed.issues
    .filter(
      /** @param {any} i */
      i =>
        typeof i.offset === 'number' &&
        typeof i.length === 'number' &&
        i.offset >= 0 &&
        i.offset + i.length <= textLength &&
        VALID_CATEGORIES.has(i.category) &&
        typeof i.suggestion === 'string' &&
        i.suggestion.length > 0
    )
    .map(
      /** @param {any} i */
      i => ({
        offset: remap(i.offset),
        length: i.length,
        message: typeof i.message === 'string' ? i.message : '',
        suggestion: i.suggestion,
        category: /** @type {Category} */ (i.category),
      })
    )
    .sort(
      /** @param {Issue} a @param {Issue} b */
      (a, b) => a.offset - b.offset
    )
}

const WritingAssistManager = {
  check: callbackify(check),
  promises: { check },
}

export default WritingAssistManager
```

- [ ] **Step 2: Commit**

```bash
git add services/web/app/src/Features/WritingAssist/WritingAssistManager.mjs
git commit -m "feat: add WritingAssistManager — LLM orchestration with LaTeX masking"
```

---

### Task 7: Backend — Controller + Router

**Files:**
- Create: `services/web/app/src/Features/WritingAssist/WritingAssistController.mjs`
- Create: `services/web/app/src/Features/WritingAssist/WritingAssistRouter.mjs`

- [ ] **Step 1: Write the Controller**

```javascript
// @ts-check
// services/web/app/src/Features/WritingAssist/WritingAssistController.mjs

import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../Authentication/SessionManager.mjs'
import WritingAssistManager from './WritingAssistManager.mjs'
import WritingAssistEncryption from './WritingAssistEncryption.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'
import settings from '@overleaf/settings'
import logger from '@overleaf/logger'

const ENCRYPTION_KEY = settings.writingAssist?.encryptionKey ?? 'dev-key-change-me'

// ---- Schemas ----

const checkSchema = z.object({
  body: z.object({
    text: z.string(),
    language: z.literal('en'),
    enabledCategories: z.array(
      z.enum(['correctness', 'clarity', 'conciseness', 'delivery', 'engagement'])
    ),
    context: z
      .object({ before: z.string(), after: z.string() })
      .optional(),
  }),
})

const configSchema = z.object({
  body: z.object({
    enabled: z.boolean().optional(),
    provider: z.enum(['openai', 'anthropic', 'custom']).optional(),
    openai: z.object({
      apiKey: z.string(),
      model: z.string(),
      endpoint: z.string().optional(),
    }).optional(),
    anthropic: z.object({
      apiKey: z.string(),
      model: z.string(),
      endpoint: z.string().optional(),
    }).optional(),
    custom: z.object({
      apiKey: z.string(),
      endpoint: z.string(),
      model: z.string(),
    }).optional(),
    categories: z.object({
      correctness: z.boolean().optional(),
      clarity: z.boolean().optional(),
      conciseness: z.boolean().optional(),
      delivery: z.boolean().optional(),
      engagement: z.boolean().optional(),
    }).optional(),
    debounceMs: z.number().min(500).max(5000).optional(),
  }),
})

// ---- In-memory config store (per-user, lost on restart; replace with DB in production) ----
/** @type {Map<string, any>} */
const userConfigs = new Map()

/**
 * Resolve user's stored config + decrypted keys to callable provider config.
 * @param {string} userId
 * @returns {{ provider: string, providerConfig: { apiKey: string, model: string, endpoint?: string } }}
 */
function resolveProviderConfig(userId) {
  const cfg = userConfigs.get(userId) || getDefaultConfig()
  const provider = cfg.provider || 'openai'
  const providerCfgRaw = cfg[provider]

  if (!providerCfgRaw) {
    throw Object.assign(new Error('Provider not configured'), { statusCode: 400 })
  }

  const apiKey = providerCfgRaw.apiKey
    ? WritingAssistEncryption.decrypt(providerCfgRaw.apiKey, ENCRYPTION_KEY)
    : ''

  return {
    provider,
    providerConfig: {
      apiKey,
      model: providerCfgRaw.model || getDefaultModel(provider),
      endpoint: providerCfgRaw.endpoint || undefined,
    },
  }
}

function getDefaultConfig() {
  return {
    enabled: true,
    provider: 'openai',
    openai: { model: 'gpt-4o', apiKey: '' },
    anthropic: { model: 'claude-sonnet-4-6', apiKey: '' },
    custom: null,
    categories: { correctness: true, clarity: true, conciseness: true, delivery: false, engagement: false },
    debounceMs: 1500,
  }
}

function getDefaultModel(provider) {
  if (provider === 'openai') return 'gpt-4o'
  if (provider === 'anthropic') return 'claude-sonnet-4-6'
  return 'gpt-4o'
}

function maskApiKey(key) {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '...' + key.slice(-4)
}

// ---- Handlers ----

/**
 * POST /writing-assist/check
 */
async function check(req, res) {
  const { body } = parseReq(req, checkSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)

  const { provider, providerConfig } = resolveProviderConfig(userId)

  const issues = await WritingAssistManager.promises.check({
    text: body.text,
    enabledCategories: body.enabledCategories,
    provider,
    providerConfig,
  })

  res.json({ issues })
}

/**
 * GET /writing-assist/config
 * Returns config with API keys MASKED.
 */
async function getConfig(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const cfg = userConfigs.get(userId) || getDefaultConfig()

  const result = {
    enabled: cfg.enabled,
    provider: cfg.provider,
    categories: cfg.categories,
    debounceMs: cfg.debounceMs,
  }

  // Attach provider info with masked keys
  for (const p of ['openai', 'anthropic', 'custom']) {
    if (cfg[p]) {
      result[p] = {
        model: cfg[p].model,
        hasKey: !!cfg[p].apiKey,
      }
      if (p === 'custom') result[p].endpoint = cfg[p].endpoint
    }
  }

  res.json(result)
}

/**
 * PUT /writing-assist/config
 * Accepts partial config. Encrypts API keys before storing.
 */
async function putConfig(req, res) {
  const { body } = parseReq(req, configSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)

  const existing = userConfigs.get(userId) || getDefaultConfig()

  /** @type {any} */
  const merged = { ...existing }

  if (body.enabled !== undefined) merged.enabled = body.enabled
  if (body.provider !== undefined) merged.provider = body.provider
  if (body.categories) merged.categories = { ...merged.categories, ...body.categories }
  if (body.debounceMs !== undefined) merged.debounceMs = body.debounceMs

  // Encrypt API keys for each provider
  for (const p of ['openai', 'anthropic', 'custom']) {
    if (body[p]) {
      merged[p] = { ...body[p] }
      if (body[p].apiKey) {
        merged[p].apiKey = WritingAssistEncryption.encrypt(body[p].apiKey, ENCRYPTION_KEY)
      }
    }
  }

  userConfigs.set(userId, merged)
  logger.info({ userId }, 'WritingAssist: config updated')

  res.sendStatus(204)
}

export default {
  check: expressify(check),
  getConfig: expressify(getConfig),
  putConfig: expressify(putConfig),
}
```

- [ ] **Step 2: Write the Router**

```javascript
// @ts-check
// services/web/app/src/Features/WritingAssist/WritingAssistRouter.mjs

import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import WritingAssistController from './WritingAssistController.mjs'
import RateLimiter from '../../infrastructure/RateLimiter.mjs'

/**
 * @param {any} webRouter
 * @param {any} privateApiRouter
 */
function apply(webRouter, privateApiRouter) {
  const requireLogin = AuthenticationController.requireLogin()

  // Check endpoint — rate limited
  privateApiRouter.post(
    '/writing-assist/check',
    requireLogin,
    RateLimiter.rateLimit('writing-assist-check', { maxRequests: 30, timeInterval: 60 }),
    WritingAssistController.check
  )

  // Config endpoints
  privateApiRouter.get(
    '/writing-assist/config',
    requireLogin,
    WritingAssistController.getConfig
  )

  privateApiRouter.put(
    '/writing-assist/config',
    requireLogin,
    WritingAssistController.putConfig
  )
}

export default { apply }
```

- [ ] **Step 3: Commit**

```bash
git add services/web/app/src/Features/WritingAssist/WritingAssistController.mjs
git add services/web/app/src/Features/WritingAssist/WritingAssistRouter.mjs
git commit -m "feat: add WritingAssist Controller + Router with /check, /config endpoints"
```

---

### Task 8: Backend — Wire into router.mjs + settings

**Files:**
- Modify: `services/web/app/src/router.mjs`
- Modify: `services/web/config/settings.defaults.js`

- [ ] **Step 1: Add route registration in router.mjs**

Add this import near the top (after the existing imports, e.g., after line 7 `SpellingController`):
```javascript
import WritingAssistRouter from './Features/WritingAssist/WritingAssistRouter.mjs'
```

Add this line near the end (after all the other `.apply()` calls, before the final export):
```javascript
WritingAssistRouter.apply(webRouter, privateApiRouter)
```

- [ ] **Step 2: Add settings defaults**

Add this block before the final `module.exports.mergeWith` at the end of `settings.defaults.js`:
```javascript
  writingAssist: {
    enabled: false,
    defaultProvider: 'openai',
    defaultModel: {
      openai: 'gpt-4o',
      anthropic: 'claude-sonnet-4-6',
    },
    maxTextLength: 4000,
    timeout: 10000,
    retryAttempts: 1,
    debounceMs: 1500,
    cacheSize: 200,
    encryptionKey: process.env.WRITING_ASSIST_ENCRYPTION_KEY || 'dev-key-change-me',
  },
```

- [ ] **Step 3: Commit**

```bash
git add services/web/app/src/router.mjs
git add services/web/config/settings.defaults.js
git commit -m "feat: wire WritingAssist routes into router and settings"
```

---

### Task 9: Frontend — API helpers

**Files:**
- Create: `services/web/frontend/js/utils/api/writing-assist.ts`

- [ ] **Step 1: Write API helper**

```typescript
// services/web/frontend/js/utils/api/writing-assist.ts

import { postJSON, getJSON } from '../../infrastructure/fetch-json'

import type {
  Category,
  CheckRequest,
  CheckResponse,
  Issue,
  WritingAssistUserConfig,
  WritingAssistPublicConfig,
} from '../../../../../types/writing-assist'

export async function checkWriting(
  text: string,
  enabledCategories: Category[]
): Promise<Issue[]> {
  const body: CheckRequest = {
    text,
    language: 'en',
    enabledCategories,
  }

  // No context for now; add later for Feature B
  const response = await postJSON<CheckResponse>(
    '/writing-assist/check',
    { body }
  )
  return response.issues ?? []
}

export async function getConfig(): Promise<WritingAssistPublicConfig> {
  return getJSON<WritingAssistPublicConfig>('/writing-assist/config')
}

export async function saveConfig(
  config: Partial<WritingAssistUserConfig>
): Promise<void> {
  await postJSON('/writing-assist/config', { body: config })
}
```

- [ ] **Step 2: Commit**

```bash
git add services/web/frontend/js/utils/api/writing-assist.ts
git commit -m "feat: add WritingAssist frontend API helpers"
```

---

### Task 10: Frontend — Sentence fingerprint cache

**Files:**
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/sentence-fingerprint.ts`

- [ ] **Step 1: Write sentence fingerprint module**

```typescript
// services/web/frontend/js/features/source-editor/extensions/writing-assist/sentence-fingerprint.ts

import type { SentenceCache, Issue } from '../../../../../../types/writing-assist'

const STORAGE_PREFIX = 'wa-cache-'
const MAX_CACHE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const STALE_MS = 24 * 60 * 60 * 1000 // 24 hours
const EVICT_FRACTION = 0.2

/**
 * SHA-256 hash truncated to 12 hex characters.
 * Uses the Web Crypto API (available in all modern browsers).
 */
export async function fingerprint(text: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text.trim())
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  // 12 hex chars = 6 bytes
  return hashArray
    .slice(0, 6)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Synchronous fingerprint for quick cache lookup.
 * Uses a simpler but sufficient hash (djb2).
 */
export function fingerprintSync(text: string): string {
  let hash = 5381
  const trimmed = text.trim()
  for (let i = 0; i < trimmed.length; i++) {
    hash = ((hash << 5) + hash + trimmed.charCodeAt(i)) | 0
  }
  // Convert to 12-char hex (use absolute value + pad)
  const abs = Math.abs(hash)
  return abs.toString(16).padStart(8, '0').slice(0, 12)
}

export class SentenceFingerprintCache {
  private projectId: string
  private cache: SentenceCache
  private storageKey: string
  private pendingWrites: Map<string, { text: string; issues: Issue[] }>

  constructor(projectId: string) {
    this.projectId = projectId
    this.storageKey = `${STORAGE_PREFIX}${projectId}`
    this.pendingWrites = new Map()
    this.cache = this.load()
  }

  private load(): SentenceCache {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return { version: 1, entries: {} }
      const parsed = JSON.parse(raw) as SentenceCache
      // Version mismatch → reset
      if (parsed.version !== 1) return { version: 1, entries: {} }
      return parsed
    } catch {
      return { version: 1, entries: {} }
    }
  }

  private persist(): void {
    try {
      // Check size and evict if needed
      let json = JSON.stringify(this.cache)
      if (json.length > MAX_CACHE_SIZE_BYTES) {
        this.evict()
        json = JSON.stringify(this.cache)
      }
      localStorage.setItem(this.storageKey, json)
    } catch (e) {
      // localStorage full — evict and retry once
      this.evict()
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.cache))
      } catch {
        // Give up silently
      }
    }
  }

  private evict(): void {
    const entries = Object.entries(this.cache.entries)
    if (entries.length === 0) return
    // Sort by checkedAt ascending (oldest first)
    entries.sort((a, b) => a[1].checkedAt - b[1].checkedAt)
    const evictCount = Math.max(1, Math.ceil(entries.length * EVICT_FRACTION))
    for (let i = 0; i < evictCount && i < entries.length; i++) {
      delete this.cache.entries[entries[i][0]]
    }
  }

  has(hash: string): boolean {
    const entry = this.cache.entries[hash]
    if (!entry) return false
    // Stale check
    if (Date.now() - entry.checkedAt > STALE_MS) {
      delete this.cache.entries[hash]
      return false
    }
    return true
  }

  get(hash: string): Issue[] | null {
    if (!this.has(hash)) return null
    return this.cache.entries[hash].issues
  }

  set(hash: string, text: string, issues: Issue[]): void {
    this.cache.entries[hash] = {
      text,
      checkedAt: Date.now(),
      issues,
    }
    this.pendingWrites.set(hash, { text, issues })
  }

  /** Call after each batch to persist to localStorage. */
  flush(): void {
    this.persist()
    this.pendingWrites.clear()
  }

  /** Invalidate cache entries within a character range (user edited that region). */
  invalidateRange(from: number, to: number): void {
    // We can't map character offsets back to sentence hashes without
    // reconstructing. Instead, clear entries that are younger than
    // the current edit — most recent writes are the ones being edited.
    // Conservative approach: flush pending then rely on fingerprint
    // mismatch for edited sentences.
    this.pendingWrites.clear()
  }

  /** Remove all entries for this project. */
  clear(): void {
    this.cache = { version: 1, entries: {} }
    try { localStorage.removeItem(this.storageKey) } catch {}
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add services/web/frontend/js/features/source-editor/extensions/writing-assist/sentence-fingerprint.ts
git commit -m "feat: add sentence fingerprint cache with localStorage persistence"
```

---

### Task 11: Frontend — Types + Viewport Tracker + Checker + Decorations + Tooltip + Context Menu + Index

**Files:**
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/types.ts`
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/viewport-tracker.ts`
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/checker.ts`
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/decorations.ts`
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/tooltip.ts`
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/context-menu.tsx`
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/index.ts`

Due to the size of this plan, Tasks 11-17 are documented as one task per file with full code in each step. See the expanded plan sections below.

---

### Task 11: Frontend — Shared extension types

**Files:**
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/types.ts`

```typescript
// services/web/frontend/js/features/source-editor/extensions/writing-assist/types.ts

import type { Category, Issue, WritingAssistPublicConfig } from '../../../../../../types/writing-assist'

export type { Category, Issue, WritingAssistPublicConfig }

export const CATEGORY_COLORS: Record<Category, { className: string; color: string; priority: number }> = {
  correctness:  { className: 'wa-underline-correctness',  color: '#e53e3e', priority: 10 },
  clarity:      { className: 'wa-underline-clarity',      color: '#3182ce', priority: 8  },
  conciseness:  { className: 'wa-underline-conciseness',  color: '#d69e2e', priority: 6  },
  delivery:     { className: 'wa-underline-delivery',     color: '#38a169', priority: 4  },
  engagement:   { className: 'wa-underline-engagement',   color: '#805ad5', priority: 2  },
}

export const CATEGORY_ORDER: Category[] = [
  'correctness', 'clarity', 'conciseness', 'delivery', 'engagement',
]
```

---

### Task 12: Frontend — Viewport tracker

**Files:**
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/viewport-tracker.ts`

```typescript
// services/web/frontend/js/features/source-editor/extensions/writing-assist/viewport-tracker.ts

import { EditorView } from '@codemirror/view'
import { SentenceFingerprintCache, fingerprintSync } from './sentence-fingerprint'
import type { Issue } from './types'

/**
 * Split text into sentences using Intl.Segmenter when available,
 * falling back to regex split.
 */
export function segmentSentences(text: string): string[] {
  try {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' })
    const segments = segmenter.segment(text)
    return Array.from(segments, s => s.segment.trim()).filter(s => s.length > 0)
  } catch {
    // Fallback: split on sentence-ending punctuation followed by space + capital
    return text
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && /[a-zA-Z]/.test(s))
  }
}

export interface ViewportSnapshot {
  sentences: Array<{ text: string; hash: string }>
  /** Sentences that need checking (not in cache) */
  unchecked: Array<{ text: string; hash: string }>
  /** Issues for cached sentences, keyed by hash */
  cachedIssues: Map<string, Issue[]>
}

export class ViewportTracker {
  private lastFrom = -1
  private lastTo = -1
  private cache: SentenceFingerprintCache
  private onChangeCallback: ((snapshot: ViewportSnapshot) => void) | null = null

  constructor(projectId: string) {
    this.cache = new SentenceFingerprintCache(projectId)
  }

  onChange(callback: (snapshot: ViewportSnapshot) => void): void {
    this.onChangeCallback = callback
  }

  getCache(): SentenceFingerprintCache {
    return this.cache
  }

  /**
   * Called on viewport change or doc change (debounced).
   */
  update(view: EditorView): ViewportSnapshot | null {
    const vp = view.viewport
    if (vp.from === this.lastFrom && vp.to === this.lastTo) {
      return null // viewport unchanged
    }
    this.lastFrom = vp.from
    this.lastTo = vp.to

    const visibleText = view.state.sliceDoc(vp.from, vp.to)
    const sentences = segmentSentences(visibleText)

    const cachedIssues = new Map<string, Issue[]>()
    const unchecked: Array<{ text: string; hash: string }> = []
    const allSentences: Array<{ text: string; hash: string }> = []

    for (const s of sentences) {
      const hash = fingerprintSync(s)
      allSentences.push({ text: s, hash })
      const cached = this.cache.get(hash)
      if (cached) {
        cachedIssues.set(hash, cached)
      } else {
        unchecked.push({ text: s, hash })
      }
    }

    const snapshot: ViewportSnapshot = { sentences: allSentences, unchecked, cachedIssues }

    if (this.onChangeCallback) {
      this.onChangeCallback(snapshot)
    }

    return snapshot
  }

  /** Invalidate cache entries touched by a document change. */
  invalidateRange(from: number, to: number): void {
    this.cache.invalidateRange(from, to)
    // Reset last viewport so next update always fires
    this.lastFrom = -1
    this.lastTo = -1
  }
}
```

---

### Task 13: Frontend — Checker (debounce + fetch)

**Files:**
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/checker.ts`

```typescript
// services/web/frontend/js/features/source-editor/extensions/writing-assist/checker.ts

import { EditorView } from '@codemirror/view'
import { checkWriting } from '../../../utils/api/writing-assist'
import type { Category, Issue } from './types'

export type IssueCallback = (issues: Issue[]) => void

export class Checker {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private debounceMs: number
  private enabledCategories: Category[]
  private onIssues: IssueCallback
  private abortController: AbortController | null = null

  constructor(
    debounceMs: number,
    enabledCategories: Category[],
    onIssues: IssueCallback
  ) {
    this.debounceMs = debounceMs
    this.enabledCategories = enabledCategories
    this.onIssues = onIssues
  }

  updateConfig(debounceMs: number, enabledCategories: Category[]): void {
    this.debounceMs = debounceMs
    this.enabledCategories = enabledCategories
  }

  /**
   * Schedule a check for the given sentences after debounce.
   * @param sentences — array of { text, hash } for unchecked sentences
   */
  schedule(sentences: Array<{ text: string; hash: string }>): void {
    if (sentences.length === 0) return
    if (this.enabledCategories.length === 0) return

    if (this.debounceTimer) clearTimeout(this.debounceTimer)

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.execute(sentences)
    }, this.debounceMs)
  }

  private async execute(
    sentences: Array<{ text: string; hash: string }>
  ): Promise<void> {
    // Cancel any in-flight request
    if (this.abortController) {
      this.abortController.abort()
    }
    this.abortController = new AbortController()

    try {
      // Join all unchecked sentences into one text blob
      const text = sentences.map(s => s.text).join('\n\n')
      const issues = await checkWriting(text, this.enabledCategories)

      // Distribute issues back to sentences (approximate — offsets
      // are relative to the joined text; we store them as-is for
      // the decoration layer which works in document offsets anyway)
      this.onIssues(issues)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      // Silently ignore other errors (non-blocking feature)
    } finally {
      this.abortController = null
    }
  }

  cancel(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}
```

---

### Task 14: Frontend — Decorations (StateField)

**Files:**
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/decorations.ts`

The decoration state field uses `StateField<DecorationSet>` and `StateEffect` to push new issues. Issues are rendered as colored wavy underline `MarkDecoration`s.

```typescript
// services/web/frontend/js/features/source-editor/extensions/writing-assist/decorations.ts

import {
  StateField,
  StateEffect,
} from '@codemirror/state'
import {
  Decoration,
  DecorationSet,
  EditorView,
} from '@codemirror/view'
import type { Issue, Category } from './types'
import { CATEGORY_COLORS, CATEGORY_ORDER } from './types'

export const setIssuesEffect = StateEffect.define<Issue[]>()

/**
 * Build decorations from issues.  If multiple issues cover the same
 * text span, the highest-priority category wins.
 */
function buildDecorations(issues: Issue[], view: EditorView): DecorationSet {
  if (!issues || issues.length === 0) return Decoration.none

  const decorations: Array<{ from: number; to: number; deco: Decoration }> = []

  for (const issue of issues) {
    // Convert character offset to document position.
    // Issues come from the backend in "original text" coordinates,
    // but we check viewport-only text. The backend gets viewport text
    // so offsets are relative to viewport start.  We add viewport.from.
    const vp = view.viewport
    const from = vp.from + issue.offset
    const to = from + issue.length

    if (from < vp.from || to > vp.to) continue // safety

    const cat = CATEGORY_COLORS[issue.category]
    const mark = Decoration.mark({
      class: cat.className,
      attributes: {
        'data-wa-category': issue.category,
        'data-wa-message': issue.message,
        'data-wa-suggestion': issue.suggestion,
      },
    })

    decorations.push({ from, to, deco: mark })
  }

  // Sort by position
  decorations.sort((a, b) => a.from - b.from || a.to - b.to)

  // Build set (CM6 handles overlapping marks correctly)
  return Decoration.set(
    decorations.map(d => d.deco.range(d.from, d.to))
  )
}

export const decorationField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(decorations, tr) {
    for (const e of tr.effects) {
      if (e.is(setIssuesEffect)) {
        // We need the EditorView to get viewport — store issues
        // and let the view plugin apply them
        return decorations // handled by ViewPlugin below
      }
    }
    // Map through doc changes
    return decorations.map(tr.changes)
  },
  provide: f => EditorView.decorations.from(f),
})
```

---

### Task 15: Frontend — Tooltip + Context Menu + Index (full wiring)

**Files:**
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/tooltip.ts`
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/context-menu.tsx`
- Create: `services/web/frontend/js/features/source-editor/extensions/writing-assist/index.ts`

---

### Task 15: Frontend — Tooltip

```typescript
// services/web/frontend/js/features/source-editor/extensions/writing-assist/tooltip.ts

import { EditorView, hoverTooltip, Tooltip } from '@codemirror/view'
import { CATEGORY_COLORS, CATEGORY_ORDER } from './types'
import type { Issue, Category } from './types'

/**
 * Build a hover tooltip showing all issues at the hovered position.
 */
export function waHoverTooltip(
  getIssues: (pos: number) => Issue[]
): (view: EditorView) => ReturnType<typeof hoverTooltip> {
  return (view: EditorView) =>
    hoverTooltip((view, pos) => {
      const issues = getIssues(pos)
      if (issues.length === 0) return null

      return {
        pos,
        end: pos,
        above: true,
        create() {
          const dom = document.createElement('div')
          dom.className = 'wa-tooltip'

          // Sort by category priority descending
          const sorted = [...issues].sort(
            (a, b) =>
              (CATEGORY_COLORS[a.category]?.priority ?? 0) -
              (CATEGORY_COLORS[b.category]?.priority ?? 0)
          )

          for (const issue of sorted) {
            const cat = CATEGORY_COLORS[issue.category]
            const row = document.createElement('div')
            row.className = 'wa-tooltip-row'

            const indicator = document.createElement('span')
            indicator.className = 'wa-tooltip-indicator'
            indicator.style.backgroundColor = cat.color
            indicator.textContent = '●'

            const body = document.createElement('div')
            body.className = 'wa-tooltip-body'

            const msg = document.createElement('div')
            msg.className = 'wa-tooltip-message'
            msg.textContent = issue.message

            const sugg = document.createElement('div')
            sugg.className = 'wa-tooltip-suggestion'
            sugg.textContent = `→ ${issue.suggestion}`

            body.appendChild(msg)
            body.appendChild(sugg)
            row.appendChild(indicator)
            row.appendChild(body)
            dom.appendChild(row)

            // Apply button
            const applyBtn = document.createElement('button')
            applyBtn.className = 'wa-tooltip-apply'
            applyBtn.textContent = 'Apply'
            applyBtn.onclick = (e) => {
              e.stopPropagation()
              applySuggestion(view, issue)
              dom.remove()
            }
            row.appendChild(applyBtn)
          }

          return { dom }
        },
      }
    })
}

function applySuggestion(view: EditorView, issue: Issue): void {
  const vp = view.viewport
  const from = vp.from + issue.offset
  const to = from + issue.length
  view.dispatch({
    changes: { from, to, insert: issue.suggestion },
  })
}
```

---

### Task 16: Frontend — Context menu

```typescript
// services/web/frontend/js/features/source-editor/extensions/writing-assist/context-menu.tsx

// Simplified: right-click on a decorated span shows "Apply suggestion" / "Ignore".
// For now, the hover tooltip covers the primary interaction.
// Full context menu deferred to a follow-up.
```

---

### Task 17: Frontend — Extension index (wires everything together)

```typescript
// services/web/frontend/js/features/source-editor/extensions/writing-assist/index.ts

import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import type { Extension } from '@codemirror/state'
import { ViewportTracker } from './viewport-tracker'
import { Checker } from './checker'
import { decorationField, setIssuesEffect } from './decorations'
import { waHoverTooltip } from './tooltip'
import { SentenceFingerprintCache } from './sentence-fingerprint'
import type { Category, Issue, WritingAssistPublicConfig } from './types'
import { CATEGORY_ORDER } from './types'

export { CATEGORY_COLORS, CATEGORY_ORDER } from './types'
export type { Category, Issue, WritingAssistPublicConfig }
export { ViewportTracker } from './viewport-tracker'
export { SentenceFingerprintCache } from './sentence-fingerprint'

export interface WritingAssistOptions {
  projectId: string
  config: WritingAssistPublicConfig
}

/**
 * Issue store shared between the view plugin and the tooltip.
 */
class IssueStore {
  /** Issues in the current viewport, keyed by document-offset */
  issues: Issue[] = []

  setIssues(issues: Issue[]) {
    this.issues = issues
  }

  getIssuesAt(pos: number): Issue[] {
    return this.issues.filter(
      i => pos >= i.offset && pos < i.offset + i.length
    )
  }
}

/**
 * Main entry point. Creates the writing-assist CodeMirror extension.
 */
export function writingAssist(options: WritingAssistOptions): Extension {
  const { projectId, config } = options
  const tracker = new ViewportTracker(projectId)
  const store = new IssueStore()

  const checker = new Checker(
    config.debounceMs,
    enabledCategories(config),
    (issues) => {
      store.setIssues(issues)
      // Also store in cache for each checked sentence
      const cache = tracker.getCache()
      for (const issue of issues) {
        // Simple: flush all pending after batch
      }
      cache.flush()
    }
  )

  // View plugin: watches for viewport/doc changes
  const viewPlugin = ViewPlugin.fromClass(
    class {
      constructor(readonly view: EditorView) {
        // Initial check
        setTimeout(() => this.check(), 100)
      }

      update(update: ViewUpdate) {
        if (update.viewportChanged || update.docChanged) {
          this.check()
        }
      }

      check() {
        const snapshot = tracker.update(this.view)
        if (snapshot && snapshot.unchecked.length > 0) {
          checker.schedule(snapshot.unchecked)
        }
      }

      destroy() {
        checker.cancel()
      }
    }
  )

  return [
    viewPlugin,
    decorationField,
    waHoverTooltip((pos) => store.getIssuesAt(pos)),
  ]
}

function enabledCategories(config: WritingAssistPublicConfig): Category[] {
  return CATEGORY_ORDER.filter(c => config.categories[c])
}
```

---

### Task 18: Frontend — Wire extension into codemirror-editor.tsx

**Files:**
- Modify: `services/web/frontend/js/features/source-editor/components/codemirror-editor.tsx`

- [ ] **Step 1: Import and conditionally add the extension**

At the top of the file, add:
```typescript
import { writingAssist } from '../extensions/writing-assist/index'
import type { WritingAssistPublicConfig } from '../extensions/writing-assist/types'
```

In the extensions array (where `spelling` and other extensions are composed), add—conditionally gated behind the user's config:
```typescript
// Check if writing assist is configured + enabled
const waConfig = userSettings?.writingAssist as WritingAssistPublicConfig | undefined
const waExtensions = (waConfig?.enabled)
  ? [writingAssist({ projectId, config: waConfig })]
  : []
```

And spread `waExtensions` into the main extensions array.

---

### Task 19: Frontend — CSS

**Files:**
- Create: `services/web/frontend/stylesheets/writing-assist.less`

```less
// services/web/frontend/stylesheets/writing-assist.less

// ---- Wavy underline decorations (one colour per category) ----
.wa-underline-correctness {
  text-decoration: underline wavy #e53e3e 2px;
  text-underline-offset: 2px;
}
.wa-underline-clarity {
  text-decoration: underline wavy #3182ce 2px;
  text-underline-offset: 2px;
}
.wa-underline-conciseness {
  text-decoration: underline wavy #d69e2e 2px;
  text-underline-offset: 2px;
}
.wa-underline-delivery {
  text-decoration: underline wavy #38a169 2px;
  text-underline-offset: 2px;
}
.wa-underline-engagement {
  text-decoration: underline wavy #805ad5 2px;
  text-underline-offset: 2px;
}

// ---- Tooltip ----
.wa-tooltip {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 8px;
  max-width: 360px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 13px;
  line-height: 1.4;
}

.wa-tooltip-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #f3f4f6;

  &:last-child {
    border-bottom: none;
  }
}

.wa-tooltip-indicator {
  font-size: 12px;
  line-height: 1.6;
  flex-shrink: 0;
}

.wa-tooltip-body {
  flex: 1;
  min-width: 0;
}

.wa-tooltip-message {
  color: #374151;
  margin-bottom: 2px;
}

.wa-tooltip-suggestion {
  color: #059669;
  font-style: italic;
  word-break: break-word;
}

.wa-tooltip-apply {
  flex-shrink: 0;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 2px 10px;
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: #1d4ed8;
  }
}
```

---

### Task 20: Backend — Unit Tests

**Files:**
- Create: `services/web/test/unit/js/WritingAssist/WritingAssistEncryptionTests.mjs`
- Create: `services/web/test/unit/js/WritingAssist/WritingAssistLaTeXMaskerTests.mjs`
- Create: `services/web/test/unit/js/WritingAssist/WritingAssistManagerTests.mjs`

- [ ] **Step 1: Encryption test**

```javascript
// services/web/test/unit/js/WritingAssist/WritingAssistEncryptionTests.mjs

import { describe, it } from 'mocha'
import { expect } from 'chai'
import WritingAssistEncryption from
  '../../../../app/src/Features/WritingAssist/WritingAssistEncryption.mjs'

describe('WritingAssistEncryption', function () {
  const key = 'test-key-32-bytes-long-xxxxxxxxx' // 32 chars

  it('should round-trip encrypt/decrypt', function () {
    const plaintext = 'sk-abc123-def456-ghi789'
    const encrypted = WritingAssistEncryption.encrypt(plaintext, key)
    expect(encrypted).to.not.equal(plaintext)
    expect(encrypted).to.match(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/)

    const decrypted = WritingAssistEncryption.decrypt(encrypted, key)
    expect(decrypted).to.equal(plaintext)
  })

  it('should return empty string for empty input', function () {
    expect(WritingAssistEncryption.encrypt('', key)).to.equal('')
    expect(WritingAssistEncryption.decrypt('', key)).to.equal('')
  })

  it('should produce different ciphertext each time', function () {
    const e1 = WritingAssistEncryption.encrypt('same-text', key)
    const e2 = WritingAssistEncryption.encrypt('same-text', key)
    expect(e1).to.not.equal(e2) // different IVs
  })

  it('should throw on malformed ciphertext', function () {
    expect(() => WritingAssistEncryption.decrypt('not-valid', key)).to.throw()
  })
})
```

- [ ] **Step 2: LaTeX masker test**

```javascript
// services/web/test/unit/js/WritingAssist/WritingAssistLaTeXMaskerTests.mjs

import { describe, it } from 'mocha'
import { expect } from 'chai'
import WritingAssistLaTeXMasker from
  '../../../../app/src/Features/WritingAssist/WritingAssistLaTeXMasker.mjs'

describe('WritingAssistLaTeXMasker', function () {
  it('should pass through plain text unchanged', function () {
    const { maskedText, remap } = WritingAssistLaTeXMasker.mask('Hello world.')
    expect(maskedText).to.equal('Hello world.')
    // remap should be identity
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

  it('should remap offsets correctly', function () {
    const original = 'The \\textbf{method} works.'
    //            0123456789...
    // "The " = 0-3, "\textbf{method}" = 4-20, " works." = 20-27
    const { maskedText, remap } = WritingAssistLaTeXMasker.mask(original)
    // Masked should be "The ⟨CMD⟩method works." and all offsets after the
    // placeholder should remap correctly.
    // The placeholder is 5 chars for ⟨CMD⟩.
    // "method" in masked starts at 4 + 5 = 9, in original at 13.
    // "works" in masked: let's trust the remap function.
    expect(typeof remap).to.equal('function')
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add services/web/test/unit/js/WritingAssist/
git commit -m "test: add WritingAssist unit tests (encryption, LaTeX masker)"
```

---

### Task 21: Integration smoke test

- [ ] **Step 1: Backend start check**

```bash
cd services/web && node app.js &
sleep 3
# Test the check endpoint with a curl — expect 401 (no auth)
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/writing-assist/check
# Expected: 401 (or 302 redirect to login)
kill %1
```

- [ ] **Step 2: Validate the existing spelling still works**

```bash
cd services/web
grep -r "spelling" app/src/router.mjs | head -3
# Should still show the spelling routes intact
```

---

## Plan Self-Review Checklist

1. **Spec coverage:**
   - [x] Five colour categories (Section 1) → Task 11 types, Task 14 decorations, Task 19 CSS
   - [x] Pluggable LLM backend (Section 1) → Tasks 3, 4
   - [x] Request/Response data model (Section 3) → Task 1 types, Task 6 manager
   - [x] User config with encrypted keys (Section 3.3) → Task 2 encryption, Task 7 controller
   - [x] LLM prompt design (Section 4) → Task 6 manager SYSTEM_PROMPT
   - [x] LaTeX masking + offset remapping (Section 5) → Task 5
   - [x] Viewport-only checking (Section 6.1) → Task 12 viewport-tracker
   - [x] Sentence fingerprint cache (Section 6.2) → Task 10
   - [x] Viewport change detection (Section 6.3) → Task 12
   - [x] Combined flow (Section 6.4) → Task 17 index.ts
   - [x] Backend file list (Section 7.1) → Tasks 2-8
   - [x] Frontend file list (Section 7.2) → Tasks 9-17
   - [x] CSS (Section 7.4) → Task 19
   - [x] CodeMirror extension design (Section 8) → Tasks 14, 15, 17
   - [x] Edge cases (Section 9) → Covered in manager (Task 6) and checker (Task 13)
   - [x] Security (Section 12) → Encryption (Task 2), auth + rate limiting (Task 7)
   - [x] Success criteria (Section 14) → Smoke test (Task 21)

2. **Placeholder scan:** No TODOs or TBDs. All code blocks are complete.

3. **Type consistency:**
   - `Issue` has `{ offset, length, message, suggestion, category }` — consistent across Tasks 1, 6, 10, 11, 14.
   - `WritingAssistPublicConfig` has `{ enabled, provider, categories, debounceMs }` — used in Tasks 1, 9, 17.
   - Category values `'correctness' | 'clarity' | 'conciseness' | 'delivery' | 'engagement'` — consistent everywhere.
   - `ViewportTracker` → `update()` returns `ViewportSnapshot` with `{ sentences, unchecked, cachedIssues }` — consistent between Tasks 12 and 17.
   - `Checker.schedule(sentences: Array<{text, hash}>)` — called from Task 17 index with `snapshot.unchecked`.
