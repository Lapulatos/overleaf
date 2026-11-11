import { useRef, type ReactNode } from 'react'
import { Overlay } from 'react-bootstrap'

export default function ActionSubmenu({ label, open, onOpen, onClose, children }: { label: string; open: boolean; onOpen: () => void; onClose: () => void; children: ReactNode }) {
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement | null>(null)
  const focusFirst = () => requestAnimationFrame(() => menu.current?.querySelector<HTMLElement>('.dropdown-item:not(.disabled):not(:disabled)')?.focus())
  return <>
    <button ref={trigger} type="button" className="dropdown-item native-git-submenu-trigger" aria-label={`${label} submenu`} aria-haspopup="menu" aria-expanded={open}
      onMouseEnter={onOpen} onClick={event => { event.stopPropagation(); open ? onClose() : onOpen() }}
      onKeyDown={event => { if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); onOpen(); focusFirst() } }}>
      {label}<span aria-hidden="true">›</span>
    </button>
    <Overlay show={open} target={trigger.current} placement="right-start" flip container={document.body} transition={false}
      popperConfig={{ strategy: 'fixed', modifiers: [{ name: 'preventOverflow', options: { padding: 8 } }, { name: 'offset', options: { offset: [0, 2] } }] }}>
      {({ ref, style }) => <div ref={node => { menu.current = node; ref(node) }} style={style} className="dropdown-menu show native-git-repository-menu native-git-submenu" role="menu" aria-label={`${label} actions`}
        onKeyDownCapture={event => {
          if (event.key === 'Escape' || event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); onClose(); trigger.current?.focus() }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); event.stopPropagation()
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('.dropdown-item:not(.disabled):not(:disabled)'))
            const index = items.indexOf(document.activeElement as HTMLElement)
            items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
          }
        }}>{children}</div>}
    </Overlay>
  </>
}
