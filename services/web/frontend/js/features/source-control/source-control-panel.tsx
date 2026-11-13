import AutoSyncIndicator from './auto-sync-indicator'
import TerminalIndicators from './terminal-indicators'
import AutoCommitIndicator from './auto-commit-indicator'
import ToolAction from './tool-action'
import ReadOnlyHistory from './read-only-history'
import ProjectBackups from './project-backups'
import HistoryRecovery from './history-recovery'
import BranchWorkspaces from './branch-workspaces'
import AutoSyncSettings from './auto-sync-settings'
import AutoCommitSettings from './auto-commit-settings'
import ShellDrafts from './shell-drafts'
import RemoteDiscoveryStatus from './remote-discovery-status'
import SessionRecovery from './session-recovery'
import { formatGitDate } from './format-date'
import { sectionLayout } from './section-layout'
import { useFileTreePathContext } from '@/features/file-tree/contexts/file-tree-path'
import { FilePreview, hasVisualPreview, type FileVersions } from './file-preview'
import { FileLabel, FileStatus, OpenFileIcon } from './file-presentation'
import { EditorDiff, PatchComparison, type DiffVersions } from './editor-diff'
import type { CommitDetails, CommitFile } from './types'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Dropdown, Modal } from 'react-bootstrap'
import { createPortal } from 'react-dom'
import { Panel, PanelGroup, PanelResizeHandle, type ImperativePanelHandle, type ImperativePanelGroupHandle } from 'react-resizable-panels'
import RailPanelHeader from '@/features/ide-react/components/rail/rail-panel-header'
import { useProjectContext } from '@/shared/context/project-context'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import { withSavedEditor } from './editor-operation'
import BranchPicker, { BranchIcon } from './branch-picker'
import MaterialIcon from '@/shared/components/material-icon'
import { CommitFiles } from './commit-graph'
import EditorGraph from './editor-graph'
import GitGraphIcon from './git-graph-icon'
import ActionSubmenu from './action-submenu'
import { useRailContext } from '@/features/ide-react/context/rail-context'
import GraphHistory from './graph-history'
import RemoteSettings from './remote-settings'
import WorktreeManager, { type WorktreeEntry } from './worktree-manager'
import CollaborationTasks from './collaboration-tasks'
import MergeBranchPicker from './merge-branch-picker'
import ResetDialog, { type ResetPreview } from './reset-dialog'
import IgnoredFiles from './ignored-files'
import ConflictEditor, { type ConflictDetails } from './conflict-editor'
import BlameView from './blame-view'
import StashManager, { type StashEntry } from './stash-manager'
import ConnectRepository from './connect-repository'
import CloneRepository from './clone-repository'
import { errorMessage, gitApi, type GitApi, type GitCommand } from './api'
import type { BranchChoice, GitCommit, GitFile, GitSnapshot } from './types'
import './source-control.css'

type Action = { title: string; summary?: string; submitLabel?: string; fields: { key: string; label: string; value?: string; multiline?: boolean }[]; execute: (values: Record<string, string>) => Promise<unknown> }
type Hunk = { index: number; oldStart: number; newStart: number; lines: string[] }
type FileHunks = { text: string; fingerprint: string; hunks: Hunk[] }
type Diff = { title: string; text: string; loading?: boolean; error?: string; preview?: FileVersions; versions?: DiffVersions; file?: { path: string; staged: boolean; fingerprint: string; hunks: Hunk[] } }
const staged = (file: GitFile) => ![' ', '?', '!'].includes(file.index)
const unstaged = (file: GitFile) => ![' ', '!'].includes(file.workingTree)

export function SourceControlView({ api, onOpenFile, active = true, projectName = 'Repository', recoveryTools }: { recoveryTools?: ReactNode; projectName?: string; api: GitApi; onOpenFile?: (path: string) => Promise<void>; active?: boolean }) {
  const [snapshot, setSnapshot] = useState<GitSnapshot>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [refreshError, setRefreshError] = useState('')
  const [message, setMessage] = useState('')
  const [picker, setPicker] = useState(false)
  const [action, setAction] = useState<Action>()
  const [discard, setDiscard] = useState<{ path: string; fingerprint: string; text: string; untracked?: boolean }>()
  const [discardAll, setDiscardAll] = useState<{ paths: string[]; fingerprint: string; untracked: string[] }>()
  const [cloneOpen, setCloneOpen] = useState(false)
  const [submenu, setSubmenu] = useState<string>()
  const [repositoryMenuOpen, setRepositoryMenuOpen] = useState(false)
  const [changesMenuOpen, setChangesMenuOpen] = useState(false)
  const [graphOpen, setGraphOpen] = useState(false)
  useEffect(() => { if (!active) setGraphOpen(false) }, [active])
  const [gitOutput, setGitOutput] = useState<string>()
  const [changesTree, setChangesTree] = useState(false)
  const [changesSort, setChangesSort] = useState<'path' | 'name' | 'status'>('path')
  const [changeQueue, setChangeQueue] = useState<{ paths: string[]; staged: boolean }>()
  const [expandedCommits, setExpandedCommits] = useState<Record<string, boolean>>({})
  const [commitDetails, setCommitDetails] = useState<Record<string, CommitDetails>>({})
  const inspecting = useRef(new Set<string>())
  const [diff, setDiff] = useState<Diff>()
  const historyDiffCache = useRef(new Map<string, string>())
  const diffRequest = useRef(0)
  const openProjectFile = async (path: string) => {
    if (!onOpenFile) return
    try { await onOpenFile(path); closeDiff(); setError('') }
    catch (error) { setError(errorMessage(error)) }
  }
  const closeDiff = () => { diffRequest.current++; setDiff(undefined) }
  const [fileHistory, setFileHistory] = useState<{ path: string; commits: GitCommit[] }>()
  const [worktrees, setWorktrees] = useState<WorktreeEntry[]>()
  const [ignoredFiles, setIgnoredFiles] = useState<string[]>()
  const [resetOpen, setResetOpen] = useState(false)
  const [mergeTarget, setMergeTarget] = useState<string>()
  const [workspacesOpen, setWorkspacesOpen] = useState(false)
  const [mergeTasksOpen, setMergeTasksOpen] = useState(false)
  const [shellDraftsOpen, setShellDraftsOpen] = useState(false)
  const [mergeTaskId, setMergeTaskId] = useState<string>()
  const [conflict, setConflict] = useState<ConflictDetails>()
  const [blame, setBlame] = useState<{ path: string; output: string }>()
  const [stashIntent, setStashIntent] = useState<'apply'|'pop'|'drop'|'view'>()
  const [stashes, setStashes] = useState<StashEntry[]>()
  const [settings, setSettings] = useState(false)
  const branchButton = useRef<HTMLButtonElement>(null)
  const panelGroup = useRef<ImperativePanelGroupHandle>(null)
  const expandedSectionSizes = useRef([20, 45, 35])
  const collapseSection = (index: number) => {
    const previous = panelGroup.current?.getLayout()
    if (!previous || previous.length !== 4) return
    expandedSectionSizes.current[index] = previous[index]
    panelGroup.current?.setLayout(sectionLayout(previous, index, null, collapsedSize))
  }
  const expandSection = (index: number) => {
    const previous = panelGroup.current?.getLayout()
    if (!previous || previous.length !== 4) return
    panelGroup.current?.setLayout(sectionLayout(previous, index, expandedSectionSizes.current[index], collapsedSize))
  }
  const sectionGroup = useRef<HTMLDivElement>(null)
  const [collapsedSize, setCollapsedSize] = useState(6)
  const running = useRef(false)
  const revision = useRef(0)
  const alive = useRef(true)
  const connected = !!snapshot && snapshot.connected !== false

  useEffect(() => {
    const element = sectionGroup.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      const height = element.getBoundingClientRect().height
      if (height > 0) setCollapsedSize(Math.min(25, 2800 / height))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [connected])

  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    const version = ++revision.current
    api.status(controller.signal).then(value => {
      if (alive.current && revision.current === version) setSnapshot(value)
    }).catch(error => { if (!controller.signal.aborted) setError(errorMessage(error)) })
    return () => { alive.current = false; controller.abort() }
  }, [api])

  const run = useCallback(async (operation: () => Promise<GitSnapshot>) => {
    if (running.current) return
    running.current = true
    ++revision.current
    setBusy(true)
    setError('')
    try {
      const result = await operation()
      if (alive.current) { setSnapshot(previous => ({ ...previous, ...result })); setRefreshError('') }
      return result
    } catch (error) {
      if (alive.current) setError(errorMessage(error))
      // Git may have produced conflict files before returning an error.
      try {
        const value = await api.status()
        if (alive.current) {
          setSnapshot(value)
          // Native Git already started. Reveal recovery controls instead of
          // leaving the launch dialog open to run the operation a second time.
          if (value.status?.operation && value.status.conflicted.length) {
            setMergeTarget(undefined)
            setAction(undefined)
          }
        }
      } catch { /* Keep the original error visible. */ }
      return undefined
    } finally {
      running.current = false
      if (alive.current) setBusy(false)
    }
  }, [api])
  useEffect(() => {
    if (!connected) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let fetching = false
    let pending = false
    const controller = new AbortController()
    const refresh = async () => {
      timer = undefined
      if (!active) return
      if (running.current || fetching) {
        pending = true
        timer = setTimeout(refresh, 750)
        return
      }
      pending = false
      fetching = true
      const version = ++revision.current
      try {
        const value = await api.status(controller.signal)
        if (active && revision.current === version) {
          setSnapshot(value)
          setRefreshError('')
        }
      } catch (error) {
        if (active && revision.current === version && !controller.signal.aborted) setRefreshError(errorMessage(error))
      } finally {
        fetching = false
        if (active && pending) schedule()
      }
    }
    const schedule = () => {
      pending = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(refresh, 750)
    }
    const visible = () => { if (document.visibilityState === 'visible') schedule() }
    window.addEventListener('doc:changed', schedule)
    window.addEventListener('doc:saved', schedule)
    window.addEventListener('native-git-command-completed', schedule)
    window.addEventListener('focus', schedule)
    document.addEventListener('visibilitychange', visible)
    return () => {
      active = false
      controller.abort()
      if (timer) clearTimeout(timer)
      window.removeEventListener('doc:changed', schedule)
      window.removeEventListener('doc:saved', schedule)
      window.removeEventListener('native-git-command-completed', schedule)
      window.removeEventListener('focus', schedule)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [api, connected])

  const command = (body: GitCommand) => run(() => api.command(body))
  const status = snapshot?.status
  const indexFiles = status?.files.filter(file => staged(file) && !status.conflicted.includes(file.path)) || []
  const workingFiles = status?.files.filter(file => unstaged(file) && !status.conflicted.includes(file.path)) || []
  const conflictFiles = status?.files.filter(file => status.conflicted.includes(file.path)) || []

  const checkout = async (branch: BranchChoice) => {
    if (branch.current) { setPicker(false); return }
    const result = await run(async () => {
      if (branch.tag) return api.command({ command: 'checkoutDetached', ref: branch.ref })
      if (branch.remote) {
        const local = branch.name.slice(branch.name.indexOf('/') + 1)
        await api.command({ command: 'trackBranch', name: local, remoteRef: branch.ref })
        return api.command({ command: 'checkout', name: local })
      }
      return api.command({ command: 'checkout', name: branch.name })
    })
    if (result) { setPicker(false); closeDiff() }
  }
  const createBranch = (chooseBase: boolean) => {
    setPicker(false)
    setAction({ title: chooseBase ? 'Create new branch from…' : 'Create new branch',
      fields: [{ key: 'name', label: 'Branch name' }, ...(chooseBase ? [{ key: 'from', label: 'Starting branch, tag or commit', value: status?.branch || 'HEAD' }] : [])],
      execute: values => run(async () => {
        await api.command({ command: 'createBranch', name: values.name, from: values.from || 'HEAD' })
        return api.command({ command: 'checkout', name: values.name })
      }) })
  }
  const refAction = (title: string, name: string) => {
    setPicker(false)
    setAction({ title, fields: [{ key: 'ref', label: 'Branch, tag or commit' }], execute: values => command({ command: name, ref: values.ref }) })
  }
  const openIgnoredFiles = async () => {
    const response = await command({ command: 'ignoredFiles' })
    if (response) setIgnoredFiles(response.result as string[])
  }
  const amendCommit = () => commitVariant('staged', true)
  const mergeBranch = () => {
    if (status?.branch) { setError(''); setMergeTarget(status.branch) }
  }
  const remoteAction = (name: 'fetch' | 'pull' | 'push', publish = false, rebase = false) => {
    setAction({ title: publish ? 'Publish branch' : `${name[0].toUpperCase()}${name.slice(1)}`,
      fields: [{ key: 'remote', label: 'Remote', value: 'origin' },
        ...(name === 'fetch' ? [] : [{ key: 'branch', label: 'Branch', value: status?.branch || '' }])],
      ...(name === 'pull' && snapshot.collaboration?.drafts ? { summary: 'Fetch the remote branch and open a shared merge review. Files change only after you review and apply the task.', submitLabel: 'Fetch and review' } : {}),
      execute: async values => {
        const result = await command({ command: name, ...values, ...(name === 'push' ? { publish } : {}), ...(name === 'pull' ? { operationId: crypto.randomUUID(), ...(rebase ? { rebase: true } : {}) } : {}) })
        if (result?.reviewRequired && result.result && typeof result.result === 'object' && 'id' in result.result) {
          setMergeTaskId(String(result.result.id)); setMergeTasksOpen(true)
        }
        return result
      } })
  }
  const inspectCommit = async (commit: GitCommit) => {
    if (commitDetails[commit.hash] || inspecting.current.has(commit.hash)) return
    inspecting.current.add(commit.hash)
    try {
      const response = await api.command({ command: 'commitFiles', ref: commit.hash })
      if (alive.current) setCommitDetails(previous => ({ ...previous, [commit.hash]: response.result as CommitDetails }))
    } catch (error) { if (alive.current) setError(errorMessage(error)) }
    finally { inspecting.current.delete(commit.hash) }
  }
  const expandCommit = (commit: GitCommit) => {
    setExpandedCommits(previous => ({ ...previous, [commit.hash]: !previous[commit.hash] }))
    void inspectCommit(commit)
  }
  const openCommitFile = async (commit: GitCommit, file: CommitFile) => {
    const versions = { before: commit.parents[0] || 'Empty tree', after: commit.hash }
    if (!hasVisualPreview(file.path)) return openDiff(file.path, { command: 'commitFileDiff', ref: commit.hash, path: file.path }, versions)
    const request = ++diffRequest.current
    setDiff({ title: file.path, text: '', loading: true, versions })
    try {
      const result = await api.command({ command: 'commitFilePreview', ref: commit.hash, path: file.path })
      if (alive.current && request === diffRequest.current) setDiff({ title: file.path, text: '', preview: result.result as FileVersions, versions })
    } catch (error) {
      if (alive.current && request === diffRequest.current) setDiff({ title: file.path, text: '', error: errorMessage(error), versions })
    }
  }
  const openDiff = async (title: string, body: GitCommand, versions?: DiffVersions) => {
    const request = ++diffRequest.current
    const key = JSON.stringify(body)
    const cached = historyDiffCache.current.get(key)
    setDiff({ title, text: cached ?? '', loading: cached === undefined, versions })
    if (cached !== undefined) return
    try {
      const result = await api.command(body)
      if (typeof result.result !== 'string') throw new Error('Unable to read this diff')
      historyDiffCache.current.set(key, result.result)
      if (historyDiffCache.current.size > 10) historyDiffCache.current.delete(historyDiffCache.current.keys().next().value!)
      if (alive.current && request === diffRequest.current) setDiff({ title, text: result.result, versions })
    } catch (error) {
      if (alive.current && request === diffRequest.current) setDiff({ title, text: '', error: errorMessage(error), versions })
    }
  }
  const previewDiscard = async (path: string) => {
    const result = await command({ command: 'discardDetails', path })
    if (result?.result && typeof result.result === 'object') setDiscard(result.result as { path: string; fingerprint: string; text: string })
  }
  const openFileDiff = async (path: string, staged: boolean, request = ++diffRequest.current) => {
    const head = snapshot?.branches?.find(branch => branch.name === status?.branch)?.commit
    const versions = { before: staged ? `HEAD${head ? ' · ' + head : ''}` : 'Index (staged)', after: staged ? 'Index (staged)' : 'Working tree' }
    if (hasVisualPreview(path)) {
      setDiff({ title: path, text: '', loading: true, versions })
      const result = await command({ command: 'filePreview', path, staged })
      if (alive.current && request === diffRequest.current) {
        setDiff(result?.result ? { title: path, text: '', preview: result.result as FileVersions, versions } : { title: path, text: '', error: 'Unable to load file preview. Select the file to retry.' })
      }
      return
    }
    const result = await command({ command: 'fileHunks', path, staged })
    if (request === diffRequest.current && result?.result && typeof result.result === 'object') {
      const data = result.result as FileHunks
      setDiff({ title: path, text: data.text, versions, file: { path, staged, fingerprint: data.fingerprint, hunks: data.hunks } })
    }
  }
  const applyHunk = async (index: number) => {
    if (!diff?.file) return
    const request = diffRequest.current
    const { path, staged, fingerprint } = diff.file
    const result = await command({ command: 'applyHunks', path, staged, fingerprint, selected: [index] })
    if (result && request === diffRequest.current) await openFileDiff(path, staged, request)
  }
  const openWorktrees = async () => {
    const result = await command({ command: 'worktrees' })
    if (Array.isArray(result?.result)) setWorktrees(result.result as WorktreeEntry[])
  }
  const openStashes = async () => {
    setStashIntent(undefined)
    const result = await command({ command: 'stashes' })
    if (Array.isArray(result?.result)) setStashes(result.result as StashEntry[])
  }
  const openStashFor = async (intent: 'apply'|'pop'|'drop'|'view') => { await openStashes(); setStashIntent(intent) }
  const reloadStashes = async () => {
    const result = await command({ command: 'stashes' })
    if (Array.isArray(result?.result)) setStashes(previous => previous ? result.result as StashEntry[] : undefined)
  }
  const openConflict = async (path: string) => {
    const result = await command({ command: 'conflictDetails', path })
    if (result?.result && typeof result.result === 'object') setConflict(result.result as ConflictDetails)
  }
  const openBlame = async (path: string) => {
    const result = await command({ command: 'blame', path })
    if (typeof result?.result === 'string') {
      setFileHistory(undefined)
      setBlame({ path, output: result.result })
    }
  }
  const openFileHistory = async (path: string) => {
    const result = await command({ command: 'fileHistory', path })
    if (result && Array.isArray(result.result)) setFileHistory({ path, commits: result.result })
    return result
  }
  const commit = async () => {
    if (!message.trim() || !indexFiles.length) return
    await commitVariant('staged')
  }
  const files = (items: GitFile[], inIndex: boolean) => <CommitFiles tree={changesTree} files={[...items].sort((a, b) => { const key = (f: GitFile) => changesSort === 'name' ? f.path.split('/').pop()! : changesSort === 'status' ? (inIndex ? f.index : f.workingTree) : f.path; return key(a).localeCompare(key(b)) || a.path.localeCompare(b.path) })} renderFile={file => <div className="native-git-file" key={file.path}>
    <button type="button" className="native-git-file-name" disabled={busy}
      title={file.from ? `${file.from} → ${file.path}` : file.path}
      aria-label={file.path} onClick={() => { setChangeQueue(undefined); openFileDiff(file.path, inIndex) }}><FileLabel path={file.path} /></button>
    <span className="native-git-file-actions">
    {onOpenFile && <button type="button" className="native-git-icon-button" title="Open file in editor" aria-label={`Open file ${file.path}`} onClick={() => openProjectFile(file.path)}><OpenFileIcon /></button>}
    <button type="button" className="native-git-icon-button" disabled={busy || file.index === '?'}
      aria-label={`History ${file.path}`} title="View file history"
      onClick={() => openFileHistory(file.path)}>
      <svg className="native-git-history-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 8a7 7 0 1 1 0 5M3 3v5h5M10 6v4l3 2" />
      </svg></button>
    {!inIndex && <button type="button" className="native-git-icon-button" disabled={busy}
      aria-label={`Discard changes to ${file.path}`} title="Discard unstaged changes" onClick={() => previewDiscard(file.path)}><svg className="native-git-history-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M7 3L3 7l4 4M3 7h8a5 5 0 0 1 0 10" /></svg></button>}
    <button type="button" className="native-git-icon-button" disabled={busy}
      aria-label={`${inIndex ? 'Unstage' : 'Stage'} ${file.path}`} title={inIndex ? 'Unstage' : 'Stage'}
      onClick={() => command({ command: inIndex ? 'unstage' : 'stage', paths: [file.path] })}>{inIndex ? '−' : '+'}</button></span>
    <FileStatus status={inIndex ? file.index : file.workingTree} />
  </div>} />

  const commitVariant = async (scope: 'auto' | 'staged' | 'all', amend = false, signoff = false) => {
    const all = scope === 'all' || scope === 'auto' && !indexFiles.length
    const details = amend ? (await command({command:'amendDetails'}))?.result as {head:string;branch:string|null;message:string} | undefined : undefined
    if (amend && !details) return
    const preview = (await command({command:'commitPreview', all, amend, signoff}))?.result as {fingerprint:string;paths:string[]} | undefined
    if (!preview) return
    if (typeof preview.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(preview.fingerprint) || !Array.isArray(preview.paths) || preview.paths.some(path => typeof path !== 'string')) { setError('Could not load the commit preview. Refresh repository status and try again.'); return }
    setAction({title:`${amend ? 'Amend' : 'Commit'} ${all ? 'all changes' : 'staged changes'}${signoff ? ' (Signed Off)' : ''}`,submitLabel:amend?'Amend commit':'Commit',
      summary:`Files: ${preview.paths.join(', ') || '(no file changes)'}. ${all?'Includes tracked changes and untracked files.':'Includes only staged changes.'}${signoff?' Adds a Signed-off-by trailer using your configured Git identity.':''}${amend?' Replaces the latest commit; published history may be affected.':''}`,
      fields:[{key:'message',label:'Commit message',value:message || details?.message || '',multiline:true}],
      execute: async values => { const result=await command({command:'commit',fingerprint:preview.fingerprint,message:values.message,all,amend,signoff,...(details?{expectedHead:details.head,expectedBranch:details.branch}:{})});if(result)setMessage('');return result }})
  }
  const undoLastCommit = async () => {
    const preview=(await command({command:'undoDetails'}))?.result as (Omit<ResetPreview,'target'> & {target:string|null}) | undefined
    if(preview) setAction({title:'Undo Last Commit',summary:`Move ${preview.branch || 'HEAD'} from ${preview.head.slice(0,8)} to ${preview.target?.slice(0,8) || 'an unborn branch'}. Keep the changes staged and preserve project files.`,submitLabel:'Undo commit',fields:[],execute:()=>command({command:'undoCommit',fingerprint:preview.fingerprint})})
  }
  const createStash = (mode: 'tracked'|'include-untracked'|'staged') => setAction({title:mode==='staged'?'Stash Staged':mode==='include-untracked'?'Stash (Include Untracked)':'Stash',fields:[{key:'message',label:'Message',value:'Unfinished work'}],execute:values=>command({command:'stash',message:values.message,mode})})
  const latestStash = async (pop=false) => {
    const entries=(await command({command:'stashes'}))?.result as StashEntry[] | undefined
    if(!entries?.length) {setError('No stashes available.');return}
    await command({command:'applyStash',index:0,expectedHash:entries[0].hash,pop})
  }
  const dropAllStashes = async () => {
    const entries=(await command({command:'stashes'}))?.result as StashEntry[] | undefined
    if(!entries?.length) {setError('No stashes available.');return}
    setAction({title:'Drop All Stashes',submitLabel:'Delete all stashes',summary:`Permanently delete ${entries.length} saved stashes: ${entries.map(e=>e.message).join('; ')}. Project files stay unchanged.`,fields:[],execute:()=>command({command:'dropAllStashes',expectedHashes:entries.map(e=>e.hash)})})
  }
  const deleteRemoteRef = (kind:'branch'|'tag') => setAction({title:`Delete Remote ${kind==='branch'?'Branch':'Tag'}`,submitLabel:'Review deletion',fields:[{key:'remote',label:'Remote',value:'origin'},{key:'name',label:kind==='branch'?'Branch name':'Tag name'}],execute:async values=>{
    const item=(await command({command:'remoteRef',kind,...values}))?.result as {hash:string;ref:string} | undefined
    if(item) setAction({title:'Confirm remote deletion',submitLabel:'Delete remote reference',summary:`Delete ${values.remote}/${item.ref} at ${item.hash}. Local branches and tags stay unchanged.`,fields:[],execute:()=>command({command:'deleteRemoteRef',kind,...values,expectedHash:item.hash})})
    return undefined
  }})
  const sync = () => setAction({title:'Sync',summary:'Pull remote changes, then push the current branch. A pull failure or conflict stops the push.',fields:[{key:'remote',label:'Remote',value:'origin'},{key:'branch',label:'Branch',value:status?.branch || ''}],execute:values=>command({command:'sync',...values})})
  const subgroup = (label: string, children: ReactNode) => <ActionSubmenu label={label} open={submenu === label} onOpen={() => setSubmenu(label)} onClose={() => setSubmenu(undefined)}>{children}</ActionSubmenu>
  const showGitOutput = async () => { const result = await command({ command: 'gitOutput' }); if (typeof result?.result === 'string') setGitOutput(result.result) }
  const repositoryActions = () => <>
<Dropdown.Item onClick={() => remoteAction('pull')}>Pull…</Dropdown.Item>
<Dropdown.Item onClick={() => remoteAction('push')}>Push…</Dropdown.Item>
<Dropdown.Item onClick={() => { setError('');setCloneOpen(true) }}>Clone…</Dropdown.Item>
<Dropdown.Item onClick={() => setPicker(true)}>Checkout to…</Dropdown.Item>
<Dropdown.Item onClick={() => remoteAction('fetch')}>Fetch…</Dropdown.Item>
<Dropdown.Divider />
    {subgroup('Commit', <>
      {(['auto','staged','all'] as const).map(scope=><Dropdown.Item key={scope} disabled={!!status?.conflicted.length || !(scope==='staged'?indexFiles.length:status?.files.length)} onClick={()=>commitVariant(scope)}>{scope==='auto'?'Commit':scope==='staged'?'Commit Staged':'Commit All'}</Dropdown.Item>)}
      <Dropdown.Item disabled={!!status?.operation || !snapshot?.graph?.length} onClick={undoLastCommit}>Undo Last Commit</Dropdown.Item>
      <Dropdown.Item disabled={status?.operation !== 'rebase'} onClick={() => command({command:'continueOperation',operation:'rebase',action:'abort'})}>Abort Rebase</Dropdown.Item>
      <Dropdown.Divider />
      {(['auto','staged','all'] as const).map(scope=><Dropdown.Item key={scope} disabled={!!status?.operation || !!status?.conflicted.length || !snapshot?.graph?.length} onClick={()=>commitVariant(scope,true)}>{scope==='auto'?'Commit (Amend)':scope==='staged'?'Commit Staged (Amend)':'Commit All (Amend)'}</Dropdown.Item>)}
      <Dropdown.Divider />
      {(['auto','staged','all'] as const).map(scope=><Dropdown.Item key={scope} disabled={!!status?.conflicted.length || !(scope==='staged'?indexFiles.length:status?.files.length)} onClick={()=>commitVariant(scope,false,true)}>{scope==='auto'?'Commit (Signed Off)':scope==='staged'?'Commit Staged (Signed Off)':'Commit All (Signed Off)'}</Dropdown.Item>)}
      <Dropdown.Divider />
      <Dropdown.Item onClick={() => refAction('Cherry-pick commit', 'cherryPick')}>Cherry-pick…</Dropdown.Item>
      <Dropdown.Item onClick={() => refAction('Revert commit', 'revert')}>Revert commit…</Dropdown.Item>
      <Dropdown.Item disabled={!!status?.operation || !!status?.conflicted.length || !snapshot?.graph?.length} onClick={amendCommit}>Amend latest commit…</Dropdown.Item>
    </>)}
    {subgroup('Changes', <>
<Dropdown.Item onClick={openIgnoredFiles}>Ignored files…</Dropdown.Item>
<Dropdown.Item onClick={() => setAction({ title: 'File history', fields: [{ key: 'path', label: 'File path' }],
                execute: values => openFileHistory(values.path) })}>File history…</Dropdown.Item>
<Dropdown.Item disabled={!workingFiles.length} onClick={() => openChanges(workingFiles,false)}>Open Changes</Dropdown.Item>
<Dropdown.Item disabled={!workingFiles.length} onClick={() => command({command:'stage',paths:workingFiles.map(file=>file.path)})}>Stage All Changes</Dropdown.Item>
<Dropdown.Item disabled={!indexFiles.length} onClick={() => command({command:'unstage',paths:indexFiles.map(file=>file.path)})}>Unstage All Changes</Dropdown.Item>
<Dropdown.Item disabled={!workingFiles.length} onClick={previewDiscardAll}>Discard All Changes…</Dropdown.Item>
    </>)}
    {subgroup('Pull, Push', <>
<Dropdown.Item disabled={!status?.branch} onClick={sync}>Sync…</Dropdown.Item>
<Dropdown.Divider />

<Dropdown.Item onClick={() => remoteAction('pull')}>Pull</Dropdown.Item>
<Dropdown.Item onClick={() => remoteAction('pull',false,true)}>Pull (Rebase)…</Dropdown.Item>
<Dropdown.Item onClick={() => remoteAction('pull')}>Pull from…</Dropdown.Item>
<Dropdown.Item onClick={() => remoteAction('push')}>Push</Dropdown.Item>
<Dropdown.Item onClick={() => remoteAction('push')}>Push to…</Dropdown.Item>
<Dropdown.Divider />
<Dropdown.Item onClick={() => remoteAction('fetch')}>Fetch</Dropdown.Item>
<Dropdown.Item onClick={() => setAction({title:'Fetch (Prune)',fields:[{key:'remote',label:'Remote',value:'origin'}],execute:values=>command({command:'fetch',...values,prune:true})})}>Fetch (Prune)…</Dropdown.Item>
<Dropdown.Item onClick={() => run(async () => { const remotes=(await api.command({command:'remotes'})).result as {name:string}[]; for(const remote of remotes) await api.command({command:'fetch',remote:remote.name}); return api.status() })}>Fetch From All Remotes</Dropdown.Item>
    </>)}
    {subgroup('Branch', <>
<Dropdown.Item onClick={()=>deleteRemoteRef('branch')}>Delete Remote Branch…</Dropdown.Item>
<Dropdown.Item disabled={!status?.branch} onClick={mergeBranch}>Merge into current branch…</Dropdown.Item>
<Dropdown.Item onClick={() => refAction('Rebase onto', 'rebase')}>Rebase onto…</Dropdown.Item>
<Dropdown.Item disabled={!!status?.operation || !snapshot?.graph?.length} onClick={() => { setError(''); setResetOpen(true) }}>Reset current branch…</Dropdown.Item>
<Dropdown.Item disabled={!!status?.detached} onClick={() => remoteAction('push', true)}>Publish branch…</Dropdown.Item>

    </>)}
    {subgroup('Remote', <>
<Dropdown.Item onClick={() => setAction({ title: 'Add remote', fields: [
                { key: 'name', label: 'Remote name', value: 'origin' }, { key: 'url', label: 'HTTPS repository URL' }],
                execute: values => command({ command: 'addRemote', ...values }) })}>Add remote…</Dropdown.Item>
<Dropdown.Item onClick={() => setSettings(true)}>Remove Remote…</Dropdown.Item>
    </>)}
    {subgroup('Stash', <>
<Dropdown.Item onClick={()=>createStash('tracked')}>Stash</Dropdown.Item>
<Dropdown.Item onClick={()=>createStash('include-untracked')}>Stash (Include Untracked)</Dropdown.Item>
<Dropdown.Item disabled={!indexFiles.length} onClick={()=>createStash('staged')}>Stash Staged</Dropdown.Item>
<Dropdown.Divider />
<Dropdown.Item onClick={()=>latestStash()}>Apply Latest Stash</Dropdown.Item>
<Dropdown.Item onClick={()=>openStashFor('apply')}>Apply Stash…</Dropdown.Item>
<Dropdown.Item onClick={()=>latestStash(true)}>Pop Latest Stash</Dropdown.Item>
<Dropdown.Item onClick={()=>openStashFor('pop')}>Pop Stash…</Dropdown.Item>
<Dropdown.Divider />
<Dropdown.Item onClick={()=>openStashFor('drop')}>Drop Stash…</Dropdown.Item>
<Dropdown.Item onClick={dropAllStashes}>Drop All Stashes…</Dropdown.Item>
<Dropdown.Item onClick={()=>openStashFor('view')}>View Stash…</Dropdown.Item>
<Dropdown.Item onClick={openStashes}>Stashes…</Dropdown.Item>
    </>)}
    {subgroup('Tags', <>
<Dropdown.Item onClick={()=>deleteRemoteRef('tag')}>Delete Remote Tag…</Dropdown.Item>
<Dropdown.Item onClick={()=>setAction({title:'Push Tags',summary:'Push all local tags to the selected remote without replacing existing remote tags.',fields:[{key:'remote',label:'Remote',value:'origin'}],execute:values=>command({command:'pushTags',...values})})}>Push Tags…</Dropdown.Item>
<Dropdown.Item onClick={() => setAction({ title: 'Create tag', fields: [{ key: 'name', label: 'Tag name' },
                { key: 'ref', label: 'Branch or commit', value: 'HEAD' }],
                execute: values => command({ command: 'createTag', ...values }) })}>Create tag…</Dropdown.Item>
<Dropdown.Item onClick={() => setAction({ title: 'Delete local tag', fields: [{ key: 'name', label: 'Tag name' }],
                execute: values => command({ command: 'deleteTag', name: values.name }) })}>Delete tag…</Dropdown.Item>

    </>)}
    {subgroup('Worktrees', <>
<Dropdown.Item onClick={()=>setAction({title:'Create Worktree',summary:'Create a separate server workspace on a new branch. Keep the current editor and its unfinished files unchanged.',fields:[{key:'name',label:'New branch name'},{key:'from',label:'Start from',value:'HEAD'}],execute:values=>command({command:'createWorktree',...values})})}>Create Worktree…</Dropdown.Item>
<Dropdown.Item onClick={openWorktrees}>Worktrees…</Dropdown.Item>

    </>)}
<Dropdown.Divider />
<Dropdown.Item onClick={() => run(() => api.status())}>Refresh</Dropdown.Item>
<Dropdown.Item onClick={() => setSettings(true)}>Repository settings…</Dropdown.Item>
<Dropdown.Item onClick={showGitOutput}>Show Git Output</Dropdown.Item>
  </>
  const iconAction = (label: string, icon: string, action: () => unknown, disabled = false) => <button type="button" className="native-git-icon-button" aria-label={label} title={label} disabled={busy || disabled} onClick={() => action()}><MaterialIcon type={icon} /></button>
  const previewDiscardAll = async () => {
    const result = await command({ command: 'discardAllDetails', paths: workingFiles.map(file => file.path) })
    if (result?.result) setDiscardAll(result.result as { paths: string[]; fingerprint: string; untracked: string[] })
  }
  const openChanges = (items: GitFile[], staged: boolean) => {
    if (!items.length) return
    setChangeQueue({ paths: items.map(file => file.path), staged })
    void openFileDiff(items[0].path, staged)
  }
  const viewGraph = () => { closeDiff(); setGraphOpen(true) }
  const changesActions = <div className="native-git-changes-toolbar" role="toolbar" aria-label="Changes actions">
    {iconAction('Commit staged changes', 'check', commit, !message.trim() || !indexFiles.length || !!status?.conflicted.length)}
    {iconAction('Refresh changes', 'refresh', () => run(() => api.status()))}
    <button type="button" className="native-git-icon-button" aria-label="View Git Graph" title="View Git Graph" disabled={busy} onClick={viewGraph}><GitGraphIcon /></button>
    <Dropdown onToggle={open => { setChangesMenuOpen(open); setSubmenu(undefined) }}><Dropdown.Toggle variant="link" className="native-git-icon-button" aria-label="More changes actions" disabled={busy}>⋯</Dropdown.Toggle>
      {createPortal(<Dropdown.Menu className="native-git-repository-menu" flip onMouseOver={event => { if (event.currentTarget.contains(event.target as Node) && !(event.target as Element).closest('.native-git-submenu-trigger')) setSubmenu(undefined) }}>
        <Dropdown.Item onClick={() => setChangesTree(value => !value)}>{changesTree ? 'View as List' : 'View as Tree'}</Dropdown.Item>
        {changesMenuOpen && subgroup('View & Sort', <>
          <Dropdown.Item role="menuitemradio" aria-checked={!changesTree} onClick={() => setChangesTree(false)}><span className="native-git-menu-check" aria-hidden="true">{!changesTree ? '✓' : ''}</span>View as List</Dropdown.Item>
          <Dropdown.Item role="menuitemradio" aria-checked={changesTree} onClick={() => setChangesTree(true)}><span className="native-git-menu-check" aria-hidden="true">{changesTree ? '✓' : ''}</span>View as Tree</Dropdown.Item>
          <Dropdown.Divider />
          {(['name', 'path', 'status'] as const).map(sort => <Dropdown.Item key={sort} role="menuitemradio" aria-checked={changesSort === sort} onClick={() => setChangesSort(sort)}><span className="native-git-menu-check" aria-hidden="true">{changesSort === sort ? '✓' : ''}</span>Sort Changes by {sort[0].toUpperCase() + sort.slice(1)}</Dropdown.Item>)}
        </>)}
        <Dropdown.Divider />{changesMenuOpen && repositoryActions()}
        <Dropdown.Item onClick={viewGraph}>View Git Graph</Dropdown.Item>
      </Dropdown.Menu>, document.body)}
    </Dropdown>
  </div>
  if (!snapshot) return <div className="native-git-panel"><p role={error ? 'alert' : 'status'}>{error || 'Loading repository…'}</p>
    {error && <><button className="btn btn-default" disabled={busy} onClick={() => run(() => api.status())}>Retry</button><SessionRecovery api={api} /></>}</div>
  if (snapshot.readOnly) return <ReadOnlyHistory api={api} snapshot={snapshot} onRefresh={() => run(() => api.status())} />
  if (snapshot.connected === false) return <div className="native-git-panel native-git-connect">
    <BranchIcon /><h4>Source Control</h4><p>Track this project with Git.</p>
    {error && <p role="alert">{error}</p>}
    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => api.initialize())}>Initialize repository</button>
    <ConnectRepository busy={busy} connect={command} />
  </div>
  const commits = snapshot.graph || []
  return <div className="native-git-panel" aria-busy={busy}>
    {(error || refreshError) && <div className="native-git-error" role="alert">{error || refreshError}{' '}
      <button type="button" className="btn btn-default btn-sm" disabled={busy} onClick={() => run(() => api.status())}><MaterialIcon type="refresh" />Refresh repository status</button>
    </div>}
    {snapshot.mutationTaskId ? <div className="native-git-error" role="status">{snapshot.mutationKind === 'auto-commit'
      ? <>An automatic commit needs recovery before Git changes can continue. The project owner can review it in Automatic commits.</>
      : snapshot.mutationKind === 'shell'
      ? <>A Shell application needs recovery before Git changes can continue. {snapshot.canRecoverMutation
        ? <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => setShellDraftsOpen(true)}><MaterialIcon type="terminal" />Review interrupted Shell application</button>
        : <span>The draft owner must review the interrupted application.</span>}</>
      : <>A merge needs recovery before Git changes can continue. <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => { setMergeTaskId(snapshot.mutationTaskId); setMergeTasksOpen(true) }}><MaterialIcon type="merge" />Review interrupted merge</button></>}</div>
      : snapshot.switching && <div className="native-git-error" role="status">Updating project files… <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => command({ command: 'resumeTransfer' })}>Retry</button></div>}
    <div ref={sectionGroup} className="native-git-section-group"><PanelGroup ref={panelGroup} direction="vertical" autoSaveId="native-git-sections-v4">
      <Section expand={() => expandSection(0)} collapse={() => collapseSection(0)} title="Repositories" defaultSize={12} collapsedSize={collapsedSize}>
        <div className="native-git-repository-row">
          <MaterialIcon type="inventory_2" className="native-git-repository-icon" /><span className="native-git-repository-name" title={projectName}>{projectName}</span>
          <button ref={branchButton} type="button" className="native-git-branch-button" disabled={busy}
            title={status?.branch || 'Detached HEAD'} onClick={() => setPicker(value => !value)}><BranchIcon />{status?.branch || 'Detached HEAD'}<AutoCommitIndicator policy={snapshot.branches?.find(branch=>!branch.remote && branch.name===status?.branch)?.autoCommit}/><AutoSyncIndicator policy={snapshot.branches?.find(branch=>!branch.remote && branch.name===status?.branch)?.autoSync}/><TerminalIndicators sessions={snapshot.branches?.find(branch=>!branch.remote && branch.name===status?.branch)?.terminals}/><span aria-hidden="true">▾</span></button>
          {iconAction('Publish Branch', 'cloud_upload', () => remoteAction('push', true), !!status?.detached || !status?.branch)}
          <Dropdown onToggle={open => { setRepositoryMenuOpen(open); setSubmenu(undefined) }}>
            <Dropdown.Toggle className="native-git-icon-button" variant="link" title="More Actions" aria-label="Repository actions" disabled={busy}>⋯</Dropdown.Toggle>
            {createPortal(<Dropdown.Menu className="native-git-repository-menu" flip onMouseOver={event => { if (event.currentTarget.contains(event.target as Node) && !(event.target as Element).closest('.native-git-submenu-trigger')) setSubmenu(undefined) }}>
              {repositoryMenuOpen && repositoryActions()}
            </Dropdown.Menu>, document.body)}
          </Dropdown>
          <Dropdown autoClose="outside" className="native-git-tools">
            <Dropdown.Toggle variant="link" className="native-git-icon-button" aria-label="Project tools" title="Project tools"><MaterialIcon type="tune" /></Dropdown.Toggle>
            {createPortal(<Dropdown.Menu renderOnMount className="native-git-tools-menu" align="end">
              <Dropdown.Header>Collaboration</Dropdown.Header>
              {snapshot.collaboration?.drafts && <ToolAction icon="merge" disabled={busy} onClick={() => { setMergeTaskId(undefined); setMergeTasksOpen(true) }}>Merge branches…</ToolAction>}
              <Dropdown.Divider />
              <Dropdown.Header>Sync & automation</Dropdown.Header>
              {snapshot.collaboration?.apply && <><AutoCommitSettings api={api} /><AutoSyncSettings api={api} branch={status?.branch || 'main'} /></>}
              <Dropdown.Divider />
              <Dropdown.Header>Backup & recovery</Dropdown.Header>
              <ProjectBackups api={api} />
              {recoveryTools}
              {snapshot.collaboration?.apply && <SessionRecovery api={api} />}
              {snapshot.collaboration?.drafts && <ToolAction icon="terminal" disabled={busy} onClick={() => setShellDraftsOpen(true)}>Review assistant changes</ToolAction>}
              <Dropdown.Divider />
        {snapshot.collaboration?.drafts && <RemoteDiscoveryStatus api={api} busy={busy} onReview={async (ref, expectedSourceOid) => {
          const result = await command({ command: 'mergeDraftPrepare', ref, expectedSourceOid, operationId: crypto.randomUUID() })
          if (result) { setMergeTaskId((result.result as { id: string }).id); setMergeTasksOpen(true) }
        }} />}
            </Dropdown.Menu>, document.body)}
          </Dropdown>
        </div>
        <div className="native-git-repository-status">{status?.ahead ? `${status.ahead} outgoing commits` : 'Local repository'}{status?.behind ? ` · ${status.behind} incoming commits` : ''}</div>
      </Section>
      <PanelResizeHandle className="native-git-resize" aria-label="Resize repositories and changes" />
      <Section expand={() => expandSection(1)} collapse={() => collapseSection(1)} title="Changes" actions={changesActions} defaultSize={45} collapsedSize={collapsedSize}>
        <form className="native-git-composer" onSubmit={event => { event.preventDefault(); void commit() }}>
          <div className="native-git-message"><input className="form-control" aria-label="Commit message" placeholder="Message describing your changes" value={message} disabled={busy}
            onChange={event => setMessage(event.target.value)} onKeyDown={event => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void commit() } }} />
            <button type="button" className="native-git-icon-button" aria-label="Generate commit message with AI" title="Generate from staged files and diff"
              disabled={busy || !indexFiles.length} onClick={async () => { const result = await command({ command: 'generateMessage' }); if (typeof result?.result === 'string') setMessage(result.result) }}>
              <svg className="native-git-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="m8 3 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z M16 1v6m-3-3h6" /></svg>
            </button></div>
          <button type="submit" className="btn btn-primary" disabled={busy || !message.trim() || indexFiles.length === 0 || !!status?.conflicted.length}>Commit</button>
        </form>
        {!!status?.conflicted.length && <p className="native-git-error">Resolve {status.conflicted.length} conflicted files before committing.</p>}
        {status?.operation && <div className="native-git-operation" role="status">
          <span>{status.operation} in progress</span>
          <button type="button" className="btn btn-default btn-sm" disabled={busy || !!status.conflicted.length}
            onClick={() => command({ command: 'continueOperation', operation: status.operation, action: 'continue' })}>Continue {status.operation}</button>
          <button type="button" className="btn btn-default btn-sm" disabled={busy}
            onClick={() => command({ command: 'continueOperation', operation: status.operation, action: 'abort' })}>Abort {status.operation}</button>
          {status.operation !== 'merge' && <button type="button" className="btn btn-default btn-sm" disabled={busy}
            onClick={() => command({ command: 'continueOperation', operation: status.operation, action: 'skip' })}>Skip commit</button>}
        </div>}
        {!!conflictFiles.length && <div className="native-git-conflict-list">
          <div className="native-git-file-heading"><strong>Merge Changes</strong><span>{conflictFiles.length}</span></div>
          {conflictFiles.map(file => <div className="native-git-file" key={file.path}>
            <button type="button" className="native-git-file-name" disabled={busy} aria-label={file.path} onClick={() => openConflict(file.path)}><FileLabel path={file.path} /></button><FileStatus status="U" conflict />
            <button type="button" className="btn btn-default btn-sm" disabled={busy} aria-label={`Resolve ${file.path}`} onClick={() => openConflict(file.path)}>Resolve</button>
          </div>)}
        </div>}
        <div className="native-git-file-heading"><strong>Staged Changes</strong><span className="native-git-file-count">{indexFiles.length}</span><span className="native-git-group-actions">
          {iconAction('Open staged changes', 'difference', () => openChanges(indexFiles, true), !indexFiles.length)}
          {iconAction('Unstage all', 'remove', () => command({ command: 'unstage', paths: indexFiles.map(file => file.path) }), !indexFiles.length)}</span></div>
        {files(indexFiles, true)}
        <div className="native-git-file-heading"><strong>Changes</strong><span className="native-git-group-actions">
          {iconAction('Open Changes', 'difference', () => openChanges(workingFiles, false), !workingFiles.length)}
          {iconAction('Discard all changes', 'undo', previewDiscardAll, !workingFiles.length)}
          {iconAction('Stage all', 'add', () => command({ command: 'stage', paths: workingFiles.map(file => file.path) }), !workingFiles.length)}</span><span className="native-git-file-count" aria-label={`${workingFiles.length} changed files`}>{workingFiles.length}</span></div>
        {files(workingFiles, false)}
        {!status?.files.length && <p className="native-git-empty">No changes</p>}
      </Section>
      <PanelResizeHandle className="native-git-resize" aria-label="Resize changes and graph" />
      <Section expand={() => expandSection(2)} collapse={() => collapseSection(2)} title="Graph" defaultSize={35} collapsedSize={collapsedSize}>
        <GraphHistory onCheckout={branch => void checkout({ ...branch, current: branch.name === status?.branch })} currentRef={status?.branch ? `refs/heads/${status.branch}` : 'HEAD'}
          onRefresh={() => run(() => api.status())} onPull={() => remoteAction('pull')} onPublish={() => remoteAction('push', true)}
          onFetchAll={() => run(async () => {
            const remotes = (await api.command({ command: 'remotes' })).result as { name: string }[]
            for (const remote of remotes) await api.command({ command: 'fetch', remote: remote.name })
            return api.status()
          })} webRemotes={snapshot.webRemotes || []} api={api} branches={[...(snapshot.branches || []), ...(snapshot.tags || [])]} commits={commits} busy={busy} expanded={expandedCommits} details={commitDetails} onSelect={expandCommit} onInspect={inspectCommit} onFile={openCommitFile} onOpenFile={onOpenFile ? openProjectFile : undefined} />
      </Section>
    <Panel defaultSize={0} minSize={0} className="native-git-section-spacer" />
    </PanelGroup></div>
    <BranchPicker target={branchButton} show={picker} branches={snapshot.branches || []} tags={snapshot.tags || []} current={status?.branch || null}
      busy={busy} onClose={() => setPicker(false)} onCheckout={checkout} onCreate={createBranch} onDetached={!snapshot.collaboration?.apply ? () => refAction('Checkout detached', 'checkoutDetached') : undefined}
      onWorkspaces={snapshot.collaboration?.apply ? () => { setPicker(false); setWorkspacesOpen(true) } : undefined}
      onRename={!snapshot.collaboration?.apply ? () => { setPicker(false); setAction({title:'Rename branch',fields:[{key:'from',label:'Branch',value:status?.branch || ''},{key:'to',label:'New name'}],execute:values=>command({command:'renameBranch',...values})}) } : undefined}
      onDelete={!snapshot.collaboration?.apply ? () => { setPicker(false); setAction({title:'Delete merged branch',fields:[{key:'name',label:'Branch name'}],execute:values=>command({command:'deleteBranch',name:values.name})}) } : undefined} />
    {workspacesOpen && <BranchWorkspaces api={api} onClose={() => setWorkspacesOpen(false)}/>}
    {cloneOpen && <CloneRepository command={command} busy={busy} error={error} onClose={()=>setCloneOpen(false)} />}
    {action && <ActionDialog action={action} busy={busy} error={error} onClose={() => setAction(undefined)} />}
    {settings && <RemoteSettings api={api} onClose={() => { setSettings(false); void run(() => api.status()) }} />}
    {stashes && <StashManager intent={stashIntent} entries={stashes} command={command} reload={reloadStashes} busy={busy} error={error} onClose={() => setStashes(undefined)} onPreview={(title, text) => { setStashes(undefined); setDiff({ title, text }) }} />}
    <Modal className="native-git-dialog" show={!!fileHistory} onHide={() => setFileHistory(undefined)} size="lg" aria-label="File history">
      <Modal.Header closeButton><Modal.Title>{fileHistory?.path}</Modal.Title></Modal.Header>
      <Modal.Body>
        {error && <p role="alert" className="native-git-error">{error}</p>}
        {fileHistory && <button type="button" className="btn btn-default btn-sm" disabled={busy} onClick={() => openBlame(fileHistory.path)}>Line authors</button>}
        {fileHistory?.commits.length === 0 && <p>No commits for this file on the current branch.</p>}
        {fileHistory?.commits.map(entry => <div key={entry.hash} className="native-git-history-entry">
          <button type="button" className="native-git-file-name" disabled={busy} onClick={() => {
            setFileHistory(undefined)
            void openDiff(entry.subject, { command: 'commitDiff', ref: entry.hash })
          }}>{entry.subject}</button>
          <small>{entry.author} · {formatGitDate(entry.date)} · {entry.hash.slice(0, 8)}</small>
        </div>)}
      </Modal.Body>
    </Modal>
    {gitOutput !== undefined && <Modal className="native-git-dialog" show onHide={() => setGitOutput(undefined)} size="lg" aria-label="Git output"><Modal.Header closeButton><Modal.Title>Git output</Modal.Title></Modal.Header><Modal.Body><pre>{gitOutput}</pre></Modal.Body></Modal>}
    {discardAll && <Modal className="native-git-dialog" show onHide={() => { if (!busy) setDiscardAll(undefined) }} aria-label="Discard all changes">
      <Modal.Header closeButton><Modal.Title>Discard {discardAll.paths.length} files’ unstaged changes?</Modal.Title></Modal.Header>
      <Modal.Body><p>Tracked files will be restored to their staged version. Untracked files will be deleted. Staged changes stay intact.</p>
        <ul>{discardAll.paths.map(path => <li key={path}>{path}{discardAll.untracked.includes(path) ? ' (delete untracked file)' : ''}</li>)}</ul>
        {error && <p role="alert">{error}</p>}
      </Modal.Body><Modal.Footer><button className="btn btn-default" disabled={busy} onClick={() => setDiscardAll(undefined)}><MaterialIcon type="close" />Cancel</button>
        <button className="btn btn-default" disabled={busy} onClick={previewDiscardAll}><MaterialIcon type="refresh" />Refresh preview</button>
        <button className="btn btn-danger" disabled={busy} onClick={async () => { const result = await command({ command: 'discardAll', paths: discardAll.paths, fingerprint: discardAll.fingerprint }); if (result) setDiscardAll(undefined) }}>Discard all changes</button>
      </Modal.Footer>
    </Modal>}
    {discard && <Modal className="native-git-dialog" show onHide={() => { if (!busy) setDiscard(undefined) }} size="lg" aria-label="Discard unstaged changes">
      <Modal.Header closeButton><Modal.Title>Discard changes · {discard.path}</Modal.Title></Modal.Header>
      <Modal.Body className="native-git-diff">
        <p>{discard.untracked ? 'Delete this untracked file from the project. Its contents will be lost.' : 'Restore this file to its staged version. The unstaged changes shown below will be lost. Staged changes stay intact.'}</p>
        {error && <p role="alert" className="native-git-error">{error}</p>}
        <pre>{discard.text || 'No unstaged text differences.'}</pre>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-default" disabled={busy} onClick={() => previewDiscard(discard.path)}><MaterialIcon type="refresh" />Refresh preview</button>
        <button type="button" className="btn btn-default" disabled={busy} onClick={() => setDiscard(undefined)}><MaterialIcon type="close" />Cancel</button>
        <button type="button" className="btn btn-danger" disabled={busy} onClick={async () => {
          const result = await command({ command: 'discard', paths: [discard.path], fingerprint: discard.fingerprint })
          if (result) setDiscard(undefined)
        }}>Discard changes</button>
      </Modal.Footer>
    </Modal>}
    {worktrees && <WorktreeManager entries={worktrees} busy={busy} error={error} reload={openWorktrees} onClose={() => setWorktrees(undefined)}
      clean={async entry => {
        const result = await command({ command: 'cleanWorktree', id: entry.id, expectedHead: entry.head })
        if (!result) return false
        await openWorktrees()
        return true
      }} />}
    {ignoredFiles && <IgnoredFiles paths={ignoredFiles} busy={busy} error={error} onClose={() => setIgnoredFiles(undefined)} onRefresh={openIgnoredFiles}
      onStage={async path => {
        if (await command({ command: 'stage', paths: [path], force: true })) await openIgnoredFiles()
      }} />}
    {resetOpen && <ResetDialog commits={snapshot.graph || []} busy={busy} error={error} onClose={() => setResetOpen(false)}
      onPreview={async ref => (await command({ command: 'resetDetails', ref }))?.result as ResetPreview | undefined}
      onReset={async (preview, mode) => {
        if (await command({ command: 'reset', ref: preview.target, mode, fingerprint: preview.fingerprint })) {
          setResetOpen(false); closeDiff()
        }
      }} />}
    {shellDraftsOpen && <ShellDrafts key={api.projectId} api={api} canApply={snapshot.collaboration?.apply === true} onClose={() => setShellDraftsOpen(false)} />}
    {mergeTasksOpen && <CollaborationTasks api={api} canApply={snapshot.collaboration?.apply === true} selectedId={mergeTaskId} onNewMerge={() => { setMergeTasksOpen(false); mergeBranch() }} onClose={() => setMergeTasksOpen(false)} />}
    {mergeTarget && <MergeBranchPicker preview={snapshot.collaboration?.drafts} branches={snapshot.branches || []} target={mergeTarget} busy={busy} error={error}
      onClose={() => setMergeTarget(undefined)}
      onMerge={async ref => {
        const result = await command(snapshot.collaboration?.drafts
          ? { command: 'mergeDraftPrepare', ref, operationId: crypto.randomUUID() }
          : { command: 'merge', ref, expectedBranch: mergeTarget })
        if (result) {
          setMergeTarget(undefined)
          if (snapshot.collaboration?.drafts) { setMergeTaskId((result.result as { id: string }).id); setMergeTasksOpen(true) }
        }
      }} />}
    {conflict && <ConflictEditor details={conflict} busy={busy} error={error} onClose={() => setConflict(undefined)}
      onResolve={async (choice, text) => {
        const result = await command({ command: 'resolveConflict', path: conflict.path, fingerprint: conflict.fingerprint, choice, ...(choice === 'edited' ? { text } : {}) })
        if (result) setConflict(undefined)
      }} />}
    {blame && <BlameView path={blame.path} output={blame.output} busy={busy} error={error} onClose={() => setBlame(undefined)}
      onCommit={async hash => {
        const result = await command({ command: 'commitDiff', ref: hash })
        if (typeof result?.result === 'string') { setBlame(undefined); setDiff({ title: hash.slice(0, 8), text: result.result }) }
      }} />}
    {active && graphOpen && <EditorGraph draftsEnabled={snapshot.collaboration?.apply} onCheckout={branch => void checkout({ ...branch, current: branch.name === status?.branch })} hidden={!!diff} api={api} commits={commits} branches={[...(snapshot.branches || []), ...(snapshot.tags || [])]} currentRef={status?.branch ? `refs/heads/${status.branch}` : 'HEAD'} busy={busy} webRemotes={snapshot.webRemotes || []} onClose={() => setGraphOpen(false)} onFile={openCommitFile} onOpenFile={onOpenFile ? path => { setGraphOpen(false); void openProjectFile(path) } : undefined} onRefresh={() => run(() => api.status())} />}
    {diff && <EditorDiff title={diff.title} versions={diff.versions} onClose={closeDiff}>
      {changeQueue && changeQueue.paths.includes(diff.title) && <div className="native-git-change-navigation"><label>Changed file <select aria-label="Changed file" value={diff.title} onChange={event => openFileDiff(event.target.value, changeQueue.staged)}>{changeQueue.paths.map(path => <option key={path}>{path}</option>)}</select></label><span>{changeQueue.paths.indexOf(diff.title) + 1} / {changeQueue.paths.length}</span></div>}
      {error && <p role="alert" className="native-git-error">{error}</p>}
      {diff.file && <div className="native-git-diff-toolbar">
        <span>{diff.file.staged ? 'Staged changes' : 'Working tree changes'}</span>
        <button type="button" className="btn btn-default btn-sm" disabled={busy} onClick={() => diff.file && openFileDiff(diff.file.path, diff.file.staged)}><MaterialIcon type="refresh" />Refresh diff</button>
      </div>}
      {diff.loading ? <p role="status" className="native-git-empty">Loading diff…</p> : diff.error ? <p role="alert" className="native-git-error">{diff.error}</p> : diff.preview ? <FilePreview key={diff.title} title={diff.title} versions={diff.preview} /> : <PatchComparison patch={diff.text} versions={diff.versions} busy={busy} staged={diff.file?.staged} onHunk={diff.file?.hunks.length ? applyHunk : undefined} />}
    </EditorDiff>}
  </div>
}

function Section({ title, collapse, expand, actions, defaultSize, collapsedSize, children }: { collapse: () => void; expand: () => void; actions?: ReactNode; title: string; defaultSize: number; collapsedSize: number; children: ReactNode }) {
  const panel = useRef<ImperativePanelHandle>(null)
  const [collapsed, setCollapsed] = useState(false)
  return <Panel ref={panel} defaultSize={defaultSize} minSize={Math.max(12, collapsedSize + 2)} collapsible collapsedSize={collapsedSize} onCollapse={() => setCollapsed(true)} onExpand={() => setCollapsed(false)}>
    <section className="native-git-section">
      <div className="native-git-section-header" onClick={event => {
        // Blank header space toggles the section; action controls keep their own behavior.
        if (event.target !== event.currentTarget) return
        collapsed ? expand() : collapse()
      }}><button type="button" className="native-git-section-heading" data-section={title} aria-expanded={!collapsed}
        onClick={() => collapsed ? expand() : collapse()}><svg className={`native-git-chevron ${collapsed ? '' : 'is-open'}`} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false" aria-hidden="true"><path d="M6 4l4 4-4 4" /></svg>{title}</button>{actions}{title === 'Graph' && <div id="native-git-graph-toolbar-host" />}</div>
      <div className="native-git-section-body" style={collapsed ? { display: 'none' } : undefined}>{children}</div>
    </section>
  </Panel>
}

function ActionDialog({ action, busy, error, onClose }: { action: Action; busy: boolean; error: string; onClose: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(action.fields.map(field => [field.key, field.value || ''])))
  return <Modal className="native-git-dialog" show onHide={() => { if (!busy) onClose() }} aria-label={action.title}>
    <Modal.Header closeButton><Modal.Title>{action.title}</Modal.Title></Modal.Header>
    <form onSubmit={async event => { event.preventDefault(); if (await action.execute(values)) onClose() }}>
      <Modal.Body>{action.summary && <p>{action.summary}</p>}{error && <p role="alert" className="native-git-error">{error}</p>}{action.fields.map((field, index) => <label className="native-git-field" key={field.key}>{field.label}
        {field.multiline ? <textarea className="form-control" rows={5} autoFocus={index === 0} value={values[field.key]} required disabled={busy}
          onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))} /> : <input className="form-control" autoFocus={index === 0} value={values[field.key]} required disabled={busy}
          onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))} />}</label>)}</Modal.Body>
      <Modal.Footer><button type="button" className="btn btn-default" disabled={busy} onClick={onClose}><MaterialIcon type="close" />Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{action.submitLabel || 'Continue'}</button></Modal.Footer>
    </form>
  </Modal>
}

export default function SourceControlPanel() {
  const { selectedTab } = useRailContext()
  const { projectId, name: projectName } = useProjectContext()
  const { openDocs, openDocWithId, openFileWithId } = useEditorManagerContext()
  const { findEntityByPath } = useFileTreePathContext()
  const openFile = async (path: string) => {
    const found = findEntityByPath(path)
    if (!found || found.type === "folder") throw new Error(`File is not present in the current branch: ${path}`)
    if (found.type === "doc") await openDocWithId(found.entity._id)
    else openFileWithId(found.entity._id)
  }
  const api = useMemo(() => {
    const backend = gitApi(projectId)
    const busy = (busy: boolean) => window.dispatchEvent(new CustomEvent('native-git-local-write-state', { detail: { busy } }))
    return { ...backend,
      initialize: () => withSavedEditor(openDocs, busy, () => backend.initialize()),
      command: (command: GitCommand) => ['shellDraftGet', 'shellDraftList', 'shellDraftPoll', 'shellDraftInput', 'shellDraftRun', 'shellDraftResize', 'shellDraftStart', 'shellDraftSeal', 'shellDraftReview', 'shellDraftFile', 'webhookStatus', 'configureWebhook', 'autoCommitSchedule', 'configureAutoCommitSchedule', 'autoCommitRecoveryPreview', 'autoCommitRecover', 'remoteDiscoveryList', 'discoverySchedule', 'configureDiscoverySchedule', 'discoverRemote', 'accessPolicy', 'setAccessPolicy', 'terminalApprove', 'terminalPoll', 'terminalInput', 'terminalRun', 'terminalResize', 'terminalClose', 'commitDetails', 'graphSettings', 'commitFiles', 'commitFileDiff', 'commitDiff', 'commitFilePreview', 'graph'].includes(command.command)
        ? backend.command(command)
        : withSavedEditor(openDocs, busy, () => backend.command(command)),
    }
  }, [projectId, openDocs])
  return <div className="native-git-root"><RailPanelHeader title="Source Control" /><SourceControlView recoveryTools={<HistoryRecovery projectId={projectId} />} key={projectId} projectName={projectName || 'Repository'} active={selectedTab === 'native-git'} api={api} onOpenFile={openFile} /></div>
}
