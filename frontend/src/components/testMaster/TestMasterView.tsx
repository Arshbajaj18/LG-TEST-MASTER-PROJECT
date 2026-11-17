import { useDeferredValue, useMemo, useState } from 'react'
import type { TestMaster } from '../../types'
import { formatDateTime, plural } from '../../utils/format'
import { BoxesIcon, FileSpreadsheetIcon, BeakerIcon, SearchIcon } from '../ui/Icons'
import { CellText } from './CellText'
import { TestItemDrawer } from './TestItemDrawer'

export function TestMasterView({ master }: { master: TestMaster }) {
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const totalSamples = useMemo(
    () => master.items.reduce((sum, i) => sum + (typeof i.sampleQuantity === 'number' ? i.sampleQuantity : 0), 0),
    [master.items],
  )

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return master.items
    return master.items.filter((item) =>
      [item.partName, item.testName, item.specification, item.criteria].join(' ').toLowerCase().includes(q),
    )
  }, [master.items, deferredQuery])

  return (
    <>
      <section className="summary" aria-label="Test master summary">
        <div className="summary-metric">
          <span className="summary-icon">
            <BeakerIcon size={18} />
          </span>
          <div>
            <span className="summary-value" data-testid="summary-tests">
              {master.items.length}
            </span>
            <span className="summary-label">Tests</span>
          </div>
        </div>
        <div className="summary-metric">
          <span className="summary-icon">
            <BoxesIcon size={18} />
          </span>
          <div>
            <span className="summary-value">{totalSamples}</span>
            <span className="summary-label">Total samples</span>
          </div>
        </div>
        <div className="summary-source">
          <span className="summary-icon summary-icon-green">
            <FileSpreadsheetIcon size={18} />
          </span>
          <div className="summary-source-text">
            <span className="summary-file" title={master.fileName}>
              {master.fileName}
            </span>
            <span className="summary-label">
              Uploaded {formatDateTime(master.uploadedAt)}
              {master.uploadedBy ? ` by ${master.uploadedBy}` : ''}
            </span>
          </div>
        </div>
      </section>

      <div className="toolbar">
        <div className="search-input toolbar-search">
          <SearchIcon size={18} />
          <input
            className="input"
            type="search"
            placeholder="Search part, test, specification, criteria…"
            aria-label="Search tests"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <p className="result-count" aria-live="polite" data-testid="result-count">
        {visible.length === master.items.length
          ? plural(master.items.length, 'test')
          : `Showing ${visible.length} of ${master.items.length} tests`}
      </p>

      <div className="table-card">
        <table className="tests-table">
          <thead>
            <tr>
              <th className="col-part">Part Name</th>
              <th className="col-test">Test Name</th>
              <th className="col-spec">Specification</th>
              <th className="col-crit">Condition / Judgement criteria</th>
              <th className="col-qty">Sample qty</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((item, i) => (
              <tr
                key={item.row}
                tabIndex={0}
                data-testid="test-row"
                onClick={() => setOpenIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setOpenIndex(i)
                  }
                }}
              >
                <td className="col-part">
                  <CellText text={item.partName} lines={2} />
                </td>
                <td className="col-test">
                  <span className="test-name">{item.testName || <span className="muted">—</span>}</span>
                </td>
                <td className="col-spec">
                  <CellText text={item.specification} />
                </td>
                <td className="col-crit">
                  <CellText text={item.criteria} />
                </td>
                <td className="col-qty">{item.sampleQuantity ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="table-empty">
            No tests match{deferredQuery.trim() ? ` “${deferredQuery.trim()}”` : ''}.
          </div>
        )}
      </div>

      {openIndex !== null && (
        <TestItemDrawer items={visible} index={openIndex} onNavigate={setOpenIndex} onClose={() => setOpenIndex(null)} />
      )}
    </>
  )
}
