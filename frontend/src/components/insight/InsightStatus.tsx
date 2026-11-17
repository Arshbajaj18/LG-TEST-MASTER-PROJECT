import { useCallback, useEffect, useState } from 'react'
import { apiHost, config } from '../../config'
import { loadSession } from '../../auth/session'
import { probeInsight, type InsightProbe } from '../../services/testMasterStore'
import { errorMessage, formatDateTime } from '../../utils/format'
import { Dialog } from '../ui/Dialog'
import { AlertTriangleIcon, CheckCircleIcon, RefreshIcon } from '../ui/Icons'
import './InsightStatus.css'

type Probe =
  | { status: 'checking' }
  | { status: 'ok'; data: InsightProbe }
  | { status: 'failed'; error: string; checkedAt: number }

/**
 * Header indicator that proves, from inside the app, whether I/O Sense is actually
 * reachable and what this app has stored in the configured insight. On-prem the
 * connector cannot be reached from a developer machine, so this is how a deployment
 * is confirmed: green means a real read of the insight succeeded.
 */
export function InsightStatus() {
  const [probe, setProbe] = useState<Probe>({ status: 'checking' })
  const [open, setOpen] = useState(false)

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    probeInsight().then(
      (data) => active && setProbe({ status: 'ok', data }),
      (err: unknown) => active && setProbe({ status: 'failed', error: errorMessage(err), checkedAt: Date.now() }),
    )
    return () => {
      active = false
    }
  }, [attempt])

  const check = useCallback(() => {
    setProbe({ status: 'checking' })
    setAttempt((n) => n + 1)
  }, [])

  // Always re-read on open: the chip's last probe may predate the writes the operator
  // just made, and a stale panel would be worse than none for confirming a save.
  const openPanel = useCallback(() => {
    setOpen(true)
    check()
  }, [check])

  const label =
    probe.status === 'checking' ? 'Checking I/O Sense…' : probe.status === 'ok' ? 'Connected' : 'Not reachable'

  return (
    <>
      <button
        type="button"
        className={`app-env app-env-${probe.status}`}
        onClick={openPanel}
        title={`${label} — ${apiHost} · ${config.insightId}`}
        aria-label={`I/O Sense connection: ${label}. Open insight status`}
        data-testid="insight-status"
      >
        <span className="app-env-dot" />
        <span className="app-env-text">I/O Sense · {apiHost}</span>
      </button>

      {open && (
        <Dialog
          open
          width={620}
          title="Insight status"
          subtitle="Where this app reads and writes, and what is stored there right now"
          onClose={() => setOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={check}>
                <RefreshIcon size={16} />
                Re-check
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>
                Close
              </button>
            </>
          }
        >
          <div
            className={`insight-banner insight-banner-${probe.status}`}
            role={probe.status === 'failed' ? 'alert' : 'status'}
            data-testid="insight-banner"
          >
            {probe.status === 'checking' && <span className="spinner" />}
            {probe.status === 'ok' && <CheckCircleIcon size={16} />}
            {probe.status === 'failed' && <AlertTriangleIcon size={16} />}
            <span>
              {probe.status === 'checking' && 'Reading the insight…'}
              {probe.status === 'ok' && `Connected — read ${config.insightId} successfully.`}
              {probe.status === 'failed' && `Could not read ${config.insightId}: ${probe.error}`}
            </span>
          </div>

          <dl className="insight-facts">
            <div>
              <dt>Server</dt>
              <dd className="insight-mono">{config.apiRoot}</dd>
            </div>
            <div>
              <dt>Insight</dt>
              <dd className="insight-mono" data-testid="insight-id">
                {config.insightId}
              </dd>
            </div>
            <div>
              <dt>Organisation</dt>
              <dd className="insight-mono">{loadSession()?.organisation || '—'}</dd>
            </div>
            <div>
              <dt>Last checked</dt>
              <dd>{probe.status === 'checking' ? '—' : formatDateTime(probe.status === 'ok' ? probe.data.checkedAt : probe.checkedAt)}</dd>
            </div>
          </dl>

          {probe.status === 'ok' && (
            <>
              <div className="insight-counts" data-testid="insight-counts">
                <div className="stat">
                  <span className="stat-value">{probe.data.categories}</span>
                  <span className="stat-label">Categories</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{probe.data.masterRows}</span>
                  <span className="stat-label">Test master rows</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{probe.data.testItems}</span>
                  <span className="stat-label">Test items</span>
                </div>
              </div>

              <h3 className="insight-subhead">Rows in this insight</h3>
              {probe.data.rows.length === 0 ? (
                <p className="insight-empty">
                  The insight is readable but holds nothing yet. Create a category to write the first row.
                </p>
              ) : (
                <div className="insight-table-wrap">
                  <table className="insight-table">
                    <thead>
                      <tr>
                        <th>Row id</th>
                        <th>Kind</th>
                        <th>Contents</th>
                        <th>Saved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {probe.data.rows.map((row) => (
                        <tr key={row.id} data-testid="insight-row">
                          <td className="insight-mono insight-id-cell" title={row.id}>
                            {row.id}
                          </td>
                          <td>{row.kind}</td>
                          <td>{row.label}</td>
                          <td className="insight-when">
                            {formatDateTime(row.savedAt)}
                            {row.savedBy ? ` · ${row.savedBy}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Dialog>
      )}
    </>
  )
}
