import { useCallback, useEffect, useState } from 'react'
import { dataApiUrl } from '../../services/http'
import { probeStorage, type StorageProbe } from '../../services/testMasterStore'
import { errorMessage, formatDateTime, plural } from '../../utils/format'
import { Dialog } from '../ui/Dialog'
import { AlertTriangleIcon, CheckCircleIcon, RefreshIcon } from '../ui/Icons'
import './StorageStatus.css'

type Probe =
  | { status: 'checking' }
  | { status: 'ok'; data: StorageProbe }
  | { status: 'failed'; error: string; checkedAt: number }

/**
 * Header indicator that proves, from inside the app, whether the Test Plan Masters API and
 * its MongoDB are reachable and what is stored there. On-prem the database cannot be reached
 * from a developer machine, so this is how a deployment is confirmed: green means a real
 * read of the collection succeeded.
 */
export function StorageStatus() {
  const [probe, setProbe] = useState<Probe>({ status: 'checking' })
  const [open, setOpen] = useState(false)

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    probeStorage().then(
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

  const label = probe.status === 'checking' ? 'Checking database…' : probe.status === 'ok' ? 'Connected' : 'Not reachable'
  const where = probe.status === 'ok' ? `${probe.data.host} · ${probe.data.database}.${probe.data.collection}` : dataApiUrl

  return (
    <>
      <button
        type="button"
        className={`app-env app-env-${probe.status}`}
        onClick={openPanel}
        title={`${label} — ${where}`}
        aria-label={`Database connection: ${label}. Open database status`}
        data-testid="storage-status"
      >
        <span className="app-env-dot" />
        <span className="app-env-text">MongoDB{probe.status === 'ok' ? ` · ${probe.data.host}` : ''}</span>
      </button>

      {open && (
        <Dialog
          open
          width={620}
          title="Database status"
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
            className={`storage-banner storage-banner-${probe.status}`}
            role={probe.status === 'failed' ? 'alert' : 'status'}
            data-testid="storage-banner"
          >
            {probe.status === 'checking' && <span className="spinner" />}
            {probe.status === 'ok' && <CheckCircleIcon size={16} />}
            {probe.status === 'failed' && <AlertTriangleIcon size={16} />}
            <span>
              {probe.status === 'checking' && 'Reading the database…'}
              {probe.status === 'ok' &&
                `Connected — read ${probe.data.database}.${probe.data.collection} successfully.`}
              {probe.status === 'failed' && `Could not read the database: ${probe.error}`}
            </span>
          </div>

          <dl className="storage-facts">
            <div>
              <dt>API</dt>
              <dd className="storage-mono">{dataApiUrl}</dd>
            </div>
            <div>
              <dt>MongoDB</dt>
              <dd className="storage-mono" data-testid="storage-host">
                {probe.status === 'ok' ? probe.data.host : '—'}
              </dd>
            </div>
            <div>
              <dt>Collection</dt>
              <dd className="storage-mono" data-testid="storage-collection">
                {probe.status === 'ok' ? `${probe.data.database}.${probe.data.collection}` : '—'}
              </dd>
            </div>
            <div>
              <dt>Last checked</dt>
              <dd>
                {probe.status === 'checking'
                  ? '—'
                  : formatDateTime(probe.status === 'ok' ? probe.data.checkedAt : probe.checkedAt)}
              </dd>
            </div>
          </dl>

          {probe.status === 'ok' && (
            <>
              <div className="storage-counts" data-testid="storage-counts">
                <div className="stat">
                  <span className="stat-value">{probe.data.categories}</span>
                  <span className="stat-label">Stored categories</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{probe.data.testMasters}</span>
                  <span className="stat-label">Test masters</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{probe.data.testItems}</span>
                  <span className="stat-label">Test items</span>
                </div>
              </div>

              <h3 className="storage-subhead">Documents in this collection</h3>
              {probe.data.documents.length === 0 ? (
                <p className="storage-empty">
                  The collection is readable but holds nothing yet. A default category is saved the first time its
                  test master is uploaded or its description is edited.
                </p>
              ) : (
                <div className="storage-table-wrap">
                  <table className="storage-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Document id</th>
                        <th>Test master</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {probe.data.documents.map((doc) => (
                        <tr key={doc.id} data-testid="storage-row">
                          <td>
                            {doc.name}
                            {doc.isDefault && <span className="muted"> · default</span>}
                          </td>
                          <td className="storage-mono storage-id-cell" title={doc.id}>
                            {doc.id}
                          </td>
                          <td>
                            {doc.testCount === null
                              ? '—'
                              : `${doc.fileName ?? 'test master'} · ${plural(doc.testCount, 'test')}`}
                          </td>
                          <td className="storage-when">{formatDateTime(doc.lastUpdated)}</td>
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
