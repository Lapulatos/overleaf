import { EditorView } from '@codemirror/view'

/**
 * Writing Assist styling shipped as a CodeMirror baseTheme so the styles travel
 * with the JS chunk (no stylesheet-import wiring needed).
 *
 * The editor shows only a thick solid underline in the category colour under
 * the problematic span. Hovering the span adds a light category-tinted
 * background as an affordance; the suggestion/diff is shown in the hover card
 * (see tooltip.ts).
 */
export const writingAssistTheme = EditorView.baseTheme({
  '.wa-mark': {
    textDecorationLine: 'underline',
    textDecorationStyle: 'solid',
    textDecorationThickness: '2px',
    textUnderlineOffset: '2px',
    textDecorationSkipInk: 'none',
    cursor: 'pointer',
    borderRadius: '2px',
    transition: 'background-color 0.1s ease',
  },

  '.wa-mark-correctness': { textDecorationColor: '#e53e3e' },
  '.wa-mark-clarity': { textDecorationColor: '#3182ce' },
  '.wa-mark-conciseness': { textDecorationColor: '#d69e2e' },
  '.wa-mark-delivery': { textDecorationColor: '#38a169' },
  '.wa-mark-engagement': { textDecorationColor: '#805ad5' },

  // Lighter category-tinted background on hover.
  '.wa-mark-correctness:hover': { backgroundColor: 'rgba(229,62,62,0.15)' },
  '.wa-mark-clarity:hover': { backgroundColor: 'rgba(49,130,206,0.15)' },
  '.wa-mark-conciseness:hover': { backgroundColor: 'rgba(214,158,46,0.15)' },
  '.wa-mark-delivery:hover': { backgroundColor: 'rgba(56,161,105,0.15)' },
  '.wa-mark-engagement:hover': { backgroundColor: 'rgba(128,90,213,0.18)' },

  // The hover card's outer element IS the `.cm-tooltip` (CodeMirror adds that
  // class to our `.wa-card-root` node directly — it is not a wrapper). Strip
  // CodeMirror's default tooltip chrome here so only our inner rounded card
  // shows, with no redundant outer box.
  '.wa-card-root.cm-tooltip': {
    border: 'none',
    background: 'transparent',
    boxShadow: 'none',
    overflow: 'visible',
  },
  '.wa-card-root.cm-tooltip.cm-tooltip-below > .cm-tooltip-arrow, .wa-card-root.cm-tooltip > .cm-tooltip-arrow':
    {
      display: 'none',
    },
})
