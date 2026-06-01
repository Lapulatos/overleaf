import {
  EditorView,
  Tooltip,
  showTooltip,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view'
import { StateField, StateEffect, Extension } from '@codemirror/state'
import type { Issue } from './types'
import { CATEGORY_COLORS } from './types'
import { applyIssue, dismissIssue } from './apply'
import { closeHoverEffect } from './effects'

const SENTENCE_BOUNDARY = /[.!?]\s|\n/
const CLOSE_DELAY_MS = 300

/**
 * Self-managed hover card for writing-assist issues.
 *
 * We do NOT use CodeMirror's built-in `hoverTooltip` because it closes the
 * tooltip the moment the pointer leaves the underlined span — there is no way
 * to keep it open for a grace period or while the pointer travels to the card.
 *
 * Instead a StateField holds the currently-shown issue as a `showTooltip`
 * Tooltip, and a ViewPlugin drives it from raw pointer events:
 *  - moving onto an underline shows that issue's card,
 *  - leaving the underline starts a 1.5s close timer,
 *  - entering the card cancels the timer; leaving the card restarts it.
 * This gives full control over close timing (the user's requested 1.5s delay)
 * and makes the Apply button reliably reachable.
 */

const setHoverIssue = StateEffect.define<{ issue: Issue; pos: number } | null>()

interface HoverResolver {
  issuesAt: (pos: number) => Issue[]
}

export function writingAssistHover(resolver: HoverResolver): Extension {
  const tooltipField = StateField.define<Tooltip | null>({
    create() {
      return null
    },
    update(value, tr) {
      for (const e of tr.effects) {
        if (e.is(closeHoverEffect)) return null
        if (e.is(setHoverIssue)) {
          if (e.value === null) return null
          return makeTooltip(e.value.issue, e.value.pos)
        }
      }
      // Keep the tooltip pinned to its position across doc changes by mapping.
      if (value && tr.docChanged) {
        return { ...value, pos: tr.changes.mapPos(value.pos) }
      }
      return value
    },
    provide: f => showTooltip.from(f),
  })

  const hoverPlugin = ViewPlugin.fromClass(
    class {
      private closeTimer: ReturnType<typeof setTimeout> | null = null
      shownPos: number | null = null
      private onCardEnter: () => void
      private onCardLeave: () => void

      constructor(readonly view: EditorView) {
        this.onCardEnter = () => this.cancelClose()
        this.onCardLeave = () => this.scheduleClose()
      }

      update(u: ViewUpdate) {
        // If the tooltip was force-closed (e.g. by apply), clear shownPos so the
        // same span can re-open its card on the next hover.
        if (u.state.field(tooltipField) === null && this.shownPos !== null) {
          this.shownPos = null
          this.cancelClose()
        }
      }

      // Schedule the tooltip to close after the grace period.
      scheduleClose() {
        this.cancelClose()
        this.closeTimer = setTimeout(() => {
          this.closeTimer = null
          this.shownPos = null
          this.view.dispatch({ effects: setHoverIssue.of(null) })
        }, CLOSE_DELAY_MS)
      }

      cancelClose() {
        if (this.closeTimer) {
          clearTimeout(this.closeTimer)
          this.closeTimer = null
        }
      }

      show(issue: Issue, pos: number) {
        this.cancelClose()
        if (this.shownPos === pos) return
        this.shownPos = pos
        this.view.dispatch({ effects: setHoverIssue.of({ issue, pos }) })
        // Attach hover handlers to the rendered card so moving onto it keeps it
        // open. The DOM appears next frame.
        requestAnimationFrame(() => this.bindCard())
      }

      bindCard() {
        // Only one writing-assist card exists at a time; find it anywhere in
        // the document (the tooltip may be portaled outside the editor DOM).
        const card = document.querySelector('.wa-card-root') as HTMLElement | null
        if (!card) return
        card.removeEventListener('mouseenter', this.onCardEnter)
        card.removeEventListener('mouseleave', this.onCardLeave)
        card.addEventListener('mouseenter', this.onCardEnter)
        card.addEventListener('mouseleave', this.onCardLeave)
      }

      handleMove(event: MouseEvent) {
        const target = event.target as HTMLElement | null
        // If the pointer is over the card itself, keep it open.
        if (target && target.closest('.wa-card-root')) {
          this.cancelClose()
          return
        }
        const mark = target && target.closest('.wa-mark')
        if (mark) {
          const pos = this.view.posAtDOM(mark)
          const issues = resolver.issuesAt(pos)
          if (issues.length > 0) {
            // Use the issue's own start so the card anchors consistently.
            this.show(issues[0], issues[0].offset)
            return
          }
        }
        // Not over a mark or the card → start the close grace period.
        if (this.shownPos !== null) this.scheduleClose()
      }

      destroy() {
        this.cancelClose()
      }
    },
    {
      eventHandlers: {
        mousemove(event) {
          this.handleMove(event)
        },
        mouseleave() {
          // Pointer left the editor entirely.
          if (this.shownPos !== null) this.scheduleClose()
        },
      },
    }
  )

  // Build a Tooltip object for an issue, anchored at `pos`.
  function makeTooltip(issue: Issue, pos: number): Tooltip {
    return {
      pos,
      above: true,
      strictSide: false,
      arrow: false,
      create(view: EditorView) {
        const root = document.createElement('div')
        root.className = 'wa-card-root'
        Object.assign(root.style, {
          // transparent padding bridges the gap between underline and card so
          // the pointer never crosses a dead zone with no element to hit.
          padding: '8px 12px',
          margin: '-8px -12px',
        } as CSSStyleDeclaration)

        const card = document.createElement('div')
        Object.assign(card.style, {
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
          padding: '10px 12px',
          maxWidth: '420px',
          font: "13px/1.5 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: '#1a202c',
        } as CSSStyleDeclaration)
        card.appendChild(buildCard(view, issue))
        root.appendChild(card)
        return { dom: root }
      },
    }
  }

  return [tooltipField, hoverPlugin]
}

function buildCard(view: EditorView, issue: Issue): HTMLElement {
  const cat = CATEGORY_COLORS[issue.category]
  const color = cat?.color ?? '#666'
  const docLen = view.state.doc.length
  const from = Math.max(0, Math.min(issue.offset, docLen))
  const to = Math.max(from, Math.min(issue.offset + issue.length, docLen))
  const original = view.state.sliceDoc(from, to)
  const corrected = issue.suggestion

  const card = document.createElement('div')

  const head = document.createElement('div')
  head.textContent = cat?.label ?? issue.category
  Object.assign(head.style, {
    color,
    fontWeight: '700',
    fontSize: '11px',
    letterSpacing: '0.02em',
    marginBottom: '6px',
  } as CSSStyleDeclaration)
  card.appendChild(head)

  const isMultiWord = /\s/.test(original.trim())

  if (!isMultiWord) {
    const line = document.createElement('div')
    line.style.marginBottom = '6px'
    const word = document.createElement('span')
    word.textContent = corrected
    Object.assign(word.style, {
      color,
      fontWeight: '700',
      fontSize: '15px',
    } as CSSStyleDeclaration)
    line.appendChild(word)
    card.appendChild(line)
  } else {
    const sentence = enclosingSentence(view, from, to)
    card.appendChild(
      buildSentenceDiff(
        view.state.sliceDoc(sentence.from, sentence.to),
        from - sentence.from,
        to - sentence.from,
        corrected,
        color
      )
    )
  }

  if (issue.message) {
    const reason = document.createElement('div')
    reason.textContent = issue.message
    Object.assign(reason.style, {
      color: '#4a5568',
      marginTop: '6px',
    } as CSSStyleDeclaration)
    card.appendChild(reason)
  }

  const actions = document.createElement('div')
  Object.assign(actions.style, {
    marginTop: '8px',
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  } as CSSStyleDeclaration)

  const btn = document.createElement('button')
  btn.textContent = '应用修改'
  btn.title = '应用此修改建议'
  Object.assign(btn.style, {
    background: color,
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    padding: '3px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  } as CSSStyleDeclaration)
  btn.addEventListener('mousedown', e => {
    e.preventDefault()
    e.stopPropagation()
    applyIssue(view, issue)
  })
  actions.appendChild(btn)

  // Flexible spacer pushes the dismiss group to the right, giving a clearly
  // larger gap between "apply" (primary, left) and the dismiss group (right).
  const spacer = document.createElement('div')
  spacer.style.flex = '1 1 auto'
  spacer.style.minWidth = '24px'
  actions.appendChild(spacer)

  // Right group: "dismiss" (local — this occurrence only, not saved to Notes)
  // and "dismiss all" (global — adds a pattern to the Dismiss Notes). They sit
  // close together (small gap) to read as one group, distinct from apply.
  const group = document.createElement('div')
  Object.assign(group.style, {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
  } as CSSStyleDeclaration)

  const secondaryStyle = {
    background: 'transparent',
    color: '#718096',
    border: '1px solid #cbd5e0',
    borderRadius: '5px',
    padding: '3px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  } as CSSStyleDeclaration

  // Local dismiss: hide this suggestion at this spot only; the same sentence
  // elsewhere/later can still be flagged. NOT added to the Dismiss Notes.
  const dismissBtn = document.createElement('button')
  dismissBtn.textContent = 'dismiss'
  dismissBtn.title = '忽略当前这处（不加入忽略本子，相同句子之后仍可能提示）'
  Object.assign(dismissBtn.style, secondaryStyle)
  dismissBtn.addEventListener('mousedown', e => {
    e.preventDefault()
    e.stopPropagation()
    dismissIssue(view, issue, 'local')
  })
  group.appendChild(dismissBtn)

  // Global dismiss: add this sentence (as a diff-pattern) to the Dismiss Notes
  // so every matching sentence is skipped from now on.
  const dismissAllBtn = document.createElement('button')
  dismissAllBtn.textContent = 'dismiss all'
  dismissAllBtn.title = '忽略全部匹配的句子（加入忽略本子，后续不再提示）'
  Object.assign(dismissAllBtn.style, secondaryStyle)
  dismissAllBtn.addEventListener('mousedown', e => {
    e.preventDefault()
    e.stopPropagation()
    dismissIssue(view, issue, 'all')
  })
  group.appendChild(dismissAllBtn)

  actions.appendChild(group)
  card.appendChild(actions)

  return card
}

function buildSentenceDiff(
  sentence: string,
  relFrom: number,
  relTo: number,
  corrected: string,
  color: string
): HTMLElement {
  const wrap = document.createElement('div')
  Object.assign(wrap.style, {
    background: '#f7fafc',
    borderRadius: '5px',
    padding: '6px 8px',
    wordBreak: 'break-word',
  } as CSSStyleDeclaration)

  const before = document.createTextNode(sentence.slice(0, relFrom))
  const del = document.createElement('span')
  del.textContent = sentence.slice(relFrom, relTo)
  Object.assign(del.style, {
    color: '#e53e3e',
    fontWeight: '700',
    textDecoration: 'line-through',
  } as CSSStyleDeclaration)
  const add = document.createElement('span')
  add.textContent = corrected
  Object.assign(add.style, {
    color,
    fontWeight: '700',
    marginLeft: '3px',
  } as CSSStyleDeclaration)
  const after = document.createTextNode(sentence.slice(relTo))

  wrap.appendChild(before)
  wrap.appendChild(del)
  wrap.appendChild(add)
  wrap.appendChild(after)
  return wrap
}

function enclosingSentence(
  view: EditorView,
  from: number,
  to: number
): { from: number; to: number } {
  const docLen = view.state.doc.length
  const backStart = Math.max(0, from - 240)
  const backText = view.state.sliceDoc(backStart, from)
  let start = backStart
  for (let i = backText.length - 2; i >= 0; i--) {
    if (SENTENCE_BOUNDARY.test(backText.slice(i, i + 2))) {
      start = backStart + i + (backText[i] === '\n' ? 1 : 2)
      break
    }
  }
  const fwdEnd = Math.min(docLen, to + 240)
  const fwdText = view.state.sliceDoc(to, fwdEnd)
  let end = fwdEnd
  for (let i = 0; i < fwdText.length - 1; i++) {
    if (SENTENCE_BOUNDARY.test(fwdText.slice(i, i + 2))) {
      end = to + i + 1
      break
    }
  }
  return { from: start, to: end }
}
