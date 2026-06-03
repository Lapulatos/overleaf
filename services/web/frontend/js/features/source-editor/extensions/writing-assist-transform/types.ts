import type {
  TransformAction,
  TransformPreview,
  SupportedLanguage,
} from '../../../../../../types/writing-assist'

export type { TransformAction, TransformPreview, SupportedLanguage }

export const SUPPORTED_LANGUAGES: readonly {
  code: SupportedLanguage
  name: string
}[] = [
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

/** Per-action metadata for the toolbar UI. */
export const ACTION_META: Record<
  TransformAction,
  { label: string; icon: string }
> = {
  polish: { label: '润色', icon: 'sparkle' },
  translate: { label: '翻译', icon: 'translate' },
  rewrite: { label: '改写', icon: 'editNote' },
  custom: { label: '自定义', icon: 'tune' },
  expand: { label: '扩写', icon: 'unfoldMore' },
  condense: { label: '缩写', icon: 'unfoldLess' },
}

/** State of a transform request in the editor. */
export type TransformState =
  | { status: 'idle' }
  | { status: 'loading'; from: number; to: number; action: TransformAction; targetLanguage?: SupportedLanguage; customInstruction?: string; lengthRatio?: number; rewriteFidelity?: number }
  | { status: 'preview'; preview: TransformPreview }
  | { status: 'error'; message: string; from: number; to: number; action: TransformAction; targetLanguage?: SupportedLanguage; customInstruction?: string; lengthRatio?: number; rewriteFidelity?: number }
