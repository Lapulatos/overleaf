import { EditorView, hoverTooltip } from '@codemirror/view'
import type { Issue, Category } from './types'
import { CATEGORY_COLORS } from './types'

export function waHoverTooltip(
  getIssues: (pos: number) => Issue[]
): ReturnType<typeof hoverTooltip> {
  return hoverTooltip((view, pos) => {
    const issues = getIssues(pos)
    if (issues.length === 0) return null

    return {
      pos,
      end: pos,
      above: true,
      create() {
        const dom = document.createElement('div')
        dom.className = 'wa-tooltip'

        const sorted = [...issues].sort(
          (a, b) =>
            (CATEGORY_COLORS[b.category]?.priority ?? 0) -
            (CATEGORY_COLORS[a.category]?.priority ?? 0)
        )

        for (const issue of sorted) {
          const cat = CATEGORY_COLORS[issue.category]
          const row = document.createElement('div')
          row.className = 'wa-tooltip-row'

          const indicator = document.createElement('span')
          indicator.className = 'wa-tooltip-indicator'
          indicator.style.color = cat.color
          indicator.textContent = '●'

          const body = document.createElement('div')
          body.className = 'wa-tooltip-body'

          const msg = document.createElement('div')
          msg.className = 'wa-tooltip-message'
          msg.textContent = issue.message

          const sugg = document.createElement('div')
          sugg.className = 'wa-tooltip-suggestion'
          sugg.textContent = `→ ${issue.suggestion}`

          body.appendChild(msg)
          body.appendChild(sugg)
          row.appendChild(indicator)
          row.appendChild(body)
          dom.appendChild(row)

          const applyBtn = document.createElement('button')
          applyBtn.className = 'wa-tooltip-apply'
          applyBtn.textContent = 'Apply'
          applyBtn.onclick = (e) => {
            e.stopPropagation()
            applySuggestion(view, issue)
            dom.remove()
          }
          row.appendChild(applyBtn)
        }

        return { dom }
      },
    }
  })
}

function applySuggestion(view: EditorView, issue: Issue): void {
  const from = issue.offset
  const to = from + issue.length
  view.dispatch({
    changes: { from, to, insert: issue.suggestion },
  })
}
