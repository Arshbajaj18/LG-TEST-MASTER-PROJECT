import type { Page, Route } from '@playwright/test'

/**
 * In-memory stand-in for the LG on-prem I/O Sense connector (10.102.120.46:3002 is not reachable from CI).
 * Mirrors the Bruce insight-result contract verified against the live cloud connector:
 * - filter.tags must be an array and is AND-combined, otherwise { success: false, errors: ['Invalid tags'] }
 * - include-style projection with dotted paths; _id and metadata always returned
 * - newest first, nested pagination { page, count } -> { data, totalCount, pagination }
 */

export const ON_PREM_HOST = '10.102.120.46:3002'
/** The on-prem connector is plain http on port 3002, unlike the https cloud connector. */
export const ON_PREM_ORIGIN = `http://${ON_PREM_HOST}`
export const INSIGHT_ID = 'INS_85cbe7954686'
export const VALID_SSO = 'valid-sso-token'
export const BEARER = 'Bearer test-jwt'

export interface StoredRow {
  _id: string
  insightID: string
  resultName: string
  tags: string[]
  result: Record<string, unknown>
  invocationTime: string
  createdAt: string
  metadata: Record<string, unknown>
}

export interface RecordedRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

function pick(source: Record<string, unknown>, path: string, target: Record<string, unknown>) {
  const [head, ...rest] = path.split('.')
  if (!(head in source)) return
  if (rest.length === 0) {
    target[head] = source[head]
    return
  }
  const child = source[head]
  if (child && typeof child === 'object') {
    target[head] = (target[head] as Record<string, unknown>) ?? {}
    pick(child as Record<string, unknown>, rest.join('.'), target[head] as Record<string, unknown>)
  }
}

export class FakeIosense {
  rows: StoredRow[] = []
  requests: RecordedRequest[] = []
  /** When set, data routes answer 401 as if the token expired. */
  expireToken = false
  /** When set, listing fails the way an unknown insight does on a real connector. */
  breakReads = false
  private seq = 0
  private clock = Date.parse('2026-11-17T06:00:00Z')
  private page: Page

  constructor(page: Page) {
    this.page = page
  }

  async install() {
    await this.page.route(`${ON_PREM_ORIGIN}/api/**`, (route) => this.handle(route))
  }

  rowsTagged(...tags: string[]) {
    return this.rows.filter((r) => tags.every((t) => r.tags.includes(t)))
  }

  private nextId() {
    this.seq += 1
    return this.seq.toString(16).padStart(24, '0')
  }

  private json(route: Route, status: number, body: unknown) {
    return route.fulfill({
      status,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    })
  }

  private async handle(route: Route) {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 200,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'GET, PUT, POST, DELETE',
          'access-control-allow-headers': 'Content-Type, Authorization, organisation, ngsw-bypass',
        },
      })
    }
    const body = req.postData() ? JSON.parse(req.postData() as string) : undefined
    this.requests.push({ method, url: req.url(), headers: req.headers(), body })

    const path = url.pathname
    const sso = path.match(/^\/api\/retrieve-sso-token\/(.+)$/)
    if (sso && method === 'GET') {
      return decodeURIComponent(sso[1]) === VALID_SSO
        ? this.json(route, 200, { success: true, token: BEARER, organisation: 'https://iosense.io', userId: 'user-1' })
        : this.json(route, 400, { success: false, errors: ['Invalid or expired token.'] })
    }

    if (this.expireToken || req.headers()['authorization'] !== BEARER) {
      return this.json(route, 401, { success: false, errors: ['Unauthorized'] })
    }

    if (path === '/api/account/bruce/insightResult/add' && method === 'POST') {
      if (body.insightID !== INSIGHT_ID) return this.json(route, 404, { success: false, errors: ['Insight not found.'] })
      if (!body.result || typeof body.result !== 'object') return this.json(route, 400, { success: false, errors: ['result is required'] })
      this.clock += 1000
      const row: StoredRow = {
        _id: this.nextId(),
        insightID: body.insightID,
        resultName: body.resultName,
        tags: body.tags ?? [],
        result: body.result,
        invocationTime: new Date(this.clock).toISOString(),
        createdAt: new Date(this.clock).toISOString(),
        metadata: { userID: { _id: 'user-1', userDetail: { personalDetails: { name: { first: 'LG', last: ' Tester' } } } } },
      }
      this.rows.push(row)
      return this.json(route, 200, { success: true, data: row })
    }

    const list = path.match(/^\/api\/account\/bruce\/insightResult\/fetch\/paginated\/(.+)$/)
    if (list && method === 'PUT') {
      if (this.breakReads) {
        return this.json(route, 200, { success: false, errors: [`fetchInsightResults: Insight ${INSIGHT_ID} not found.`] })
      }
      if (decodeURIComponent(list[1]) !== INSIGHT_ID) {
        return this.json(route, 200, { success: false, errors: [`fetchInsightResults: Insight ${list[1]} not found.`] })
      }
      const tags = body?.filter?.tags
      if (tags !== undefined && !Array.isArray(tags)) return this.json(route, 200, { success: false, errors: ['Invalid tags'] })
      const matching = this.rows
        .filter((r) => (tags ?? []).every((t: string) => r.tags.includes(t)))
        .sort((a, b) => b.invocationTime.localeCompare(a.invocationTime))
      const page = body?.pagination?.page ?? 1
      const count = body?.pagination?.count ?? 10
      const slice = matching.slice((page - 1) * count, page * count)
      const projection = body?.projection as Record<string, number> | undefined
      const data = slice.map((row) => {
        if (!projection) return row
        const out: Record<string, unknown> = { _id: row._id, metadata: row.metadata }
        for (const key of Object.keys(projection)) if (projection[key]) pick(row as unknown as Record<string, unknown>, key, out)
        return out
      })
      return this.json(route, 200, {
        success: true,
        data: { data, totalCount: matching.length, pagination: { page, count, totalPages: Math.max(1, Math.ceil(matching.length / count)) } },
      })
    }

    const del = path.match(/^\/api\/account\/bruce\/insightResult\/delete\/([^/]+)\/([^/]+)$/)
    if (del && method === 'DELETE') {
      const index = this.rows.findIndex((r) => r._id === del[2] && r.insightID === decodeURIComponent(del[1]))
      if (index === -1) return this.json(route, 404, { success: false, errors: ['Insight result not found.'] })
      const [removed] = this.rows.splice(index, 1)
      return this.json(route, 200, { success: true, data: removed })
    }

    return this.json(route, 404, { success: false, errors: [`No fake route for ${method} ${path}`] })
  }
}
