import type { ReactNode } from 'react'
import { InsightStatus } from '../insight/InsightStatus'
import { ChevronRightIcon, ClipboardListIcon } from '../ui/Icons'
import './AppShell.css'

const YEAR = new Date().getFullYear()

interface AppShellProps {
  /** Trailing breadcrumb after the app title, e.g. the open category name. */
  crumb?: string
  children: ReactNode
}

export function AppShell({ crumb, children }: AppShellProps) {
  return (
    <>
      <header className="app-header">
        <nav className="app-header-nav" aria-label="Breadcrumb">
          <a href="#/" className="app-brand">
            <span className="app-brand-icon">
              <ClipboardListIcon size={18} />
            </span>
            <span className="app-brand-title">Test Plan Masters</span>
          </a>
          {crumb && (
            <>
              <ChevronRightIcon size={16} className="app-crumb-sep" />
              <span className="app-crumb" aria-current="page">
                {crumb}
              </span>
            </>
          )}
        </nav>
        <InsightStatus />
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">© {YEAR}, powered by Faclon Labs</footer>
    </>
  )
}
