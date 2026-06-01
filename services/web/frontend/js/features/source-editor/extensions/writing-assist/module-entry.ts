import type { Extension } from '@codemirror/state'
import { writingAssist } from './index'
import { DEFAULT_CONFIG } from '../../../../../../types/writing-assist'

/**
 * Module entry point for the Writing Assist CodeMirror extension.
 *
 * Registered via `overleafModuleImports.sourceEditorExtensions` in
 * `config/settings.defaults.js`. The editor consumes the `extension` named
 * export in `extensions/index.ts`, calling it with the full editor options
 * object. This adapter pulls the bits Writing Assist needs out of those
 * options so the feature is wired through Overleaf's module seam instead of a
 * hardcoded call in the core extensions list.
 */
export const extension = (options: Record<string, any>): Extension =>
  writingAssist({ projectId: options.projectId, config: DEFAULT_CONFIG })
