import googleLogo from './calendar-icons/google.svg'
import icloudLogo from './calendar-icons/icloud.svg'
import { useState } from 'react'
import { calendarFile, type CalendarEntry } from './calendar-export'

export default function CalendarExportActions({ entries, name }: { entries: CalendarEntry[]; name: string }) {
  const [provider, setProvider] = useState('')
  function download(target: string) {
    const url = URL.createObjectURL(new Blob([calendarFile(entries, name)], { type: 'text/calendar;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${name.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 100)}.ics`
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); setProvider(target)
  }
  return <footer className="venue-calendar-export" aria-label={`Export ${name}`}>
    <div className="venue-calendar-export-buttons">{['Google Calendar', 'iCloud Calendar'].map(target => <button key={target} type="button" disabled={!entries.length} onClick={() => download(target)} title={`Download ${name} as .ics for ${target}`}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/></svg>
      <img src={target === 'Google Calendar' ? googleLogo : icloudLogo} alt="" aria-hidden="true"/>
      {target}
    </button>)}</div>
    {!entries.length && <small>No confirmed dates to export.</small>}
    {provider && <small role="status">.ics downloaded. {provider === 'Google Calendar' ? <>In <a href="https://calendar.google.com/calendar/u/0/r/settings/export" target="_blank" rel="noopener noreferrer">Google Calendar → Import &amp; export</a>, select this file and a destination calendar.</> : <>Open the file in Apple Calendar and choose an iCloud calendar.</>} This is a snapshot; later changes are not synced.</small>}
  </footer>
}
