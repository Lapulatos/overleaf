import type { Category, Issue, WritingAssistPublicConfig } from '../../../../../../types/writing-assist'

export type { Category, Issue, WritingAssistPublicConfig }

/**
 * Per-category presentation. `color` drives both the strikethrough on the
 * original text and the inline suggestion chip; `priority` breaks ties when
 * spans overlap (higher wins / sorts first).
 */
export const CATEGORY_COLORS: Record<
  Category,
  { className: string; color: string; priority: number; label: string }
> = {
  correctness: { className: 'wa-correctness', color: '#e53e3e', priority: 10, label: '语法/拼写' },
  clarity:     { className: 'wa-clarity',     color: '#3182ce', priority: 8,  label: '清晰度' },
  conciseness: { className: 'wa-conciseness', color: '#d69e2e', priority: 6,  label: '简洁度' },
  delivery:    { className: 'wa-delivery',    color: '#38a169', priority: 4,  label: '语气' },
  engagement:  { className: 'wa-engagement',  color: '#805ad5', priority: 2,  label: '表达' },
}

export const CATEGORY_ORDER: Category[] = [
  'correctness', 'clarity', 'conciseness', 'delivery', 'engagement',
]
