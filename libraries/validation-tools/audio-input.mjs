const MAX_BYTES = 2 * 1024 * 1024
const MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/wav',
])

// Transport validation only. The transcription worker must separately enforce
// decoded duration and reject malformed media before inference.
export function validateAudio(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('An audio recording is required')
  }
  if (!MIME_TYPES.has(input.mime)) {
    throw new Error('Use a WebM, Ogg, MP4 or WAV audio recording')
  }
  if (!['en', 'zh'].includes(input.language)) {
    throw new Error('Choose English or Mandarin for transcription')
  }
  const data = input.data
  if (
    typeof data !== 'string' ||
    !data.length ||
    data.length > Math.ceil(MAX_BYTES / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      data
    )
  ) {
    throw new Error('Audio must be valid base64 and at most 2 MiB')
  }
  const bytes = Buffer.from(data, 'base64')
  if (bytes.length > MAX_BYTES || bytes.toString('base64') !== data) {
    throw new Error('Audio must be valid base64 and at most 2 MiB')
  }
  const signature = {
    'audio/webm': bytes.subarray(0, 4).toString('hex') === '1a45dfa3',
    'audio/ogg': bytes.subarray(0, 4).toString('ascii') === 'OggS',
    'audio/mp4': bytes.subarray(4, 8).toString('ascii') === 'ftyp',
    'audio/wav':
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WAVE',
  }
  if (!signature[input.mime])
    throw new Error('Audio does not match its declared format')
  return { mime: input.mime, language: input.language, data }
}
