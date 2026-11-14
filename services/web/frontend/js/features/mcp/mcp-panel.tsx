import { useEffect, useState } from 'react'
import { getJSON, postJSON, putJSON, deleteJSON, FetchError } from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import { matchScore } from '@/features/plugins/plugin-groups'
import RailPanelHeader from '@/features/ide-react/components/rail/rail-panel-header'
import './mcp-panel.css'

// Official MCP logomark (the three symbol paths, without the wordmark):
// https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/logo/light.svg
export function McpRailIcon({ title = 'MCP' }: { title?: string }) {
  return <>
    <svg className="ide-rail-tab-link-icon mcp-icon" viewBox="0 0 195 195" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="12" strokeLinecap="round">
        <path d="M25 97.8528L92.8823 29.9706C102.255 20.598 117.451 20.598 126.823 29.9706C136.196 39.3431 136.196 54.5391 126.823 63.9117L75.5581 115.177" />
        <path d="M76.2653 114.47L126.823 63.9117C136.196 54.5391 151.392 54.5391 160.765 63.9117L161.118 64.2652C170.491 73.6378 170.491 88.8338 161.118 98.2063L99.7248 159.6C96.6006 162.724 96.6006 167.789 99.7248 170.913L112.331 183.52" />
        <path d="M109.853 46.9411L59.6482 97.1457C50.2757 106.518 50.2757 121.714 59.6482 131.087C69.0208 140.459 84.2168 140.459 93.5894 131.087L143.794 80.8822" />
      </g>
    </svg>
    <span className="visually-hidden">{title}</span>
  </>
}

type Configuration = { name: string; description: string } & (
  { transport: 'http'; url: string } | { transport: 'stdio'; command: string; args: string[] }
)
type Service = Configuration & { id: string; revision: number; status: 'disconnected' | 'verified'; verifiedAt?: string; tools?: { name: string; description: string }[] }
const api = '/writing-assist/mcp-services'
const demoUrl = 'http://overleaf-mcp-demo:3100/mcp'
type DemoResponse = { service: Service; result?: { isError?: boolean; content: { type: string; text?: string }[] } }
function errorMessage(error: unknown) {
  if (error instanceof FetchError && typeof error.data?.error === 'string') return error.data.error
  return 'Could not load or save MCP settings. Please retry.'
}

function ServiceForm({ service, busy, onSave, onCancel }: {
  service?: Service; busy: boolean; onSave: (value: Configuration) => void; onCancel: () => void
}) {
  const [name, setName] = useState(service?.name || '')
  const [description, setDescription] = useState(service?.description || '')
  const [transport, setTransport] = useState<'http' | 'stdio'>(service?.transport || 'http')
  const [url, setUrl] = useState(service?.transport === 'http' ? service.url : '')
  const [command, setCommand] = useState(service?.transport === 'stdio' ? service.command : '')
  const [args, setArgs] = useState(service?.transport === 'stdio' ? service.args.join('\n') : '')
  return <form className="mcp-form" onSubmit={event => {
    event.preventDefault()
    onSave({ name: name.trim(), description: description.trim(), ...(transport === 'http' ? { transport, url: url.trim() } : { transport, command: command.trim(), args: args ? args.split('\n') : [] }) })
  }}>
    <h3>{service ? 'Edit service' : 'Add service'}</h3>
    <fieldset disabled={busy}>
      <label>Name<input autoFocus required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></label>
      <label>Description<input maxLength={500} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <label>Transport<select value={transport} onChange={e => setTransport(e.target.value as 'http' | 'stdio')}><option value="http">Remote · HTTP</option><option value="stdio">Container · stdio</option></select></label>
      {transport === 'http' ? <label>Server URL<input type="url" required maxLength={2000} placeholder="https://example.org/mcp" value={url} onChange={e => setUrl(e.target.value)} /></label> : <>
        <label>Command<input required maxLength={500} placeholder="npx" value={command} onChange={e => setCommand(e.target.value)} /></label>
        <label>Arguments · one per line<textarea rows={3} maxLength={100000} placeholder={'-y\npackage-name'} value={args} onChange={e => setArgs(e.target.value)} /></label>
      </>}
      <p className="mcp-panel-caption">Configuration only. Nothing runs or connects when saved. Do not include passwords or tokens.</p>
      <div className="mcp-actions"><button className="mcp-primary" type="submit" disabled={!name.trim() || !(transport === 'http' ? url.trim() : command.trim())}>{busy ? 'Saving…' : 'Save service'}</button><button type="button" onClick={onCancel}>Cancel</button></div>
    </fieldset>
  </form>
}

function DemoTools({ service, busy, onCall }: { service: Service; busy: boolean; onCall: (id: string, name: string, args: Record<string, string>) => Promise<DemoResponse | undefined> }) {
  const [message, setMessage] = useState('Hello from Overleaf')
  const [result, setResult] = useState('')
  const [failed, setFailed] = useState(false)
  const call = async (name: string) => {
    setResult(''); setFailed(false)
    const response = await onCall(service.id, name, name === 'echo_message' ? { message } : {})
    if (response?.result) { setFailed(!!response.result.isError); setResult(response.result.content.filter(item => item.type === 'text').map(item => item.text || '').join('\n')) }
  }
  return <details className="mcp-tools"><summary>Tools · {service.tools?.length || 0}</summary>
    {service.tools?.map(tool => <div className="mcp-tool" key={tool.name}><strong>{tool.name}</strong><p>{tool.description}</p>
      {tool.name === 'echo_message' && <input aria-label="Echo message" maxLength={500} value={message} onChange={e => setMessage(e.target.value)} />}
      <button disabled={busy || (tool.name === 'echo_message' && !message)} onClick={() => call(tool.name)}>Try {tool.name === 'get_current_time' ? 'current time' : 'echo'}</button>
    </div>)}
    {result && <div role="status"><strong>{failed ? 'Tool returned an error' : 'MCP response'}</strong><pre className="mcp-tool-result">{result}</pre></div>}
  </details>
}

export default function McpPanel() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<Service | 'new' | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [refresh, setRefresh] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError('')
    getJSON<{ services: Service[] }>(api, { signal: controller.signal }).then(value => {
      if (!controller.signal.aborted) setServices(value.services)
    }).catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refresh])
  const save = async (configuration: Configuration) => {
    setBusy(true); setError('')
    try {
      const value = editing && editing !== 'new'
        ? await putJSON<Service>(`${api}/${editing.id}`, { body: { configuration, revision: editing.revision } })
        : await postJSON<Service>(api, { body: configuration })
      setServices(previous => [value, ...previous.filter(item => item.id !== value.id)])
      setEditing(null)
    } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  const remove = async (id: string) => {
    setBusy(true); setError('')
    try {
      await deleteJSON(`${api}/${id}`)
      setServices(previous => previous.filter(item => item.id !== id)); setDeleting(null)
    } catch (reason) { setError(errorMessage(reason)) } finally { setBusy(false) }
  }
  const demoAction = async (id?: string, name?: string, args?: Record<string, string>): Promise<DemoResponse | undefined> => {
    setBusy(true); setError('')
    try {
      if (!id) {
        const service = await postJSON<Service>(`${api}/demo`, { body: {} })
        setServices(previous => [service, ...previous.filter(item => item.id !== service.id)])
        return { service }
      }
      const response = await postJSON<DemoResponse>(`${api}/${id}/${name ? 'call' : 'probe'}`, { body: name ? { name, arguments: args } : {} })
      setServices(previous => previous.map(item => item.id === id ? response.service : item))
      return response
    } catch (reason) { setError(errorMessage(reason)); return undefined } finally { setBusy(false) }
  }
  const matches = services.map(service => ({ service, score: Math.max(matchScore(service.name, query), matchScore(service.description, query)) })).filter(item => item.score > 0).sort((a, b) => b.score - a.score)
  return <section className="mcp-panel" aria-label="MCP services">
    <RailPanelHeader title="MCP" actions={<>
      <OLIconButton icon="add" accessibilityLabel="Add MCP service" title="Add service" size="sm" disabled={busy || loading || !!editing} onClick={() => { setEditing('new'); setDeleting(null); setError('') }} />
      <OLIconButton icon="refresh" accessibilityLabel="Refresh MCP services" title="Refresh" size="sm" disabled={busy || loading || !!editing} onClick={() => setRefresh(value => value + 1)} />
    </>} />
    <div className="mcp-panel-body">
      <p className="mcp-panel-caption">Your services · available across your projects</p>
      {!loading && !services.some(item => item.transport === 'http' && item.url === demoUrl) && <button className="mcp-demo-add" disabled={busy || !!editing} onClick={() => demoAction()}>Add local demo</button>}
      <label className="mcp-search"><MaterialIcon type="search" /><input aria-label="Search MCP services" placeholder="Search services…" value={query} maxLength={100} onChange={e => setQuery(e.target.value)} /></label>
      {error && <div className="mcp-error" role="alert">{error}{!editing && <button disabled={busy || loading} onClick={() => setRefresh(value => value + 1)}>Retry</button>}</div>}
      {loading && <p role="status">Loading services…</p>}
      {editing && <ServiceForm key={editing === 'new' ? 'new' : editing.id} service={editing === 'new' ? undefined : editing} busy={busy} onSave={save} onCancel={() => { setEditing(null); setError('') }} />}
      {!loading && matches.map(({ service }) => <article key={service.id} className="mcp-card" aria-label={service.name}>
        <div className="mcp-card-heading"><h3>{service.name}</h3><span className="mcp-status">{service.verifiedAt ? 'Connection verified' : 'Not connected'}</span></div>
        {service.description && <p>{service.description}</p>}
        <div className="mcp-card-meta"><span>{service.transport === 'http' ? 'HTTP' : 'stdio'}</span><code title={service.transport === 'http' ? service.url : service.command}>{service.transport === 'http' ? service.url : service.command}</code></div>
        {service.verifiedAt && <p className="mcp-verified">Last test: {new Date(service.verifiedAt).toLocaleString()}</p>}
        <div className="mcp-actions">
          {service.transport === 'http' && service.url === demoUrl && <button disabled={busy || !!editing} onClick={() => demoAction(service.id)}><MaterialIcon type="link" />Test connection</button>}
          <button disabled={busy || !!editing} aria-label={`Edit ${service.name}`} onClick={() => { setEditing(service); setDeleting(null); setError('') }}><MaterialIcon type="edit" />Edit</button>
          <button disabled={busy || !!editing} aria-label={`Delete ${service.name}`} onClick={() => setDeleting(service.id)}><MaterialIcon type="delete" />Delete</button>
        </div>
        {service.transport === 'http' && service.url === demoUrl && service.tools?.length ? <DemoTools key={`${service.id}-${service.revision}`} service={service} busy={busy} onCall={demoAction} /> : null}
        {deleting === service.id && <div className="mcp-delete"><p>Delete this service configuration?</p><div className="mcp-actions"><button className="mcp-danger" disabled={busy} onClick={() => remove(service.id)}>Delete service</button><button disabled={busy} onClick={() => setDeleting(null)}>Cancel</button></div></div>}
      </article>)}
      {!loading && !error && !editing && matches.length === 0 && <div className="mcp-empty"><McpRailIcon /><h3>{services.length ? 'No matching services' : 'No MCP services yet'}</h3>{!services.length && <button className="mcp-primary" onClick={() => setEditing('new')}>Add service</button>}</div>}
      {!loading && services.length > 0 && <p className="mcp-panel-caption">The local demo supports connection tests and read-only calls. Paper Assistant access is not enabled yet.</p>}
    </div>
  </section>
}
