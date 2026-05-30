import { checkWriting } from '../../../utils/api/writing-assist'
import type { Category, Issue } from './types'

export type IssueCallback = (issues: Issue[]) => void

export class Checker {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private debounceMs: number
  private enabledCategories: Category[]
  private onIssues: IssueCallback
  private abortController: AbortController | null = null

  constructor(
    debounceMs: number,
    enabledCategories: Category[],
    onIssues: IssueCallback
  ) {
    this.debounceMs = debounceMs
    this.enabledCategories = enabledCategories
    this.onIssues = onIssues
  }

  updateConfig(debounceMs: number, enabledCategories: Category[]): void {
    this.debounceMs = debounceMs
    this.enabledCategories = enabledCategories
  }

  schedule(sentences: Array<{ text: string; hash: string }>): void {
    if (sentences.length === 0) return
    if (this.enabledCategories.length === 0) return

    if (this.debounceTimer) clearTimeout(this.debounceTimer)

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.execute(sentences)
    }, this.debounceMs)
  }

  private async execute(
    sentences: Array<{ text: string; hash: string }>
  ): Promise<void> {
    if (this.abortController) {
      this.abortController.abort()
    }
    this.abortController = new AbortController()

    try {
      const text = sentences.map(s => s.text).join('\n\n')
      const issues = await checkWriting(text, this.enabledCategories)
      this.onIssues(issues)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      // silently ignore other errors (non-blocking feature)
    } finally {
      this.abortController = null
    }
  }

  cancel(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }
}
