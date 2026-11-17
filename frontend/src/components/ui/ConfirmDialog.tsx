import type { ReactNode } from 'react'
import { Dialog } from './Dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel, busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      busy={busy}
      width={440}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy && <span className="spinner" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div style={{ color: 'var(--ink-700)' }}>{message}</div>
    </Dialog>
  )
}
