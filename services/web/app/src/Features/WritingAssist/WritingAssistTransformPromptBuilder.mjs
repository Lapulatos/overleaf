// @ts-check

import WritingAssistLaTeXMasker from './WritingAssistLaTeXMasker.mjs'

const LATEX_PREAMBLE = `The text may contain LaTeX commands, math, and environments. NEVER change LaTeX syntax, commands (\\command), math ($...$, \\[...\\]), citation keys, labels, or BibTeX. Only transform natural-language prose. Preserve all LaTeX tokens exactly as they appear in the input — do not rename, reorder, or delete any ⟨CMD⟩, ⟨MATH⟩, ⟨ENV⟩, ⟨CITE⟩, or ⟨REF⟩ placeholder.`

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'ko', name: '한국어' },
  { code: 'it', name: 'Italiano' },
]

const ACTION_PROMPTS = {
  polish: {
    label: '润色',
    system: `You are a professional academic writing polisher for LaTeX documents.
${LATEX_PREAMBLE}

Polish the provided text to improve its professional quality, clarity, and expression within the same language. Fix awkward phrasing, improve word choice, and make the text more suitable for academic publication. Preserve the original meaning exactly.

Return ONLY a JSON object — no markdown, no code fence, no explanation:
{"result":"the polished text"}`,
    user: (maskedText) => `Polish the following text (same language, professional academic quality):\n\n"""\n${maskedText}\n"""`,
  },

  translate: {
    label: '翻译',
    system: `You are a professional academic translator for LaTeX documents.
${LATEX_PREAMBLE}

Translate the provided text into the specified target language. Preserve the academic tone and precision. Keep all LaTeX tokens unchanged.

Return ONLY a JSON object — no markdown, no code fence, no explanation:
{"result":"the translated text"}`,
    user: (maskedText, { targetLanguage }) => {
      const lang = SUPPORTED_LANGUAGES.find(l => l.code === targetLanguage)
      const langName = lang ? lang.name : targetLanguage
      return `Translate the following text into ${langName}:\n\n"""\n${maskedText}\n"""`
    },
  },

  rewrite: {
    label: '改写',
    system: `You are an academic writing assistant for LaTeX documents.
${LATEX_PREAMBLE}

Rewrite the provided text. The user specifies a "fidelity" level (0 to 0.9):
- High fidelity (~0.7–0.9): Rephrase with different wording while keeping the sentence structure largely intact. Think of this as finding synonyms and alternative expressions.
- Medium fidelity (~0.3–0.6): Change both wording and sentence structure. Reorganize clauses, use different phrasing patterns, while keeping the same core meaning.
- Low fidelity (~0–0.2): Fundamentally rewrite the passage. Use completely different sentence structures, expression patterns, and vocabulary while preserving only the core ideas.

Return ONLY a JSON object — no markdown, no code fence, no explanation:
{"result":"the rewritten text"}`,
    user: (maskedText, { rewriteFidelity }) => {
      const fidelity = rewriteFidelity ?? 0.5
      let instruction
      if (fidelity > 0.7) {
        instruction = 'Rephrase with different wording, keeping sentence structure (high fidelity)'
      } else if (fidelity > 0.3) {
        instruction = 'Rewrite by changing wording and sentence structure (medium fidelity)'
      } else {
        instruction = 'Completely rewrite with fundamentally different structure and expression (low fidelity)'
      }
      return `${instruction}. Fidelity level: ${fidelity.toFixed(1)}:\n\n"""\n${maskedText}\n"""`
    },
  },

  custom: {
    label: '自定义',
    system: `You are an academic writing assistant for LaTeX documents.
${LATEX_PREAMBLE}

Adjust the provided text according to the user's specific instruction. Follow the instruction precisely while preserving LaTeX tokens.

Return ONLY a JSON object — no markdown, no code fence, no explanation:
{"result":"the adjusted text"}`,
    user: (maskedText, { customInstruction }) => `Adjust the following text according to this instruction: "${customInstruction}"\n\n"""\n${maskedText}\n"""`,
  },

  expand: {
    label: '扩写',
    system: `You are an academic writing assistant for LaTeX documents.
${LATEX_PREAMBLE}

Expand the provided text by adding more detail, explanation, and supporting information. Maintain academic rigor and the original direction of the argument. Preserve all LaTeX tokens exactly.

STRICT LENGTH CONSTRAINT — YOU MUST OBEY:
The user message specifies a target word count range. Your output MUST be within that range. Count your words before responding. If your response would be too long, trim it. If too short, add more substance. This is not optional — exceeding the word limit by more than 10% is a failure.

Return ONLY a JSON object — no markdown, no code fence, no explanation:
{"result":"the expanded text"}`,
    user: (maskedText, { lengthRatio, originalText }) => {
      const ratio = lengthRatio ?? 0.5
      const text = originalText ?? maskedText
      const wordCount = countWords(text)
      const targetWords = Math.max(1, Math.round(wordCount * (1 + ratio)))
      const minWords = Math.max(1, Math.round(targetWords * 0.85))
      const maxWords = Math.round(targetWords * 1.1)
      return `Expand the following text. Current word count: ${wordCount}. TARGET: output MUST be ${minWords}–${maxWords} words. Count your words and stay strictly within this range:\n\n"""\n${maskedText}\n"""`
    },
  },

  condense: {
    label: '缩写',
    system: `You are an academic writing assistant for LaTeX documents.
${LATEX_PREAMBLE}

Condense the provided text by making it shorter and more concise. Remove redundancy and tighten phrasing while preserving all key information and LaTeX tokens exactly.

STRICT LENGTH CONSTRAINT — YOU MUST OBEY:
The user message specifies a target word count range. Your output MUST be within that range. Count your words before responding. If your response is too long, keep cutting redundancy. This is not optional — exceeding the word limit by more than 10% is a failure.

Return ONLY a JSON object — no markdown, no code fence, no explanation:
{"result":"the condensed text"}`,
    user: (maskedText, { lengthRatio, originalText }) => {
      const ratio = lengthRatio ?? -0.3
      const text = originalText ?? maskedText
      const wordCount = countWords(text)
      const targetWords = Math.max(1, Math.round(wordCount * (1 + ratio)))
      const minWords = Math.max(1, Math.round(targetWords * 0.85))
      const maxWords = Math.round(targetWords * 1.1)
      return `Condense the following text. Current word count: ${wordCount}. TARGET: output MUST be ${minWords}–${maxWords} words. Count your words and stay strictly within this range:\n\n"""\n${maskedText}\n"""`
    },
  },
}

export const VALID_ACTIONS = Object.keys(ACTION_PROMPTS)

/**
 * Count words in text (splits on whitespace, filters empty strings).
 * Used for accurate length ratio calculation independent of LaTeX masking tokens.
 *
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Build system and user prompts for a transform action.
 *
 * @param {{ action: string, targetLanguage?: string, customInstruction?: string, maskedText: string, lengthRatio?: number, rewriteFidelity?: number, originalText?: string }} params
 * @returns {{ systemPrompt: string, userMessage: string }}
 */
function buildTransformPrompt(params) {
  const { action, targetLanguage, customInstruction, maskedText, lengthRatio, rewriteFidelity, originalText } = params
  const template = ACTION_PROMPTS[action]
  if (!template) {
    throw Object.assign(new Error(`Unknown transform action: ${action}`), { statusCode: 400 })
  }

  const systemPrompt = template.system
  const userMessage = template.user(maskedText, { targetLanguage, customInstruction, lengthRatio, rewriteFidelity, originalText })
  return { systemPrompt, userMessage }
}

export default { buildTransformPrompt, SUPPORTED_LANGUAGES, VALID_ACTIONS }