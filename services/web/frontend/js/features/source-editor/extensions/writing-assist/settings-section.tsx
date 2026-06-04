import WritingAssistSettings from './config-panel'
import type { SettingsSection } from '@/features/settings/context/types'

/**
 * Settings section definition for Writing Assist.
 *
 * Previously used as a module hook for `settingsModalEditorTabSections`
 * (to embed WA inside the Editor tab). Now the WA settings are rendered
 * as a top-level tab in settings-modal-context.tsx, but this file is
 * kept for potential reuse if the section needs to be referenced elsewhere.
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
