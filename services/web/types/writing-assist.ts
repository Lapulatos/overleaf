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

// ── Transform (B-layer selection-based actions) ──

export const TRANSFORM_ACTIONS = [
  'polish',
  'translate',
  'rewrite',
  'custom',
  'expand',
  'condense',
] as const;

export type TransformAction = (typeof TRANSFORM_ACTIONS)[number];

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
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number]['code'];

export interface TransformRequest {
  text: string;
  action: TransformAction;
  targetLanguage?: SupportedLanguage;
  customInstruction?: string;
  /** Length ratio for expand/condense actions.
   *  Positive ratio = expand (0.0 < ratio <= 5.0): target ~len*(1+ratio)
   *  Negative ratio = condense (-0.8 <= ratio < 0): target ~len*(1+ratio)
   *  Soft constraint: actual output within 10% of target.
   */
  lengthRatio?: number;
  /** Rewrite fidelity for the rewrite action (0 <= fidelity < 1).
   *  Higher values keep the output closer to the original (light rephrase);
   *  lower values produce fundamentally different phrasing (full rewrite).
   *  0 = maximum divergence, ~0.9 = stay close to original.
   */
  rewriteFidelity?: number;
  projectId: string;
  context?: {
    before: string;
    after: string;
  };
}

export interface TransformResponse {
  result: string;
}

/** Describes a pending or completed transform preview in the editor. */
export interface TransformPreview {
  original: string;
  suggested: string;
  from: number;
  to: number;
  action: TransformAction;
}
