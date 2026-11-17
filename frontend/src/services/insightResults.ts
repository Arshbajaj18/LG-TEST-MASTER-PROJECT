import { config } from '../config'
import { iosenseRequest } from './http'

/** A row in a Bruce insight's result collection, as returned by the list route. */
export interface InsightResultRow<R> {
  _id: string
  insightID?: string
  resultName?: string
  tags?: string[]
  invocationTime?: string
  createdAt?: string
  result?: R
  metadata?: {
    userID?: {
      _id?: string
      userDetail?: { personalDetails?: { name?: { first?: string; last?: string } } }
    }
  }
}

interface ListPage<R> {
  data: InsightResultRow<R>[]
  totalCount: number
  pagination: { page: number; count?: number; totalPages: number }
}

const PAGE_SIZE = 100
const MAX_PAGES = 50

const bruce = (route: string) => `/account/bruce/insightResult${route}`

/** POST /account/bruce/insightResult/add */
export async function createInsightResult<R extends object>(input: {
  resultName: string
  tags: string[]
  result: R
}): Promise<InsightResultRow<R>> {
  return iosenseRequest<InsightResultRow<R>>('POST', bruce('/add'), {
    insightID: config.insightId,
    resultName: input.resultName,
    tags: input.tags,
    result: input.result,
    invocationTime: Date.now(),
  })
}

/**
 * PUT /account/bruce/insightResult/fetch/paginated/:insightID
 * Fetches every page. `tags` are AND-combined by the server.
 */
export async function listInsightResults<R>(options: {
  tags: string[]
  projection?: Record<string, 0 | 1>
}): Promise<InsightResultRow<R>[]> {
  const rows: InsightResultRow<R>[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await iosenseRequest<ListPage<R>>(
      'PUT',
      bruce(`/fetch/paginated/${encodeURIComponent(config.insightId)}`),
      {
        filter: { tags: options.tags },
        ...(options.projection ? { projection: options.projection } : {}),
        pagination: { page, count: PAGE_SIZE },
      },
    )
    rows.push(...(res?.data ?? []))
    const totalPages = res?.pagination?.totalPages ?? 1
    if (page >= totalPages || !res?.data?.length) break
  }
  return rows
}

/** DELETE /account/bruce/insightResult/delete/:insightID/:resultId */
export async function deleteInsightResult(resultId: string): Promise<void> {
  await iosenseRequest<unknown>(
    'DELETE',
    bruce(`/delete/${encodeURIComponent(config.insightId)}/${encodeURIComponent(resultId)}`),
  )
}

export function rowAuthorName(row: InsightResultRow<unknown>): string {
  const name = row.metadata?.userID?.userDetail?.personalDetails?.name
  return [name?.first, name?.last].map((s) => s?.trim()).filter(Boolean).join(' ')
}

export function rowTime(row: InsightResultRow<unknown>): number {
  const t = Date.parse(row.invocationTime ?? row.createdAt ?? '')
  return Number.isNaN(t) ? 0 : t
}
