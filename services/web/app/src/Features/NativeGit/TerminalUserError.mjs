export function terminalUserError(error) {
 const message=String(error?.message || error || '')
 if (/ENOENT|no such file or directory/i.test(message)) return 'This terminal’s runtime record is unavailable. Refresh the session list and retry cleanup.'
 if (/terminal session expired/i.test(message)) return 'Terminal session expired. Open another session or create a new terminal.'
 if (/shell exited/i.test(message)) return 'Shell exited. Open another session or create a new terminal.'
 if (/\/(?:Users|home|var|private|tmp|opt|etc|mnt|srv)\/|[A-Z]:\\|Command failed:|\n\s+at\s|docker.*inspect|no such (?:object|container)/i.test(message) || message.length>300) return 'The terminal operation could not be completed. Refresh the session list and retry.'
 return message || 'The terminal operation could not be completed. Please retry.'
}
