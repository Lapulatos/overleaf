# Writing Assist — Feature A: Real-time Grammar & Style Check

**Date:** 2026-05-30
**Status:** draft
**Scope:** `services/web` monorepo (backend `app/` + frontend `frontend/`)

---

## 1. Overview

Add a Grammarly-style real-time writing check to Overleaf's source editor.
The system shows color-coded wavy underlines for five categories of writing
issues, each backed by a pluggable LLM provider.

### User-facing outcome

- User writes LaTeX in the source editor.
- After a short pause (1–2 s debounce), the changed text is sent to a
  configurable LLM backend.
- The LLM returns structured issue data. Issues are rendered as colored wavy
  underlines inside CodeMirror 6.
- Hovering an underline shows a tooltip with the problem description and a
  one-click "Apply" button.
- The user independently toggles each of the five check categories from the
  editor toolbar.

### Five-colour category system (Grammarly-compatible)

| Colour | Category       | Severity | When to use                               | Academic default |
|--------|----------------|----------|-------------------------------------------|------------------|
| 🔴 Red | `correctness`  | high     | grammar, spelling, punctuation, tense, S-V agreement | **on** |
| 🔵 Blue | `clarity`     | medium   | tangled sentences, passive overuse, hard-to-follow modifiers | **on** |
| 🟡 Yellow | `conciseness` | low–med  | filler phrases, redundancy, `due to the fact that` → `because` | **on** |
| 🟢 Green | `delivery`    | low–med  | tone mismatch — too blunt for rebuttal, too casual for academic | off (opt-in for rebuttal) |
| 🟣 Purple | `engagement` | low      | flat expression, "good" → "strong" | off (academic convention) |

### Pluggable LLM backend

Users configure **one** of:

- **OpenAI** — API key + model (default `gpt-4o`)
- **Anthropic** — API key + model (default `claude-sonnet-4-6`)
- **Custom** — OpenAI-compatible endpoint URL + API key + model name

Configuration is stored per-user in the existing `User` model (or a dedicated
settings collection) and never hard-coded.

---

## 2. Architecture

```
┌─ Frontend (React + CM6) ────────────────────────────────────────┐
│                                                                  │
│  CodeMirror 6 Editor                                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  writing-assist/  (NEW CodeMirror extension)              │  │
│  │                                                            │  │
│  │  index.ts            extension entry point                 │  │
│  │  viewport-tracker.ts extract visible paragraphs only       │  │
│  │  checker.ts          debounce(1-2 s) → diff → fetch       │  │
│  │  decorations.ts      StateField<DecorationSet> — coloured  │  │
│  │                      wavy underlines per category          │  │
│  │  tooltip.ts          React tooltip: problem + suggestion   │  │
│  │  context-menu.tsx     right-click: Apply / Ignore / ...    │  │
│  │  sentence-fingerprint.ts  hash each sentence → skip checked│  │
│  │  types.ts            CheckRequest, CheckResponse, Issue    │  │
│  └───────────────────────────────────────────────────────────┘  │
│  Toolbar toggle-button (NEW)                                     │
│  Settings panel: LLM provider + category on/off (NEW)            │
│                           │                                      │
│                      postJSON()                                   │
└───────────────────────────┼──────────────────────────────────────┘
                            │
┌─ Backend (Express) ───────┼──────────────────────────────────────┐
│                            ▼                                      │
│  POST /writing-assist/check                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  WritingAssistController.mjs                               │  │
│  │    • AuthenticationController.requireLogin()               │  │
│  │    • validate body: { text, language, enabledCategories }   │  │
│  │    • delegate → WritingAssistManager                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  WritingAssistManager.mjs                                   │  │
│  │    • build LLM prompt with category instructions            │  │
│  │    • call WritingAssistLLMProvider                          │  │
│  │    • validate + normalise returned JSON                     │  │
│  │    • strip LaTeX before sending, remap offsets after        │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  WritingAssistLLMProvider.mjs  (strategy pattern)          │  │
│  │    ┌──────────────┬──────────────┬──────────────────┐     │  │
│  │    │ OpenAI       │ Anthropic    │ Custom           │     │  │
│  │    │ Provider     │ Provider     │ Provider         │     │  │
│  │    │ chat/complet.│ messages API │ chat/completions │     │  │
│  │    └──────────────┴──────────────┴──────────────────┘     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  GET /writing-assist/config   (read user LLM + category prefs)   │
│  PUT /writing-assist/config   (write user LLM + category prefs)  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 Request (Frontend → Backend)

```typescript
// POST /writing-assist/check
interface CheckRequest {
  text: string;                    // original editor text (including LaTeX)
  language: 'en';                  // future: zh, de, fr...
  enabledCategories: Category[];   // subset of the five categories
  context?: {                      // optional surrounding text for better suggestions
    before: string;                // preceding paragraph
    after: string;                 // following paragraph
  };
}

type Category = 'correctness' | 'clarity' | 'conciseness' | 'delivery' | 'engagement';
```

### 3.2 Response (Backend → Frontend)

```typescript
// POST /writing-assist/check → 200
interface CheckResponse {
  issues: Issue[];
}

interface Issue {
  offset: number;        // character offset in `text`
  length: number;        // length of problematic span
  message: string;       // Chinese explanation of the problem
  suggestion: string;    // corrected text to apply
  category: Category;
}
```

### 3.3 User Configuration (persisted)

```typescript
// GET/PUT /writing-assist/config
interface WritingAssistConfig {
  enabled: boolean;               // master on/off
  provider: 'openai' | 'anthropic' | 'custom';
  openai?: {
    apiKey: string;
    model: string;                // default: "gpt-4o"
    endpoint?: string;            // default: "https://api.openai.com/v1"
  };
  anthropic?: {
    apiKey: string;
    model: string;                // default: "claude-sonnet-4-6"
    endpoint?: string;            // default: "https://api.anthropic.com/v1"
  };
  custom?: {
    apiKey: string;
    endpoint: string;             // required for custom
    model: string;                // required for custom
  };
  categories: {
    correctness: boolean;         // default: true
    clarity: boolean;             // default: true
    conciseness: boolean;         // default: true
    delivery: boolean;            // default: false
    engagement: boolean;          // default: false
  };
  debounceMs: number;             // default: 1500
}
```

API keys are stored encrypted at rest (AES-256-GCM using `crypto` module with a
server-side encryption key from `Settings.encryptionKey`). Keys are **never**
returned in full to the frontend — the GET endpoint returns masked keys
(`sk-...xxxx`).

---

## 4. LLM Prompt Design

### 4.1 System prompt (Anthropic) / System message (OpenAI)

```
You are an academic-paper writing checker for LaTeX documents.
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
- message: one-sentence description of the problem and why it matters
  (use Chinese)
- suggestion: the exact replacement text
- category: one of the five category strings above
```

### 4.2 User message template

```
Enabled categories: {categories_list}
Return issues for ONLY these categories. Ignore others.

Text to check:
"""
{user_text}
"""
```

### 4.3 Response parsing & validation

```javascript
// WritingAssistManager — normalise LLM output
function validateIssues(raw, textLength) {
  if (!Array.isArray(raw?.issues)) throw new Error('Missing issues array')

  return raw.issues
    .filter(i =>
      typeof i.offset === 'number' &&
      typeof i.length === 'number' &&
      i.offset >= 0 &&
      i.offset + i.length <= textLength &&
      VALID_CATEGORIES.has(i.category) &&
      typeof i.suggestion === 'string' &&
      i.suggestion.length > 0
    )
    // sort by offset for frontend rendering
    .sort((a, b) => a.offset - b.offset)
}
```

---

## 5. LaTeX Awareness (Backend-Side)

Before sending text to the LLM, the **backend** masks LaTeX constructs to:

1. **Save tokens** — don't charge the user for checking `\usepackage{...}`
2. **Prevent false positives** — the LLM won't flag `\begin{equation}` as a
   misspelling

The frontend sends the **original unmodified text** (including LaTeX).
All masking and offset remapping happens on the backend.

### 5.1 Masking rules

| Construct | Masked as | Example |
|-----------|-----------|---------|
| LaTeX commands | `⟨CMD⟩` | `\textbf{hello}` → `⟨CMD⟩hello` |
| Math mode `$...$` | `⟨MATH⟩` | `$x^2 + y^2$` → `⟨MATH⟩` |
| Display math `\[...\]` | `⟨MATH⟩` | `\[E=mc^2\]` → `⟨MATH⟩` |
| Environments | `⟨ENV⟩` | `\begin{itemize}...\end{itemize}` → `⟨ENV⟩` |
| `\cite{...}`, `\ref{...}` | `⟨CITE⟩`, `⟨REF⟩` | |
| Comments `%...` | stripped | |

Each placeholder is a fixed-length token so that the **delta table
(masked → original offset map) is deterministic**.

### 5.2 Offset remapping (backend)

```
Original:  "The \textbf{method} is good."
Masked:    "The ⟨CMD⟩method is good."
           LLM returns offset=4 len=4 for "good"

Remap:     Original offset = masked offset + accumulated delta
           → "good" at masked[4:8] = original[20:24]
```

The backend:
1. Receives original text from frontend
2. Builds `maskedText` and an offset delta table while masking
3. Sends `maskedText` to the LLM
4. LLM returns issues with offsets in `maskedText`
5. Backend remaps each issue's offset from masked → original using the delta table
6. Returns issues with offsets in the **original** text to the frontend
7. Frontend renders decorations directly — no remapping needed client-side

---

## 6. Viewport Scope & Sentence Fingerprint Cache

### 6.1 Viewport-only checking

Only text **currently visible** in the CodeMirror viewport is checked.
This avoids sending the entire document to the LLM on every keystroke.

```
┌─ CodeMirror scroll container ────────────┐
│                                           │
│  \section{Introduction}   ← NOT checked   │
│                                           │
│  ┌── viewport (visible) ──────────────┐  │
│  │  We propose a novel method for     │  │
│  │  detecting adversarial examples.   │  │  ← checked
│  │  Our approach leverages contrastive│  │
│  └────────────────────────────────────┘  │
│                                           │
│  \begin{equation}...\end{equation} ← NOT  │
│                                           │
└───────────────────────────────────────────┘
```

**How it works:**

1. On each `doc.changed` event + debounce timeout, get the visible range
   from `EditorView.viewport` → `{from: number, to: number}` (document positions).
2. Split the visible text into **sentences** (using `Intl.Segmenter` with
   `granularity: 'sentence'`).
3. For each sentence, compute a **fingerprint** (SHA-256 hash truncated to 12 hex
   chars).
4. Look up the fingerprint in the **sentence cache** (an in-memory `Map`).
   - **Cache hit** → sentence unchanged; apply existing decorations, skip LLM.
   - **Cache miss** → sentence is new or modified; queue for LLM check.
5. Only sentences with cache misses are sent to the backend.
6. When the LLM returns, store the sentence fingerprint → issues mapping in the cache.
7. When the user scrolls to a new region, the viewport change triggers a re-check —
   but **only for uncached sentences** in the new viewport.

### 6.2 Sentence fingerprint cache (persistent, per-project)

The cache is **not just an in-memory LRU** — it persists to `localStorage`
keyed by `projectId`, so checked sentences survive:

- Page refresh
- Editor close/reopen
- Tab switch
- Scroll away and scroll back

**Data structure:**

```typescript
// localStorage key: `wa-cache-${projectId}`
interface SentenceCache {
  version: 1;                               // schema version — wipe on mismatch
  entries: Record<
    string,                                 // sentence fingerprint (12-char hex)
    {
      text: string;                         // original sentence text (for collision check)
      checkedAt: number;                    // Date.now() timestamp
      issues: Issue[];                      // cached issues for this sentence
    }
  >;
}
```

**Cache operations:**

| Event | Action |
|-------|--------|
| Sentence unchanged (fingerprint match) | Load issues from cache, render decorations instantly |
| User edits a sentence (fingerprint changed) | Old entry orphaned; new fingerprint queued for LLM check |
| User clicks "Apply" on a suggestion | Sentence text changes → new fingerprint → old entry orphaned |
| `checkedAt` older than 24 hours | Entry considered stale on next viewport entry, re-check |
| User switches to a different project | Different `localStorage` key; no cross-project pollution |
| Cache exceeds 5 MB (≈ ~8000 sentences) | Evict oldest 20% of entries by `checkedAt` |

### 6.3 Viewport change detection

```typescript
// viewport-tracker.ts — simplified logic
class ViewportTracker {
  private lastViewport: { from: number; to: number } | null = null;
  private lastSentenceHashes: Set<string> = new Set();

  onViewportChange(view: EditorView, cache: SentenceFingerprintCache) {
    const vp = view.viewport;  // { from, to } in doc offsets
    if (this.lastViewport && vp.from === this.lastViewport.from && vp.to === this.lastViewport.to) {
      return;  // viewport didn't move — no-op
    }
    this.lastViewport = { from: vp.from, to: vp.to };

    const visibleText = view.state.sliceDoc(vp.from, vp.to);
    const sentences = segmentSentences(visibleText);
    const newHashes = new Set<string>();

    for (const s of sentences) {
      const hash = fingerprint(s);
      newHashes.add(hash);
      if (!cache.has(hash)) {
        this.queueForCheck(s, hash);
      }
    }

    // Sentences that left the viewport — keep them cached but hide their
    // decorations (CM6 decorations only paint inside viewport anyway)
    this.lastSentenceHashes = newHashes;
  }

  onDocChanged(view: EditorView, change: ChangeDesc, cache: SentenceFingerprintCache) {
    // Invalidate cache entries whose text touched the changed range
    const changedFrom = change.from;
    const changedTo = change.to;
    cache.invalidateRange(changedFrom, changedTo);

    // Re-check viewport after the change settles
    this.onViewportChange(view, cache);
  }
}
```

### 6.4 Combined flow

```
User scrolls or types
        │
        ▼
┌─ viewport-tracker ───────────────────────────────────┐
│  1. Get visible text range → EditorView.viewport      │
│  2. Split into sentences → Intl.Segmenter             │
│  3. For each sentence:                                │
│     fingerprint = SHA256(sentence).slice(0, 12)       │
│     if cache.has(fingerprint) → render from cache     │
│     else → collect for batch check                    │
└──────────────────────────────────────────────────────┘
        │
        ▼ (only new/changed sentences)
┌─ checker ────────────────────────────────────────────┐
│  4. POST /writing-assist/check { text: batch }        │
│  5. Receive issues[] per sentence                     │
│  6. Store each sentence → issues in cache              │
│  7. Update decorationState                            │
└──────────────────────────────────────────────────────┘
```

**LLM cost reduction:** A typical viewport shows ~5-8 sentences. On first
scroll-through of a 30-page paper, each viewport's sentences are checked once.
Subsequent scroll-backs hit cache — zero additional LLM calls. The entire paper
gets checked viewport-by-viewport as the user scrolls, not in one massive call.

---

## 7. File-Level Implementation Plan

### 7.1 Backend (`services/web/app/src/`)

| File | Purpose |
|------|---------|
| `Features/WritingAssist/WritingAssistController.mjs` | HTTP handlers: `POST /check`, `GET /config`, `PUT /config` |
| `Features/WritingAssist/WritingAssistManager.mjs` | Orchestration: prompt construction, LLM call, response validation, offset remapping |
| `Features/WritingAssist/WritingAssistLLMProvider.mjs` | Strategy-pattern factory: choose OpenAI / Anthropic / Custom |
| `Features/WritingAssist/providers/OpenAIProvider.mjs` | `POST https://api.openai.com/v1/chat/completions` |
| `Features/WritingAssist/providers/AnthropicProvider.mjs` | `POST https://api.anthropic.com/v1/messages` |
| `Features/WritingAssist/providers/CustomProvider.mjs` | `POST <user-endpoint>/chat/completions` (OpenAI-compatible) |
| `Features/WritingAssist/WritingAssistRouter.mjs` | `apply(webRouter, privateApiRouter)` |
| `Features/WritingAssist/WritingAssistEncryption.mjs` | AES-256-GCM encrypt/decrypt API keys at rest |

**router.mjs change (one line):**
```javascript
import WritingAssistRouter from './Features/WritingAssist/WritingAssistRouter.mjs'
// … existing routers …
WritingAssistRouter.apply(webRouter, privateApiRouter)
```

### 7.2 Frontend (`services/web/frontend/js/features/source-editor/`)

| File | Purpose |
|------|---------|
| `extensions/writing-assist/index.ts` | Extension entry (Facet + array of extensions) |
| `extensions/writing-assist/types.ts` | TypeScript types shared across the extension |
| `extensions/writing-assist/viewport-tracker.ts` | Viewport range detection, scroll watching, sentence segmentation |
| `extensions/writing-assist/sentence-fingerprint.ts` | SHA-256 sentence hashing + `localStorage`-backed per-project cache |
| `extensions/writing-assist/checker.ts` | Debounce, diff viewport sentences, batch-fetch uncached ones via `/check` |
| `extensions/writing-assist/decorations.ts` | StateField → DecorationSet with per-category MarkDecoration |
| `extensions/writing-assist/tooltip.ts` | React tooltip portal: show issue + "Apply" button |
| `extensions/writing-assist/context-menu.tsx` | Right-click actions: Apply / Apply All / Ignore |
| `extensions/writing-assist/config-panel.tsx` | Settings UI (provider, API key, model, category toggles) |
| `extensions/writing-assist/toolbar-button.tsx` | Master on/off toggle in editor toolbar |
| `utils/api/writing-assist.ts` | `checkWriting(text, config)` and `get/saveConfig()` API helpers |

Note: LaTeX masking and offset remapping happens on the **backend**.
The frontend sends raw editor text and receives issues with offsets already
in original-text coordinates.

### 7.3 Shared types

| File | Purpose |
|------|---------|
| `services/web/types/writing-assist.ts` | `CheckRequest`, `CheckResponse`, `Issue`, `Category`, `ProviderConfig` |

### 7.4 CSS

| File | Purpose |
|------|---------|
| `frontend/stylesheets/writing-assist.less` | Five underline styles (`.wa-underline-correctness`, etc.), tooltip styles, toggle button, config panel |

---

## 8. CodeMirror Extension Design

### 8.1 Extension structure (index.ts)

```typescript
export function writingAssist(config: WritingAssistConfig): Extension {
  return [
    // State fields
    checkerState,
    decorationState,
    // Event handlers
    EditorView.domEventHandlers({ mouseover: tooltipHover }),
    EditorView.domEventHandlers({ contextmenu: contextMenuHandler }),
    // Keybindings
    keymap.of([{ key: 'Mod-Shift-a', run: toggleWritingAssist }]),
    // Theme
    writingAssistTheme,
  ];
}
```

### 8.2 Decoration rendering

```typescript
const CATEGORY_MARK = {
  correctness: MarkDecorationSpec({ class: 'wa-underline-correctness' }),
  clarity:     MarkDecorationSpec({ class: 'wa-underline-clarity' }),
  conciseness: MarkDecorationSpec({ class: 'wa-underline-conciseness' }),
  delivery:    MarkDecorationSpec({ class: 'wa-underline-delivery' }),
  engagement:  MarkDecorationSpec({ class: 'wa-underline-engagement' }),
};
```

### 8.3 Debounce & viewport strategy

- After every `doc.changed` transaction, reset a 1.5 s timer.
- On timer fire, the **viewport tracker** extracts visible sentences (Section 6.1).
- Each sentence is fingerprinted; already-checked sentences load from cache instantly.
- Only **new or modified** sentences are batched into a single `POST /check`.
- On response, each sentence's issues are stored in the fingerprint cache and
  `decorationState` is updated → CM6 re-renders affected viewport lines only.
- On scroll, the viewport tracker fires again. Newly visible sentences that are
  uncached get checked; cached sentences render instantly.

---

## 9. Edge Cases & Error Handling

| Scenario | Behaviour |
|----------|-----------|
| LLM timeout (>10 s) | Abort, show "Check timed out" toast, no decorations |
| LLM returns malformed JSON | Retry once with stricter prompt; if still bad, log error, skip |
| LLM returns offset out of bounds | Filter out in `validateIssues()` |
| API key expired / invalid | 401 → show "Update your API key in settings" banner |
| Rate limited (429) | Exponential backoff, show "Rate limited, retrying in Ns" |
| Empty text / only LaTeX | Skip check, return empty issues |
| Very long paragraph (>4000 chars) | Split into chunks, check each, merge offsets |
| User rapidly types | Debounce cancels previous timer, only last snapshot is checked |
| Multiple issues overlap | Tooltip shows all at that position, sorted by severity |
| CM6 visual (rich-text) mode | Writing assist works in source mode only; disabled in visual mode |
| No internet / offline | Silently skip, no error shown (non-blocking) |
| User scrolls to unchecked region | Viewport tracker fires; uncached sentences queued for check |
| User scrolls back to checked region | All cached — decorations render instantly, no API call |
| Cache full (>5 MB per project) | Evict oldest 20% by `checkedAt` timestamp |
| Stale cache (>24 hours old) | Re-check on next viewport entry |
| User edits a cached sentence | Old fingerprint orphaned; new fingerprint queued |

---

## 10. Testing Strategy

### Backend

- `test/unit/js/WritingAssist/WritingAssistManagerTests.js` — prompt construction, response validation, offset remapping
- `test/unit/js/WritingAssist/WritingAssistLLMProviderTests.js` — provider selection, error handling
- `test/unit/js/WritingAssist/WritingAssistEncryptionTests.mjs` — encrypt/decrypt round-trip
- `test/acceptance/js/WritingAssist/WritingAssistTests.js` — full POST /check flow with mock LLM

### Frontend

- `extensions/writing-assist/viewport-tracker.test.ts` — correct visible text extraction, scroll detection
- `extensions/writing-assist/sentence-fingerprint.test.ts` — hash stability, cache hit/miss, eviction, cross-project isolation
- `extensions/writing-assist/checker.test.ts` — debounce behaviour, batch fetch with mock

### Integration

- Manual smoke test: open a project, toggle writing assist, type a sentence with a known error, verify red underline appears

---

## 11. Configuration Defaults

```javascript
// services/web/config/settings.defaults.js

module.exports = {
  // …
  writingAssist: {
    enabled: false,               // feature flag — off by default initially
    defaultProvider: 'openai',
    defaultModel: {
      openai: 'gpt-4o',
      anthropic: 'claude-sonnet-4-6',
    },
    maxTextLength: 4000,          // max chars per check request
    timeout: 10000,               // LLM request timeout ms
    retryAttempts: 1,
    debounceMs: 1500,
    cacheSize: 200,               // client-side sentence cache entries
    encryptionKey: process.env.WRITING_ASSIST_ENCRYPTION_KEY,
  },
}
```

---

## 12. Security Considerations

- **API keys** stored encrypted at rest (`crypto.createCipheriv('aes-256-gcm')`)
- API keys **never** returned in full to the client after initial save
- `/writing-assist/check` requires authentication (`requireLogin()`)
- Rate limiting per user (e.g., 30 requests/minute) via `RateLimiter`
- Text sent to third-party LLM APIs; users should be informed that their
  content leaves Overleaf's servers when using this feature
- Custom endpoint URL validated against SSRF (block internal IP ranges,
  localhost)

---

## 13. Out of Scope (Future Iterations)

| Feature | Deferred To |
|---------|-------------|
| AI rewrite selected text (Feature B) | Next iteration |
| Full-document cross-chapter analysis (Feature C) | Later |
| One-click full-document polish + diff (Feature D) | Later |
| Zotero/Mendeley integration | — |
| Non-English language support | — |
| "Apply All" batch fix for the whole document | — |
| User dictionary / "Ignore for this project" | — |
| Offline local model support (WebLLM) | — |

---

## 14. Success Criteria

1. User types a sentence with a grammar error → red underline appears within 2 s
2. User types a wordy sentence → yellow underline appears for "due to the fact that"
3. Hovering an underline shows a tooltip with Chinese explanation and English suggestion
4. Clicking "Apply" replaces the text and removes the underline
5. User can toggle individual categories on/off from settings
6. User can switch between OpenAI, Anthropic, and custom endpoint
7. LaTeX commands and math are NOT flagged as errors
8. Existing Hunspell spell check continues to work independently
9. Only visible viewport text is checked — scrolling does NOT trigger full-document re-check
10. Scrolling back to a previously checked paragraph shows decorations instantly (cache hit)
11. Editing a sentence and undoing the edit re-checks (old fingerprint gone, new one queued)
12. Switching to a different project uses its own isolated cache
13. Cache older than 24 hours re-checks on viewport entry
