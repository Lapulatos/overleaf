# WritingAssist Features

> AI-powered academic writing assistant for Overleaf.
> Branch: `feature/writing-assist`

## Overview

WritingAssist provides real-time grammar, style, and punctuation checking inside the Overleaf editor, plus an AI transform toolbar for rewriting, expanding, condensing, and translating selected text. It integrates directly into the CodeMirror editor as a native extension — no browser extension required.

## Features

### Grammar & Style Checker

Real-time checking with 5 categories:

| Category | Color | What it catches |
|----------|-------|-----------------|
| Correctness | Red | Grammar errors, subject-verb agreement, punctuation, spacing, capitalization |
| Clarity | Blue | Ambiguous phrasing, unclear references |
| Conciseness | Yellow | Wordy constructions, redundant phrases |
| Delivery | Green | Tone mismatches, inappropriate register |
| Engagement | Purple | Monotonous language, weak verbs |

**Interaction:**
- Thick colored underline marks the changed span (not the whole sentence)
- Hover the underline → card appears with:
  - Category label + reason (in your language)
  - Inline diff: single-word change → corrected word bold+colored; multi-word → track-changes with red strikethrough + green bold
  - **Apply** button — replaces the span in one transaction
  - **Dismiss** — hide this occurrence (position-anchored, survives re-check)
  - **Dismiss all** — add to project's Dismiss Notes (regex pattern, persistent)
- **↻ Check** button (bottom-right, always pinned) — force fresh re-check of all viewport sentences

**Checking behavior:**
- Per-sentence concurrent checking (configurable concurrency, default 4)
- Sentence cache — only re-sends edited sentences after apply
- Non-regression gate — each apply must lower severity; no loops
- Lazy/Eager analysis mode — lazy checks only visible viewport; eager checks viewport ±8000 chars
- Selection-scoped — if text is selected, ↻ Check only checks selected sentences
- Punctuation & spacing — commas, periods, double spaces, missing capitalization

### AI Transform Toolbar

Select text → sparkle icon appears above the selection → click to open action menu:

| Action | Description |
|--------|-------------|
| **Polish** | Improve clarity and flow |
| **Translate** | Translate to English (or other target language) |
| **Rewrite** | Rewrite with fidelity slider (0–0.9: higher = closer to original) |
| **Expand** | Elaborate with length ratio slider (green, word-count target) |
| **Condense** | Shorten with length ratio slider (red, word-count target) |
| **Custom** | Free-form instruction with text input |

**After selecting an action:**
- Loading spinner with progress
- Inline preview card showing:
  - Diff view: deleted text (red strikethrough) + added text (green bold)
  - **Accept** / **Reject** buttons
- Stop button for in-progress checks

**LaTeX-aware:** LaTeX commands and math environments are masked before sending to the LLM, so they are preserved in the output.

### Dismiss Notes

A per-project notebook of dismissed patterns, accessible from the left rail panel below Chat:

- **Search** — fuzzy subsequence filter
- **Add** — type a sentence to ignore; duplicate detection with hint
- **Edit/Delete** — inline editing and removal
- **Regex pattern matching** — dismissed patterns use diff-aware regex (original-side words + `.*` gaps), so filler words still match
- **Project-scoped** — dismissals are isolated per project, not shared across projects

### Configuration

Settings modal → **Writing Assist** section:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Enabled | Toggle | On | Master enable/disable |
| Provider | Select | Custom | openai / anthropic / custom |
| API Key | Password | — | Provider API key (AES-encrypted at rest) |
| Model | Text | — | Model name (e.g. `deepseek-chat`) |
| Endpoint | Text | — | Custom provider endpoint |
| Categories | 5 toggles | All on | Which issue categories to check |
| Analysis scope | Select | Lazy | lazy (viewport only) / eager (viewport+margin) |
| Concurrency | Number | 4 | Parallel sentence checks (1–12) |
| Timeout | Number | 20s | Per-sentence timeout (2–60s) |

**Persistence:** All settings are stored in MongoDB (per-user, AES-encrypted API keys). Survives container restarts.

## Architecture

### Backend

```
services/web/app/src/Features/WritingAssist/
├── WritingAssistController.mjs    # API handlers: check, transform, config, dismissals
├── WritingAssistRouter.mjs        # Route definitions
├── WritingAssistManager.mjs       # LLM orchestration, prompt building, response parsing
├── WritingAssistConfigManager.mjs # Per-user config persistence (MongoDB)
├── WritingAssistDismissalManager.mjs # Dismissal CRUD + pattern matching
├── WritingAssistEncryption.mjs    # AES-256-GCM encryption for API keys
├── WritingAssistLLMProvider.mjs   # LLM provider abstraction
├── WritingAssistLaTeXMasker.mjs   # LaTeX command/math masking for transforms
├── WritingAssistTransformManager.mjs      # Transform LLM orchestration
├── WritingAssistTransformPromptBuilder.mjs # Transform prompt construction
└── providers/
    ├── OpenAIProvider.mjs
    ├── AnthropicProvider.mjs
    └── CustomProvider.mjs
```

**API Routes:**

| Method | Path | Description |
|--------|------|-------------|
| POST | `/writing-assist/check` | Check text for issues |
| POST | `/writing-assist/transform` | Transform (polish/rewrite/etc.) |
| GET | `/writing-assist/config` | Get user config |
| PUT | `/writing-assist/config` | Update user config |
| GET | `/writing-assist/dismissals?projectId=...` | List dismiss notes |
| POST | `/writing-assist/dismissals` | Add dismiss note |
| PUT | `/writing-assist/dismissals/:id` | Update dismiss note |
| DELETE | `/writing-assist/dismissals/:id` | Delete dismiss note |

**Models:**
- `WritingAssistConfig` — per-user config (user_id unique, config:Mixed, encrypted apiKey)
- `WritingAssistDismissal` — per-project dismiss notes (user_id + project_id, text with regex pattern)

### Frontend

```
services/web/frontend/js/features/source-editor/extensions/
├── writing-assist/                 # Grammar checker
│   ├── index.ts                    # Main extension (checker, decorations, cache)
│   ├── checker.ts                  # Per-sentence concurrent checker
│   ├── decorations.ts              # Underline mark decorations
│   ├── tooltip.ts                  # Hover card (self-managed)
│   ├── apply.ts                    # Apply/dismiss actions
│   ├── effects.ts                  # State effects
│   ├── theme.ts                    # Underline + card base theme
│   ├── segment.ts                  # Sentence segmentation with offsets
│   ├── sentence-cache.ts           # Text→issues cache + severity gates
│   ├── progress.ts                 # ↻ Check button + progress overlay
│   ├── dismiss-store.ts            # Shared dismiss state (CM ↔ React)
│   ├── dismiss-pattern.ts          # Diff-aware regex pattern builder
│   ├── local-dismiss.ts            # Position-anchored dismiss StateField
│   ├── dismiss-panel.tsx           # Rail panel (React)
│   ├── config-panel.tsx            # Settings modal section (React)
│   ├── settings-section.tsx        # Module hook for settings registration
│   ├── rail-entry.tsx              # Rail panel registration
│   ├── module-entry.ts             # Extension module seam entry
│   └── types.ts                    # Issue, config, category types
│
└── writing-assist-transform/       # AI transform toolbar
    ├── index.ts                    # Assembles all sub-extensions
    ├── toolbar.ts                  # Selection-triggered icon tooltip
    ├── toolbar-react.tsx           # Action menu (React portal)
    ├── toolbar-portal.tsx          # Portal wrapper
    ├── preview.ts                  # Preview tooltip StateField
    ├── preview-react.tsx           # Preview diff card (React)
    ├── preview-portal.tsx          # Portal wrapper
    ├── transform-runner.ts         # LLM call + effect dispatch
    ├── apply.ts                    # Apply transform result
    ├── effects.ts                  # State effects
    ├── theme.ts                    # Full theme (light + dark)
    ├── module-entry.ts             # Extension module seam entry
    └── types.ts                    # Transform types
```

**Module Registration** (via Overleaf's module seam):
- `settings.defaults.js` → `sourceEditorExtensions` → both `module-entry.ts` files
- `settings.defaults.js` → `overleafModuleImports.settingsModalEditorTabSections` → `settings-section.tsx`
- `settings.defaults.js` → `overleafModuleImports.railEntries` → `rail-entry.tsx`

## Build & Deploy

### Prerequisites

- Node.js 23+ (host)
- Docker Desktop (with `host.docker.internal` support)
- LLM API key (DeepSeek, OpenAI, or custom endpoint)

### Build

```bash
cd services/web

# IMPORTANT: clear caches after any source edit
rm -rf node_modules/.cache/babel-loader
rm -f node_modules/.cache/last-overleafModuleImports.json

# Build production bundle
env -u OVERLEAF_CONFIG -u SHARELATEX_CONFIG NODE_ENV=production \
  node ../../node_modules/.bin/webpack --config webpack.config.prod.js
```

**Key gotchas:**
- Do NOT set `OVERLEAF_CONFIG` — it causes Settings.js to self-merge and crash
- Must clear babel-loader cache after source edits (stale transpiled modules)
- Must clear macro cache after `overleafModuleImports` registration changes
- `.tsx` module paths MUST include explicit `.tsx` extension in settings.defaults.js

### Deploy

```bash
# Bake image (copies public/ + WA backend + models into existing container)
bash plan/bake-wa-image.sh   # → overleaf-wa:p0

# Deploy with compose overlay
docker compose -f docker-compose.yml -f plan/wa-p0-compose.yml up -d sharelatex
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WRITING_ASSIST_DEFAULT_API_KEY` | No | `''` | Pre-configured API key for custom provider |
| `WRITING_ASSIST_DEFAULT_MODEL` | No | `''` | Pre-configured model name |
| `WRITING_ASSIST_DEFAULT_ENDPOINT` | No | `''` | Pre-configured endpoint URL |
| `WRITING_ASSIST_ENCRYPTION_KEY` | No | `dev-key-change-me` | AES encryption key for stored API keys |

### Access

```
http://localhost:3000/
Login: admin@overleaf.local / admin123456
```

## Known Issues

| Issue | Status | Workaround |
|-------|--------|------------|
| Hover card uses hardcoded colors — may not adapt perfectly to dark editor theme | Known | Transform toolbar already uses `--wa-themed-*` variables; grammar card fix is planned |
| `A2 from-source server build` deferred — deployed image's non-WA server is a foreign revision | Deferred | 3-line write-and-cite guard (`cd6a7c7`) prevents the only observed crash |
| Single-word dismiss patterns (e.g. "is") match any sentence containing that word | Accepted | Coarse but functional; user accepted as original-side semantics tradeoff |
| Overleaf's module macro cache can serve stale registrations | Fixed | Clear `last-overleafModuleImports.json` + `babel-loader` cache before rebuild |

## Competitive Comparison

| Feature | WA | Writefull | Paperpal | Trinka | Prism |
|---------|----|-----------|----------|--------|-------|
| Grammar/style check | ✅ | ✅ | ✅ | ✅ | ✅ |
| Category classification | ✅ 5 | ✅ | Partial | ✅ | — |
| Selection rewrite | ✅ 6 actions | ✅ | ✅ | ✅ | ✅ |
| Rewrite fidelity control | ✅ Unique | — | — | — | — |
| Project-scoped dismiss | ✅ Unique | — | — | — | — |
| Title generator | ❌ | ✅ | ✅ | — | — |
| Abstract generator | ❌ | ✅ | ✅ | — | — |
| LaTeX code generation | ❌ | ✅ TeXGPT | — | — | ✅ |
| Plagiarism detection | ❌ | — | ✅ | ✅ | — |
| Journal finder | ❌ | — | ✅ | ✅ | — |
| Citation assistance | ❌ | — | ✅ | — | ✅ |
| Full-document analysis | ❌ | — | — | — | ✅ |
| Local agent backend | Planned | — | — | — | — |

See `plan/wa-roadmap.md` for the full feature roadmap and implementation plan.
