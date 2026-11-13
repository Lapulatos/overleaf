import MaterialIcon from '@/shared/components/material-icon'
import { useEffect, useRef, useState } from 'react'
import { useAccessPolicy } from './access-mode'
import { errorMessage, type GitApi } from './api'
import type { Terminal } from './vendor/xterm'
import './vendor/xterm.css'
export default function GitTerminal({ api, onClose, onChanged, createTerminal, interactive = false }: { interactive?: boolean; api: GitApi; onClose: () => void; onChanged: () => unknown; createTerminal?: () => Promise<Terminal> }) {
  const { policy: access, setPolicy } = useAccessPolicy(api)
  const sessionId = useRef<string>()
  const generation = useRef(0)
  const [ready, setReady] = useState(false)
  const [command, setCommand] = useState(''), [approval, setApproval] = useState<{token: string; text: string; reason: string}>(), [running, setRunning] = useState(false)
  const execute = async (confirmed = false) => {
    const id = sessionId.current, current = generation.current
    if (!id || !ready || running) return
    setRunning(true); setError('')
    try {
      const result = (await api.command({command:'terminalRun',id,text:confirmed ? approval!.text : command, ...(confirmed ? {approval:approval!.token} : {})})).result as {approvalRequired?:boolean;approval?:string;reason?:string}
      if (generation.current !== current) return
      if (result.approvalRequired) setApproval({token:result.approval!,text:command,reason:result.reason!})
      else {setApproval(undefined);setCommand('');void changed.current()}
    } catch (error) {if (generation.current === current) {setError(errorMessage(error));setApproval(undefined)}} finally {if (generation.current === current) setRunning(false)}
  }
  const [height, setHeight] = useState(230)
  const drag = useRef<{ y: number; height: number }>()
  const [atBottom, setAtBottom] = useState(true)
  const jumpToBottom = useRef<() => void>()
  const host = useRef<HTMLDivElement>(null)
  const [directory, setDirectory] = useState('Connecting…'), [error, setError] = useState('')
  const changed = useRef(onChanged); changed.current = onChanged
  useEffect(() => {
    generation.current++; setReady(false); setRunning(false); setDirectory('Connecting…')
    let active = true, id: string | undefined, terminal: Terminal | undefined, timer: ReturnType<typeof setTimeout>, observer: ResizeObserver | undefined
    let follow = true
    jumpToBottom.current = () => { follow = true; setAtBottom(true); terminal?.scrollToBottom?.() }
    let inputQueue = Promise.resolve()
    const send = (input: string) => { jumpToBottom.current?.(); inputQueue = inputQueue.then(async () => { if (active && id) await api.command({ command: 'terminalInput', id, input }) }).catch(error => { if (active) setError(errorMessage(error)) }) }
    const resize = () => {
      if (!terminal || !host.current || !id) return
      const screen = terminal.element?.querySelector<HTMLElement>('.xterm-screen')
      const cellWidth = screen?.clientWidth ? screen.clientWidth / terminal.cols : 8
      const cellHeight = screen?.clientHeight ? screen.clientHeight / terminal.rows : 18
      const cols = Math.max(2, Math.min(500, Math.floor((host.current.clientWidth - 32) / cellWidth)))
      const rows = Math.max(2, Math.min(200, Math.floor((host.current.clientHeight - 8) / cellHeight)))
      terminal.resize(cols, rows)
      void api.command({ command: 'terminalResize', id, cols, rows }).catch(error => { if (active) setError(errorMessage(error)) })
    }
    const poll = async () => {
      try {
        const result = (await api.command({ command: 'terminalPoll', id })).result as { output: string; exited: boolean; truncated?: boolean }
        if (!active) return
        if (result.truncated) terminal?.writeln('\r\n[Earlier terminal output is no longer retained]')
        if (result.output) { const stick = follow; terminal?.write(result.output, () => { if (stick && active) jumpToBottom.current?.() }) }
        if (result.exited) { terminal?.writeln('\r\n[Shell exited]'); void changed.current(); return }
        timer = setTimeout(poll, 150)
      } catch (error) { if (active) setError(errorMessage(error)) }
    }
    void (async () => {
      terminal = createTerminal ? await createTerminal() : new (await import('./vendor/xterm.cjs')).Terminal({ fontSize: 13, lineHeight: 1.2, cursorBlink: true, scrollback: 5000, theme: { background: '#f7f8fa', foreground: '#202630', cursor: '#202630', selectionBackground: '#b7cfe9' } })
      if (!active) { terminal.dispose(); return }
      terminal.open(host.current!); if(interactive || access.mode !== 'auto-review') terminal.onData(send)
      terminal.onScroll?.(() => { if (!terminal) return; follow = terminal.buffer.active.viewportY >= terminal.buffer.active.baseY; setAtBottom(follow) })
      const result = (await api.command({ command: 'terminalOpen', ...access })).result as { id: string; directory: string }
      id = result.id
      if (!active) { await api.command({ command: 'terminalClose', id }); return }
      sessionId.current = id; setReady(true)
      setDirectory(result.directory); resize(); requestAnimationFrame(() => { if (active) resize() }); terminal.focus()
      observer = new ResizeObserver(resize); observer.observe(host.current!)
      void poll()
    })().catch(error => { if (active) { setError(errorMessage(error)); setDirectory('Connection failed'); setReady(false) } })
    return () => {
      active = false; generation.current++; setReady(false); sessionId.current = undefined; setApproval(undefined); jumpToBottom.current = undefined; clearTimeout(timer); observer?.disconnect(); terminal?.dispose()
      if (id) void api.command({ command: 'terminalClose', id }).catch(() => {}).finally(() => { void api.command({ command:'accessPolicy' }).then(result => { if ((result.result as any)?.mode) setPolicy(result.result as any) }).catch(() => {}); void changed.current() })
    }
  }, [api, createTerminal, access, interactive])
  return <section className="native-git-terminal" aria-label="Repository terminal" style={{ flexBasis: height }}>
    <div className="native-git-terminal-resize" role="separator" aria-label="Resize terminal" aria-orientation="horizontal" aria-valuenow={height} aria-valuemin={150} aria-valuemax={700} tabIndex={0}
      onPointerDown={event => { drag.current = { y: event.clientY, height }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }}
      onPointerMove={event => { if (drag.current) { const max = Math.max(150, Math.min(700, (event.currentTarget.parentElement?.parentElement?.clientHeight || 800) - 160)); setHeight(Math.max(150, Math.min(max, drag.current.height + drag.current.y - event.clientY))) } }}
      onPointerUp={() => { drag.current = undefined }} onPointerCancel={() => { drag.current = undefined }}
      onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setHeight(value => Math.max(150, Math.min(700, value + (event.key === 'ArrowUp' ? 20 : -20)))) } }} />
    <header><strong>Terminal</strong><span className="native-git-terminal-mode">{({'read-only':'Read Only','workspace-write':'Ask for approval','auto-review':'Approve for me','full-access':'Full Access'})[access.mode]}</span><code title={directory}>{directory}</code><button className="native-git-icon-button" aria-label="Close terminal" onClick={onClose}>×</button></header>
    {!interactive && access.mode === 'auto-review' && <form onSubmit={event => {event.preventDefault();void execute()}} style={{padding:'8px'}}><label>Command (starts in repository directory)<textarea aria-label="Reviewed terminal command" value={command} disabled={!ready || running || !!approval} onChange={event => setCommand(event.target.value)} style={{width:'100%'}} /></label><button className="btn btn-secondary" type="submit" disabled={!ready || running || !!approval || !command.trim()}><MaterialIcon type="visibility" />Review and run</button>{approval && <div role="alert"><p>{approval.reason}</p><pre>{approval.text}</pre><button className="btn btn-secondary" type="button" disabled={!ready || running} onClick={() => void execute(true)}><MaterialIcon type="terminal" />Approve this command</button><button className="btn btn-secondary" type="button" disabled={running} onClick={() => setApproval(undefined)}><MaterialIcon type="close" />Cancel</button></div>}</form>}
    {error && <p role="alert">{error}</p>}<div className="native-git-shell" ref={host} />{!atBottom && <button type="button" className="btn btn-default btn-sm native-git-terminal-jump" onClick={() => jumpToBottom.current?.()}>Back to bottom ↓</button>}</section>
}
