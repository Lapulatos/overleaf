/** Fixed-width Git timestamps in the viewer's local timezone. */
export function formatGitDate(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '—'
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${String(date.getFullYear()).padStart(4, '0')} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
