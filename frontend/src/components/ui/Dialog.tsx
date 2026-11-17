import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll'
import { XIcon } from './Icons'
import './Dialog.css'

interface DialogProps {
  open: boolean
  title: string
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
  /** Blocks Escape/backdrop close while work is in flight. */
  busy?: boolean
}

export function Dialog({ open, title, subtitle, onClose, children, footer, width = 480, busy = false }: DialogProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  useLockBodyScroll(open)
  // Refs keep the open/close effect from re-running (and stealing focus) on every parent render.
  const closeRef = useRef(onClose)
  const busyRef = useRef(busy)
  useEffect(() => {
    closeRef.current = onClose
    busyRef.current = busy
  })

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    const firstField = panel?.querySelector<HTMLElement>('input, textarea, select')
    ;(firstField ?? panel)?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busyRef.current) closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [open])

  if (!open) return null

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div
        ref={panelRef}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{ maxWidth: width }}
      >
        <header className="dialog-header">
          <div>
            <h2 id={titleId} className="dialog-title">
              {title}
            </h2>
            {subtitle && <div className="dialog-subtitle">{subtitle}</div>}
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose} disabled={busy}>
            <XIcon size={18} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-footer">{footer}</footer>}
      </div>
    </div>
  )
}
