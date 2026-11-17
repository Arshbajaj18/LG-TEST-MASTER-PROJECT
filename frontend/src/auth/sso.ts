import { config } from '../config'
import { ApiError } from '../services/http'
import type { Session } from './session'

interface SsoResponse {
  success: boolean
  token?: string
  organisation?: string
  userId?: string
  errors?: string[]
}

const SSO_PARAMS = ['token', 'ssoToken', 'sso_token']

/** Reads the SSO token I/O Sense appends when launching the app (`?token=...`). */
export function readSsoTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  for (const name of SSO_PARAMS) {
    const value = params.get(name)
    if (value) return value
  }
  return null
}

/** Removes the one-time SSO token from the address bar so it is not bookmarked or shared. */
export function stripSsoTokenFromUrl(): void {
  const url = new URL(window.location.href)
  let changed = false
  for (const name of SSO_PARAMS) {
    if (url.searchParams.has(name)) {
      url.searchParams.delete(name)
      changed = true
    }
  }
  if (changed) window.history.replaceState(null, '', url.toString())
}

/** Exchanges an I/O Sense SSO token for a Bearer token. */
export async function exchangeSsoToken(ssoToken: string): Promise<Session> {
  const headers: Record<string, string> = { Accept: 'application/json', 'ngsw-bypass': 'true' }
  if (config.organisation) headers.organisation = config.organisation

  let res: Response
  try {
    res = await fetch(`${config.apiRoot}/retrieve-sso-token/${encodeURIComponent(ssoToken)}`, {
      method: 'GET',
      headers,
    })
  } catch {
    throw new ApiError(`Could not reach I/O Sense at ${config.apiRoot}. Check the network connection.`, 0)
  }

  let body: SsoResponse | null = null
  try {
    body = (await res.json()) as SsoResponse
  } catch {
    // non-JSON body handled below
  }

  if (!res.ok || !body?.success || !body.token) {
    const message = body?.errors?.join(', ') || `SSO validation failed (HTTP ${res.status})`
    throw new ApiError(message, res.status)
  }

  const bearer = body.token.startsWith('Bearer ') ? body.token : `Bearer ${body.token}`
  return {
    bearer,
    organisation: body.organisation ?? '',
    userId: body.userId ?? '',
    createdAt: Date.now(),
  }
}
