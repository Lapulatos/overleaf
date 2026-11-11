import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { realpath, lstat, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { validateWorkspacePath } from './project-workspace.mjs'

export function compilationDiagnostic(log) {
  const font = /Font ([^\r\n]+?) at \d+ not found/.exec(log)
  if (font) return {
    kind: 'missing-font', file: font[1],
    guidance: 'The compiler could not load a required font. Report the font dependency and stop unchanged compilation retries. Do not change the manuscript typography or document class to bypass missing compiler fonts.',
  }
  const missing = /(?:LaTeX|Package [^\n]+) Error: File [`']([^`'\r\n]+)' not found/.exec(log)
  if (!missing) return null
  return {
    kind: 'missing-input', file: missing[1],
    guidance: 'Check whether this is a missing project file or a compiler package. If a standard package is absent from the compiler, report the environment dependency and stop compilation retries. Do not remove package imports, rewrite the document class, or fabricate replacement packages to bypass it.',
  }
}

// The image is administrator configuration, never a model-supplied value.
// The model chooses only a project-local TeX root; it cannot choose mounts/flags.
export async function compileProject({ directory, rootFile, image, signal, timeout = 90000 }) {
  validateWorkspacePath(rootFile)
  if (!rootFile.endsWith('.tex')) throw new Error('Compilation root must be a TeX file')
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('A pinned compiler image is required')
  const workspace = await realpath(directory)
  const input = await realpath(join(workspace, rootFile))
  if (!input.startsWith(workspace + '/') || !(await lstat(input)).isFile()) throw new Error('Invalid compilation root')
  if (signal?.aborted) throw new Error('Compilation cancelled')
  const output = join(workspace, '.overleaf-build')
  await mkdir(output, { recursive: true, mode: 0o700 })
  if ((await lstat(output)).isSymbolicLink() || await realpath(output) !== output) throw new Error('Invalid compilation output directory')
  const name = `overleaf-compile-${randomUUID()}`
  // TeX may generate font bitmaps. Keep its cache in the disposable tmpfs,
  // rather than the image's read-only application cache directory.
  const args = ['run', '--rm', '--name', name, '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--cpus', '2', '--memory', '2g', '--pids-limit', '128', '--tmpfs', '/tmp:rw,nosuid,size=256m', '--env', 'TEXMFVAR=/tmp/texmf-var', '--env', 'TEXMFCONFIG=/tmp/texmf-config', '--mount', `type=bind,source=${workspace},target=/project`, '--workdir', '/project', '--entrypoint', 'latexmk', image, '-norc', '-pdf', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', '-latexoption=-no-shell-escape', '-outdir=.overleaf-build', rootFile]
  let cancelled = false, timedOut = false, captured = '', bytes = 0
  const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] })
  const stop = () => {
    const cleanup = spawn('docker', ['rm', '-f', name], { stdio: 'ignore' })
    cleanup.on('error', () => {})
    proc.kill('SIGTERM')
  }
  const abort = () => { cancelled = true; stop() }
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => { timedOut = true; stop() }, timeout)
  if (signal?.aborted) abort()
  const collect = chunk => {
    bytes += chunk.length
    captured = (captured + chunk.toString('utf8')).slice(-64000)
    if (bytes > 2000000) stop()
  }
  proc.stdout.on('data', collect); proc.stderr.on('data', collect)
  try {
    const code = await new Promise((resolve, reject) => { proc.once('close', resolve); proc.once('error', reject) })
    if (cancelled) throw new Error('Compilation cancelled')
    if (timedOut) throw new Error('Compilation timed out')
    if (bytes > 2000000) throw new Error('Compilation output exceeds limit')
    const pdfName = rootFile.split('/').at(-1).replace(/\.tex$/, '.pdf')
    const pdfPath = join(output, pdfName)
    let pdfBytes = 0
    if (code === 0) {
      const stat = await lstat(pdfPath)
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 20000000) throw new Error('Invalid compiled PDF')
      const header = (await readFile(pdfPath)).subarray(0, 5).toString('ascii')
      if (header !== '%PDF-') throw new Error('Compiler did not produce a PDF')
      pdfBytes = stat.size
    }
    return { success: code === 0, log: captured, diagnostic: code === 0 ? null : compilationDiagnostic(captured), pdfPath: code === 0 ? pdfPath : null, pdfBytes }
  } finally {
    clearTimeout(timer); signal?.removeEventListener('abort', abort)
    // Wait for removal of this task's exact container even if Docker's client
    // exited during cancellation before the first cleanup attempt succeeded.
    await new Promise(resolve => {
      const cleanup = spawn('docker', ['rm', '-f', name], { stdio: 'ignore' })
      const deadline = setTimeout(() => { cleanup.kill('SIGKILL'); resolve() }, 5000)
      cleanup.once('error', () => { clearTimeout(deadline); resolve() })
      cleanup.once('close', () => { clearTimeout(deadline); resolve() })
    })
  }
}
