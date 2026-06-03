import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { StateField, StateEffect, Extension } from '@codemirror/state'
import type { Progress } from './checker'
import { requestCheckEffect } from './effects'

/**
 * Self-managed status + manual-check control pinned to the bottom-right of the
 * editor.
 *
 * A small always-visible "检查" button lets the user trigger a check on demand
 * (e.g. to retry after a failure, or force a re-scan). Next to it a status area
 * reflects the live check state:
 *  - checking: spinner + "检查中 n/total" (button disabled)
 *  - done: brief ✓ (auto-hides after ~1.5s)
 *  - error: ⚠ "n 处检查失败" (button stays enabled to retry)
 *  - idle: just the button
 *
 * Rendered as a fixed-position overlay inside the editor scroll DOM so it never
 * depends on Overleaf status-bar wiring.
 */

const setProgress = StateEffect.define<Progress>()

const progressField = StateField.define<Progress>({
  create() {
    return { state: 'idle', total: 0, completed: 0, failed: 0 }
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setProgress)) return e.value
    }
    return value
  },
})

export function reportProgress(view: EditorView, p: Progress): void {
  view.dispatch({ effects: setProgress.of(p) })
}

export function writingAssistProgress(onCancel: () => void): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      dom: HTMLElement
      statusEl: HTMLElement
      btn: HTMLButtonElement
      stopBtn: HTMLButtonElement
      hideStatusTimer: ReturnType<typeof setTimeout> | null = null
      last = ''

      constructor(readonly view: EditorView) {
        this.dom = document.createElement('div')
        Object.assign(this.dom.style, {
          position: 'absolute',
          right: '12px',
          bottom: '12px',
          zIndex: '20',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '4px 6px 4px 10px',
          borderRadius: '16px',
          background: 'rgba(26,32,44,0.88)',
          color: '#fff',
          font: "12px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          userSelect: 'none',
          opacity: '0.85',
        } as CSSStyleDeclaration)

        const style = document.createElement('style')
        style.textContent = '@keyframes wa-spin{to{transform:rotate(360deg)}}'
        this.dom.appendChild(style)

        this.statusEl = document.createElement('span')
        this.statusEl.style.whiteSpace = 'nowrap'
        this.dom.appendChild(this.statusEl)

        // Stop button — visible only during checking
        this.stopBtn = document.createElement('button')
        this.stopBtn.type = 'button'
        this.stopBtn.title = '停止检查'
        Object.assign(this.stopBtn.style, {
          display: 'none',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(220,38,38,0.85)',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          padding: '3px 10px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
        } as CSSStyleDeclaration)
        this.stopBtn.textContent = '■ 停止'
        this.stopBtn.addEventListener('mousedown', e => {
          e.preventDefault()
          e.stopPropagation()
          // Call the cancel callback DIRECTLY (not via effect dispatch) so the
          // checker stops and the progress resets synchronously. Dispatching
          // cancelCheckEffect + then dispatching setProgress inside update()
          // creates a nested dispatch that CodeMirror may drop or defer.
          onCancel()
        })
        this.dom.appendChild(this.stopBtn)

        // Check button — visible when NOT checking
        this.btn = document.createElement('button')
        this.btn.type = 'button'
        this.btn.title = '立即检查写作建议（若有选区则只检查选中部分）'
        Object.assign(this.btn.style, {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(255,255,255,0.16)',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          padding: '3px 10px',
          fontSize: '12px',
          fontWeight: '600',
          cursor: 'pointer',
        } as CSSStyleDeclaration)
        this.btn.textContent = '↻ 检查'
        // mousedown (not click) so focus stays in the editor; preventDefault
        // keeps the cursor/selection intact.
        this.btn.addEventListener('mousedown', e => {
          e.preventDefault()
          e.stopPropagation()
          this.view.dispatch({ effects: requestCheckEffect.of(null) })
        })
        this.dom.appendChild(this.btn)

        // Mount on view.dom (the non-scrolling editor root, which CM sets
        // position:relative) rather than view.scrollDOM, so the button+status
        // stay pinned to the editor's bottom-right corner and never scroll away.
        view.dom.appendChild(this.dom)
        this.render(this.view.state.field(progressField))
      }

      update(u: ViewUpdate) {
        const p = u.state.field(progressField)
        const key = `${p.state}:${p.completed}/${p.total}:${p.failed}`
        if (key === this.last) return
        this.last = key
        this.render(p)
      }

      render(p: Progress) {
        if (this.hideStatusTimer) {
          clearTimeout(this.hideStatusTimer)
          this.hideStatusTimer = null
        }
        this.dom.style.background = 'rgba(26,32,44,0.88)'

        if (p.state === 'checking') {
          // Show stop button, hide check button
          this.stopBtn.style.display = 'inline-flex'
          this.btn.style.display = 'none'
          this.statusEl.innerHTML = ''
          const dot = document.createElement('span')
          Object.assign(dot.style, {
            display: 'inline-block',
            width: '10px',
            height: '10px',
            marginRight: '6px',
            verticalAlign: '-1px',
            border: '2px solid rgba(255,255,255,0.35)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'wa-spin 0.7s linear infinite',
          } as CSSStyleDeclaration)
          this.statusEl.appendChild(dot)
          this.statusEl.appendChild(
            document.createTextNode(`检查中 ${p.completed}/${p.total}`)
          )
          this.statusEl.style.display = 'inline-flex'
          return
        }

        // Not checking → show check button, hide stop button.
        this.btn.style.display = 'inline-flex'
        this.stopBtn.style.display = 'none'

        if (p.state === 'done') {
          this.statusEl.textContent = '✓ 检查完成'
          this.statusEl.style.display = 'inline'
          this.hideStatusTimer = setTimeout(() => {
            this.statusEl.style.display = 'none'
          }, 1500)
        } else if (p.state === 'error') {
          this.statusEl.textContent = `⚠ ${p.failed} 处检查失败`
          this.statusEl.style.display = 'inline'
          this.dom.style.background = 'rgba(197,48,48,0.92)'
        } else {
          // idle → just the button.
          this.statusEl.textContent = ''
          this.statusEl.style.display = 'none'
        }
      }

      destroy() {
        if (this.hideStatusTimer) clearTimeout(this.hideStatusTimer)
        this.dom.remove()
      }
    }
  )

  return [progressField, plugin]
}
