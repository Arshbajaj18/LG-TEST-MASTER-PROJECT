import { config } from '../config'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
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

/** The Test Plan Masters API root as an absolute URL, for display. */
export const dataApiUrl = (() => {
  try {
    return new URL(config.dataApiRoot, document.baseURI).href
  } catch {
    return config.dataApiRoot
  }
})()

/**
 * Calls a Test Plan Masters API route (backend/, which stores data in MongoDB) and unwraps
 * its `{ success, data }` envelope.
 */
export async function apiRequest<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${config.dataApiRoot}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(`Could not reach the Test Plan Masters API at ${dataApiUrl}.`, 0)
  }

  let json: Envelope<T> | null = null
  try {
    json = (await res.json()) as Envelope<T>
  } catch {
    // handled below
  }

  if (res.status === 413) {
    throw new ApiError('The server rejected the request because it is too large.', 413)
  }
  if (!res.ok || !json || json.success === false) {
    throw new ApiError(describeErrors(json) ?? `Request failed (HTTP ${res.status}).`, res.status)
  }
  return json.data as T
}
