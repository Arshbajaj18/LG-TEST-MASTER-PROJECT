/**
 * Categories and test masters, stored by the Test Plan Masters API (backend/) in MongoDB.
 * Each category is one document holding its current test master, so replacing a master
 * is a single write and readers never see a half-saved one.
 */
import type { Category, CategorySummary, ParsedTestMaster, TestMaster } from '../types'
import { ApiError, apiRequest } from './http'

const categoryPath = (id: string) => `/testmaster/categories/${encodeURIComponent(id)}`

export function listCategorySummaries(): Promise<CategorySummary[]> {
  return apiRequest('GET', '/testmaster/categories')
}

export async function getCategory(categoryId: string): Promise<Category | null> {
  try {
    return await apiRequest<Category>('GET', categoryPath(categoryId))
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

export async function createCategory(name: string, description: string): Promise<void> {
  await apiRequest('POST', '/testmaster/categories', { name, description })
}

export async function updateCategory(categoryId: string, name: string, description: string): Promise<void> {
  await apiRequest('PUT', categoryPath(categoryId), { name, description })
}

/** Removes the category and its test master. Default categories are refused by the API. */
export async function deleteCategory(categoryId: string): Promise<void> {
  await apiRequest('DELETE', categoryPath(categoryId))
}

export async function getTestMaster(categoryId: string): Promise<TestMaster | null> {
  try {
    return await apiRequest<TestMaster | null>('GET', `${categoryPath(categoryId)}/master`)
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/** Saves a parsed test master for a category, replacing any previous one, in one request. */
export async function saveTestMaster(category: Pick<Category, 'id'>, parsed: ParsedTestMaster): Promise<void> {
  await apiRequest('PUT', `${categoryPath(category.id)}/master`, {
    fileName: parsed.fileName,
    sheetName: parsed.sheetName,
    columns: parsed.columns,
    warnings: parsed.warnings,
    items: parsed.items,
  })
}

export interface StoredDocumentSummary {
  id: string
  name: string
  isDefault: boolean
  testCount: number | null
  fileName: string | null
  lastUpdated: number
}

export interface StorageProbe {
  host: string
  database: string
  collection: string
  checkedAt: number
  categories: number
  testMasters: number
  testItems: number
  documents: StoredDocumentSummary[]
}

/**
 * Reads back what this app has stored in MongoDB, without the test items. Used by the
 * status indicator so an operator can confirm, from the app itself, that the API and the
 * database are reachable and holding what they expect.
 */
export function probeStorage(): Promise<StorageProbe> {
  return apiRequest('GET', '/testmaster/status')
}
