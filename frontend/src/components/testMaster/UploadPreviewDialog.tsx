import { useState } from 'react'
import type { ParsedTestMaster, TestMaster } from '../../types'
import { config } from '../../config'
import { errorMessage, plural } from '../../utils/format'
import { Dialog } from '../ui/Dialog'
import { AlertTriangleIcon } from '../ui/Icons'
import { CellText } from './CellText'

interface UploadPreviewDialogProps {
  sheets: ParsedTestMaster[]
  existing: TestMaster | null
  onSave: (parsed: ParsedTestMaster, onProgress: (done: number, total: number) => void) => Promise<void>
  onClose: () => void
}

const PREVIEW_ROWS = 6

export function UploadPreviewDialog({ sheets, existing, onSave, onClose }: UploadPreviewDialogProps) {
  const [sheetIndex, setSheetIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const parsed = sheets[sheetIndex]
  const totalSamples = parsed.items.reduce((sum, i) => sum + (typeof i.sampleQuantity === 'number' ? i.sampleQuantity : 0), 0)

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(parsed, (done, total) => setProgress({ done, total }))
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
      setProgress(null)
    }
  }

  return (
    <Dialog
      open
      width={860}
      title="Review test master"
      subtitle={
        <>
          {parsed.fileName} · sheet <strong>{parsed.sheetName}</strong>
        </>
      }
      onClose={onClose}
      busy={saving}
      footer={
        <>
          <span className="preview-target">Saves to insight {config.insightId}</span>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {saving && <span className="spinner" />}
            {saving
              ? progress && progress.total > 1
                ? `Saving part ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
                : 'Saving…'
              : `Save ${plural(parsed.items.length, 'test')}`}
          </button>
        </>
      }
    >
      {sheets.length > 1 && (
        <label className="field">
          <span className="field-label">Sheet</span>
          <select
            className="input"
            value={sheetIndex}
            onChange={(e) => setSheetIndex(Number(e.target.value))}
            disabled={saving}
          >
            {sheets.map((s, i) => (
              <option key={s.sheetName} value={i}>
                {s.sheetName} ({plural(s.items.length, 'test')})
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="preview-stats">
        <div className="stat">
          <span className="stat-value" data-testid="preview-count">
            {parsed.items.length}
          </span>
          <span className="stat-label">Test items</span>
        </div>
        <div className="stat">
          <span className="stat-value">{totalSamples}</span>
          <span className="stat-label">Total samples</span>
        </div>
        <div className="preview-columns" aria-label="Columns found in the sheet">
          {parsed.columns.map((column) => (
            <span key={column} className="chip chip-gray">
              {column}
            </span>
          ))}
        </div>
      </div>

      {existing && (
        <div className="alert alert-warning" role="note">
          <AlertTriangleIcon size={16} />
          <span>
            This replaces the current master ({plural(existing.items.length, 'test')} from {existing.fileName}).
          </span>
        </div>
      )}

      {parsed.warnings.length > 0 && (
        <div className="alert alert-warning" role="note" data-testid="preview-warnings">
          <AlertTriangleIcon size={16} />
          <div>
            Check these before saving:
            <ul>
              {parsed.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="preview-table-wrap">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Part name</th>
              <th>Test name</th>
              <th>Specification</th>
              <th>Condition / Judgement criteria</th>
              <th className="preview-qty">Sample qty</th>
            </tr>
          </thead>
          <tbody>
            {parsed.items.slice(0, PREVIEW_ROWS).map((item) => (
              <tr key={item.row}>
                <td>{item.partName || <span className="muted">—</span>}</td>
                <td className="preview-strong">{item.testName || <span className="muted">—</span>}</td>
                <td>
                  <CellText text={item.specification} lines={2} />
                </td>
                <td>
                  <CellText text={item.criteria} lines={2} />
                </td>
                <td className="preview-qty">{item.sampleQuantity ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {parsed.items.length > PREVIEW_ROWS && (
          <p className="preview-more">+ {plural(parsed.items.length - PREVIEW_ROWS, 'more test')}</p>
        )}
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          <AlertTriangleIcon size={16} />
          <span>Couldn't save: {error}</span>
        </div>
      )}
    </Dialog>
  )
}
