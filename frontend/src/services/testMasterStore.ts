/**
 * Maps categories and test masters onto rows in the configured Bruce insight.
 *
 * Row layout (all rows carry the `lg-test-master` tag):
 *  - Category:    tags lgtm-category, lgtm-category/<categoryId>
 *  - Test master: tags lgtm-testmaster, lgtm-testmaster/<categoryId>, lgtm-upload/<uploadId>
 *    A test master is split into chunks so no single request exceeds the gateway body limit.
 *
 * Edits are create-then-delete: the new row is written first, then older rows are removed.
 * Readers always pick the newest complete version, so a failed cleanup never shows stale data.
 */
import type { Category, CategorySummary, ParsedTestMaster, TestItem, TestMaster } from '../types'
import { plural } from '../utils/format'
import {
  createInsightResult,
  deleteInsightResult,
  listInsightResults,
  rowAuthorName,
  rowTime,
  type InsightResultRow,
} from './insightResults'

const TAG_APP = 'lg-test-master'
const TAG_CATEGORY = 'lgtm-category'
const TAG_TESTMASTER = 'lgtm-testmaster'
const categoryTag = (id: string) => `${TAG_CATEGORY}/${id}`
const testMasterTag = (categoryId: string) => `${TAG_TESTMASTER}/${categoryId}`
const uploadTag = (uploadId: string) => `lgtm-upload/${uploadId}`

/** Max serialized size of one chunk's items; keeps each request well under common 100 KB body limits. */
const CHUNK_BYTE_BUDGET = 48_000

interface CategoryResult {
  schema: 'lgtm.category.v1'
  categoryId: string
  name: string
  description: string
  createdAt: number
}

interface TestMasterChunkResult {
  schema: 'lgtm.testmaster.v1'
  categoryId: string
  uploadId: string
  part: number
  parts: number
  itemCount: number
  fileName: string
  sheetName: string
  columns: string[]
  warnings: string[]
  uploadedAt: number
  items: TestItem[]
}

type ChunkSummary = Pick<TestMasterChunkResult, 'categoryId' | 'uploadId' | 'part' | 'parts' | 'itemCount' | 'fileName'>

export function newId(): string {
  // crypto.randomUUID is only available in secure contexts; on-prem may be served over plain http.
  if (typeof crypto.randomUUID === 'function' && window.isSecureContext) return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function toCategory(row: InsightResultRow<CategoryResult>): Category & { createdAt: number } {
  const r = row.result as CategoryResult
  return {
    id: r.categoryId,
    name: r.name,
    description: r.description ?? '',
    createdAt: r.createdAt ?? rowTime(row),
    resultId: row._id,
    updatedAt: rowTime(row),
    updatedBy: rowAuthorName(row),
  }
}

/** Keeps only the newest row per category id. */
function latestCategoryRows(rows: InsightResultRow<CategoryResult>[]) {
  const byId = new Map<string, InsightResultRow<CategoryResult>>()
  for (const row of rows) {
    const id = row.result?.categoryId
    if (!id) continue
    const current = byId.get(id)
    if (!current || rowTime(row) > rowTime(current)) byId.set(id, row)
  }
  return byId
}

/** Groups chunk rows by upload and returns the newest upload whose parts are all present. */
function latestCompleteUpload<R extends ChunkSummary>(rows: InsightResultRow<R>[]) {
  const uploads = new Map<string, InsightResultRow<R>[]>()
  for (const row of rows) {
    const uploadId = row.result?.uploadId
    if (!uploadId) continue
    uploads.set(uploadId, [...(uploads.get(uploadId) ?? []), row])
  }
  let best: { uploadId: string; rows: InsightResultRow<R>[]; time: number } | null = null
  for (const [uploadId, parts] of uploads) {
    const expected = parts[0].result?.parts ?? 0
    const distinct = new Set(parts.map((p) => p.result?.part))
    if (expected === 0 || distinct.size !== expected) continue
    const time = Math.max(...parts.map(rowTime))
    if (!best || time > best.time) best = { uploadId, rows: parts, time }
  }
  return best
}

export async function listCategorySummaries(): Promise<CategorySummary[]> {
  const [categoryRows, chunkRows] = await Promise.all([
    listInsightResults<CategoryResult>({ tags: [TAG_CATEGORY] }),
    listInsightResults<ChunkSummary>({
      tags: [TAG_TESTMASTER],
      projection: {
        'result.categoryId': 1,
        'result.uploadId': 1,
        'result.part': 1,
        'result.parts': 1,
        'result.itemCount': 1,
        'result.fileName': 1,
        invocationTime: 1,
        createdAt: 1,
      },
    }),
  ])

  const chunksByCategory = new Map<string, InsightResultRow<ChunkSummary>[]>()
  for (const row of chunkRows) {
    const id = row.result?.categoryId
    if (!id) continue
    chunksByCategory.set(id, [...(chunksByCategory.get(id) ?? []), row])
  }

  return [...latestCategoryRows(categoryRows).values()]
    .map(toCategory)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((category) => {
      const upload = latestCompleteUpload(chunksByCategory.get(category.id) ?? [])
      const head = upload?.rows[0]?.result
      return {
        ...category,
        testCount: head ? head.itemCount : null,
        fileName: head ? head.fileName : null,
        lastUpdated: Math.max(category.updatedAt, upload?.time ?? 0),
      }
    })
}

export async function getCategory(categoryId: string): Promise<Category | null> {
  const rows = await listInsightResults<CategoryResult>({ tags: [categoryTag(categoryId)] })
  const row = latestCategoryRows(rows).get(categoryId)
  return row ? toCategory(row) : null
}

async function writeCategory(categoryId: string, name: string, description: string, createdAt: number) {
  const result: CategoryResult = {
    schema: 'lgtm.category.v1',
    categoryId,
    name: name.trim(),
    description: description.trim(),
    createdAt,
  }
  return createInsightResult({
    resultName: `Test plan category · ${result.name}`,
    tags: [TAG_APP, TAG_CATEGORY, categoryTag(categoryId)],
    result,
  })
}

export async function createCategory(name: string, description: string): Promise<void> {
  await writeCategory(newId(), name, description, Date.now())
}

export async function updateCategory(categoryId: string, name: string, description: string): Promise<void> {
  const existing = await listInsightResults<CategoryResult>({ tags: [categoryTag(categoryId)] })
  const createdAt = latestCategoryRows(existing).get(categoryId)?.result?.createdAt ?? Date.now()
  await writeCategory(categoryId, name, description, createdAt)
  await deleteRowsQuietly(existing.map((r) => r._id))
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const [categoryRows, chunkRows] = await Promise.all([
    listInsightResults({ tags: [categoryTag(categoryId)], projection: { _id: 1 } }),
    listInsightResults({ tags: [testMasterTag(categoryId)], projection: { _id: 1 } }),
  ])
  // Test master rows first so a partial failure never leaves orphaned data behind a hidden category.
  for (const row of chunkRows) await deleteInsightResult(row._id)
  for (const row of categoryRows) await deleteInsightResult(row._id)
}

async function deleteRowsQuietly(ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await deleteInsightResult(id)
    } catch (err) {
      console.warn(`Could not remove superseded row ${id}`, err)
    }
  }
}

export async function getTestMaster(categoryId: string): Promise<TestMaster | null> {
  const rows = await listInsightResults<TestMasterChunkResult>({ tags: [testMasterTag(categoryId)] })
  const upload = latestCompleteUpload(rows)
  if (!upload) return null
  const parts = [...upload.rows].sort((a, b) => (a.result?.part ?? 0) - (b.result?.part ?? 0))
  const head = parts[0].result as TestMasterChunkResult
  return {
    categoryId,
    uploadId: upload.uploadId,
    uploadedAt: head.uploadedAt ?? upload.time,
    uploadedBy: rowAuthorName(parts[0]),
    fileName: head.fileName,
    sheetName: head.sheetName,
    columns: head.columns ?? [],
    warnings: head.warnings ?? [],
    items: parts.flatMap((p) => p.result?.items ?? []),
  }
}

function chunkItems(items: TestItem[]): TestItem[][] {
  const encoder = new TextEncoder()
  const chunks: TestItem[][] = []
  let current: TestItem[] = []
  let size = 0
  for (const item of items) {
    const itemSize = encoder.encode(JSON.stringify(item)).length + 1
    if (current.length > 0 && size + itemSize > CHUNK_BYTE_BUDGET) {
      chunks.push(current)
      current = []
      size = 0
    }
    current.push(item)
    size += itemSize
  }
  if (current.length > 0 || chunks.length === 0) chunks.push(current)
  return chunks
}

/**
 * Saves a parsed test master for a category, replacing any previous one.
 * If any chunk fails, chunks already written for this upload are rolled back.
 */
export async function saveTestMaster(
  category: Pick<Category, 'id' | 'name'>,
  parsed: ParsedTestMaster,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const previous = await listInsightResults({ tags: [testMasterTag(category.id)], projection: { _id: 1 } })
  const uploadId = newId()
  const uploadedAt = Date.now()
  const chunks = chunkItems(parsed.items)

  try {
    for (let i = 0; i < chunks.length; i++) {
      onProgress?.(i, chunks.length)
      const result: TestMasterChunkResult = {
        schema: 'lgtm.testmaster.v1',
        categoryId: category.id,
        uploadId,
        part: i + 1,
        parts: chunks.length,
        itemCount: parsed.items.length,
        fileName: parsed.fileName,
        sheetName: parsed.sheetName,
        columns: parsed.columns,
        warnings: parsed.warnings,
        uploadedAt,
        items: chunks[i],
      }
      await createInsightResult({
        resultName: `Test master · ${category.name} · ${parsed.fileName}${chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : ''}`,
        tags: [TAG_APP, TAG_TESTMASTER, testMasterTag(category.id), uploadTag(uploadId)],
        result,
      })
    }
    onProgress?.(chunks.length, chunks.length)
  } catch (err) {
    // Roll back whatever parts of this upload made it in; readers ignore incomplete uploads anyway.
    try {
      const partial = await listInsightResults({ tags: [uploadTag(uploadId)], projection: { _id: 1 } })
      await deleteRowsQuietly(partial.map((r) => r._id))
    } catch (cleanupErr) {
      console.warn('Could not roll back partial test master upload', cleanupErr)
    }
    throw err
  }

  await deleteRowsQuietly(previous.map((r) => r._id))
}

export interface StoredRowSummary {
  id: string
  kind: 'Category' | 'Test master'
  label: string
  savedAt: number
  savedBy: string
}

export interface InsightProbe {
  checkedAt: number
  categories: number
  /** Insight rows holding test master chunks (one upload can span several). */
  masterRows: number
  /** Test items across the newest upload of every category. */
  testItems: number
  rows: StoredRowSummary[]
}

/** Only the projected fields come back, and a row is of either schema, never both. */
interface ProbeResult {
  schema?: CategoryResult['schema'] | TestMasterChunkResult['schema']
  name?: string
  categoryId?: string
  uploadId?: string
  parts?: number
  itemCount?: number
  fileName?: string
}

/**
 * Reads back what this app has stored in the configured insight. Used by the status
 * indicator so an operator can confirm, from the app itself, that reads and writes
 * are reaching I/O Sense — items are left out of the projection to keep it cheap.
 */
export async function probeInsight(): Promise<InsightProbe> {
  const rows = await listInsightResults<ProbeResult>({
    tags: [TAG_APP],
    projection: {
      'result.schema': 1,
      'result.name': 1,
      'result.categoryId': 1,
      'result.uploadId': 1,
      'result.parts': 1,
      'result.itemCount': 1,
      'result.fileName': 1,
      invocationTime: 1,
      createdAt: 1,
    },
  })

  const categories = rows.filter((r) => r.result?.schema === 'lgtm.category.v1')
  const chunks = rows.filter((r) => r.result?.schema === 'lgtm.testmaster.v1')

  // Every chunk of an upload repeats itemCount, so count each upload once.
  const itemsByUpload = new Map<string, number>()
  for (const row of chunks) {
    const uploadId = row.result?.uploadId
    if (uploadId) itemsByUpload.set(uploadId, row.result?.itemCount ?? 0)
  }

  const summarise = (row: InsightResultRow<ProbeResult>): StoredRowSummary => ({
    id: row._id,
    kind: row.result?.schema === 'lgtm.category.v1' ? 'Category' : 'Test master',
    label:
      row.result?.schema === 'lgtm.category.v1'
        ? (row.result?.name ?? '—')
        : `${row.result?.fileName ?? 'test master'} · ${plural(row.result?.itemCount ?? 0, 'test')}${
            (row.result?.parts ?? 1) > 1 ? ` · ${row.result?.parts} parts` : ''
          }`,
    savedAt: rowTime(row),
    savedBy: rowAuthorName(row),
  })

  return {
    checkedAt: Date.now(),
    categories: categories.length,
    masterRows: chunks.length,
    testItems: [...itemsByUpload.values()].reduce((sum, n) => sum + n, 0),
    rows: [...rows].sort((a, b) => rowTime(b) - rowTime(a)).map(summarise),
  }
}
