import type { Venue, DeadlineEvent } from './submission-deadlines'
import type { SequenceStep } from './submission-sequence'

export type CalendarEntry = { id: string; title: string; date: string; allDay: boolean; description: string; url?: string; location?: string }
const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,')
const utc = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
function validDay(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value }
function fold(line: string) {
  const lines: string[] = []; let current = '', bytes = 0
  for (const character of line) {
    const size = new TextEncoder().encode(character).length
    if (bytes + size > 75) { lines.push(current); current = ' '; bytes = 1 }
    current += character; bytes += size
  }
  lines.push(current); return lines.join('\r\n')
}
export function calendarFile(entries: CalendarEntry[], name: string, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Venues//Submission calendar//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${escapeText(name)}`]
  for (const event of new Map(entries.map(e => [e.id, e])).values()) {
    if (event.allDay ? !validDay(event.date) : !Number.isFinite(Date.parse(event.date))) continue
    const start = event.allDay ? event.date.replace(/-/g, '') : utc(event.date)
    const end = event.allDay ? new Date(Date.parse(event.date) + 86400000).toISOString().slice(0, 10).replace(/-/g, '') : utc(new Date(Date.parse(event.date) + 60000).toISOString())
    lines.push('BEGIN:VEVENT', `UID:${encodeURIComponent(event.id)}@venues.local`, `DTSTAMP:${utc(now.toISOString())}`, `DTSTART${event.allDay ? ';VALUE=DATE' : ''}:${start}`, `DTEND${event.allDay ? ';VALUE=DATE' : ''}:${end}`, `SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText(event.description)}`, 'TRANSP:TRANSPARENT')
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`)
    if (event.url && /^https?:\/\//i.test(event.url)) lines.push(`URL:${event.url.replace(/[\r\n]/g, '')}`)
    lines.push('END:VEVENT')
  }
  return [...lines, 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n'
}
function eventsFor(venue: Venue, events: DeadlineEvent[], track = '', id = venue.id): CalendarEntry[] {
  return events.flatMap(event => {
    const timed = Boolean(event.utc && Number.isFinite(Date.parse(event.utc)))
    if (!timed && !validDay(event.date || '')) return []
    const date = timed ? event.utc! : event.date!
    return [{ id: `${id}:${event.label}:${date}`, title: `${venue.title} ${venue.year || ''}${track ? ` · ${track}` : ''} · ${event.label}`.trim(), date, allDay: !timed, description: [venue.description, event.original, event.timezone, 'Check the official source for changes.'].filter(Boolean).join('\n'), url: venue.sourceUrl || venue.website || undefined, location: venue.place }]
  })
}
export function conferenceCalendarEntries(venues: Venue[]): CalendarEntry[] {
  return venues.filter(v => v.kind === 'conference').flatMap(v => [
    ...eventsFor(v, [...v.events, ...(v.milestones || [])], v.track?.title || v.round),
    ...(!v.track ? (v.trackSearch || []).flatMap(t => eventsFor(v, t.events, t.title, t.id)) : []),
  ]).filter((entry, index, entries) => entries.findIndex(e => e.id === entry.id) === index)
}
function localDay(stamp: number) { const d = new Date(stamp); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
export function planCalendarEntries(steps: SequenceStep[], projectId = 'local'): CalendarEntry[] {
  return steps.flatMap(step => {
    const v = step.venue
    const details = [step.reason, step.conflict, v.manuscriptVariant?.summary, 'Planning dates only. Subsequent submissions require rejection or effective withdrawal.'].filter(Boolean).join('\n')
    const entries = conferenceCalendarEntries([v])
    for (const [kind, stamp] of [['submission', step.start], ['review outcome', step.end]] as const) {
      if (!Number.isFinite(stamp)) continue
      const existing = entries.find(e => (e.allDay ? e.date === localDay(stamp!) : Date.parse(e.date) === stamp) && (kind === 'submission' ? /paper|submission/i.test(e.title) : /decision|notification|outcome/i.test(e.title)))
      if (existing) { existing.description += `\n${details}`; continue }
      const label = kind === 'review outcome' ? `${kind} (estimated)` : kind
      entries.push({ id: `plan:${projectId}:${v.id}:${kind}`, title: `${v.title} ${v.year || ''}${v.track ? ` · ${v.track.title}` : ''} · Planned ${label}`, date: v.kind === 'journal' ? localDay(stamp!) : new Date(stamp!).toISOString(), allDay: v.kind === 'journal', description: details, url: v.sourceUrl || v.website || undefined })
    }
    return entries
  })
}
