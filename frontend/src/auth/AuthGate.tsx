import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { apiHost } from '../config'
import { onUnauthorized } from '../services/http'
import { errorMessage } from '../utils/format'
import { ClipboardListIcon, LockIcon } from '../components/ui/Icons'
import { clearSession, loadSession, saveSession } from './session'
import { exchangeSsoToken, readSsoTokenFromUrl, stripSsoTokenFromUrl } from './sso'
import './AuthGate.css'

type AuthState =
  | { status: 'checking' }
  | { status: 'ready' }
  | { status: 'signed-out'; reason: 'missing' | 'expired' | 'failed'; message?: string }

async function signIn(ssoToken: string): Promise<AuthState> {
  try {
    saveSession(await exchangeSsoToken(ssoToken))
    return { status: 'ready' }
  } catch (err) {
    clearSession()
    return { status: 'signed-out', reason: 'failed', message: errorMessage(err) }
  }
}

// Module-level so the one-time SSO token is exchanged exactly once, even under StrictMode double effects.
let bootstrap: Promise<AuthState> | null = null
function bootstrapOnce(): Promise<AuthState> {
  bootstrap ??= (async () => {
    const ssoToken = readSsoTokenFromUrl()
    if (ssoToken) {
      stripSsoTokenFromUrl()
      return signIn(ssoToken)
    }
    return loadSession() ? { status: 'ready' } : { status: 'signed-out', reason: 'missing' }
  })()
  return bootstrap
}

/** Establishes an I/O Sense session from the SSO token before rendering the app. */
export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'checking' })
  const [manualToken, setManualToken] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    void bootstrapOnce().then((next) => active && setState(next))
    return () => {
      active = false
    }
  }, [])

  useEffect(
    () =>
      onUnauthorized(() =>
        setState({ status: 'signed-out', reason: 'expired', message: 'Your I/O Sense session has expired.' }),
      ),
    [],
  )

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!manualToken.trim()) return
    setSubmitting(true)
    const next = await signIn(manualToken.trim())
    setSubmitting(false)
    setState(next)
  }

  if (state.status === 'ready') return <>{children}</>

  if (state.status === 'checking') {
    return (
      <div className="auth-screen">
        <div className="auth-card auth-card-center" aria-busy="true">
          <span className="spinner spinner-lg" />
          <p className="auth-checking">Connecting to I/O Sense…</p>
        </div>
      </div>
    )
  }

  const heading =
    state.reason === 'failed' ? "We couldn't sign you in" : state.reason === 'expired' ? 'Session expired' : 'Sign in with I/O Sense'

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-icon">
          <ClipboardListIcon size={22} />
        </div>
        <h1 className="auth-title">{heading}</h1>
        <p className="auth-text">
          Open <strong>Test Plan Masters</strong> from I/O Sense to sign in automatically. Your session is created from the
          I/O Sense SSO token.
        </p>
        {state.message && (
          <div className="alert alert-error" role="alert">
            <LockIcon size={16} />
            <span>{state.message}</span>
          </div>
        )}
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field">
            <span className="field-label">SSO token</span>
            <input
              className="input"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              placeholder="Paste an I/O Sense SSO token"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={!manualToken.trim() || submitting}>
            {submitting && <span className="spinner" />}
            Continue
          </button>
        </form>
        <p className="auth-host">Server: {apiHost}</p>
      </div>
    </div>
  )
}
