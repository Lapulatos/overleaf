import { EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import type { Extension } from '@codemirror/state'
import { ViewportTracker } from './viewport-tracker'
import { Checker } from './checker'
import { decorationField, setIssuesEffect } from './decorations'
import { waHoverTooltip } from './tooltip'
import type { Category, Issue, WritingAssistPublicConfig } from './types'
import { CATEGORY_ORDER } from './types'

export { CATEGORY_COLORS, CATEGORY_ORDER } from './types'
export type { Category, Issue, WritingAssistPublicConfig }

export interface WritingAssistOptions {
  projectId: string
  config: WritingAssistPublicConfig
}

class IssueStore {
  issues: Issue[] = []

  setIssues(issues: Issue[]): void {
    this.issues = issues
  }

  getIssuesAt(pos: number): Issue[] {
    return this.issues.filter(
      i => pos >= i.offset && pos <= i.offset + i.length
    )
  }
}

export function writingAssist(options: WritingAssistOptions): Extension {
  const { projectId, config } = options
  const tracker = new ViewportTracker(projectId)
  const store = new IssueStore()

  const checker = new Checker(
    config.debounceMs,
    enabledCategories(config),
    (issues) => {
      store.setIssues(issues)
      tracker.getCache().flush()
    }
  )

  const viewPlugin = ViewPlugin.fromClass(
    class {
      constructor(readonly view: EditorView) {
        setTimeout(() => this.check(), 100)
      }

      update(update: ViewUpdate) {
        if (update.viewportChanged || update.docChanged) {
          this.check()
        }
      }

      check() {
        const snapshot = tracker.update(this.view)
        if (snapshot && snapshot.unchecked.length > 0) {
          checker.schedule(snapshot.unchecked)
        }
        if (snapshot) {
          // Dispatch cached + new issues combined
          const allIssues: Issue[] = []
          for (const cached of snapshot.cachedIssues.values()) {
            allIssues.push(...cached)
          }
          allIssues.push(...store.issues)
          // Sort by offset for decoration rendering
          allIssues.sort((a, b) => a.offset - b.offset)
          this.view.dispatch({
            effects: setIssuesEffect.of(allIssues),
          })
        }
      }

      destroy() {
        checker.cancel()
      }
    }
  )

  return [
    viewPlugin,
    decorationField,
    waHoverTooltip((pos) => store.getIssuesAt(pos)),
  ]
}

function enabledCategories(config: WritingAssistPublicConfig): Category[] {
  return CATEGORY_ORDER.filter(c => config.categories[c])
}
