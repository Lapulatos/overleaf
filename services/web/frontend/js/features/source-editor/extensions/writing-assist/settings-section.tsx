import WritingAssistSettings from './config-panel'
import type { SettingsSection } from '@/features/settings/context/types'

/**
 * Module hook for `settingsModalEditorTabSections`.
 *
 * Returns a Writing Assist section appended to the editor tab of the settings
 * modal (alongside spell-check, tools, etc.).
 */
export default function writingAssistSettingsSection(): SettingsSection {
  return {
    key: 'writing-assist',
    title: 'Writing Assist',
    settings: [
      {
        key: 'writing-assist-config',
        component: <WritingAssistSettings />,
      },
    ],
  }
}
