import type { Extension } from '@codemirror/state'
import { writingAssistTransform } from './index'

/**
 * Module entry point for the Writing Assist Transform CodeMirror extension.
 *
 * Registered via `overleafModuleImports.sourceEditorExtensions` in
 * `config/settings.defaults.js`. The editor consumes the `extension` named
 * export, calling it with the full editor options object. This adapter pulls
 * out the bits Writing Assist Transform needs.
 */
export const extension = (options: Record<string, any>): Extension =>
  writingAssistTransform({ projectId: options.projectId })
