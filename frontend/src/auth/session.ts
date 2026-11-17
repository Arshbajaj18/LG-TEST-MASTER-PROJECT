export interface Session {
  /** Full Authorization header value, always prefixed with "Bearer ". */
  bearer: string
  organisation: string
  userId: string
  createdAt: number
}

const KEY = 'lgtm.session'

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Session
    return parsed.bearer ? parsed : null
  } catch {
    return null
  }
}

export function saveSession(session: Session): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch {
    // Storage can be blocked (private mode / embedded iframes); the in-memory session still works.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
