# Git interactive control inventory

Generated from current JSX. Repeated menu entries and dynamic rows share handlers; this is a source inventory, not a test-pass claim.

| Source | Control | Label | Handler |
|---|---|---|---|
| access-mode.tsx:19 | button | "Permissions shared by Paper Assistant and Git" | onClick={() => { setMode(policy.mode); setError(''); setOpen(true) }} |
| access-mode.tsx:20 | Modal | "Paper Assistant permissions" | onHide={() => { if (!busy) setOpen(false) }} |
| access-mode.tsx:22 | input |  | onChange={() => setMode('read-only')} |
| access-mode.tsx:23 | input |  | onChange={() => setMode('workspace-write')} |
| access-mode.tsx:24 | input |  |  |
| access-mode.tsx:25 | input |  |  |
| access-mode.tsx:26 | button | Cancel | onClick={() => setOpen(false)} |
| access-mode.tsx:26 | button | Apply mode | onClick={async () => { setBusy(true); try { const result = await api.command({command:'setAccessPolicy',mode,directories:[]}); setPolicy(result.result as Policy); setOpen(false) } catch(error) { setError(errorMessage(error)) } finally { setBusy(false) } }} |
| action-submenu.tsx:9 | button | {`${label} submenu`} | onMouseEnter={onOpen}; onClick={event => { event.stopPropagation(); open ? onClose() : onOpen() }}; onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); onOpen(); focusFirst() } }} |
| action-submenu.tsx:16 | div | {`${label} actions`} | onKeyDownCapture={event => { if (event.key === 'Escape' \|\| event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); onClose(); trigger.current?.focus() } if (event.key === 'ArrowDown' \|\| event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation() const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('.dropdown-item:not(.disabled):not(:disabled)')) const index = items.indexOf(document.activeElement as HTMLElement) items[(index + (event.key  |
| blame-view.tsx:33 | Modal | "Line authors" | onHide={onClose} |
| blame-view.tsx:43 | button | {row.subject} | onClick={() => onCommit(row.hash)} |
| branch-picker.tsx:47 | Overlay |  <Popover className="native-git-picker" aria-label="Switch branch"> <div className="native-git-picker-search"> <input ref={input} className="form-control" value={query} type="searc | onHide={onClose}; onEntered={() => input.current?.focus()} |
| branch-picker.tsx:51 | input | "Select a branch or tag to checkout" | onChange={event => { setQuery(event.target.value); setActive(0) }}; onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); target.current?.focus() } if (event.key === 'ArrowDown' \|\| event.key === 'ArrowUp') { event.preventDefault() const next = (active + (event.key === 'ArrowDown' ? 1 : -1) + actions.length + choices.length) % (actions.length + choices.length) setActive(next) document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: 'nearest' }) } if ( |
| branch-picker.tsx:68 | button |  <span className="native-git-action-glyph" aria-hidden="true">{action.icon}</span> {action.label}  | onMouseEnter={() => setActive(index)}; onClick={() => activate(index)} |
| branch-picker.tsx:74 | button |  <span className="native-git-branch-heading"><BranchIcon /><strong>{branch.name}</strong>{branch.tag && <span>Tag · detached</span>} <time dateTime={branch.date} title={formatGitDa | onMouseEnter={() => setActive(offset + actions.length)}; onClick={() => onCheckout(branch)} |
| clone-repository.tsx:28 | Modal | "Clone repository" | onHide={() => { if (!busy) onClose(); }} |
| clone-repository.tsx:38 | form |  <Modal.Body> {error && <p role="alert">{error}</p>} {result ? ( <> <p>Repository cloned successfully.</p> <a href={result.url}>Open cloned project</a> </> ) : ( <> <p> Create a ne | onSubmit={async (event) => { event.preventDefault(); const value = await command({ command: "clone", url, name, operationId, ...(branch ? { branch } : {}), ...(username \|\| token ? { username, token } : {}), }); if (value?.result) { setResult(value.result as any); setToken(""); } }} |
| clone-repository.tsx:60 | a | Open cloned project |  |
| clone-repository.tsx:70 | input |  | onChange={(e) => change(() => setUrl(e.target.value))} |
| clone-repository.tsx:81 | input |  | onChange={(e) => change(() => setName(e.target.value))} |
| clone-repository.tsx:92 | input |  | onChange={(e) => change(() => setBranch(e.target.value))} |
| clone-repository.tsx:101 | input |  | onChange={(e) => setUsername(e.target.value)} |
| clone-repository.tsx:111 | input |  | onChange={(e) => setToken(e.target.value)} |
| clone-repository.tsx:124 | button |  {result ? "Close" : "Cancel"}  | onClick={onClose} |
| clone-repository.tsx:133 | button |  {busy ? "Cloning…" : "Clone"}  |  |
| commit-graph.tsx:73 | button |  <svg viewBox={`0 0 ${columns * 16 + 4} 32`} preserveAspectRatio="none" width={columns * 16 + 4} height="32" aria-hidden="true" className="native-git-graph-lines"> {before.map((has | onClick={() => { setHover(undefined); onSelect(commit) }}; onMouseEnter={event => { keep(); setCopied(false); setHover({ commit, target: event.currentTarget }); onInspect?.(commit) }}; onMouseLeave={leave}; onFocus={event => { keep(); setHover({ commit, target: event.currentTarget }); onInspect?.(commit) }}; onBlur={leave} |
| commit-graph.tsx:85 | span | {branch ? `Double-click to checkout ${name}` : name} | onClick={event => event.stopPropagation()}; onDoubleClick={event => { event.stopPropagation(); if (branch && !busy) onCheckout?.(branch) }} |
| commit-graph.tsx:98 | button | {file.path} | onClick={() => onFile?.(commit, file)} |
| commit-graph.tsx:100 | button | "Open file in editor" | onClick={() => onOpenFile(file.path)} |
| commit-graph.tsx:105 | Popover |  {hover && <Popover.Body> <p><strong>{hover.commit.author}</strong> · <time dateTime={hover.commit.date}>{formatGitDate(hover.commit.date)}</time></p> <p>{hover.commit.subject}</p> | onMouseEnter={keep}; onMouseLeave={leave} |
| commit-graph.tsx:111 | a | Open on {remote.provider} {webRemotes.length > 1 ? ` (${remote.name})` : ''} |  |
| commit-graph.tsx:113 | button | {copied ? 'Copied' : 'Copy commit ID'} | onClick={async () => { try { await navigator.clipboard.writeText(hover.commit.hash); setCopied(true) } catch { setCopied(false) } }} |
| commit-graph.tsx:114 | button | {expanded[hover.commit.hash] ? 'Collapse files' : 'Show changed files'} | onClick={() => { onSelect(hover.commit); setHover(undefined) }} |
| conflict-editor.tsx:18 | Modal | "Resolve conflict" | onHide={() => { if (!busy) onClose() }} |
| conflict-editor.tsx:27 | button |  {details.versions[name].kind === 'deleted' ? `Accept ${name} deletion & stage` : `Use ${name} & stage`}  | onClick={() => onResolve(name)} |
| conflict-editor.tsx:33 | textarea |  | onChange={event => setText(event.target.value)} |
| conflict-editor.tsx:37 | button | Close | onClick={onClose} |
| conflict-editor.tsx:38 | button | Save result & stage | onClick={() => onResolve('edited', text)} |
| connect-repository.tsx:10 | form |  <h4>Connect an existing repository</h4>  <p>Clone its Git history. Your current project files stay unchanged and appear as working-tree differences.</p>  <label className="native- | onSubmit={event => { event.preventDefault() if (!paired) return void connect({ command: 'connect', url: url.trim(), ...(branch.trim() ? { branch: branch.trim() } : {}), ...(token ? { username: username.trim(), token } : {}) }) }} |
| connect-repository.tsx:18 | input |  | onChange={event => setUrl(event.target.value)} |
| connect-repository.tsx:19 | input |  | onChange={event => setBranch(event.target.value)} |
| connect-repository.tsx:20 | input |  | onChange={event => setUsername(event.target.value)} |
| connect-repository.tsx:21 | input |  | onChange={event => setToken(event.target.value)} |
| connect-repository.tsx:23 | button | Connect repository |  |
| editor-diff.tsx:15 | button | "Close diff" | onClick={onClose} |
| editor-diff.tsx:73 | button | {`${staged ? 'Unstage' : 'Stage'} change ${index + 1}`} | onClick={() => onHunk(index)} |
| editor-diff.tsx:79 | button | {`Line ${mark.line}`} | onClick={() => mark.node.scrollIntoView({ block: 'center' })} |
| editor-graph.tsx:54 | input |  | onChange={async e => { const value = { ...settings, showRemotes: e.target.checked }; setSettings(value); const { effectiveUser, ...saved } = value; try { await api.command({ command: 'saveGraphSettings', settings: saved }) } catch (error) { setError(errorMessage(error)) } }} |
| editor-graph.tsx:55 | button | "Search commits or branches" | onClick={() => host.querySelector<HTMLInputElement>('[aria-label="Search history"]')?.focus()} |
| editor-graph.tsx:56 | button | "Open repository terminal" | onClick={() => setTerminalOpen(value => !value)} |
| editor-graph.tsx:57 | button | "Graph repository settings" | onClick={() => setSettingsOpen(true)} |
| editor-graph.tsx:58 | button | "Fetch graph remotes" | onClick={async () => { setRemoteBusy(true); try { const remotes = (await api.command({ command: 'remotes' })).result as { name: string }[]; for (const remote of remotes) await api.command({ command: 'fetch', remote: remote.name }); await onRefresh() } catch (error) { setError(errorMessage(error)) } finally { setRemoteBusy(false) } }} |
| editor-graph.tsx:59 | button | "Refresh Git Graph" | onClick={() => { void onRefresh(); setRefresh(value => value + 1) }} |
| editor-graph.tsx:63 | button | {tree ? 'View files as List' : 'View files as Tree'} | onClick={() => setTree(value => !value)} |
| editor-graph.tsx:64 | button | "Close commit details" | onClick={() => { request.current++; setSelected(''); setDetails(undefined) }} |
| editor-graph.tsx:71 | button | {parent} | onClick={() => select(parent)} |
| editor-graph.tsx:76 | a | {part} |  |
| editor-graph.tsx:76 | a | Open pull request form · {branch.name} |  |
| editor-graph.tsx:79 | button | {file.path} | onClick={() => selectedCommit && onFile(selectedCommit, file)} |
| editor-graph.tsx:80 | button | {`Open file ${file.path}`} | onClick={() => onOpenFile(file.path)} |
| editor-graph.tsx:87 | button | "Return to editor" | onClick={onClose} |
| editor-graph.tsx:88 | GraphHistory |  | onCheckout={onCheckout}; onSelect={commit => select(commit.hash)}; onRefresh={onRefresh} |
| editor-graph.tsx:90 | GitTerminal |  | onChanged={onRefresh}; onClose={() => setTerminalOpen(false)} |
| editor-graph.tsx:91 | GraphSettingsDialog |  | onSave={setSettings}; onClose={() => setSettingsOpen(false)}; onCredentials={() => { setSettingsOpen(false); setCredentialsOpen(true) }} |
| editor-graph.tsx:92 | RemoteSettings |  | onClose={() => setCredentialsOpen(false)} |
| file-preview.tsx:23 | button | {value === 'before' ? 'Before' : 'After'} | onClick={() => setSide(value)} |
| file-preview.tsx:71 | button | Previous page | onClick={() => setPageNumber(value => value - 1)} |
| file-preview.tsx:73 | button | Next page | onClick={() => setPageNumber(value => value + 1)} |
| git-terminal.tsx:58 | div | "Resize terminal" | onPointerDown={event => { drag.current = { y: event.clientY, height }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }}; onPointerMove={event => { if (drag.current) { const max = Math.max(150, Math.min(700, (event.currentTarget.parentElement?.parentElement?.clientHeight \|\| 800) - 160)); setHeight(Math.max(150, Math.min(max, drag.current.height + drag.current.y - event.clientY))) } }}; onPointerUp={() => { drag.current = undefined }}; onPointerCancel={() => { drag |
| git-terminal.tsx:63 | button | "Close terminal" | onClick={onClose} |
| git-terminal.tsx:64 | button | Back to bottom ↓ | onClick={() => jumpToBottom.current?.()} |
| graph-history.tsx:100 | button | {label} | onClick={() => action?.()} |
| graph-history.tsx:103 | div |  <label htmlFor="native-git-branch-search">Branches:</label>  <div className="native-git-branch-input"> <input id="native-git-branch-search" className="form-control" role="combobox | onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setPicker(false) }} |
| graph-history.tsx:106 | input | "Filter graph branches" | onFocus={() => { setFilter(''); setPicker(true) }}; onChange={event => { setFilter(event.target.value); setPicker(true) }}; onKeyDown={event => { if (event.key === 'Escape') { setPicker(false); event.currentTarget.blur() } if (event.key === 'ArrowDown') { event.preventDefault(); root.current?.querySelector<HTMLButtonElement>('#native-git-branch-options button')?.focus() } }} |
| graph-history.tsx:111 | button | {branch.name} | onClick={() => { setMode(branch.ref ? 'selected' : 'all'); setRefs(branch.ref ? [branch.ref] : []); setRef(''); setPicker(false) }}; onKeyDown={event => { if (event.key === 'ArrowDown' \|\| event.key === 'ArrowUp') { event.preventDefault(); const next = event.key === 'ArrowDown' ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling; (next as HTMLElement \| null)?.focus() } if (event.key === 'Escape') { setPicker(false); root.current?.querySelector<HTMLInputElement>(' |
| graph-history.tsx:116 | button | "Select history references" | onClick={() => { setDraft(refs.length ? refs : ref ? [ref] : []); setDraftMode(mode); setFilter(''); setPicker(true) }} |
| graph-history.tsx:123 | Dropdown.Toggle | "More graph actions" |  |
| graph-history.tsx:124 | Dropdown.Item | Go to Current History Item | onClick={goCurrent} |
| graph-history.tsx:125 | Dropdown.Item | Fetch From All Remotes | onClick={() => onFetchAll?.()} |
| graph-history.tsx:126 | Dropdown.Item | Pull | onClick={() => onPull?.()} |
| graph-history.tsx:127 | Dropdown.Item | Publish Branch | onClick={() => onPublish?.()} |
| graph-history.tsx:128 | Dropdown.Item | Refresh | onClick={() => { onRefresh?.(); setRefreshVersion(value => value + 1) }} |
| graph-history.tsx:129 | Dropdown.Item | {tree ? 'View as List' : 'View as Tree'} | onClick={() => setTree(value => !value)} |
| graph-history.tsx:135 | Modal | "History references" | onHide={() => setPicker(false)} |
| graph-history.tsx:137 | input | "Filter history references" | onChange={e => setFilter(e.target.value)} |
| graph-history.tsx:138 | input |  | onChange={() => { setDraftMode('all'); setDraft([]) }} |
| graph-history.tsx:139 | input |  | onChange={() => { setDraftMode('auto'); setDraft([]) }} |
| graph-history.tsx:140 | input |  | onChange={e => { setDraftMode('selected'); setDraft(previous => e.target.checked ? [...previous, branch.ref] : previous.filter(ref => ref !== branch.ref)) }} |
| graph-history.tsx:141 | button | OK | onClick={() => { setMode(draftMode); setRef(draftMode === 'auto' ? currentRef : ''); setRefs(draftMode === 'selected' ? draft : []); setPicker(false) }} |
| graph-history.tsx:143 | input | "Search history" | onChange={event => setQuery(event.target.value)} |
| graph-history.tsx:146 | button | {loading ? 'Loading history…' : 'Load earlier commits'} | onClick={loadMore} |
| graph-settings.tsx:20 | Modal | "Graph repository settings" | onHide={() => { if (!busy) onClose() }} |
| graph-settings.tsx:23 | input |  | onChange={e => setDraft({ ...draft, name: e.target.value })} |
| graph-settings.tsx:24 | select | <option value="all">Show All</option> <option value="auto">Current branch</option> <option value="selected">Selected branches</option> | onChange={e => setDraft({ ...draft, initialMode: e.target.value as GraphSettings['initialMode'] })} |
| graph-settings.tsx:25 | select | "Initial selected branches" | onChange={e => setDraft({ ...draft, initialRefs: Array.from(e.target.selectedOptions, option => option.value) })} |
| graph-settings.tsx:26 | input |  | onChange={e => setDraft({ ...draft, [key]: e.target.checked })} |
| graph-settings.tsx:28 | input |  | onChange={e => setDraft({ ...draft, userName: e.target.value })} |
| graph-settings.tsx:29 | input |  | onChange={e => setDraft({ ...draft, userEmail: e.target.value })} |
| graph-settings.tsx:30 | button | Remove override | onClick={() => setDraft({ ...draft, userName: '', userEmail: '' })} |
| graph-settings.tsx:32 | input |  | onChange={e => setDraft({ ...draft, hiddenRemotes: e.target.checked ? draft.hiddenRemotes.filter(name => name !== remote.name) : [...draft.hiddenRemotes, remote.name] })} |
| graph-settings.tsx:33 | button | Fetch | onClick={() => perform(() => api.command({ command: 'fetch', remote: remote.name }))} |
| graph-settings.tsx:34 | button | Edit | onClick={() => setEdit({ name: remote.name, expectedUrl: remote.refs.fetch, fetchUrl: remote.refs.fetch, pushUrl: remote.refs.push })} |
| graph-settings.tsx:35 | button | Remove | onClick={() => setRemove(remote.name)} |
| graph-settings.tsx:36 | button | Remove remote | onClick={() => perform(async () => { await api.command({ command: 'removeRemote', name: remote.name, expectedUrl: remote.refs.fetch }); setRemove(undefined); await reload() })} |
| graph-settings.tsx:38 | button | Add Remote | onClick={() => setEdit({ name: '', fetchUrl: '', pushUrl: '' })} |
| graph-settings.tsx:38 | button | Credentials | onClick={onCredentials} |
| graph-settings.tsx:39 | input |  | onChange={e => setEdit({ ...edit, [key]: e.target.value })} |
| graph-settings.tsx:39 | button | Save remote | onClick={() => perform(async () => { if (edit.expectedUrl) await api.command({ command: 'changeRemote', ...edit, pushUrl: edit.pushUrl \|\| edit.fetchUrl }); else { await api.command({ command: 'addRemote', name: edit.name, url: edit.fetchUrl }); if (edit.pushUrl && edit.pushUrl !== edit.fetchUrl) await api.command({ command: 'changeRemote', ...edit, expectedUrl: edit.fetchUrl }) } setEdit(undefined); await reload() })} |
| graph-settings.tsx:40 | input |  | onChange={e => setDraft({ ...draft, issueUrl: e.target.value })} |
| graph-settings.tsx:41 | input |  | onChange={e => setDraft({ ...draft, pullRequestUrl: e.target.value })} |
| graph-settings.tsx:42 | button | Export Repository Configuration | onClick={() => { const { effectiveUser, ...settings } = draft; const url = URL.createObjectURL(new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'git-graph-settings.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }} |
| graph-settings.tsx:43 | button | Cancel | onClick={onClose} |
| graph-settings.tsx:43 | button | Save settings | onClick={() => perform(async () => { const { effectiveUser, ...settings } = draft; const result = await api.command({ command: 'saveGraphSettings', settings }); onSave({ ...result.result as GraphSettings, effectiveUser: value.effectiveUser }); onClose() })} |
| ignored-files.tsx:10 | Modal | "Ignored files" | onHide={() => { if (!busy) onClose() }} |
| ignored-files.tsx:15 | input | "Search ignored files" | onChange={event => setQuery(event.target.value)} |
| ignored-files.tsx:19 | button | {`Stage ignored file ${path}`} | onClick={() => onStage(path)} |
| ignored-files.tsx:25 | button | Refresh | onClick={onRefresh} |
| ignored-files.tsx:26 | button | Close | onClick={onClose} |
| merge-branch-picker.tsx:16 | Modal | "Merge branch" | onHide={() => { if (!busy) onClose() }} |
| merge-branch-picker.tsx:21 | input | "Search source branches" | onChange={event => { setQuery(event.target.value); setSelected(undefined) }} |
| merge-branch-picker.tsx:25 | input |  | onChange={() => setSelected(branch.ref)} |
| merge-branch-picker.tsx:37 | button | Cancel | onClick={onClose} |
| merge-branch-picker.tsx:38 | button | Merge into {target} | onClick={() => { if (source) onMerge(source.ref) }} |
| remote-settings.tsx:61 | Modal | "Repository settings" | onHide={() => { if (!busy) onClose() }} |
| remote-settings.tsx:67 | select |  {remotes.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}  | onChange={event => { setRemote(event.target.value); setTarget('fetch'); setRemoving(false) }} |
| remote-settings.tsx:70 | select | <option value="fetch">Fetch / Pull</option> <option value="push">Push / Publish</option> | onChange={event => setTarget(event.target.value as 'fetch' \| 'push')} |
| remote-settings.tsx:73 | form |  <label className="native-git-field">Username<input className="form-control" autoComplete="off" value={username} disabled={busy \|\| loading} onChange={event => setUsername(event.tar | onSubmit={event => { event.preventDefault(); void update(false) }} |
| remote-settings.tsx:74 | input |  | onChange={event => setUsername(event.target.value)} |
| remote-settings.tsx:75 | input |  | onChange={event => setToken(event.target.value)} |
| remote-settings.tsx:77 | button | {configured ? 'Replace token' : 'Save token'} |  |
| remote-settings.tsx:78 | button | Remove token | onClick={() => update(true)} |
| remote-settings.tsx:84 | button | Confirm remove remote | onClick={removeRemote} |
| remote-settings.tsx:85 | button | Cancel | onClick={() => setRemoving(false)} |
| remote-settings.tsx:87 | button | Remove remote… | onClick={() => setRemoving(true)} |
| reset-dialog.tsx:30 | Modal | "Reset current branch" | onHide={() => { if (!busy) onClose() }} |
| reset-dialog.tsx:34 | input | "Search reset commits" | onChange={event => { setQuery(event.target.value); setSelected(undefined); setPreview(undefined); setConfirmed(false) }} |
| reset-dialog.tsx:38 | input |  | onChange={() => { setSelected(commit.hash); setPreview(undefined); setConfirmed(false) }} |
| reset-dialog.tsx:43 | button | Preview reset | onClick={refresh} |
| reset-dialog.tsx:49 | input |  | onChange={() => { setMode(option.value); setConfirmed(false) }} |
| reset-dialog.tsx:52 | input |  | onChange={event => setConfirmed(event.target.checked)} |
| reset-dialog.tsx:56 | button | Cancel | onClick={onClose} |
| reset-dialog.tsx:57 | button | Reset branch | onClick={() => { if (preview) onReset(preview, mode) }} |
| source-control-panel.tsx:372 | button | {file.from ? `${file.from} → ${file.path}` : file.path} | onClick={() => { setChangeQueue(undefined); openFileDiff(file.path, inIndex) }} |
| source-control-panel.tsx:376 | button | "Open file in editor" | onClick={() => openProjectFile(file.path)} |
| source-control-panel.tsx:377 | button | {`History ${file.path}`} | onClick={() => openFileHistory(file.path)} |
| source-control-panel.tsx:383 | button | {`Discard changes to ${file.path}`} | onClick={() => previewDiscard(file.path)} |
| source-control-panel.tsx:385 | button | {`${inIndex ? 'Unstage' : 'Stage'} ${file.path}`} | onClick={() => command({ command: inIndex ? 'unstage' : 'stage', paths: [file.path] })} |
| source-control-panel.tsx:421 | ActionSubmenu | {children} | onOpen={() => setSubmenu(label)}; onClose={() => setSubmenu(undefined)} |
| source-control-panel.tsx:424 | Dropdown.Item | Pull… | onClick={() => remoteAction('pull')} |
| source-control-panel.tsx:425 | Dropdown.Item | Push… | onClick={() => remoteAction('push')} |
| source-control-panel.tsx:426 | Dropdown.Item | Clone… | onClick={() => { setError('');setCloneOpen(true) }} |
| source-control-panel.tsx:427 | Dropdown.Item | Checkout to… | onClick={() => setPicker(true)} |
| source-control-panel.tsx:428 | Dropdown.Item | Fetch… | onClick={() => remoteAction('fetch')} |
| source-control-panel.tsx:431 | Dropdown.Item | {scope==='auto'?'Commit':scope==='staged'?'Commit Staged':'Commit All'} | onClick={()=>commitVariant(scope)} |
| source-control-panel.tsx:432 | Dropdown.Item | Undo Last Commit | onClick={undoLastCommit} |
| source-control-panel.tsx:433 | Dropdown.Item | Abort Rebase | onClick={() => command({command:'continueOperation',operation:'rebase',action:'abort'})} |
| source-control-panel.tsx:435 | Dropdown.Item | {scope==='auto'?'Commit (Amend)':scope==='staged'?'Commit Staged (Amend)':'Commit All (Amend)'} | onClick={()=>commitVariant(scope,true)} |
| source-control-panel.tsx:437 | Dropdown.Item | {scope==='auto'?'Commit (Signed Off)':scope==='staged'?'Commit Staged (Signed Off)':'Commit All (Signed Off)'} | onClick={()=>commitVariant(scope,false,true)} |
| source-control-panel.tsx:439 | Dropdown.Item | Cherry-pick… | onClick={() => refAction('Cherry-pick commit', 'cherryPick')} |
| source-control-panel.tsx:440 | Dropdown.Item | Revert commit… | onClick={() => refAction('Revert commit', 'revert')} |
| source-control-panel.tsx:441 | Dropdown.Item | Amend latest commit… | onClick={amendCommit} |
| source-control-panel.tsx:444 | Dropdown.Item | Ignored files… | onClick={openIgnoredFiles} |
| source-control-panel.tsx:445 | Dropdown.Item | File history… | onClick={() => setAction({ title: 'File history', fields: [{ key: 'path', label: 'File path' }], execute: values => openFileHistory(values.path) })} |
| source-control-panel.tsx:447 | Dropdown.Item | Open Changes | onClick={() => openChanges(workingFiles,false)} |
| source-control-panel.tsx:448 | Dropdown.Item | Stage All Changes | onClick={() => command({command:'stage',paths:workingFiles.map(file=>file.path)})} |
| source-control-panel.tsx:449 | Dropdown.Item | Unstage All Changes | onClick={() => command({command:'unstage',paths:indexFiles.map(file=>file.path)})} |
| source-control-panel.tsx:450 | Dropdown.Item | Discard All Changes… | onClick={previewDiscardAll} |
| source-control-panel.tsx:453 | Dropdown.Item | Sync… | onClick={sync} |
| source-control-panel.tsx:456 | Dropdown.Item | Pull | onClick={() => remoteAction('pull')} |
| source-control-panel.tsx:457 | Dropdown.Item | Pull (Rebase)… | onClick={() => remoteAction('pull',false,true)} |
| source-control-panel.tsx:458 | Dropdown.Item | Pull from… | onClick={() => remoteAction('pull')} |
| source-control-panel.tsx:459 | Dropdown.Item | Push | onClick={() => remoteAction('push')} |
| source-control-panel.tsx:460 | Dropdown.Item | Push to… | onClick={() => remoteAction('push')} |
| source-control-panel.tsx:462 | Dropdown.Item | Fetch | onClick={() => remoteAction('fetch')} |
| source-control-panel.tsx:463 | Dropdown.Item | Fetch (Prune)… | onClick={() => setAction({title:'Fetch (Prune)',fields:[{key:'remote',label:'Remote',value:'origin'}],execute:values=>command({command:'fetch',...values,prune:true})})} |
| source-control-panel.tsx:464 | Dropdown.Item | Fetch From All Remotes | onClick={() => run(async () => { const remotes=(await api.command({command:'remotes'})).result as {name:string}[]; for(const remote of remotes) await api.command({command:'fetch',remote:remote.name}); return api.status() })} |
| source-control-panel.tsx:467 | Dropdown.Item | Delete Remote Branch… | onClick={()=>deleteRemoteRef('branch')} |
| source-control-panel.tsx:468 | Dropdown.Item | Merge into current branch… | onClick={mergeBranch} |
| source-control-panel.tsx:469 | Dropdown.Item | Rebase onto… | onClick={() => refAction('Rebase onto', 'rebase')} |
| source-control-panel.tsx:470 | Dropdown.Item | Create branch… | onClick={() => createBranch(false)} |
| source-control-panel.tsx:471 | Dropdown.Item | Create branch from… | onClick={() => createBranch(true)} |
| source-control-panel.tsx:472 | Dropdown.Item | Rename branch… | onClick={() => setAction({ title: 'Rename branch', fields: [ { key: 'from', label: 'Branch', value: status?.branch \|\| '' }, { key: 'to', label: 'New name' }], execute: values => command({ command: 'renameBranch', ...values }) })} |
| source-control-panel.tsx:475 | Dropdown.Item | Delete branch… | onClick={() => setAction({ title: 'Delete merged branch', fields: [{ key: 'name', label: 'Branch name' }], execute: values => command({ command: 'deleteBranch', name: values.name }) })} |
| source-control-panel.tsx:477 | Dropdown.Item | Reset current branch… | onClick={() => { setError(''); setResetOpen(true) }} |
| source-control-panel.tsx:478 | Dropdown.Item | Publish branch… | onClick={() => remoteAction('push', true)} |
| source-control-panel.tsx:482 | Dropdown.Item | Add remote… | onClick={() => setAction({ title: 'Add remote', fields: [ { key: 'name', label: 'Remote name', value: 'origin' }, { key: 'url', label: 'HTTPS repository URL' }], execute: values => command({ command: 'addRemote', ...values }) })} |
| source-control-panel.tsx:485 | Dropdown.Item | Remove Remote… | onClick={() => setSettings(true)} |
| source-control-panel.tsx:488 | Dropdown.Item | Stash | onClick={()=>createStash('tracked')} |
| source-control-panel.tsx:489 | Dropdown.Item | Stash (Include Untracked) | onClick={()=>createStash('include-untracked')} |
| source-control-panel.tsx:490 | Dropdown.Item | Stash Staged | onClick={()=>createStash('staged')} |
| source-control-panel.tsx:492 | Dropdown.Item | Apply Latest Stash | onClick={()=>latestStash()} |
| source-control-panel.tsx:493 | Dropdown.Item | Apply Stash… | onClick={()=>openStashFor('apply')} |
| source-control-panel.tsx:494 | Dropdown.Item | Pop Latest Stash | onClick={()=>latestStash(true)} |
| source-control-panel.tsx:495 | Dropdown.Item | Pop Stash… | onClick={()=>openStashFor('pop')} |
| source-control-panel.tsx:497 | Dropdown.Item | Drop Stash… | onClick={()=>openStashFor('drop')} |
| source-control-panel.tsx:498 | Dropdown.Item | Drop All Stashes… | onClick={dropAllStashes} |
| source-control-panel.tsx:499 | Dropdown.Item | View Stash… | onClick={()=>openStashFor('view')} |
| source-control-panel.tsx:500 | Dropdown.Item | Stashes… | onClick={openStashes} |
| source-control-panel.tsx:503 | Dropdown.Item | Delete Remote Tag… | onClick={()=>deleteRemoteRef('tag')} |
| source-control-panel.tsx:504 | Dropdown.Item | Push Tags… | onClick={()=>setAction({title:'Push Tags',summary:'Push all local tags to the selected remote without replacing existing remote tags.',fields:[{key:'remote',label:'Remote',value:'origin'}],execute:values=>command({command:'pushTags',...values})})} |
| source-control-panel.tsx:505 | Dropdown.Item | Create tag… | onClick={() => setAction({ title: 'Create tag', fields: [{ key: 'name', label: 'Tag name' }, { key: 'ref', label: 'Branch or commit', value: 'HEAD' }], execute: values => command({ command: 'createTag', ...values }) })} |
| source-control-panel.tsx:508 | Dropdown.Item | Delete tag… | onClick={() => setAction({ title: 'Delete local tag', fields: [{ key: 'name', label: 'Tag name' }], execute: values => command({ command: 'deleteTag', name: values.name }) })} |
| source-control-panel.tsx:513 | Dropdown.Item | Create Worktree… | onClick={()=>setAction({title:'Create Worktree',summary:'Create a separate server workspace on a new branch. Keep the current editor and its unfinished files unchanged.',fields:[{key:'name',label:'New branch name'},{key:'from',label:'Start from',value:'HEAD'}],execute:values=>command({command:'createWorktree',...values})})} |
| source-control-panel.tsx:514 | Dropdown.Item | Worktrees… | onClick={openWorktrees} |
| source-control-panel.tsx:518 | Dropdown.Item | Refresh | onClick={() => run(() => api.status())} |
| source-control-panel.tsx:519 | Dropdown.Item | Repository settings… | onClick={() => setSettings(true)} |
| source-control-panel.tsx:520 | Dropdown.Item | Show Git Output | onClick={showGitOutput} |
| source-control-panel.tsx:522 | button | {label} | onClick={() => action()} |
| source-control-panel.tsx:536 | button | "View Git Graph" | onClick={viewGraph} |
| source-control-panel.tsx:537 | Dropdown | <Dropdown.Toggle variant="link" className="native-git-icon-button" aria-label="More changes actions" disabled={busy}>⋯</Dropdown.Toggle>  {createPortal(<Dropdown.Menu className="na | onToggle={open => { setChangesMenuOpen(open); setSubmenu(undefined) }} |
| source-control-panel.tsx:537 | Dropdown.Toggle | "More changes actions" |  |
| source-control-panel.tsx:538 | Dropdown.Menu |  <Dropdown.Item onClick={() => setChangesTree(value => !value)}>{changesTree ? 'View as List' : 'View as Tree'}</Dropdown.Item>  {changesMenuOpen && subgroup('View & Sort', <> <Dro | onMouseOver={event => { if (event.currentTarget.contains(event.target as Node) && !(event.target as Element).closest('.native-git-submenu-trigger')) setSubmenu(undefined) }} |
| source-control-panel.tsx:539 | Dropdown.Item | {changesTree ? 'View as List' : 'View as Tree'} | onClick={() => setChangesTree(value => !value)} |
| source-control-panel.tsx:541 | Dropdown.Item | <span className="native-git-menu-check" aria-hidden="true">{!changesTree ? '✓' : ''}</span> View as List | onClick={() => setChangesTree(false)} |
| source-control-panel.tsx:542 | Dropdown.Item | <span className="native-git-menu-check" aria-hidden="true">{changesTree ? '✓' : ''}</span> View as Tree | onClick={() => setChangesTree(true)} |
| source-control-panel.tsx:544 | Dropdown.Item | <span className="native-git-menu-check" aria-hidden="true">{changesSort === sort ? '✓' : ''}</span> Sort Changes by {sort[0].toUpperCase() + sort.slice(1)} | onClick={() => setChangesSort(sort)} |
| source-control-panel.tsx:547 | Dropdown.Item | View Git Graph | onClick={viewGraph} |
| source-control-panel.tsx:552 | button | Retry | onClick={() => run(() => api.status())} |
| source-control-panel.tsx:556 | button | Initialize repository | onClick={() => run(() => api.initialize())} |
| source-control-panel.tsx:562 | button | Refresh repository status | onClick={() => run(() => api.status())} |
| source-control-panel.tsx:564 | button | Retry | onClick={() => command({ command: 'resumeTransfer' })} |
| source-control-panel.tsx:569 | button | {status?.branch \|\| 'Detached HEAD'} | onClick={() => setPicker(value => !value)} |
| source-control-panel.tsx:572 | Dropdown |  <Dropdown.Toggle className="native-git-icon-button" variant="link" title="More Actions" aria-label="Repository actions" disabled={busy}>⋯</Dropdown.Toggle>  {createPortal(<Dropdow | onToggle={open => { setRepositoryMenuOpen(open); setSubmenu(undefined) }} |
| source-control-panel.tsx:573 | Dropdown.Toggle | "More Actions" |  |
| source-control-panel.tsx:574 | Dropdown.Menu |  {repositoryMenuOpen && repositoryActions()}  | onMouseOver={event => { if (event.currentTarget.contains(event.target as Node) && !(event.target as Element).closest('.native-git-submenu-trigger')) setSubmenu(undefined) }} |
| source-control-panel.tsx:583 | form |  <div className="native-git-message"><input className="form-control" aria-label="Commit message" placeholder="Message describing your changes" value={message} disabled={busy} onCha | onSubmit={event => { event.preventDefault(); void commit() }} |
| source-control-panel.tsx:584 | input | "Commit message" | onChange={event => setMessage(event.target.value)}; onKeyDown={event => { if ((event.metaKey \|\| event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void commit() } }} |
| source-control-panel.tsx:586 | button | "Generate commit message with AI" | onClick={async () => { const result = await command({ command: 'generateMessage' }); if (typeof result?.result === 'string') setMessage(result.result) }} |
| source-control-panel.tsx:590 | button | Commit |  |
| source-control-panel.tsx:595 | button | Continue {status.operation} | onClick={() => command({ command: 'continueOperation', operation: status.operation, action: 'continue' })} |
| source-control-panel.tsx:597 | button | Abort {status.operation} | onClick={() => command({ command: 'continueOperation', operation: status.operation, action: 'abort' })} |
| source-control-panel.tsx:599 | button | Skip commit | onClick={() => command({ command: 'continueOperation', operation: status.operation, action: 'skip' })} |
| source-control-panel.tsx:605 | button | {file.path} | onClick={() => openConflict(file.path)} |
| source-control-panel.tsx:606 | button | {`Resolve ${file.path}`} | onClick={() => openConflict(file.path)} |
| source-control-panel.tsx:622 | GraphHistory |  | onRefresh={() => run(() => api.status())}; onPull={() => remoteAction('pull')}; onPublish={() => remoteAction('push', true)}; onFetchAll={() => run(async () => { const remotes = (await api.command({ command: 'remotes' })).result as { name: string }[] for (const remote of remotes) await api.command({ command: 'fetch', remote: remote.name }) return api.status() })}; onSelect={expandCommit}; onInspect={inspectCommit}; onFile={openCommitFile}; onOpenFile={onOpenFile ? openProjectFile : undefined} |
| source-control-panel.tsx:632 | BranchPicker |  | onClose={() => setPicker(false)}; onCheckout={checkout}; onCreate={createBranch}; onDetached={() => refAction('Checkout detached', 'checkoutDetached')} |
| source-control-panel.tsx:634 | CloneRepository |  | onClose={()=>setCloneOpen(false)} |
| source-control-panel.tsx:635 | ActionDialog |  | onClose={() => setAction(undefined)} |
| source-control-panel.tsx:636 | RemoteSettings |  | onClose={() => { setSettings(false); void run(() => api.status()) }} |
| source-control-panel.tsx:637 | StashManager |  | onClose={() => setStashes(undefined)}; onPreview={(title, text) => { setStashes(undefined); setDiff({ title, text }) }} |
| source-control-panel.tsx:638 | Modal | "File history" | onHide={() => setFileHistory(undefined)} |
| source-control-panel.tsx:642 | button | Line authors | onClick={() => openBlame(fileHistory.path)} |
| source-control-panel.tsx:645 | button | {entry.subject} | onClick={() => { setFileHistory(undefined) void openDiff(entry.subject, { command: 'commitDiff', ref: entry.hash }) }} |
| source-control-panel.tsx:653 | Modal | "Git output" | onHide={() => setGitOutput(undefined)} |
| source-control-panel.tsx:654 | Modal | "Discard all changes" | onHide={() => { if (!busy) setDiscardAll(undefined) }} |
| source-control-panel.tsx:659 | button | Cancel | onClick={() => setDiscardAll(undefined)} |
| source-control-panel.tsx:660 | button | Refresh preview | onClick={previewDiscardAll} |
| source-control-panel.tsx:661 | button | Discard all changes | onClick={async () => { const result = await command({ command: 'discardAll', paths: discardAll.paths, fingerprint: discardAll.fingerprint }); if (result) setDiscardAll(undefined) }} |
| source-control-panel.tsx:664 | Modal | "Discard unstaged changes" | onHide={() => { if (!busy) setDiscard(undefined) }} |
| source-control-panel.tsx:672 | button | Refresh preview | onClick={() => previewDiscard(discard.path)} |
| source-control-panel.tsx:673 | button | Cancel | onClick={() => setDiscard(undefined)} |
| source-control-panel.tsx:674 | button | Discard changes | onClick={async () => { const result = await command({ command: 'discard', paths: [discard.path], fingerprint: discard.fingerprint }) if (result) setDiscard(undefined) }} |
| source-control-panel.tsx:680 | WorktreeManager |  | onClose={() => setWorktrees(undefined)} |
| source-control-panel.tsx:687 | IgnoredFiles |  | onClose={() => setIgnoredFiles(undefined)}; onRefresh={openIgnoredFiles}; onStage={async path => { if (await command({ command: 'stage', paths: [path], force: true })) await openIgnoredFiles() }} |
| source-control-panel.tsx:691 | ResetDialog |  | onClose={() => setResetOpen(false)}; onPreview={async ref => (await command({ command: 'resetDetails', ref }))?.result as ResetPreview \| undefined}; onReset={async (preview, mode) => { if (await command({ command: 'reset', ref: preview.target, mode, fingerprint: preview.fingerprint })) { setResetOpen(false); closeDiff() } }} |
| source-control-panel.tsx:698 | MergeBranchPicker |  | onClose={() => setMergeTarget(undefined)}; onMerge={async ref => { const result = await command({ command: 'merge', ref, expectedBranch: mergeTarget }) if (result) setMergeTarget(undefined) }} |
| source-control-panel.tsx:704 | ConflictEditor |  | onClose={() => setConflict(undefined)}; onResolve={async (choice, text) => { const result = await command({ command: 'resolveConflict', path: conflict.path, fingerprint: conflict.fingerprint, choice, ...(choice === 'edited' ? { text } : {}) }) if (result) setConflict(undefined) }} |
| source-control-panel.tsx:709 | BlameView |  | onClose={() => setBlame(undefined)}; onCommit={async hash => { const result = await command({ command: 'commitDiff', ref: hash }) if (typeof result?.result === 'string') { setBlame(undefined); setDiff({ title: hash.slice(0, 8), text: result.result }) } }} |
| source-control-panel.tsx:714 | EditorGraph |  | onCheckout={branch => void checkout({ ...branch, current: branch.name === status?.branch })}; onClose={() => setGraphOpen(false)}; onFile={openCommitFile}; onOpenFile={onOpenFile ? path => { setGraphOpen(false); void openProjectFile(path) } : undefined}; onRefresh={() => run(() => api.status())} |
| source-control-panel.tsx:715 | EditorDiff | {diff.title} | onClose={closeDiff} |
| source-control-panel.tsx:716 | select | "Changed file" | onChange={event => openFileDiff(event.target.value, changeQueue.staged)} |
| source-control-panel.tsx:720 | button | Refresh diff | onClick={() => diff.file && openFileDiff(diff.file.path, diff.file.staged)} |
| source-control-panel.tsx:722 | PatchComparison |  | onHunk={diff.file?.hunks.length ? applyHunk : undefined} |
| source-control-panel.tsx:730 | Panel |  <section className="native-git-section"> <div className="native-git-section-header" onClick={event => { // Blank header space toggles the section; action controls keep their own b | onCollapse={() => setCollapsed(true)}; onExpand={() => setCollapsed(false)} |
| source-control-panel.tsx:732 | div | <button type="button" className="native-git-section-heading" data-section={title} aria-expanded={!collapsed} onClick={() => collapsed ? expand() : collapse()}><svg className={`nati | onClick={event => { // Blank header space toggles the section; action controls keep their own behavior. if (event.target !== event.currentTarget) return collapsed ? expand() : collapse() }} |
| source-control-panel.tsx:736 | button | <svg className={`native-git-chevron ${collapsed ? '' : 'is-open'}`} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="ro | onClick={() => collapsed ? expand() : collapse()} |
| source-control-panel.tsx:745 | Modal | {action.title} | onHide={() => { if (!busy) onClose() }} |
| source-control-panel.tsx:747 | form |  <Modal.Body>{action.summary && <p>{action.summary}</p>}{error && <p role="alert" className="native-git-error">{error}</p>}{action.fields.map((field, index) => <label className="na | onSubmit={async event => { event.preventDefault(); if (await action.execute(values)) onClose() }} |
| source-control-panel.tsx:749 | textarea |  | onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))} |
| source-control-panel.tsx:750 | input |  | onChange={event => setValues(previous => ({ ...previous, [field.key]: event.target.value }))} |
| source-control-panel.tsx:752 | button | Cancel | onClick={onClose} |
| source-control-panel.tsx:753 | button | {action.submitLabel \|\| 'Continue'} |  |
| source-control-panel.tsx:779 | SourceControlView |  | onOpenFile={openFile} |
| stash-manager.tsx:31 | Modal | "Stashes" | onHide={onClose} |
| stash-manager.tsx:36 | button | Refresh stashes | onClick={async () => { setDeleting(undefined); await reload() }} |
| stash-manager.tsx:44 | button | View changes | onClick={() => action('stashDiff', entry, index)} |
| stash-manager.tsx:45 | button | "Restore changes and keep this stash" | onClick={() => action('applyStash', entry, index)} |
| stash-manager.tsx:46 | button | "Restore changes and remove this stash on success" | onClick={() => action('applyStash', entry, index, true)} |
| stash-manager.tsx:47 | button | Delete… | onClick={() => setDeleting(entry.hash)} |
| stash-manager.tsx:51 | button | Delete stash | onClick={() => action('dropStash', entry, index)} |
| stash-manager.tsx:52 | button | Cancel | onClick={() => setDeleting(undefined)} |
| worktree-manager.tsx:13 | Modal | "Worktrees" | onHide={() => { if (!busy) onClose() }} |
| worktree-manager.tsx:18 | button | Refresh worktrees | onClick={() => { setConfirm(undefined); reload() }} |
| worktree-manager.tsx:23 | button | Clean up workspace… | onClick={() => setConfirm(entry.id)} |
| worktree-manager.tsx:26 | button | Clean up workspace | onClick={async () => { if (await clean(entry)) setConfirm(undefined) }} |
| worktree-manager.tsx:27 | button | Cancel | onClick={() => setConfirm(undefined)} |
