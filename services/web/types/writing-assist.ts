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
  projectId: string;
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

export type AnalysisMode = 'lazy' | 'eager';

export interface WritingAssistUserConfig {
  enabled: boolean;
  provider: ProviderType;
  openai?: ProviderConfig;
  anthropic?: ProviderConfig;
  custom?: ProviderConfig;
  categories: CategoryToggles;
  debounceMs: number;
  // Max sentences checked concurrently.
  concurrency: number;
  // Per-sentence LLM request timeout, milliseconds.
  timeoutMs: number;
  // 'lazy' = check only the visible window (re-check on scroll); 'eager' =
  // check the visible window plus a wide look-ahead/behind margin.
  analysisMode: AnalysisMode;
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
  concurrency: number;
  timeoutMs: number;
  analysisMode: AnalysisMode;
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
  concurrency: 4,
  timeoutMs: 20000,
  analysisMode: 'lazy',
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
