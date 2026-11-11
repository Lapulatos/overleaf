import { formatGitDate } from './format-date'
import GitGraphIcon from './git-graph-icon'
import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { GraphSettingsDialog, defaultGraphSettings, type GraphSettings } from './graph-settings'
import GitTerminal from './git-terminal'
import RemoteSettings from './remote-settings'
import GraphHistory from './graph-history'
import { CommitFiles } from './commit-graph'
import { FileLabel, FileStatus, OpenFileIcon } from './file-presentation'
import MaterialIcon from '@/shared/components/material-icon'
import { errorMessage, type GitApi } from './api'
import type { CommitDetails, CommitFile, GitBranch, GitCommit, GitWebRemote } from './types'

type Details = CommitDetails & {
  hash: string; parents: string[]; author: string; email: string; committer: string; committerEmail: string
  authorDate: string; date: string; message: string
  files: (CommitFile & { insertions?: number | null; deletions?: number | null })[]
}
export default function EditorGraph({ api, commits, branches, currentRef, busy, hidden, webRemotes, onFile, onOpenFile, onCheckout, onClose, onRefresh }: {
  api: GitApi; commits: GitCommit[]; branches: GitBranch[]; currentRef: string; busy: boolean; hidden: boolean; webRemotes: GitWebRemote[]
  onCheckout?: (branch: GitBranch) => void
  onFile: (commit: GitCommit, file: CommitFile) => void; onOpenFile?: (path: string) => void; onClose: () => void; onRefresh: () => unknown
}) {
  const [settings, setSettings] = useState<GraphSettings>(defaultGraphSettings)
  const [settingsOpen, setSettingsOpen] = useState(false), [terminalOpen, setTerminalOpen] = useState(false), [credentialsOpen, setCredentialsOpen] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [remoteBusy, setRemoteBusy] = useState(false)
  useEffect(() => { let active = true; api.command({ command: 'graphSettings' }).then(result => { if (active && result.result && typeof result.result === 'object' && 'showRemotes' in result.result) setSettings({ ...defaultGraphSettings, ...result.result as GraphSettings }) }).catch(error => { if (active) setError(errorMessage(error)) }); return () => { active = false } }, [api])
  const [details, setDetails] = useState<Details>()
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tree, setTree] = useState(true)
  const request = useRef(0)
  useEffect(() => () => { request.current++ }, [])
  const cache = useRef(new Map<string, Details>())
  const select = async (hash: string) => {
    const generation = ++request.current
    if (hash === selected) { setSelected(''); setDetails(undefined); setLoading(false); setError(''); return }
    setSelected(hash); setError('')
    if (cache.current.has(hash)) { setDetails(cache.current.get(hash)); setLoading(false); return }
    setDetails(undefined); setLoading(true)
    try {
      const result = (await api.command({ command: 'commitDetails', ref: hash })).result as Details
      if (generation !== request.current) return
      cache.current.set(hash, result); setDetails(result)
    } catch (error) { if (generation === request.current) setError(errorMessage(error)) }
    finally { if (generation === request.current) setLoading(false) }
  }
  const host = document.getElementById('native-git-editor-diff-host')
  if (!host) return null
  const graphOptions = { showRemotes: settings.showRemotes, showTags: settings.showTags, showStashes: settings.showStashes, includeReflogs: settings.includeReflogs, firstParent: settings.firstParent, hiddenRemotes: settings.hiddenRemotes }
  const tools = <><label className="native-git-remote-toggle"><input type="checkbox" checked={settings.showRemotes} onChange={async e => { const value = { ...settings, showRemotes: e.target.checked }; setSettings(value); const { effectiveUser, ...saved } = value; try { await api.command({ command: 'saveGraphSettings', settings: saved }) } catch (error) { setError(errorMessage(error)) } }} />Show Remote Branches</label>
    <button className="native-git-icon-button" aria-label="Search commits or branches" title="Search commits or branches" onClick={() => host.querySelector<HTMLInputElement>('[aria-label="Search history"]')?.focus()}><MaterialIcon type="search" /></button>
    <button className="native-git-icon-button" aria-label="Open repository terminal" title="Open repository terminal" onClick={() => setTerminalOpen(value => !value)}><MaterialIcon type="terminal" /></button>
    <button className="native-git-icon-button" aria-label="Graph repository settings" title="Repository settings" onClick={() => setSettingsOpen(true)}><MaterialIcon type="settings" /></button>
    <button className="native-git-icon-button" aria-label="Fetch graph remotes" title="Fetch from remotes" disabled={busy || remoteBusy} onClick={async () => { setRemoteBusy(true); try { const remotes = (await api.command({ command: 'remotes' })).result as { name: string }[]; for (const remote of remotes) await api.command({ command: 'fetch', remote: remote.name }); await onRefresh() } catch (error) { setError(errorMessage(error)) } finally { setRemoteBusy(false) } }}><MaterialIcon type="cloud_download" /></button>
    <button className="native-git-icon-button" aria-label="Refresh Git Graph" title="Refresh" onClick={() => { void onRefresh(); setRefresh(value => value + 1) }}><MaterialIcon type="refresh" /></button></>
  const selectedCommit: GitCommit | undefined = details && { hash: details.hash, parents: details.parents, author: details.author, email: details.email, date: details.date, subject: details.message.split('\n')[0], refs: '' }
  const selectedDetails = selected && <section className="native-git-selected-commit" aria-label="Commit details">
      <div className="native-git-details-toolbar"><strong>Commit details</strong><span />
        <button type="button" className="native-git-icon-button" title={tree ? 'View files as List' : 'View files as Tree'} aria-label={tree ? 'View files as List' : 'View files as Tree'} onClick={() => setTree(value => !value)}><MaterialIcon type={tree ? 'format_list_bulleted' : 'account_tree'} /></button>
        <button type="button" className="native-git-icon-button" title="Close commit details" aria-label="Close commit details" onClick={() => { request.current++; setSelected(''); setDetails(undefined) }}>×</button>
      </div>
      {loading && <p role="status">Loading commit details…</p>}
      {error && <p role="alert">{error}</p>}
      {details && <div className="native-git-details-columns">
        <div className="native-git-commit-metadata"><dl>
          <dt>Commit</dt><dd><code>{details.hash}</code></dd>
          <dt>Parents</dt><dd>{details.parents.length ? details.parents.map(parent => <button type="button" className="native-git-parent-link" key={parent} onClick={() => select(parent)}>{parent}</button>) : 'None (root commit)'}</dd>
          <dt>Author</dt><dd>{details.author} &lt;{details.email}&gt;</dd>
          <dt>Committer</dt><dd>{details.committer} &lt;{details.committerEmail}&gt;</dd>
          <dt>Date</dt><dd><time dateTime={details.date}>{formatGitDate(details.date)}</time></dd>
          <dt>Author date</dt><dd><time dateTime={details.authorDate}>{formatGitDate(details.authorDate)}</time></dd>
        </dl><pre className="native-git-full-message">{settings.issueUrl ? details.message.split(/(#[0-9]+)/).map((part, i) => /^#[0-9]+$/.test(part) ? <a key={i} href={settings.issueUrl.replace('{issue}', part.slice(1))} target="_blank" rel="noopener noreferrer">{part}</a> : part) : details.message}</pre>{settings.pullRequestUrl && branches.filter(branch => !branch.remote && !branch.tag && branch.commit === details.hash).map(branch => <a key={branch.ref} className="btn btn-link btn-sm" href={settings.pullRequestUrl.replace('{branch}', encodeURIComponent(branch.name))} target="_blank" rel="noopener noreferrer">Open pull request form · {branch.name}</a>)}</div>
        <div className="native-git-detail-files"><p>{details.files.length} files changed · <span className="native-git-status-A">+{details.insertions}</span> · <span className="native-git-status-D">−{details.deletions}</span>{details.parents.length > 1 && ' · Compared with first parent'}</p>
          <CommitFiles tree={tree} files={details.files} renderFile={file => <div className="native-git-graph-file-row" key={file.path}>
            <button type="button" className="native-git-graph-file" title={file.path} aria-label={`View diff ${file.path}`} onClick={() => selectedCommit && onFile(selectedCommit, file)}><FileLabel path={file.path} /></button>
            {onOpenFile && <button type="button" className="native-git-icon-button native-git-open-file" aria-label={`Open file ${file.path}`} title="Open file in editor" onClick={() => onOpenFile(file.path)}><OpenFileIcon /></button>}
            <FileStatus status={file.status} /><span className="native-git-file-stat">{file.insertions === null ? 'Binary' : <><span className="native-git-status-A">+{file.insertions ?? 0}</span> / <span className="native-git-status-D">−{file.deletions ?? 0}</span></>}</span>
          </div>} />
        </div>
      </div>}
    </section>
  return createPortal(<section className="native-git-editor-diff native-git-full-graph" role="region" aria-label="Git Graph" style={hidden ? { display: 'none' } : undefined}>
    <header className="native-git-editor-diff-tab"><GitGraphIcon /><strong>{settings.name ? `${settings.name} · Git Graph` : 'Git Graph'}</strong><button type="button" className="native-git-icon-button" title="Return to editor" aria-label="Close Git Graph" onClick={onClose}>×</button></header>
    <div className="native-git-full-history"><GraphHistory key={refresh} inlineToolbar extraTools={tools} graphOptions={graphOptions} initialSelection={{ mode: settings.initialMode, refs: settings.initialRefs }} detailed onCheckout={onCheckout} selectedDetails={selectedDetails} selectedHash={selected} api={api} commits={commits} branches={branches.filter(branch => (settings.showRemotes || !branch.remote) && (settings.showTags || !branch.tag) && !settings.hiddenRemotes.some(name => branch.ref.startsWith(`refs/remotes/${name}/`)))} currentRef={currentRef} busy={busy} webRemotes={webRemotes} onSelect={commit => select(commit.hash)} onRefresh={onRefresh} /></div>
    {error && !selected && <p role="alert">{error}</p>}
    {terminalOpen && <GitTerminal api={api} onChanged={onRefresh} onClose={() => setTerminalOpen(false)} />}
    {settingsOpen && <GraphSettingsDialog api={api} value={settings} branches={branches} onSave={setSettings} onClose={() => setSettingsOpen(false)} onCredentials={() => { setSettingsOpen(false); setCredentialsOpen(true) }} />}
    {credentialsOpen && <RemoteSettings api={api} onClose={() => setCredentialsOpen(false)} />}

  </section>, host)
}
