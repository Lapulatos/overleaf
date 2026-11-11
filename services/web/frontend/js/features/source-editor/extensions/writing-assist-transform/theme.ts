import { EditorView } from "@codemirror/view";

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
  ".wa-transform-icon-tooltip": {
    background: "transparent",
    border: "none",
    boxShadow: "none",
    padding: "0",
  },
  ".wa-transform-trigger": {
    position: "relative",
  },
  ".wa-transform-icon-btn": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    border: "1px solid var(--wa-themed-border, #e2e8f0)",
    borderRadius: "6px",
    background: "var(--wa-themed-bg, #fff)",
    color: "#28613b",
    cursor: "pointer",
    boxShadow: "0 1px 4px rgba(0,0,0,0.10)",
    padding: "0",
    outline: "none",
    overflow: "hidden",
    transition: "box-shadow 0.15s, background 0.15s",
  },
  "&light .wa-transform-icon-btn:hover": {
    background: "#eef5ef",
    boxShadow: "0 2px 8px rgba(67,132,82,0.18)",
  },
  "&dark .wa-transform-icon-btn:hover": {
    background: "#203d2a",
    boxShadow: "0 2px 8px rgba(67,132,82,0.30)",
  },
  "&light .wa-transform-icon-btn:focus-visible": {
    boxShadow: "0 0 0 2px rgba(67,132,82,0.4), 0 1px 4px rgba(0,0,0,0.10)",
  },
  "&dark .wa-transform-icon-btn:focus-visible": {
    boxShadow: "0 0 0 2px rgba(67,132,82,0.5), 0 1px 4px rgba(0,0,0,0.10)",
  },
  ".wa-transform-sparkle": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: "1",
  },

  // One compact surface; secondary settings appear only when requested.
  ".wa-transform-menu": {
    width: "288px",
    maxWidth: "calc(100vw - 24px)",
    boxSizing: "border-box",
    maxHeight: "min(480px, calc(100vh - 48px))",
    overflowY: "auto",
    background: "var(--wa-themed-bg, #fff)",
    color: "var(--wa-themed-text, #28333d)",
    border: "1px solid var(--wa-themed-border, #dce1e5)",
    borderRadius: "12px",
    boxShadow:
      "0 8px 28px rgba(24, 35, 45, 0.14), 0 2px 6px rgba(24, 35, 45, 0.05)",
    padding: "8px",
    zIndex: "200",
    fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
    fontSize: "13px",
    lineHeight: "1.5",
  },
  ".wa-transform-menu *, .wa-transform-menu *::before, .wa-transform-menu *::after":
    { boxSizing: "border-box" },
  ".wa-transform-menu-header": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 4px 6px 8px",
    color: "var(--wa-themed-text-muted, #65717d)",
    fontSize: "11px",
    fontWeight: "600",
  },
  ".wa-transform-dismiss": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "26px",
    height: "26px",
    background: "transparent",
    color: "inherit",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
  },
  ".wa-transform-card": { padding: "4px 0", background: "transparent" },
  ".wa-transform-card + .wa-transform-card": {
    borderTop: "1px solid var(--wa-themed-border, #e7eaed)",
    marginTop: "6px",
    paddingTop: "6px",
  },
  ".wa-transform-custom-top-row": {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px",
    border: "1px solid var(--wa-themed-border, #dce1e5)",
    borderRadius: "8px",
  },
  ".wa-transform-custom-top-row:focus-within": {
    borderColor: "#438452",
    boxShadow: "0 0 0 2px rgba(67,132,82,0.10)",
  },
  ".wa-transform-custom-input": {
    flex: "1 1 auto",
    minWidth: "0",
    width: "100%",
    border: "none",
    outline: "none",
    boxShadow: "none",
    padding: "5px 7px",
    fontSize: "13px",
    background: "transparent",
    color: "inherit",
    fontFamily: "inherit",
  },
  ".wa-transform-custom-submit": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: "0",
    width: "30px",
    height: "30px",
    border: "none",
    borderRadius: "6px",
    background: "#28613b",
    color: "#fff",
    cursor: "pointer",
  },
  ".wa-transform-custom-submit:disabled": {
    background: "var(--wa-themed-border, #e8ecef)",
    color: "var(--wa-themed-text-muted, #8b959e)",
    cursor: "default",
  },
  ".wa-transform-menu-item": {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
    minHeight: "36px",
    padding: "7px 9px",
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "13px",
    textAlign: "left",
    lineHeight: "1.5",
    textDecoration: "none",
  },
  ".wa-transform-menu-item:hover, .wa-transform-menu-item[aria-expanded=true], .wa-transform-lang-item:hover, .wa-transform-dismiss:hover":
    { background: "rgba(100,120,110,0.09)" },
  ".wa-transform-menu button:focus-visible": {
    outline: "2px solid #438452",
    outlineOffset: "-2px",
  },
  ".wa-transform-item-icon": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "18px",
    color: "var(--wa-themed-text-muted, #65717d)",
    flexShrink: "0",
  },
  ".wa-transform-item-label": { flex: "1 0 auto", whiteSpace: "nowrap" },
  ".wa-transform-item-arrow": {
    display: "flex",
    color: "var(--wa-themed-text-muted, #87919a)",
    flexShrink: "0",
  },
  ".wa-transform-lang-list": {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "2px",
    padding: "4px 6px 6px 32px",
  },
  ".wa-transform-lang-item": {
    padding: "5px 8px",
    border: "none",
    borderRadius: "5px",
    background: "transparent",
    color: "inherit",
    fontFamily: "inherit",
    fontSize: "12px",
    textAlign: "left",
    cursor: "pointer",
  },
  ".wa-transform-settings": { padding: "6px 10px 10px 37px" },
  ".wa-transform-setting-caption": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    fontSize: "11px",
    color: "var(--wa-themed-text-muted, #65717d)",
    marginBottom: "6px",
  },
  ".wa-transform-setting-caption label": { margin: "0", fontWeight: "400" },
  ".wa-transform-setting-caption output": {
    padding: "0",
    color: "inherit",
    fontSize: "inherit",
    fontVariantNumeric: "tabular-nums",
  },
  ".wa-transform-setting-controls": {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  ".wa-transform-setting-controls input": {
    flex: "1 1 0",
    width: "0",
    minWidth: "0",
    accentColor: "#438452",
    cursor: "pointer",
  },
  ".wa-transform-setting-apply": {
    flexShrink: "0",
    padding: "5px 8px",
    border: "1px solid var(--wa-themed-border, #dce1e5)",
    borderRadius: "5px",
    color: "inherit",
    background: "transparent",
    fontFamily: "inherit",
    fontSize: "11px",
    whiteSpace: "nowrap",
    cursor: "pointer",
  },
  ".wa-transform-setting-apply:hover": { background: "rgba(100,120,110,0.09)" },

  '.wa-transform-source-under-review': { background: 'rgba(67,132,82,0.10)', borderBottom: '1px solid rgba(67,132,82,0.4)' },
  '.wa-transform-inline-review': {
    boxSizing: 'border-box', width: '100%', margin: '8px 0 12px', padding: '10px',
    border: '1px solid var(--wa-themed-border, #dce1e5)', borderLeft: '3px solid #438452',
    borderRadius: '6px', background: 'var(--wa-themed-bg, #fff)',
    fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
  },
  '.wa-transform-inline-review .wa-transform-diff-content': { maxHeight: 'none', padding: '0' },
  '.wa-transform-inline-review .paper-diff-scroll': { maxHeight: '340px' },
  '.wa-transform-inline-review .wa-transform-preview-header': { marginBottom: '8px' },
  '.wa-transform-inline-review .wa-transform-preview-actions': { justifyContent: 'flex-end', borderTop: '1px solid var(--wa-themed-border, #dce1e5)', paddingTop: '8px' },
  '.wa-transform-inline-review .wa-transform-btn-reject': { background: 'transparent', color: 'var(--wa-themed-text, #374151)', borderColor: 'var(--wa-themed-border, #dce1e5)' },

  // ── Preview card styles ──
  // Base rule (no &light/&dark prefix) so the card always gets a background,
  // even if the editor lacks .cm-light/.cm-dark. The &dark override below
  // adjusts colors for dark mode.
  ".wa-transform-preview-tooltip": {
    background: "var(--wa-themed-bg, #fff)",
    border: "1px solid var(--wa-themed-border, #e2e8f0)",
    borderRadius: "10px",
    padding: "10px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    zIndex: "100",
    maxWidth: "420px",
    fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
  },
  "&dark .wa-transform-preview-tooltip": {
    background: "var(--wa-themed-bg, #1f2937)",
    border: "1px solid var(--wa-themed-border, #374151)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.20)",
  },
  ".wa-transform-preview": {
    fontSize: "13px",
    lineHeight: "1.5",
  },
  ".wa-transform-preview-loading": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  ".wa-transform-spinner": {
    width: "16px",
    height: "16px",
    border: "2px solid var(--wa-themed-border, #e2e8f0)",
    borderTopColor: "#7c3aed",
    borderRadius: "50%",
    animationName: "wa-spin",
    animationDuration: "0.6s",
    animationTimingFunction: "linear",
    animationIterationCount: "infinite",
  },
  ".wa-transform-loading-text": {
    color: "var(--wa-themed-text, #374151)",
  },
  ".wa-transform-preview-header": {
    display: "flex",
    alignItems: "center",
    marginBottom: "4px",
  },
  ".wa-transform-preview-action": {
    fontWeight: "600",
    color: "var(--wa-themed-text, #374151)",
  },
  // Scrollable diff content so Accept/Reject always visible
  ".wa-transform-diff-content": {
    padding: "4px 0",
    wordBreak: "break-word",
    maxHeight: "200px",
    overflowY: "auto",
    paddingRight: "4px",
  },
  ".wa-transform-diff-del": {
    color: "#dc2626",
    textDecoration: "line-through",
    fontWeight: "500",
  },
  ".wa-transform-diff-add": {
    color: "#16a34a",
    fontWeight: "500",
  },
  ".wa-transform-diff-ctx": {
    color: "var(--wa-themed-text, #374151)",
  },
  ".wa-transform-diff-arrow": {
    color: "var(--wa-themed-text-muted, #9ca3af)",
    margin: "0 2px",
  },
  ".wa-transform-diff-unchanged": {
    color: "var(--wa-themed-text, #374151)",
  },
  ".wa-transform-preview-actions": {
    display: "flex",
    gap: "6px",
    marginTop: "8px",
  },
  ".wa-transform-btn-action": {
    padding: "5px 16px",
    border: "1px solid var(--wa-themed-border, #d1d5db)",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    background: "var(--wa-themed-bg, #fff)",
    color: "var(--wa-themed-text, #374151)",
    textDecoration: "none",
    transition: "background 0.12s, box-shadow 0.12s",
    lineHeight: "1.4",
  },
  ".wa-transform-btn-accept": {
    background: "#16a34a",
    color: "#fff",
    borderColor: "#16a34a",
  },
  "&dark .wa-transform-btn-accept": {
    background: "#15803d",
    borderColor: "#15803d",
  },
  ".wa-transform-btn-reject": {
    background: "#dc2626",
    color: "#fff",
    borderColor: "#dc2626",
  },
  "&dark .wa-transform-btn-reject": {
    background: "#b91c1c",
    borderColor: "#b91c1c",
  },
  ".wa-transform-btn-retry": {
    background: "#7c3aed",
    color: "#fff",
    borderColor: "#7c3aed",
  },
  "&dark .wa-transform-btn-retry": {
    background: "#6d28d9",
    borderColor: "#6d28d9",
  },
  ".wa-transform-error-message": {
    color: "#dc2626",
    fontSize: "12px",
  },
  // Error state header
  ".wa-transform-error-header": {
    marginBottom: "4px",
  },
  ".wa-transform-error-action": {
    fontWeight: "600",
    color: "#dc2626",
  },
  ".wa-transform-btn-cancel": {
    background: "transparent",
    color: "var(--wa-themed-text, #374151)",
    borderColor: "var(--wa-themed-border, #d1d5db)",
  },
});
