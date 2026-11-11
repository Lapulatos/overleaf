import { useEffect, useRef, useState } from 'react'
import { useAccessPolicy } from './access-mode'
import { errorMessage, type GitApi } from './api'
import type { Terminal } from './vendor/xterm'
import './vendor/xterm.css'
export default function GitTerminal({ api, onClose, onChanged, createTerminal }: { api: GitApi; onClose: () => void; onChanged: () => unknown; createTerminal?: () => Promise<Terminal> }) {
  const { policy: access, setPolicy } = useAccessPolicy(api)
  const sessionId = useRef<string>()
  const [command, setCommand] = useState(''), [approval, setApproval] = useState<{token: string; text: string; reason: string}>(), [running, setRunning] = useState(false)
  const execute = async (confirmed = false) => {
    if (!sessionId.current) return
    setRunning(true); setError('')
    try {
      const result = (await api.command({command:'terminalRun',id:sessionId.current,text:confirmed ? approval!.text : command, ...(confirmed ? {approval:approval!.token} : {})})).result as {approvalRequired?:boolean;approval?:string;reason?:string}
      if (result.approvalRequired) setApproval({token:result.approval!,text:command,reason:result.reason!})
      else {setApproval(undefined);setCommand('');void changed.current()}
    } catch (error) {setError(errorMessage(error));setApproval(undefined)} finally {setRunning(false)}
  }
  const [height, setHeight] = useState(230)
  const drag = useRef<{ y: number; height: number }>()
  const [atBottom, setAtBottom] = useState(true)
  const jumpToBottom = useRef<() => void>()
  const host = useRef<HTMLDivElement>(null)
  const [directory, setDirectory] = useState('Connecting…'), [error, setError] = useState('')
  const changed = useRef(onChanged); changed.current = onChanged
  useEffect(() => {
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
        const result = (await api.command({ command: 'terminalPoll', id })).result as { output: string; exited: boolean }
        if (!active) return
        if (result.output) { const stick = follow; terminal?.write(result.output, () => { if (stick && active) jumpToBottom.current?.() }) }
        if (result.exited) { terminal?.writeln('\r\n[Shell exited]'); void changed.current(); return }
        timer = setTimeout(poll, 150)
      } catch (error) { if (active) setError(errorMessage(error)) }
    }
    void (async () => {
      terminal = createTerminal ? await createTerminal() : new (await import('./vendor/xterm.cjs')).Terminal({ fontSize: 13, lineHeight: 1.2, cursorBlink: true, scrollback: 5000, theme: { background: '#f7f8fa', foreground: '#202630', cursor: '#202630', selectionBackground: '#b7cfe9' } })
      if (!active) { terminal.dispose(); return }
      terminal.open(host.current!); if(access.mode !== 'auto-review') terminal.onData(send)
      terminal.onScroll?.(() => { if (!terminal) return; follow = terminal.buffer.active.viewportY >= terminal.buffer.active.baseY; setAtBottom(follow) })
      const result = (await api.command({ command: 'terminalOpen', ...access })).result as { id: string; directory: string }
      id = result.id; sessionId.current = id
      if (!active) { await api.command({ command: 'terminalClose', id }); return }
      setDirectory(result.directory); resize(); requestAnimationFrame(() => { if (active) resize() }); terminal.focus()
      observer = new ResizeObserver(resize); observer.observe(host.current!)
      void poll()
    })().catch(error => { if (active) setError(errorMessage(error)) })
    return () => {
      active = false; sessionId.current = undefined; setApproval(undefined); jumpToBottom.current = undefined; clearTimeout(timer); observer?.disconnect(); terminal?.dispose()
      if (id) void api.command({ command: 'terminalClose', id }).catch(() => {}).finally(() => { void api.command({ command:'accessPolicy' }).then(result => { if ((result.result as any)?.mode) setPolicy(result.result as any) }).catch(() => {}); void changed.current() })
    }
  }, [api, createTerminal, access])
  return <section className="native-git-terminal" aria-label="Repository terminal" style={{ flexBasis: height }}>
    <div className="native-git-terminal-resize" role="separator" aria-label="Resize terminal" aria-orientation="horizontal" aria-valuenow={height} aria-valuemin={150} aria-valuemax={700} tabIndex={0}
      onPointerDown={event => { drag.current = { y: event.clientY, height }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }}
      onPointerMove={event => { if (drag.current) { const max = Math.max(150, Math.min(700, (event.currentTarget.parentElement?.parentElement?.clientHeight || 800) - 160)); setHeight(Math.max(150, Math.min(max, drag.current.height + drag.current.y - event.clientY))) } }}
      onPointerUp={() => { drag.current = undefined }} onPointerCancel={() => { drag.current = undefined }}
      onKeyDown={event => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setHeight(value => Math.max(150, Math.min(700, value + (event.key === 'ArrowUp' ? 20 : -20)))) } }} />
    <header><strong>Terminal</strong><span className="native-git-terminal-mode">{({'read-only':'Read Only','workspace-write':'Ask for approval','auto-review':'Approve for me','full-access':'Full Access'})[access.mode]}</span><code title={directory}>{directory}</code><button className="native-git-icon-button" aria-label="Close terminal" onClick={onClose}>×</button></header>
    {access.mode === 'auto-review' && <form onSubmit={event => {event.preventDefault();void execute()}} style={{padding:'8px'}}><label>Command (starts in repository directory)<textarea aria-label="Reviewed terminal command" value={command} disabled={running || !!approval} onChange={event => setCommand(event.target.value)} style={{width:'100%'}} /></label><button type="submit" disabled={running || !!approval || !command.trim()}>Review and run</button>{approval && <div role="alert"><p>{approval.reason}</p><pre>{approval.text}</pre><button type="button" disabled={running} onClick={() => void execute(true)}>Approve this command</button><button type="button" disabled={running} onClick={() => setApproval(undefined)}>Cancel</button></div>}</form>}
    {error && <p role="alert">{error}</p>}<div className="native-git-shell" ref={host} />{!atBottom && <button type="button" className="btn btn-default btn-sm native-git-terminal-jump" onClick={() => jumpToBottom.current?.()}>Back to bottom ↓</button>}</section>
}
