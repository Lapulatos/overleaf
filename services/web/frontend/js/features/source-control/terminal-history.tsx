import { useEffect, useRef, useState } from 'react'
import type { Terminal } from './vendor/xterm'
import './vendor/xterm.css'

export default function TerminalHistory({ output, createTerminal }: { output: string; createTerminal?: () => Promise<Terminal> }) {
  const [error,setError] = useState(false)
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setError(false)
    let active = true, terminal: Terminal | undefined, observer: ResizeObserver | undefined
    void (async () => {
      const instance = createTerminal ? await createTerminal() : new (await import('./vendor/xterm.cjs')).Terminal({
        disableStdin: true, cursorBlink: false, cursorInactiveStyle: 'none', fontSize: 13, lineHeight: 1.2,
        scrollback: 10000, theme: { background: '#f7f8fa', foreground: '#202630' },
      })
      if (!active) { instance.dispose(); return }
      terminal = instance
      instance.open(host.current!)
      const resize = () => {
        if (!active || !host.current) return
        const screen = instance.element?.querySelector<HTMLElement>('.xterm-screen')
        const cellWidth = screen?.clientWidth ? screen.clientWidth / instance.cols : 8
        const cellHeight = screen?.clientHeight ? screen.clientHeight / instance.rows : 18
        instance.resize(Math.max(2, Math.min(500, Math.floor((host.current.clientWidth - 16) / cellWidth))), Math.max(2, Math.floor((host.current.clientHeight - 16) / cellHeight)))
      }
      resize()
      // Replay terminal control sequences; never attach input or a shell API.
      instance.write(output, () => { if (active) instance.scrollToBottom() })
      observer = new ResizeObserver(resize); observer.observe(host.current!)
    })().catch(() => { if(active) setError(true) })
    return () => { active = false; observer?.disconnect(); terminal?.dispose() }
  }, [output, createTerminal])
  if(error) return <p role="alert">Terminal history could not be displayed. Reopen this session to retry.</p>
  return <div className="native-git-terminal-history-screen" aria-label="Read-only terminal history" ref={host}/>
}
