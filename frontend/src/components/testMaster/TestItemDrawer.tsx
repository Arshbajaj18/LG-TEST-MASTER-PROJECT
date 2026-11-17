import { useEffect, useRef } from 'react'
import type { TestItem } from '../../types'
import { isUnspecified } from '../../services/testItemText'
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from '../ui/Icons'

interface TestItemDrawerProps {
  items: TestItem[]
  index: number
  onNavigate: (index: number) => void
  onClose: () => void
}

function Section({ label, text }: { label: string; text: string }) {
  return (
    <section className="drawer-section">
      <h3 className="drawer-label">{label}</h3>
      {isUnspecified(text) ? (
        <p className="unspecified">{text?.trim() || 'Not specified'}</p>
      ) : (
        <p className="drawer-text">{text}</p>
      )}
    </section>
  )
}

export function TestItemDrawer({ items, index, onNavigate, onClose }: TestItemDrawerProps) {
  const item = items[index]
  const panelRef = useRef<HTMLDivElement>(null)
  useLockBodyScroll(true)
  const closeRef = useRef(onClose)
  const navRef = useRef({ index, count: items.length, onNavigate })
  useEffect(() => {
    closeRef.current = onClose
    navRef.current = { index, count: items.length, onNavigate }
  })

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    // Left/Right step through tests; Up/Down stay free for scrolling long specification text.
    const onKey = (e: KeyboardEvent) => {
      const nav = navRef.current
      if (e.key === 'Escape') {
        closeRef.current()
      } else if (e.key === 'ArrowRight' && nav.index < nav.count - 1) {
        e.preventDefault()
        nav.onNavigate(nav.index + 1)
      } else if (e.key === 'ArrowLeft' && nav.index > 0) {
        e.preventDefault()
        nav.onNavigate(nav.index - 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [])

  useEffect(() => {
    panelRef.current?.querySelector('.drawer-body')?.scrollTo(0, 0)
  }, [index])

  if (!item) return null

  return (
    <div className="drawer-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={item.testName || `Excel row ${item.row}`}
        tabIndex={-1}
      >
        <header className="drawer-header">
          <div className="drawer-header-meta">
            <span className="muted">Excel row {item.row}</span>
          </div>
          <button type="button" className="icon-btn" aria-label="Close details" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </header>
        <div className="drawer-body">
          <h2 className="drawer-title">{item.testName || '—'}</h2>
          <dl className="drawer-facts">
            <div>
              <dt>Part name</dt>
              <dd>{item.partName || '—'}</dd>
            </div>
            <div>
              <dt>Sample quantity</dt>
              <dd className="drawer-qty">{item.sampleQuantity ?? '—'}</dd>
            </div>
          </dl>
          <Section label="Specification" text={item.specification} />
          <Section label="Condition / Judgement criteria" text={item.criteria} />
          {item.extra &&
            Object.entries(item.extra).map(([label, text]) => <Section key={label} label={label} text={text} />)}
        </div>
        <footer className="drawer-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate(index - 1)}
            disabled={index === 0}
            title="Previous test (←)"
          >
            <ChevronLeftIcon size={16} />
            Previous
          </button>
          <span className="muted drawer-pos">
            {index + 1} of {items.length}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate(index + 1)}
            disabled={index >= items.length - 1}
            title="Next test (→)"
          >
            Next
            <ChevronRightIcon size={16} />
          </button>
        </footer>
      </aside>
    </div>
  )
}
