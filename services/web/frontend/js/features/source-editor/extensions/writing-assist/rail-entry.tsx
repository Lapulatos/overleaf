import DismissNotebookPanel from './dismiss-panel'
import type { RailElement } from '@/features/ide-react/util/rail-types'

/**
 * Module hook for `railEntries` — adds the writing-assist "Dismiss Notes"
 * tab to the editor's left rail. Registered in
 * `config/settings.defaults.js`; the rail spreads `...moduleRailEntries`
 * immediately after the Chat tab, so this entry lands directly below Chat as
 * requested.
 *
 * `key` is 'writing-assist-dismissed' (added to the RailTabKey union in
 * rail-context.tsx). The 'block' icon reads as "ignore/blocked".
 */
const dismissRailEntry: RailElement = {
  key: 'writing-assist-dismissed',
  icon: 'block',
  title: 'Dismiss Notes',
  component: <DismissNotebookPanel />,
}

export default dismissRailEntry
