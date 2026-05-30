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
