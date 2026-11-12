import { captureGitOutput } from './GitOutput.mjs'
import { simpleGit } from 'simple-git'
import { createHash } from 'node:crypto'
import Path from 'node:path'
import { mkdir, realpath, access, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { readWorktree, writeWorktree } from './WorktreeFiles.mjs'
import { parsePatch, formatPatch } from 'diff'

// This is an adapter, not a Git implementation. All object/index/ref operations
// below run native Git through simple-git. There is no parallel commit database.
export class GitRepository {
  constructor(directory, { worktreeRoot, environment = {}, allowLocalRemotes = false, redactions = [] } = {}) {
    this.directory = Path.resolve(directory)
    this.worktreeRoot = worktreeRoot && Path.resolve(worktreeRoot)
    this.allowLocalRemotes = allowLocalRemotes
    this.options = { worktreeRoot, environment, allowLocalRemotes, redactions }
    this.gitOptions = {
      baseDir: this.directory,
      maxConcurrentProcesses: 1,
      allowEnvironment: ['GIT_TERMINAL_PROMPT', 'GIT_CONFIG_COUNT',
        ...[0, 1, 2].flatMap(i => [`GIT_CONFIG_KEY_${i}`, `GIT_CONFIG_VALUE_${i}`])],
      // Only our constant /dev/null hook path is allowed; never accept caller config.
      unsafe: { allowUnsafeHooksPath: true, allowUnsafeProtocolOverride: true, allowUnsafeEditor: true,
        // Only the fixed credential config constructed below uses this channel.
        allowUnsafeConfigEnvCount: true, allowUnsafeCredentialHelper: true },
      config: ['core.hooksPath=/dev/null', 'core.quotePath=false', 'commit.gpgSign=false', 'tag.gpgSign=false',
        'protocol.ext.allow=never', 'protocol.file.allow=' + (allowLocalRemotes ? 'always' : 'never')],
      timeout: { block: 120000 },
    }
    this.environment = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: 'C.UTF-8', ...environment, GIT_TERMINAL_PROMPT: '0' }
    this.git = simpleGit(this.gitOptions).env(this.environment).outputHandler(captureGitOutput(this.directory,redactions))
  }

  static async init(directory, options = {}, branch = 'main') {
    await mkdir(directory, { recursive: true })
    const repository = new GitRepository(directory, options)
    await repository.git.raw(['init', '--initial-branch', branchName(branch)])
    return repository
  }

  async clone(url, branch) {
    await this.git.clone(remoteUrl(url, this.allowLocalRemotes), this.directory,
      branch ? ['--branch', refName(branch)] : [])
    return this
  }

  async author(name, email) {
    if (![name, email].every(value => typeof value === 'string' && value.trim() && !/[\r\n\0]/.test(value))) {
      throw new Error('A commit author name and email are required')
    }
    await this.git.addConfig('user.name', name, false, 'local')
    await this.git.addConfig('user.email', email, false, 'local')
  }

  async status() {
    const result = await this.git.status()
    return { branch: result.detached ? null : result.current, detached: result.detached, upstream: result.tracking,
      operation: await this.operation(),
      ahead: result.ahead, behind: result.behind, conflicted: result.conflicted,
      files: result.files.map(file => ({ path: file.path, from: file.from,
        index: file.index, workingTree: file.working_dir })) }
  }

  async operation() {
    // Each linked worktree has its own Git directory and operation state.
    const directory = (await this.git.raw(['rev-parse', '--absolute-git-dir'])).trim()
    for (const [marker, operation] of [['rebase-merge', 'rebase'], ['rebase-apply', 'rebase'],
      ['MERGE_HEAD', 'merge'], ['CHERRY_PICK_HEAD', 'cherry-pick'], ['REVERT_HEAD', 'revert']]) {
      try { await access(Path.join(directory, marker)); return operation } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    }
    return null
  }

  async ignoredFiles() {
    return (await this.git.raw(['ls-files', '--others', '--ignored', '--exclude-standard', '-z'])).split('\0').filter(Boolean)
  }
  async stage(paths, force = false) { await this.git.raw(['add', ...(force ? ['--force'] : []), '--', ...literalPaths(paths)]) }
  async unstage(paths) {
    paths = filePaths(paths)
    const renamed = (await this.status()).files.filter(file => file.index === 'R' && file.from && paths.includes(file.path))
    paths = literalPaths([...new Set([...paths, ...renamed.map(file => file.from)])])
    if ((await this.git.raw(['rev-parse', '--verify', '--quiet', 'HEAD']).catch(() => '')).trim()) {
      await this.git.raw(['restore', '--staged', '--', ...paths])
    } else await this.git.raw(['rm', '--cached', '--ignore-unmatch', '--', ...paths])
  }

  async amendDetails() {
    const head = await this.head()
    return { head, branch: (await this.status()).branch,
      message: (await this.git.raw(['log', '-1', '--format=%B', head])).trimEnd() }
  }

  async commitPreview({ all = false, amend = false, signoff = false } = {}) {
    const status = await this.status()
    const head = await this.head().catch(() => null)
    const hash = createHash('sha256').update(JSON.stringify([head, status.branch, status.operation, all, amend, signoff]))
      .update(await this.git.raw(['ls-files', '--stage', '-z']))
    if (all) for (const [path, content] of [...await readWorktree(this.directory)].sort(([a], [b]) => a.localeCompare(b))) {
      hash.update(JSON.stringify([path, content.length])).update(content)
    }
    return { head, branch: status.branch, fingerprint: hash.digest('hex'),
      paths: status.files.filter(file => all || ![' ', '?', '!'].includes(file.index)).map(file => file.path) }
  }

  async commit(message, { amend = false, all = false, signoff = false, expectedHead, expectedBranch, fingerprint } = {}) {
    if (fingerprint && (await this.commitPreview({ all, amend, signoff })).fingerprint !== fingerprint) {
      throw Object.assign(new Error('The branch or selected changes changed. Reopen the commit review before committing.'), { status: 409 })
    }
    if (amend && ((expectedHead && await this.head() !== expectedHead) ||
        (expectedBranch !== undefined && (await this.status()).branch !== expectedBranch))) {
      throw Object.assign(new Error('The current commit or branch changed. Reopen Amend before continuing.'), { status: 409 })
    }
    if (typeof message !== 'string' || !message.trim() || message.includes('\0')) throw new Error('Enter a commit message')
    if (all) {
      const state = await this.status()
      if (state.conflicted.length) throw Object.assign(new Error('Resolve conflicts before committing all changes.'), {status:409})
      if (state.files.length) await this.stage(state.files.map(file => file.path))
    }
    await this.git.commit(message, [...(amend ? ['--amend'] : []), ...(signoff ? ['--signoff'] : [])])
    return this.head()
  }

  async head() { return (await this.git.revparse(['--verify', 'HEAD'])).trim() }
  async resolve(ref) {
    return (await this.git.raw(['rev-parse', '--verify', '--end-of-options', refName(ref) + '^{commit}'])).trim()
  }

  async branches() {
    const output = await this.git.raw(['for-each-ref', '--sort=-committerdate',
      '--format=%(refname)%00%(objectname)%00%(upstream)%00%(authorname)%00%(authoremail)%00%(committerdate:iso-strict)%00%(subject)%00%(symref)',
      'refs/heads', 'refs/remotes'])
    return output.trimEnd().split('\n').filter(Boolean).map(line => {
      const [ref, commit, upstream, author, email, date, subject, symbolic] = line.split('\0')
      return { ref, name: ref.replace(/^refs\/(heads|remotes)\//, ''), commit,
        upstream: upstream || null, author, email, date, subject, remote: ref.startsWith('refs/remotes/'), symbolic }
    }).filter(branch => !branch.symbolic)
  }

  async graph({ limit = 100, skip = 0, all = true, ref, refs, query, showRemotes = true, showTags = true, showStashes = true, includeReflogs = false, firstParent = false, hiddenRemotes = [] } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid history limit')
    if (!Number.isSafeInteger(skip) || skip < 0) throw new Error('Invalid history offset')
    if (query !== undefined && (typeof query !== 'string' || query.length > 1024 || /[\0\r\n]/.test(query))) throw new Error('Invalid history search')
    if (query?.trim()) {
      // Let Git traverse and order history. Filter bounded native log pages so
      // author, hash, refs and subject share the same literal search semantics.
      const needle = query.trim().toLowerCase()
      const matches = []
      let matched = 0
      for (let offset = 0; ; offset += 500) {
        const rows = await this.graph({ limit: 500, skip: offset, all, ref, refs, showRemotes, showTags, showStashes, includeReflogs, firstParent, hiddenRemotes })
        for (const row of rows) {
          if (`${row.subject} ${row.author} ${row.email} ${row.hash} ${row.refs}`.toLowerCase().includes(needle)) {
            if (matched++ >= skip) matches.push(row)
            if (matches.length === limit) return matches
          }
        }
        if (rows.length < 500) return matches
      }
    }
    const options = { maxCount: limit, '--skip': skip, '--topo-order': null,
      format: { hash: '%H', parents: '%P', author: '%an', email: '%ae', date: '%cI', subject: '%s', refs: '%D' } }
    if (!(await this.git.raw(['rev-list', '--all', '--max-count=1'])).trim()) return []
    if (refs?.length) { for (const item of refs) options[await this.resolve(item)] = null }
    else if (ref) options[await this.resolve(ref)] = null
    else if (all) {
      options['--branches'] = null
      if (showRemotes) { for (const name of hiddenRemotes) options[`--exclude=${remoteName(name)}/*`] = null; options['--remotes'] = null }
      if (showTags) options['--tags'] = null
      if (showStashes && (await this.git.raw(['for-each-ref', '--format=%(objectname)', 'refs/stash'])).trim()) options['refs/stash'] = null
      options.HEAD = null
    }
    if (includeReflogs) options['--reflog'] = null
    if (firstParent) options['--first-parent'] = null
    const log = await this.git.log(options)
    return log.all.map(commit => ({ ...commit, parents: commit.parents.split(' ').filter(Boolean) }))
  }

  async diff({ paths = [], staged = false, from, to } = {}) {
    const args = ['--no-ext-diff', '--no-textconv', '--no-color']
    if (staged) args.push('--cached')
    if (from) args.push(await this.resolve(from))
    if (to) args.push(await this.resolve(to))
    return this.git.diff([...args, '--', ...(paths.length ? literalPaths(paths) : [])])
  }

  async fileDiff(path, staged = false) {
    path = filePaths([path])[0]
    const file = (await this.status()).files.find(file => file.path === path)
    if (staged || file?.index !== '?') return this.diff({ paths: staged && file?.index === 'R' && file.from ? [file.from, path] : [path], staged })
    // Native diff --no-index returns 1 when files differ, including additions.
    // Accept that code only on this dedicated diff-only invocation.
    const git = simpleGit({ ...this.gitOptions, errors: (error, result) => result.exitCode === 1 &&
      Buffer.concat(result.stdOut).length > 0 && Buffer.concat(result.stdErr).length === 0 ? undefined : error }).env(this.environment)
    return git.diff(['--no-index', '--no-ext-diff', '--no-textconv', '--no-color', '--', '/dev/null', path])
  }

  async fileHunks(path, staged = false) {
    path = filePaths([path])[0]
    const text = await this.fileDiff(path, staged)
    const fingerprint = createHash('sha256').update(text).digest('hex')
    const file = (await this.status()).files.find(file => file.path === path)
    // Creation, deletion, rename and binary changes keep the whole-file action.
    if ((staged ? file?.index : file?.workingTree) !== 'M') return { text, fingerprint, hunks: [] }
    const patches = parsePatch(text)
    if (patches.length !== 1) return { text, fingerprint, hunks: [] }
    return { text, fingerprint, hunks: patches[0].hunks.map((hunk, index) => ({ index,
      oldStart: hunk.oldStart, newStart: hunk.newStart, lines: hunk.lines })) }
  }

  async applyHunks(path, selected, fingerprint, staged = false) {
    const current = await this.fileHunks(path, staged)
    if (current.fingerprint !== fingerprint) throw Object.assign(new Error('The diff changed. Reopen it before selecting changes.'), { status: 409 })
    if (!Array.isArray(selected) || !selected.length || new Set(selected).size !== selected.length ||
      selected.some(index => !Number.isInteger(index) || index < 0 || index >= current.hunks.length)) {
      throw Object.assign(new Error('Select valid diff hunks'), { status: 400 })
    }
    const patch = parsePatch(current.text)[0]
    patch.hunks = patch.hunks.filter((_, index) => selected.includes(index))
    const directory = await mkdtemp(Path.join(tmpdir(), 'overleaf-git-patch-'))
    try {
      const file = Path.join(directory, 'selected.patch')
      await writeFile(file, formatPatch(patch), { mode: 0o600 })
      await this.git.raw(['apply', '--cached', '--whitespace=nowarn', ...(staged ? ['--reverse'] : []), '--', file])
    } finally { await rm(directory, { recursive: true, force: true }) }
  }

  async show(ref, path) {
    const commit = await this.resolve(ref)
    return this.git.show([`${commit}:${filePaths([path])[0]}`])
  }

  async fileHistory(path, { ref = 'HEAD', limit = 100 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid history limit')
    const commit = await this.resolve(ref)
    const output = await this.git.raw(['log', '--follow', `--max-count=${limit}`,
      '--format=%H%x00%P%x00%an%x00%ae%x00%cI%x00%s%x00', commit, '--', ...literalPaths([path])])
    const fields = output.split('\0')
    const history = []
    for (let i = 0; i + 5 < fields.length; i += 6) {
      const [hash, parents, author, email, date, subject] = fields.slice(i, i + 6)
      history.push({ hash: hash.trim(), parents: parents.split(' ').filter(Boolean), author, email, date, subject })
    }
    return history
  }

  async blame(path, ref = 'HEAD') {
    // Keep Git's line-porcelain output: every line carries its own commit and
    // author metadata, including renamed files and boundary commits.
    return this.git.raw(['blame', '--line-porcelain', '--no-textconv',
      await this.resolve(ref), '--', filePaths([path])[0]])
  }

  async commitDiff(ref) {
    return this.git.raw(['show', '--format=', '--no-ext-diff', '--no-textconv', '--no-color',
      '--find-renames', '--patch', await this.resolve(ref), '--'])
  }

  async commitFiles(ref) {
    const hash = await this.resolve(ref)
    const ancestry = (await this.git.raw(['rev-list', '--parents', '-n', '1', hash])).trim().split(' ')
    const range = ancestry[1] ? ['diff', ancestry[1], hash] : ['diff-tree', '--root', '-r', '--no-commit-id', hash]
    const names = (await this.git.raw([...range, '--name-status', '-z', '--find-renames', '--'])).split('\0')
    const files = []
    for (let i = 0; i < names.length && names[i];) {
      const status = names[i++][0]
      const first = names[i++]
      if (!first) break
      const renamed = status === 'R' || status === 'C'
      const path = renamed ? names[i++] : first
      files.push({ path, status, ...(renamed ? { from: first } : {}) })
    }
    const stats = await this.git.raw([...range, '--shortstat', '--find-renames', '--'])
    return { files, insertions: Number(stats.match(/(\d+) insertion/)?.[1] || 0),
      deletions: Number(stats.match(/(\d+) deletion/)?.[1] || 0), parent: ancestry[1] || null }
  }

  async commitDetails(ref) {
    const hash = await this.resolve(ref)
    const [id, parents, author, email, committer, committerEmail, authorDate, date, message] = (await this.git.raw(['show', '-s', '--format=%H%x00%P%x00%an%x00%ae%x00%cn%x00%ce%x00%aI%x00%cI%x00%B', hash, '--'])).split('\0')
    const details = await this.commitFiles(hash)
    const range = details.parent ? ['diff', details.parent, hash] : ['diff-tree', '--root', '-r', '--no-commit-id', hash]
    const stats = (await this.git.raw([...range, '--numstat', '-z', '--find-renames', '--'])).split('\0')
    const byPath = new Map()
    for (let i = 0; i < stats.length && stats[i];) {
      const item = stats[i++]; const first = item.indexOf('\t'), second = item.indexOf('\t', first + 1)
      const added = item.slice(0, first), removed = item.slice(first + 1, second)
      let path = item.slice(second + 1)
      if (!path) { i++; path = stats[i++] }
      byPath.set(path, { insertions: added === '-' ? null : Number(added), deletions: removed === '-' ? null : Number(removed) })
    }
    return { ...details, hash: id, parents: parents.split(' ').filter(Boolean), author, email, committer, committerEmail, authorDate, date,
      message: message.replace(/\n$/, ''), files: details.files.map(file => ({ ...file, ...byPath.get(file.path) })) }
  }

  async commitFileDiff(ref, path) {
    const hash = await this.resolve(ref)
    const details = await this.commitFiles(hash)
    const file = details.files.find(file => file.path === path)
    if (!file) throw Object.assign(new Error('File is not changed by this commit'), { status: 404 })
    return this.git.raw(['show', '--format=', '--first-parent', '-m', '--no-ext-diff', '--no-textconv',
      '--no-color', '--find-renames', '--patch', hash, '--', ...literalPaths(file.from ? [file.from, path] : [path])])
  }

  async commitFilePreview(ref, path) {
    const mime = previewMime(path)
    literalPaths([path])
    const hash = await this.resolve(ref)
    const details = await this.commitFiles(hash)
    const file = details.files.find(file => file.path === path)
    if (!file) throw Object.assign(new Error('File is not changed by this commit'), { status: 400 })
    const load = async (revision, filename) => {
      const object = revision + ':' + filename
      const size = Number((await this.git.raw(['cat-file', '-s', object])).trim())
      if (size > 32 * 1024 * 1024) throw Object.assign(new Error('Preview supports files up to 32 MB'), { status: 400 })
      const data = await this.git.binaryCatFile(['blob', object])
      return { mime, base64: data.toString('base64'), size }
    }
    return {
      before: details.parent && file.status !== 'A' ? await load(details.parent, file.from || path) : null,
      after: file.status !== 'D' ? await load(hash, path) : null,
    }
  }

  async filePreview(path, staged = false) {
    const mime = previewMime(path)
    literalPaths([path])
    const status = await this.status()
    const file = status.files.find(file => file.path === path)
    if (!file) throw Object.assign(new Error('This file has no changes'), { status: 400 })
    const index = (await this.git.raw(['ls-files', '--stage', '-z', '--', ...literalPaths([path])])).split('\0').find(line => /^[0-7]+ [a-f0-9]+ 0\t/.test(line))
    const indexHash = index?.split(' ')[1]
    const blob = async hash => {
      if (!hash) return null
      const size = Number((await this.git.raw(['cat-file', '-s', hash])).trim())
      if (size > 32 * 1024 * 1024) throw Object.assign(new Error('Preview supports files up to 32 MB'), { status: 400 })
      return previewData(await this.git.binaryCatFile(['blob', hash]), mime)
    }
    if (staged) {
      const head = await this.head().catch(() => null)
      const tree = head ? await this.git.raw(['ls-tree', '-z', head, '--', ...literalPaths([file.from || path])]) : ''
      const hash = tree.match(/^[0-7]+ blob ([a-f0-9]+)\t/)?.[1]
      return { before: await blob(hash), after: await blob(indexHash) }
    }
    const content = (await readWorktree(this.directory)).get(path)
    return { before: await blob(indexHash), after: content ? previewData(content, mime) : null }
  }

  async stagedContext() {
    const status = await this.status()
    if (status.conflicted.length) throw Object.assign(new Error('Resolve conflicts before generating a commit message'), { status: 409 })
    const selected = status.files.filter(file => ![' ', '?', '!'].includes(file.index))
    if (!selected.length) throw Object.assign(new Error('Stage files to generate a commit message'), { status: 409 })
    const diff = await this.diff({ staged: true })
    if (diff.length > 100000) throw Object.assign(new Error('The selected diff is too large; stage a smaller group of files'), { status: 400 })
    const tree = (await this.git.raw(['write-tree'])).trim()
    const head = await this.head().catch(() => null)
    let remaining = 64000
    const files = []
    for (const file of selected) {
      const path = filePaths([file.path])[0]
      const content = file.index === 'D' ? '' : await this.git.show([`:${path}`])
      const binary = content.includes('\0')
      const excerpt = binary ? '' : content.slice(0, Math.max(0, remaining))
      remaining -= excerpt.length
      files.push({ path, status: file.index, binary, content: excerpt, truncated: !binary && content.length > excerpt.length })
    }
    return { tree, head, diff, files }
  }

  async createBranch(name, from = 'HEAD') {
    await this.git.raw(['branch', '--', branchName(name), await this.resolve(from)])
  }
  async trackBranch(name, remoteRef) {
    name = branchName(name)
    if (typeof remoteRef !== 'string' || !remoteRef.startsWith('refs/remotes/')) throw new Error('Select a remote branch')
    await this.resolve(remoteRef)
    await this.git.raw(['branch', '--track', '--', name, remoteRef])
  }
  async renameBranch(name, next) { await this.git.raw(['branch', '-m', branchName(name), branchName(next)]) }
  async deleteBranch(name, { force = false } = {}) {
    name = branchName(name)
    const occupied = (await this.worktrees()).find(item => item.branch === `refs/heads/${name}`)
    if (occupied) {
      const current = Path.resolve(occupied.directory) === this.directory
      throw Object.assign(new Error(current
        ? 'Switch to another branch before deleting the current branch.'
        : `Branch "${name}" has a retained worktree. Open Worktrees… and clean its worktree before deleting the branch. Uncommitted work is preserved.`), { status: 409 })
    }
    await this.git.raw(['branch', force ? '-D' : '-d', '--', name])
  }

  async worktrees() {
    const output = await this.git.raw(['worktree', 'list', '--porcelain', '-z'])
    return output.split('\0\0').filter(Boolean).map(record => {
      const fields = Object.fromEntries(record.split('\0').filter(Boolean).map(line => {
        const space = line.indexOf(' ')
        return space < 0 ? [line, true] : [line.slice(0, space), line.slice(space + 1)]
      }))
      return { directory: fields.worktree, head: fields.HEAD, branch: fields.branch || null,
        detached: fields.detached === true, locked: fields.locked !== undefined }
    })
  }

  async managedWorktrees() {
    const currentDirectory = await realpath(this.directory)
    const result = []
    const items = await this.worktrees()
    for (let index = 0; index < items.length; index++) {
      const item = items[index]
      const worktree = await this.openWorktree(item.directory)
      const status = await worktree.git.status(['--ignored'])
      const changedFiles = status.files.length + (status.ignored?.length || 0)
      const operation = await worktree.operation()
      const retained = item.detached
        ? (await this.git.raw(['for-each-ref', '--format=%(refname)', `--contains=${item.head}`, 'refs/heads', 'refs/tags', 'refs/remotes'])).trim().length > 0
        : true
      const current = item.directory === currentDirectory
      const reason = current ? 'Current workspace' : index === 0 ? 'Main repository'
        : item.locked ? 'Locked worktree' : operation ? `${operation} in progress` : changedFiles ? 'Contains uncommitted or ignored files'
          : !retained ? 'Create a branch or tag to retain this detached commit' : null
      result.push({ id: createHash('sha256').update(item.directory).digest('hex'), head: item.head,
        branch: item.branch?.replace(/^refs\/heads\//, '') || null, detached: item.detached,
        current, main: index === 0, locked: item.locked, changedFiles, cleanupBlocked: reason })
    }
    return result
  }

  async cleanWorktree(id, expectedHead) {
    const view = (await this.managedWorktrees()).find(item => item.id === id)
    if (!view || view.head !== expectedHead) throw Object.assign(new Error('The worktree changed. Refresh the list.'), { status: 409 })
    if (view.cleanupBlocked) throw Object.assign(new Error(view.cleanupBlocked), { status: 409 })
    const item = (await this.worktrees()).find(item => createHash('sha256').update(item.directory).digest('hex') === id)
    if (!item) throw Object.assign(new Error('The worktree no longer exists.'), { status: 409 })
    await this.removeWorktree(item.directory)
  }

  // Each branch gets a native worktree and index. Switching the editor's binding
  // never checks out over another branch's dirty files, or commits them implicitly.
  async branchWorktree(name) {
    name = branchName(name)
    const ref = `refs/heads/${name}`
    await this.resolve(ref)
    const existing = (await this.worktrees()).find(worktree => worktree.branch === ref)
    if (existing) return this.openWorktree(existing.directory)
    if (!this.worktreeRoot) throw new Error('Worktree storage is not configured')
    await mkdir(this.worktreeRoot, { recursive: true })
    const directory = Path.join(this.worktreeRoot, createHash('sha256').update(ref).digest('hex'))
    await this.git.raw(['worktree', 'add', '--', directory, name])
    return this.openWorktree(directory)
  }
  async detachedWorktree(ref) {
    const commit = await this.resolve(ref)
    if (!this.worktreeRoot) throw new Error('Worktree storage is not configured')
    await mkdir(this.worktreeRoot, { recursive: true })
    const directory = Path.join(this.worktreeRoot, `detached-${commit}`)
    const existing = (await this.worktrees()).find(worktree => worktree.directory === directory)
    if (!existing) await this.git.raw(['worktree', 'add', '--detach', '--', directory, commit])
    return this.openWorktree(directory)
  }
  async openWorktree(directory) {
    const resolved = await realpath(directory)
    if (!(await this.worktrees()).some(worktree => worktree.directory === resolved)) throw new Error('Unknown worktree')
    return new GitRepository(resolved, this.options)
  }
  async removeWorktree(directory) {
    const worktree = await this.openWorktree(directory)
    // Native Git refuses a dirty or locked worktree; never --force here.
    await this.git.raw(['worktree', 'remove', '--', worktree.directory])
  }

  async changeRemote({ name, expectedUrl, fetchUrl, pushUrl }) {
    name = remoteName(name)
    if (await this.remoteUrl(name) !== expectedUrl) throw Object.assign(new Error('The remote URL changed. Refresh settings.'), { status: 409 })
    fetchUrl = remoteUrl(fetchUrl, this.allowLocalRemotes); pushUrl = remoteUrl(pushUrl, this.allowLocalRemotes)
    await this.git.raw(['remote', 'set-url', name, fetchUrl])
    await this.git.raw(['remote', 'set-url', '--push', name, pushUrl])
  }
  async remotes() { return this.git.getRemotes(true) }
  async remoteUrl(name, push = false) {
    const urls = (await this.git.raw(['remote', 'get-url', '--all', ...(push ? ['--push'] : []), remoteName(name)])).trim().split('\n')
    if (urls.length !== 1) throw new Error('Select a remote with one repository URL')
    const url = urls[0]
    return remoteUrl(url, this.allowLocalRemotes)
  }
  async withRemoteCredentials(url, credential, action) {
    url = remoteUrl(url, this.allowLocalRemotes)
    // Credentials are process-local, never command arguments or .git/config.
    // Disable stored helpers and redirects so a token cannot follow another URL.
    const config = [['credential.helper', ''], ['http.followRedirects', 'false']]
    let authorization
    if (credential) {
      if (credential.url !== url) throw new Error('Credential repository mismatch')
      authorization = Buffer.from(`${credential.username}:${credential.token}`).toString('base64')
      config.push([`http.${url}.extraHeader`, `Authorization: Basic ${authorization}`])
    }
    const environment = { ...this.environment, GIT_CONFIG_COUNT: String(config.length) }
    config.forEach(([key, value], i) => { environment[`GIT_CONFIG_KEY_${i}`] = key; environment[`GIT_CONFIG_VALUE_${i}`] = value })
    const repository = new GitRepository(this.directory, { ...this.options, environment, redactions: [...(this.options.redactions || []), credential?.token, authorization].filter(Boolean) })
    try { return await action(repository) } catch (error) {
      let message = String(error.message || 'Git remote operation failed')
      for (const secret of [credential?.token, authorization].filter(Boolean)) message = message.split(secret).join('[redacted]')
      if (/could not read (Username|Password)|authentication failed|incorrect username or password|access denied/i.test(message)) {
        throw Object.assign(new Error(credential
          ? 'Repository authentication was rejected. Check your login username and access token permissions, then retry.'
          : 'This repository requires authentication. Enter your repository login username and access token.'), { status: 400 })
      }
      message = message.replace(/Cloning into [^\n]+\n/g, '').split(this.directory).join('[repository]').trim()
      throw Object.assign(new Error(message), { status: 502 })
    }
  }
  async addRemote(name, url) { await this.git.addRemote(remoteName(name), remoteUrl(url, this.allowLocalRemotes)) }
  async removeRemote(name, expectedUrl) {
    name = remoteName(name)
    if (expectedUrl && (await this.remotes()).find(remote => remote.name === name)?.refs.fetch !== expectedUrl) {
      throw Object.assign(new Error('The remote address changed. Reopen repository settings before removing it.'), { status: 409 })
    }
    await this.git.removeRemote(name)
  }
  async fetch(remote = 'origin', { prune = false } = {}) { await this.git.fetch(remoteName(remote), [...(prune ? ['--prune'] : []), '--tags']) }
  async pull(remote = 'origin', branch, { rebase = false } = {}) {
    await this.git.pull(remoteName(remote), refName(branch), rebase ? ['--rebase'] : ['--no-rebase'])
  }
  async push(remote = 'origin', branch, { publish = false } = {}) {
    await this.git.push(remoteName(remote), branchName(branch), publish ? ['--set-upstream'] : [])
  }
  async merge(ref, expectedBranch) {
    if (expectedBranch && (await this.status()).branch !== expectedBranch) {
      throw Object.assign(new Error('The current branch changed. Reopen Merge and check the target branch.'), { status: 409 })
    }
    await this.git.merge(['--no-edit', await this.resolve(ref)])
  }
  async rebase(ref) { await this.git.rebase([await this.resolve(ref)]) }
  async cherryPick(ref) { await this.git.raw(['cherry-pick', await this.resolve(ref)]) }
  async revert(ref) { await this.git.raw(['revert', '--no-edit', await this.resolve(ref)]) }
  async undoDetails() {
    const preview = await this.resetDetails('HEAD')
    if ((await this.status()).operation) throw Object.assign(new Error('Finish or abort the current Git operation before undoing a commit.'), {status:409})
    const parent = (await this.git.raw(['rev-list', '--parents', '-n', '1', preview.head])).trim().split(/\s+/)[1] || null
    if (!parent && !preview.branch) throw Object.assign(new Error('Checkout a branch before undoing its initial commit.'), {status:409})
    return {...preview, target:parent}
  }
  async undoCommit(fingerprint) {
    const preview = await this.undoDetails()
    if (preview.fingerprint !== fingerprint) throw Object.assign(new Error('The branch, index or files changed. Review Undo again.'), {status:409})
    if (preview.target) await this.git.reset(['--soft', preview.target])
    else await this.git.raw(['update-ref', '-d', `refs/heads/${branchName(preview.branch)}`, preview.head])
  }

  async resetDetails(ref) {
    const target = await this.resolve(ref)
    const head = await this.head()
    const status = await this.status()
    const hash = createHash('sha256').update(JSON.stringify([target, head, status.branch, status.operation]))
      .update(await this.git.raw(['ls-files', '--stage', '-z']))
    for (const [path, content] of [...await readWorktree(this.directory)].sort(([a], [b]) => a.localeCompare(b))) {
      hash.update(JSON.stringify([path, content.length])).update(content)
    }
    return { target, head, branch: status.branch, fingerprint: hash.digest('hex'),
      changes: await this.git.raw(['diff', '--stat', target, '--']),
      untracked: status.files.filter(file => file.index === '?').map(file => file.path) }
  }
  async reset(ref, mode = 'mixed', fingerprint) {
    if (fingerprint && (await this.resetDetails(ref)).fingerprint !== fingerprint) {
      throw Object.assign(new Error('The branch, index or files changed. Refresh the reset preview before continuing.'), { status: 409 })
    }
    if (!['soft', 'mixed', 'hard'].includes(mode)) throw new Error('Invalid reset mode')
    await this.git.reset([`--${mode}`, await this.resolve(ref)])
  }
  async conflictDetails(path) {
    path = filePaths([path])[0]
    const index = await this.git.raw(['ls-files', '--unmerged', '-z', '--', ...literalPaths([path])])
    const entries = index.split('\0').filter(Boolean).map(record => {
      const match = /^(\d+) ([a-f0-9]+) ([123])\t/.exec(record)
      if (!match) throw new Error('Invalid native conflict entry')
      return { mode: match[1], hash: match[2], stage: Number(match[3]) }
    })
    if (!entries.length) throw Object.assign(new Error('This file no longer has unresolved conflicts. Refresh repository status.'), { status: 409 })
    if (entries.some(entry => !['100644', '100755'].includes(entry.mode))) {
      throw Object.assign(new Error('This conflict contains a symbolic link or submodule and cannot be edited as a project file.'), { status: 400 })
    }
    const files = await readWorktree(this.directory)
    const content = files.get(path)
    const fingerprint = createHash('sha256').update(await this.head()).update(index)
      .update(content ? 'present' : 'missing').update(content || Buffer.alloc(0)).digest('hex')
    const preview = bytes => {
      if (!bytes) return { kind: 'deleted', text: null }
      if (bytes.length > 1024 * 1024) return { kind: 'large', text: null }
      const text = bytes.toString('utf8')
      return text.includes('\0') || text.includes('\ufffd') ? { kind: 'binary', text: null } : { kind: 'text', text }
    }
    const versions = {}
    for (const [name, stage] of [['base', 1], ['current', 2], ['incoming', 3]]) {
      const entry = entries.find(entry => entry.stage === stage)
      if (!entry) versions[name] = preview(null)
      else {
        const size = Number((await this.git.raw(['cat-file', '-s', entry.hash])).trim())
        versions[name] = size > 1024 * 1024 ? { kind: 'large', text: null }
          : preview(Buffer.from(await this.git.raw(['cat-file', 'blob', entry.hash]), 'utf8'))
      }
    }
    return { path, fingerprint, versions, working: preview(content), operation: (await this.status()).operation }
  }

  async resolveConflict(path, fingerprint, choice, text) {
    const details = await this.conflictDetails(path)
    if (details.fingerprint !== fingerprint) throw Object.assign(new Error('The conflicted file changed. Refresh it before resolving.'), { status: 409 })
    if (!['current', 'incoming', 'edited'].includes(choice)) throw new Error('Invalid conflict resolution')
    if (choice === 'edited') {
      if (details.working.kind !== 'text' || typeof text !== 'string' || Buffer.byteLength(text) > 2 * 1024 * 1024) {
        throw Object.assign(new Error('Only text conflicts can be edited here.'), { status: 400 })
      }
      const files = await readWorktree(this.directory)
      files.set(path, Buffer.from(text))
      await writeWorktree(this.directory, files)
      await this.stage([path])
    } else if (details.versions[choice].kind === 'deleted') {
      await this.git.raw(['rm', '--force', '--', ...literalPaths([path])])
    } else {
      await this.git.raw(['checkout', choice === 'current' ? '--ours' : '--theirs', '--', ...literalPaths([path])])
      await this.stage([path])
    }
  }

  async continueOperation(operation, action) {
    if (!['merge', 'rebase', 'cherry-pick', 'revert'].includes(operation) || !['continue', 'abort', 'skip'].includes(action)) {
      throw new Error('Invalid Git operation')
    }
    await this.git.raw(['-c', 'core.editor=true', operation, `--${action}`])
  }
  async stash(message = 'Unfinished work', { mode = 'tracked' } = {}) {
    if (!['tracked','include-untracked','staged'].includes(mode)) throw new Error('Invalid stash mode')
    await this.git.stash(['push', ...(mode === 'include-untracked' ? ['--include-untracked'] : mode === 'staged' ? ['--staged'] : []), '--message', message])
  }
  async dropAllStashes(expectedHashes) {
    const actual = (await this.stashes()).map(entry => entry.hash)
    if (!Array.isArray(expectedHashes) || JSON.stringify(actual) !== JSON.stringify(expectedHashes)) throw Object.assign(new Error('The stash list changed. Review it again before deleting.'), {status:409})
    await this.git.stash(['clear'])
  }
  async createWorktree(name, from = 'HEAD') {
    name = branchName(name)
    if (!this.worktreeRoot) throw new Error('Worktree storage is not configured')
    const commit = await this.resolve(from)
    await mkdir(this.worktreeRoot,{recursive:true})
    const directory = Path.join(this.worktreeRoot,createHash('sha256').update(`refs/heads/${name}`).digest('hex'))
    await this.git.raw(['worktree','add','-b',name,'--',directory,commit])
    return {branch:name,head:commit}
  }
  async remoteRef(remote, kind, name) {
    remote = remoteName(remote)
    if (!['branch','tag'].includes(kind)) throw new Error('Invalid remote reference kind')
    name = branchName(name)
    const ref = `refs/${kind === 'branch' ? 'heads' : 'tags'}/${name}`
    const output = await this.git.raw(['ls-remote','--refs',await this.remoteUrl(remote,true),ref])
    const match = output.trim().split('\n').map(line=>line.split(/\s+/)).find(parts=>parts[1]===ref)
    if (!match || !/^[a-f0-9]{40,64}$/.test(match[0])) throw new Error('Remote reference does not exist')
    return {remote,kind,name,ref,hash:match[0]}
  }
  async deleteRemoteRef(remote, kind, name, expectedHash) {
    if (!/^[a-f0-9]{40,64}$/.test(expectedHash || '')) throw new Error('Review the remote reference before deleting')
    const item=await this.remoteRef(remote,kind,name)
    if(item.hash!==expectedHash) throw Object.assign(new Error('Remote reference changed. Review it again before deleting.'),{status:409})
    await this.git.raw(['push',`--force-with-lease=${item.ref}:${expectedHash}`,remoteName(remote),`:${item.ref}`])
  }
  async pushTags(remote) { await this.git.push(remoteName(remote),['--tags']) }

  async stashes() { return (await this.git.stashList()).all }
  async checkStash(index, expectedHash) {
    if (!Number.isInteger(index) || index < 0) throw new Error('Invalid stash')
    const ref = `stash@{${index}}`
    const hash = await this.resolve(ref)
    if (expectedHash && hash !== expectedHash) throw Object.assign(new Error('The stash list changed. Refresh it before choosing an entry.'), { status: 409 })
    return ref
  }
  async stashDiff(index, expectedHash) {
    const ref = await this.checkStash(index, expectedHash)
    return this.git.raw(['stash', 'show', '--patch', '--include-untracked', '--no-ext-diff', '--no-textconv', ref])
  }
  async applyStash(index, { pop = false, expectedHash } = {}) {
    await this.checkStash(index, expectedHash)
    await this.git.stash([pop ? 'pop' : 'apply', '--index', `stash@{${index}}`])
  }
  async dropStash(index, expectedHash) {
    await this.checkStash(index, expectedHash)
    await this.git.stash(['drop', `stash@{${index}}`])
  }
  async tagRefs() {
    const fields = ['refname', 'objecttype', 'objectname', 'authorname', 'authoremail', 'committerdate:iso-strict', 'subject',
      '*objecttype', '*objectname', '*authorname', '*authoremail', '*committerdate:iso-strict', '*subject']
    const output = await this.git.raw(['for-each-ref', '--sort=-creatordate', '--format=' + fields.map(field => `%(${field})`).join('%00'), 'refs/tags'])
    return output.trimEnd().split('\n').filter(Boolean).flatMap(line => {
      const [ref, type, hash, author, email, date, subject, peeledType, peeledHash, peeledAuthor, peeledEmail, peeledDate, peeledSubject] = line.split('\0')
      if (type !== 'commit' && peeledType !== 'commit') return []
      const annotated = type === 'tag'
      return [{ ref, name: ref.slice('refs/tags/'.length), commit: annotated ? peeledHash : hash,
        author: annotated ? peeledAuthor : author, email: annotated ? peeledEmail : email,
        date: annotated ? peeledDate : date, subject: annotated ? peeledSubject : subject,
        upstream: null, remote: false, tag: true }]
    })
  }
  async tags() { return (await this.git.tags()).all }
  async createTag(name, ref = 'HEAD') { await this.git.raw(['tag', '--', branchName(name), await this.resolve(ref)]) }
  async deleteTag(name) { await this.git.raw(['tag', '-d', '--', branchName(name)]) }
  async discardDetails(path) {
    path = filePaths([path])[0]
    const index = await this.git.raw(['ls-files', '--stage', '-z', '--', ...literalPaths([path])])
    const status = await this.status()
    if (status.conflicted.includes(path) || (!index && !status.files.some(file => file.path === path && file.index === '?'))) throw Object.assign(new Error('Only tracked, non-conflicted files can be restored from the index.'), { status: 400 })
    const content = (await readWorktree(this.directory)).get(path)
    const fingerprint = createHash('sha256').update(status.branch || 'detached').update(index)
      .update(content ? 'present' : 'missing').update(content || Buffer.alloc(0)).digest('hex')
    return { path, fingerprint, untracked: !index, text: await this.fileDiff(path) }
  }
  async discard(paths, fingerprint) {
    if (fingerprint) {
      if (paths.length !== 1) throw Object.assign(new Error('Confirm one file at a time.'), { status: 400 })
      const details = await this.discardDetails(paths[0])
      if (details.fingerprint !== fingerprint) throw Object.assign(new Error('The file or staged version changed. Refresh the preview before discarding.'), { status: 409 })
    }
    const status = await this.status()
    const untracked = paths.filter(path => status.files.some(file => file.path === path && file.index === '?'))
    if (untracked.length && !fingerprint) throw new Error('Confirm untracked deletion before discarding.')
    const tracked = paths.filter(path => !untracked.includes(path))
    if (tracked.length) await this.git.raw(['restore', '--worktree', '--', ...literalPaths(tracked)])
    if (untracked.length) await this.git.raw(['clean', '-f', '--', ...literalPaths(untracked)])
  }
  async discardAllDetails(paths) {
    paths = [...new Set(filePaths(paths))].sort()
    const status = await this.status()
    if (paths.some(path => status.conflicted.includes(path) || !status.files.some(file => file.path === path && file.workingTree !== ' '))) throw Object.assign(new Error('The changed file list changed. Refresh before discarding.'), { status: 409 })
    const contents = await readWorktree(this.directory)
    const hash = createHash('sha256').update(status.branch || 'detached').update(await this.git.raw(['ls-files', '--stage', '-z']))
    for (const path of paths) { const content = contents.get(path); hash.update(JSON.stringify([path, !!content])).update(content || Buffer.alloc(0)) }
    return { paths, fingerprint: hash.digest('hex'), untracked: paths.filter(path => status.files.some(file => file.path === path && file.index === '?')) }
  }
  async discardAll(paths, fingerprint) {
    const details = await this.discardAllDetails(paths)
    if (details.fingerprint !== fingerprint) throw Object.assign(new Error('The files or staged versions changed. Refresh the preview before discarding.'), { status: 409 })
    const tracked = details.paths.filter(path => !details.untracked.includes(path))
    if (tracked.length) await this.git.raw(['restore', '--worktree', '--', ...literalPaths(tracked)])
    if (details.untracked.length) await this.git.raw(['clean', '-f', '--', ...literalPaths(details.untracked)])
  }
}

function refName(ref) {
  if (typeof ref !== 'string' || !ref || ref.startsWith('-') || /[\0\r\n]/.test(ref)) throw Object.assign(new Error('Invalid Git reference'), { status: 400 })
  return ref
}
function branchName(name) {
  refName(name)
  if (/[\s~^:?*\[\\]/.test(name) || name.includes('..') || name.includes('@{') || name.startsWith('/') || name.endsWith('/') ||
      name.endsWith('.') || name.split('/').some(part => !part || part.startsWith('.') || part.endsWith('.lock'))) throw Object.assign(new Error('Invalid branch or tag name'), { status: 400 })
  return name
}
function remoteName(name) { return branchName(name) }
function filePaths(paths) {
  if (!Array.isArray(paths) || !paths.length || paths.some(path => typeof path !== 'string' || !path ||
      Path.isAbsolute(path) || path.split('/').some(part => part === '..' || part.toLowerCase() === '.git') || /[\0\r\n]/.test(path))) {
    throw Object.assign(new Error('Invalid project file path'), { status: 400 })
  }
  return paths
}
export function remoteUrl(url, allowLocal = false) {
  if (allowLocal && typeof url === 'string' && Path.isAbsolute(url)) return url
  let parsed
  try { parsed = new URL(url) } catch { throw Object.assign(new Error('Use a valid HTTPS repository URL'), { status: 400 }) }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash || parsed.search) {
    throw Object.assign(new Error('Use an HTTPS repository URL without embedded credentials'), { status: 400 })
  }
  return parsed.href
}

function literalPaths(paths) { return filePaths(paths).map(path => `:(literal)${path}`) }

function previewMime(path) {
  const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp', '.pdf': 'application/pdf' }
  const mime = types[Path.extname(path).toLowerCase()]
  if (!mime) throw Object.assign(new Error('This file type has no visual preview'), { status: 400 })
  return mime
}
function previewData(data, mime) {
  if (data.length > 32 * 1024 * 1024) throw Object.assign(new Error("Preview supports files up to 32 MB"), { status: 400 })
  return { mime, base64: data.toString("base64"), size: data.length }
}
