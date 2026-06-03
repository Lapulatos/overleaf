import type { Extension } from '@codemirror/state'
import { transformToolbarExtension } from './toolbar'
import { transformPreviewField } from './preview'
import { transformRunner } from './transform-runner'
import { transformTheme } from './theme'

export interface WritingAssistTransformOptions {
  projectId: string
}

/**
 * Assembles all transform state fields, view plugin, and themes into a single
 * CodeMirror Extension. The toolbar and preview are controlled by their
 * respective StateFields + `showTooltip` providers; the runner ViewPlugin
 * listens for `requestTransformEffect` and calls the API.
 */
export function writingAssistTransform(
  options: WritingAssistTransformOptions
): Extension {
  const { projectId } = options

  if (!projectId) {
    // eslint-disable-next-line no-console
    console.warn('[WA-Transform] missing projectId')
    return []
  }

  // eslint-disable-next-line no-console
  console.log('[WA-Transform] init projectId:', projectId)

  return [
    transformToolbarExtension,
    transformPreviewField,
    transformRunner(projectId),
    transformTheme,
  ]
}