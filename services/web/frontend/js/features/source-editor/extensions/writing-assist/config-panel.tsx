import { ChangeEvent, useCallback, useEffect, useState } from 'react'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLFormSelect from '@/shared/components/ol/ol-form-select'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import OLButton from '@/shared/components/ol/ol-button'
import { getConfig, saveConfig } from '@/utils/api/writing-assist'
import type {
  Category,
  ProviderType,
  AnalysisMode,
  UnderlineStyle,
  WritingAssistPublicConfig,
} from '../../../../../../types/writing-assist'
import './config-panel.css'

const PROVIDERS: { value: ProviderType; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
]

const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: 'correctness', label: 'Correctness (grammar, spelling)', color: '#e53e3e' },
  { key: 'clarity', label: 'Clarity (readability)', color: '#3182ce' },
  { key: 'conciseness', label: 'Conciseness (wordiness)', color: '#d69e2e' },
  { key: 'delivery', label: 'Delivery (tone)', color: '#38a169' },
  { key: 'engagement', label: 'Engagement (vividness)', color: '#805ad5' },
]

const UNDERLINE_STYLES: { value: UnderlineStyle; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'wavy', label: 'Wavy' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'dashed', label: 'Dashed' },
]

const DEFAULT_MODELS: Record<ProviderType, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-6',
  custom: '',
}

type CategoryState = Record<Category, boolean>

/**
 * Writing Assist settings section.
 *
 * Reads the per-user config from GET /writing-assist/config (API keys are
 * returned masked, never in full) and persists changes via PUT. An API key
 * field left blank keeps the previously stored key.
 */
export default function WritingAssistSettings() {
  const [loaded, setLoaded] = useState(false)
  const [config, setConfig] = useState<WritingAssistPublicConfig | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [provider, setProvider] = useState<ProviderType>('openai')
  const [model, setModel] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [hasKey, setHasKey] = useState(false)
  const [categories, setCategories] = useState<CategoryState>({
    correctness: true,
    clarity: true,
    conciseness: true,
    delivery: false,
    engagement: false,
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle'
  )
  const [concurrency, setConcurrency] = useState(4)
  const [timeoutSec, setTimeoutSec] = useState(20)
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('lazy')
  const [underlineStyle, setUnderlineStyle] = useState<UnderlineStyle>('solid')
  /** Auto-save underline style change immediately so the editor picks it up
   *  without requiring a full Save click. The underline effect depends on the
   *  CM6 theme compartment, which reads the persisted config on init + re-read
   *  on save. If the user just clicks a style button and closes the modal, the
   *  change must be in the DB for the next editor session to see it. */
  const onUnderlineStyleChange = useCallback((style: UnderlineStyle) => {
    setUnderlineStyle(style)
    // Persist just the underlineStyle change immediately (non-blocking; errors
    // are silently swallowed so the button click UX stays responsive).
    saveConfig({ underlineStyle: style })
      .then(() => {
        // Notify the live editor to reconfigure its theme compartment so the
        // underline effect changes immediately without a page reload.
        window.dispatchEvent(new CustomEvent('wa-style-change', { detail: style }))
      })
      .catch(() => {})
  }, [])

  const applyProvider = useCallback(
    (cfg: WritingAssistPublicConfig, p: ProviderType) => {
      const pc = cfg[p]
      setModel(pc?.model || DEFAULT_MODELS[p])
      setEndpoint((pc && 'endpoint' in pc && pc.endpoint) || '')
      setHasKey(Boolean(pc?.hasKey))
      setApiKey('')
    },
    []
  )

  useEffect(() => {
    let cancelled = false
    getConfig()
      .then(cfg => {
        if (cancelled) return
        setConfig(cfg)
        setEnabled(cfg.enabled)
        setProvider(cfg.provider)
        setCategories(prev => ({ ...prev, ...cfg.categories }))
        if (typeof cfg.concurrency === 'number') setConcurrency(cfg.concurrency)
        if (typeof cfg.timeoutMs === 'number') {
          setTimeoutSec(Math.round(cfg.timeoutMs / 1000))
        }
        if (cfg.analysisMode === 'lazy' || cfg.analysisMode === 'eager') {
          setAnalysisMode(cfg.analysisMode)
        }
        if (cfg.underlineStyle) {
          setUnderlineStyle(cfg.underlineStyle)
        }
        applyProvider(cfg, cfg.provider)
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [applyProvider])

  const onProviderChange = (p: ProviderType) => {
    setProvider(p)
    if (config) {
      applyProvider(config, p)
    } else {
      setModel(DEFAULT_MODELS[p])
      setEndpoint('')
      setHasKey(false)
      setApiKey('')
    }
  }

  const onSave = async () => {
    setStatus('saving')
    try {
      const providerConfig: {
        apiKey: string
        model: string
        endpoint?: string
      } = {
        apiKey, // blank keeps the stored key (backend skips empty)
        model: model || DEFAULT_MODELS[provider],
      }
      if (provider === 'custom' || endpoint) {
        providerConfig.endpoint = endpoint
      }

      await saveConfig({
        enabled,
        provider,
        categories,
        concurrency,
        timeoutMs: timeoutSec * 1000,
        analysisMode,
        underlineStyle,
        [provider]: providerConfig,
      })
      setStatus('saved')
      if (apiKey) setHasKey(true)
      setApiKey('')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
    }
  }

  if (!loaded) {
    return <div className="wa-settings">Loading Writing Assist settings…</div>
  }

  return (
    <div className="wa-settings">
      <OLFormGroup controlId="wa-enabled" className="mb-2">
        <OLFormCheckbox
          id="wa-enabled"
          checked={enabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setEnabled(e.target.checked)
          }
          label="Enable Writing Assist (real-time grammar & style check)"
        />
      </OLFormGroup>

      <OLFormGroup controlId="wa-provider">
        <OLFormLabel>LLM provider</OLFormLabel>
        <OLFormSelect
          value={provider}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            onProviderChange(e.target.value as ProviderType)
          }
        >
          {PROVIDERS.map(p => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </OLFormSelect>
      </OLFormGroup>

      <OLFormGroup controlId="wa-api-key">
        <OLFormLabel>API key</OLFormLabel>
        <OLFormControl
          type="password"
          value={apiKey}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setApiKey(e.target.value)
          }
          placeholder={hasKey ? '•••••••• (saved — leave blank to keep)' : 'sk-…'}
        />
      </OLFormGroup>

      <OLFormGroup controlId="wa-model">
        <OLFormLabel>Model</OLFormLabel>
        <OLFormControl
          type="text"
          value={model}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setModel(e.target.value)
          }
          placeholder={DEFAULT_MODELS[provider] || 'model name'}
        />
      </OLFormGroup>

      {provider === 'custom' && (
        <OLFormGroup controlId="wa-endpoint">
          <OLFormLabel>Endpoint URL</OLFormLabel>
          <OLFormControl
            type="text"
            value={endpoint}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setEndpoint(e.target.value)
            }
            placeholder="https://your-endpoint/v1"
          />
        </OLFormGroup>
      )}

      <OLFormGroup>
        <OLFormLabel>Check categories</OLFormLabel>
        {CATEGORIES.map(c => (
          <OLFormCheckbox
            key={c.key}
            id={`wa-cat-${c.key}`}
            checked={categories[c.key]}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setCategories(prev => ({ ...prev, [c.key]: e.target.checked }))
            }
            label={`${c.label}`}
          />
        ))}
      </OLFormGroup>

      <OLFormGroup controlId="wa-concurrency">
        <OLFormLabel>Concurrent sentence checks (1–12)</OLFormLabel>
        <OLFormControl
          type="number"
          min={1}
          max={12}
          value={String(concurrency)}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const v = parseInt(e.target.value, 10)
            if (!Number.isNaN(v)) setConcurrency(Math.min(12, Math.max(1, v)))
          }}
        />
      </OLFormGroup>

      <OLFormGroup controlId="wa-timeout">
        <OLFormLabel>Per-sentence timeout (seconds, 2–60)</OLFormLabel>
        <OLFormControl
          type="number"
          min={2}
          max={60}
          value={String(timeoutSec)}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const v = parseInt(e.target.value, 10)
            if (!Number.isNaN(v)) setTimeoutSec(Math.min(60, Math.max(2, v)))
          }}
        />
      </OLFormGroup>

      <OLFormGroup controlId="wa-analysis-mode">
        <OLFormLabel>Analysis scope</OLFormLabel>
        <OLFormSelect
          value={analysisMode}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setAnalysisMode(e.target.value as AnalysisMode)
          }
        >
          <option value="lazy">Visible area only (lazy, recommended)</option>
          <option value="eager">Visible area + wide margin (eager)</option>
        </OLFormSelect>
      </OLFormGroup>

      <OLFormGroup controlId="wa-underline-style">
        <OLFormLabel>Underline style</OLFormLabel>
        <div className="wa-underline-style-grid">
          {UNDERLINE_STYLES.map(s => (
            <button
              key={s.value}
              type="button"
              className={`wa-underline-style-option${underlineStyle === s.value ? ' active' : ''}`}
              onClick={() => onUnderlineStyleChange(s.value)}
              title={s.label}
            >
              <span className="wa-underline-style-label">Aa</span>
              <span
                className={`wa-underline-style-line wa-underline-${s.value}`}
              />
              <span className="wa-underline-style-name">{s.label}</span>
            </button>
          ))}
        </div>
      </OLFormGroup>

      <OLFormGroup className="mt-2">
        <OLButton
          variant="primary"
          onClick={onSave}
          disabled={status === 'saving'}
        >
          {status === 'saving' ? 'Saving…' : 'Save Writing Assist settings'}
        </OLButton>{' '}
        {status === 'saved' && <span style={{ color: '#059669' }}>Saved</span>}
        {status === 'error' && (
          <span style={{ color: '#e53e3e' }}>Save failed</span>
        )}
      </OLFormGroup>
    </div>
  )
}
