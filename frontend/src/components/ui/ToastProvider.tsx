import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangleIcon, CheckCircleIcon, XIcon } from './Icons'
import { ToastContext, type ToastKind } from './toastContext'
import './Toast.css'

const MAX_TOASTS = 3

interface Toast {
  id: number
  message: string
  kind: ToastKind
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])

  const show = useCallback(
    (message: string, kind: ToastKind = 'success') => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, message, kind }].slice(-MAX_TOASTS))
      window.setTimeout(() => dismiss(id), kind === 'error' ? 7000 : 3500)
    },
    [dismiss],
  )

  const api = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === 'success' ? <CheckCircleIcon size={18} /> : <AlertTriangleIcon size={18} />}
            <span>{t.message}</span>
            <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>
              <XIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
