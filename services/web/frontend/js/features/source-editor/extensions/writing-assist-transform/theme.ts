import { EditorView } from '@codemirror/view'

/**
 * Strip CM6's default .cm-tooltip styling (white bg, silver border, shadow)
 * from any .cm-tooltip that wraps our WA content.
 *
 * Previous approaches that failed:
 *  - CSS !important in baseTheme: CM6's baseTheme injects rules with equal
 *    specificity after ours, overriding them by DOM order.
 *  - MutationObserver on document.body: timing mismatch — observer may fire
 *    before [data-wa-tooltip] attribute is set or after CM6 restyles.
 *
 * Current approach (works): queueMicrotask in each tooltip's create() sets
 * inline styles on the .cm-tooltip ancestor. Inline styles ALWAYS win over
 * stylesheet rules regardless of specificity or injection order. The microtask
 * fires after CM6's synchronous DOM setup (wrap + insert) completes, so
 * closest('.cm-tooltip') reliably finds the wrapper.
 */

/** Theme styles for the transform icon, vertical dropdown menu, and preview card. */
export const transformTheme = EditorView.baseTheme({
  // ── Icon tooltip (shown on selection after mouse-up) ──
  // Override CodeMirror's default tooltip styling that adds a rectangular
  // border + background around the sparkle icon button. CM's showTooltip
  // wraps our inner div in a .cm-tooltip container that gets default border/
  // bg. We neutralize it by setting the inner tooltip to be the visual
  // container and making the wrapper transparent via direct DOM styling in
  // toolbar.ts create().
  '.wa-transform-icon-tooltip': {
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    padding: '0',
  },
  '.wa-transform-trigger': {
    position: 'relative',
  },
  '.wa-transform-icon-btn': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: '1px solid var(--wa-themed-border, #e2e8f0)',
    borderRadius: '6px',
    background: 'var(--wa-themed-bg, #fff)',
    color: '#7c3aed',
    cursor: 'pointer',
    boxShadow: '0 1px 4px rgba(0,0,0,0.10)',
    padding: '0',
    outline: 'none',
    overflow: 'hidden',
    transition: 'box-shadow 0.15s, background 0.15s',
  },
  '&light .wa-transform-icon-btn:hover': {
    background: '#f5f3ff',
    boxShadow: '0 2px 8px rgba(124,58,237,0.18)',
  },
  '&dark .wa-transform-icon-btn:hover': {
    background: '#3b1f7a',
    boxShadow: '0 2px 8px rgba(124,58,237,0.30)',
  },
  '&light .wa-transform-icon-btn:focus-visible': {
    boxShadow: '0 0 0 2px rgba(124,58,237,0.4), 0 1px 4px rgba(0,0,0,0.10)',
  },
  '&dark .wa-transform-icon-btn:focus-visible': {
    boxShadow: '0 0 0 2px rgba(124,58,237,0.5), 0 1px 4px rgba(0,0,0,0.10)',
  },
  '.wa-transform-sparkle': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
  },

  // ── Vertical dropdown menu ──
  // The menu itself is a transparent flex container. Each child card (.wa-transform-card)
  // provides its own background/border/shadow, creating natural card-to-card visual
  // separation without a horizontal divider line.
  '.wa-transform-menu': {
    minWidth: '220px',
    background: 'transparent',
    border: 'none',
    borderRadius: '0',
    boxShadow: 'none',
    padding: '0',
    zIndex: '200',
    fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  // Each card group is a self-contained visual card (own background, border, shadow).
  '.wa-transform-card': {
    background: 'var(--wa-themed-bg, #fff)',
    border: '1px solid var(--wa-themed-border, #e2e8f0)',
    borderRadius: '10px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
    padding: '6px 0',
  },
  '&dark .wa-transform-card': {
    boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
  },

  // ── Custom instruction input (top card) ──
  '.wa-transform-custom-top-row': {
    display: 'flex',
    gap: '6px',
    padding: '8px 12px',
    alignItems: 'center',
  },
  '.wa-transform-custom-input': {
    flex: '1 1 auto',
    border: '1px solid var(--wa-themed-border, #d1d5db)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    outline: 'none',
    background: 'var(--wa-themed-bg, #fff)',
    color: 'var(--wa-themed-text, #374151)',
    minWidth: '120px',
    fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
  },
  '.wa-transform-custom-input:focus': {
    borderColor: '#7c3aed',
    boxShadow: '0 0 0 2px rgba(124,58,237,0.15)',
  },
  '.wa-transform-custom-submit': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '8px',
    background: '#7c3aed',
    color: '#fff',
    cursor: 'pointer',
    padding: '8px 10px',
    fontSize: '14px',
    fontWeight: '600',
    transition: 'background 0.12s',
    textDecoration: 'none',
    flexShrink: '0',
  },
  '&light .wa-transform-custom-submit:hover:not(:disabled)': {
    background: '#6d28d9',
  },
  '&dark .wa-transform-custom-submit:hover:not(:disabled)': {
    background: '#6d28d9',
  },
  '.wa-transform-custom-submit:disabled': {
    opacity: '0.5',
    cursor: 'default',
  },

  // ── Action card buttons ──
  '.wa-transform-menu-item': {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '7px 14px',
    border: 'none',
    background: 'transparent',
    color: 'var(--wa-themed-text, #374151)',
    cursor: 'pointer',
    fontSize: '13px',
    textAlign: 'left',
    textDecoration: 'none',
    outline: 'none',
    borderRadius: '6px',
    transition: 'background 0.12s',
    lineHeight: '1.4',
  },
  '&light .wa-transform-menu-item:hover': {
    background: '#ede9fe',
  },
  '&dark .wa-transform-menu-item:hover': {
    background: '#3b1f7a',
  },
  '.wa-transform-item-icon': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    color: '#7c3aed',
    flexShrink: '0',
    overflow: 'hidden',
  },
  '.wa-transform-item-label': {
    flex: '1 1 auto',
    textDecoration: 'none',
  },
  '.wa-transform-item-arrow': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    color: 'var(--wa-themed-text-muted, #9ca3af)',
    flexShrink: '0',
  },

  // ── Language sub-menu (nested vertically) ──
  '.wa-transform-lang-list': {
    paddingLeft: '44px',
    paddingBottom: '4px',
  },
  '.wa-transform-lang-item': {
    display: 'block',
    width: '100%',
    padding: '4px 12px',
    border: 'none',
    background: 'transparent',
    color: 'var(--wa-themed-text, #374151)',
    cursor: 'pointer',
    fontSize: '12px',
    textAlign: 'left',
    textDecoration: 'none',
    outline: 'none',
    transition: 'background 0.12s',
    borderRadius: '3px',
    lineHeight: '1.5',
  },
  '&light .wa-transform-lang-item:hover': {
    background: '#ede9fe',
  },
  '&dark .wa-transform-lang-item:hover': {
    background: '#3b1f7a',
  },

  // ── Length ratio control for expand (green) / condense (red) ──
  '.wa-transform-menu-item-row': {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
    padding: '6px 14px',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  // Expand: light green
  '.wa-transform-ratio-inline': {
    flex: '1 1 auto',
    accentColor: '#22c55e',
    height: '4px',
    minWidth: '50px',
    cursor: 'pointer',
  },
  // Condense: light red
  '.wa-transform-ratio-inline--condense': {
    accentColor: '#ef4444',
  },
  '.wa-transform-ratio-value': {
    fontSize: '12px',
    fontWeight: '600',
    color: '#22c55e',
    minWidth: '28px',
    textAlign: 'center',
    flexShrink: '0',
  },
  '.wa-transform-ratio-value--condense': {
    color: '#ef4444',
  },
  '.wa-transform-ratio-apply': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '6px',
    background: '#22c55e',
    color: '#fff',
    cursor: 'pointer',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'background 0.12s',
    flexShrink: '0',
  },
  '&light .wa-transform-ratio-apply:hover': {
    background: '#16a34a',
  },
  '&dark .wa-transform-ratio-apply:hover': {
    background: '#16a34a',
  },
  // Condense variant (light red)
  '.wa-transform-ratio-apply--condense': {
    background: '#ef4444',
  },
  '&light .wa-transform-ratio-apply--condense:hover': {
    background: '#dc2626',
  },
  '&dark .wa-transform-ratio-apply--condense:hover': {
    background: '#dc2626',
  },

  // ── Rewrite fidelity slider (light blue) ──
  '.wa-transform-fidelity-inline': {
    flex: '1 1 auto',
    accentColor: '#60a5fa',
    height: '4px',
    minWidth: '50px',
    cursor: 'pointer',
  },
  '.wa-transform-fidelity-value': {
    fontSize: '12px',
    fontWeight: '600',
    color: '#60a5fa',
    minWidth: '28px',
    textAlign: 'center',
    flexShrink: '0',
  },
  '.wa-transform-fidelity-apply': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    borderRadius: '6px',
    background: '#60a5fa',
    color: '#fff',
    cursor: 'pointer',
    padding: '4px 10px',
    fontSize: '12px',
    fontWeight: '600',
    transition: 'background 0.12s',
    flexShrink: '0',
  },
  '&light .wa-transform-fidelity-apply:hover': {
    background: '#3b82f6',
  },
  '&dark .wa-transform-fidelity-apply:hover': {
    background: '#3b82f6',
  },

  // ── Preview card styles ──
  // Base rule (no &light/&dark prefix) so the card always gets a background,
  // even if the editor lacks .cm-light/.cm-dark. The &dark override below
  // adjusts colors for dark mode.
  '.wa-transform-preview-tooltip': {
    background: 'var(--wa-themed-bg, #fff)',
    border: '1px solid var(--wa-themed-border, #e2e8f0)',
    borderRadius: '10px',
    padding: '10px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    zIndex: '100',
    maxWidth: '420px',
    fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
  },
  '&dark .wa-transform-preview-tooltip': {
    background: 'var(--wa-themed-bg, #1f2937)',
    border: '1px solid var(--wa-themed-border, #374151)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
  },
  '.wa-transform-preview': {
    fontSize: '13px',
    lineHeight: '1.5',
  },
  '.wa-transform-preview-loading': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  '.wa-transform-spinner': {
    width: '16px',
    height: '16px',
    border: '2px solid var(--wa-themed-border, #e2e8f0)',
    borderTopColor: '#7c3aed',
    borderRadius: '50%',
    animationName: 'wa-spin',
    animationDuration: '0.6s',
    animationTimingFunction: 'linear',
    animationIterationCount: 'infinite',
  },
  '.wa-transform-loading-text': {
    color: 'var(--wa-themed-text, #374151)',
  },
  '.wa-transform-preview-header': {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '4px',
  },
  '.wa-transform-preview-action': {
    fontWeight: '600',
    color: 'var(--wa-themed-text, #374151)',
  },
  // Scrollable diff content so Accept/Reject always visible
  '.wa-transform-diff-content': {
    padding: '4px 0',
    wordBreak: 'break-word',
    maxHeight: '200px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  '.wa-transform-diff-del': {
    color: '#dc2626',
    textDecoration: 'line-through',
    fontWeight: '500',
  },
  '.wa-transform-diff-add': {
    color: '#16a34a',
    fontWeight: '500',
  },
  '.wa-transform-diff-ctx': {
    color: 'var(--wa-themed-text, #374151)',
  },
  '.wa-transform-diff-arrow': {
    color: 'var(--wa-themed-text-muted, #9ca3af)',
    margin: '0 2px',
  },
  '.wa-transform-diff-unchanged': {
    color: 'var(--wa-themed-text, #374151)',
  },
  '.wa-transform-preview-actions': {
    display: 'flex',
    gap: '6px',
    marginTop: '8px',
  },
  '.wa-transform-btn-action': {
    padding: '5px 16px',
    border: '1px solid var(--wa-themed-border, #d1d5db)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    background: 'var(--wa-themed-bg, #fff)',
    color: 'var(--wa-themed-text, #374151)',
    textDecoration: 'none',
    transition: 'background 0.12s, box-shadow 0.12s',
    lineHeight: '1.4',
  },
  '.wa-transform-btn-accept': {
    background: '#16a34a',
    color: '#fff',
    borderColor: '#16a34a',
  },
  '&dark .wa-transform-btn-accept': {
    background: '#15803d',
    borderColor: '#15803d',
  },
  '.wa-transform-btn-reject': {
    background: '#dc2626',
    color: '#fff',
    borderColor: '#dc2626',
  },
  '&dark .wa-transform-btn-reject': {
    background: '#b91c1c',
    borderColor: '#b91c1c',
  },
  '.wa-transform-btn-retry': {
    background: '#7c3aed',
    color: '#fff',
    borderColor: '#7c3aed',
  },
  '&dark .wa-transform-btn-retry': {
    background: '#6d28d9',
    borderColor: '#6d28d9',
  },
  '.wa-transform-error-message': {
    color: '#dc2626',
    fontSize: '12px',
  },
  // Error state header
  '.wa-transform-error-header': {
    marginBottom: '4px',
  },
  '.wa-transform-error-action': {
    fontWeight: '600',
    color: '#dc2626',
  },
  '.wa-transform-btn-cancel': {
    background: 'transparent',
    color: 'var(--wa-themed-text, #374151)',
    borderColor: 'var(--wa-themed-border, #d1d5db)',
  },
})