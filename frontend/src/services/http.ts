import { config } from '../config'
import { clearSession, loadSession } from '../auth/session'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type UnauthorizedListener = () => void
const unauthorizedListeners = new Set<UnauthorizedListener>()

/** Lets the auth layer react when any call reports an expired/invalid token. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

interface Envelope<T> {
  success?: boolean
  data?: T
  errors?: unknown
  error?: unknown
  message?: unknown
}

function describeErrors(body: Envelope<unknown> | null): string | null {
  if (!body) return null
  const raw = body.errors ?? body.error ?? body.message
  if (!raw) return null
  if (Array.isArray(raw)) return raw.map((e) => (typeof e === 'string' ? e : JSON.stringify(e))).join(', ')
  return typeof raw === 'string' ? raw : JSON.stringify(raw)
}

/**
 * Calls an I/O Sense route relative to the configured API root and unwraps the
 * `{ success, data }` envelope. FSV reports some failures as HTTP 200 with
 * `success: false`, so both the status and the flag are checked.
 */
export async function iosenseRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const session = loadSession()
  if (!session) {
    unauthorizedListeners.forEach((l) => l())
    throw new ApiError('Not signed in to I/O Sense.', 401)
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: session.bearer,
    'ngsw-bypass': 'true',
  }
  if (session.organisation) headers.organisation = session.organisation
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${config.apiRoot}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(`Could not reach I/O Sense at ${config.apiRoot}.`, 0)
  }

  let json: Envelope<T> | null = null
  try {
    json = (await res.json()) as Envelope<T>
  } catch {
    // handled below
  }

  if (res.status === 401) {
    clearSession()
    unauthorizedListeners.forEach((l) => l())
    throw new ApiError('Your I/O Sense session has expired. Please reopen the app from I/O Sense.', 401)
  }
  if (res.status === 413) {
    throw new ApiError('The server rejected the request because it is too large.', 413)
  }
  if (!res.ok || !json || json.success === false) {
    throw new ApiError(describeErrors(json) ?? `Request failed (HTTP ${res.status}).`, res.status)
  }
  return json.data as T
}
