import { formatGitDate } from './format-date'
import { Modal } from 'react-bootstrap'

export type BlameLine = { hash: string; line: number; author: string; date: string; subject: string; text: string }

// Git determines authorship. This only decodes its documented line-porcelain
// records, which repeat metadata for each source line.
export function parseBlame(output: string): BlameLine[] {
  const rows: BlameLine[] = []
  let record: BlameLine | undefined
  for (const line of output.split('\n')) {
    const header = /^([a-f0-9]{40}|[a-f0-9]{64}) (\d+) (\d+)(?: \d+)?$/.exec(line)
    if (header) {
      record = { hash: header[1], line: Number(header[3]), author: '', date: '', subject: '', text: '' }
    } else if (record && line.startsWith('\t')) {
      rows.push({ ...record, text: line.slice(1) })
      record = undefined
    } else if (record && line.startsWith('author ')) record.author = line.slice(7)
    else if (record && line.startsWith('summary ')) record.subject = line.slice(8)
    else if (record && /^author-time -?\d+$/.test(line)) {
      const date = new Date(Number(line.slice(12)) * 1000)
      if (Number.isFinite(date.getTime())) record.date = date.toISOString()
    }
  }
  return rows
}

export default function BlameView({ path, output, busy, error, onCommit, onClose }: {
  path: string; output: string; busy: boolean; error: string
  onCommit: (hash: string) => void; onClose: () => void
}) {
  const rows = parseBlame(output)
  return <Modal className="native-git-dialog" show size="xl" onHide={onClose} aria-label="Line authors">
    <Modal.Header closeButton><Modal.Title>{path} · Line authors</Modal.Title></Modal.Header>
    <Modal.Body className="native-git-blame">
      <p>Committed file version. Select a commit to view its changes.</p>
      {error && <p role="alert" className="native-git-error">{error}</p>}
      {!rows.length ? <p>No committed lines.</p> : <table>
        <thead><tr><th>Line</th><th>Author / date</th><th>Commit</th><th>Content</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.line}>
          <td>{row.line}</td>
          <td><span>{row.author}</span><time dateTime={row.date} title={formatGitDate(row.date)}>{row.date ? formatGitDate(row.date) : ''}</time></td>
          <td><button className="btn btn-secondary" type="button" disabled={busy} title={row.subject} onClick={() => onCommit(row.hash)}>{row.hash.slice(0, 8)}</button><span className="native-git-blame-subject">{row.subject}</span></td>
          <td><code>{row.text || ' '}</code></td>
        </tr>)}</tbody>
      </table>}
    </Modal.Body>
  </Modal>
}
