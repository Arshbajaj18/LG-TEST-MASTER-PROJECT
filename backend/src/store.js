/**
 * Categories and their test masters, one document per category:
 *
 *   { _id: <categoryId>, categoryId, docType: 'lgtm.category', name, nameKey, description,
 *     isDefault, sortOrder, createdAt, updatedAt,
 *     testMaster: null | { categoryId, uploadId, fileName, sheetName, columns, warnings,
 *                          itemCount, items, uploadedAt } }
 *
 * The default categories come from code and are always listed, whether or not MongoDB holds
 * anything for them. A default's document is created the first time something is saved for
 * it (a test master upload or a description edit) and updated in place after that.
 * Categories users add are stored when they are created.
 *
 * `categoryId` repeats `_id` so it is explicit on every write, including inside the test master.
 * Replacing a test master is a single-document update, so readers never see a half-written one.
 */
import { randomUUID } from 'node:crypto'
import { DOC_TYPE, getCollection } from './db.js'
import { DEFAULT_CATEGORIES, DEFAULT_IDS } from './defaultCategories.js'

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const NAME_MAX = 80
const DESC_MAX = 160
/** Custom categories sort after the defaults, then by creation time. */
const CUSTOM_SORT_ORDER = 1000

const nameKey = (name) => name.trim().toLowerCase()
const time = (date) => (date instanceof Date ? date.getTime() : 0)
const DEFAULT_NAME_KEYS = new Set(DEFAULT_CATEGORIES.map((c) => nameKey(c.name)))
const defaultById = (id) => DEFAULT_CATEGORIES.find((c) => c.id === id)

const notFound = () => new HttpError(404, 'Category not found. It may have been deleted.')
const duplicateName = () => new HttpError(409, 'A category with this name already exists.')

function isDuplicateKey(err) {
  return err?.code === 11000
}

function validateCategory(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const description = typeof body?.description === 'string' ? body.description.trim() : ''
  if (!name) throw new HttpError(400, 'Enter a category name.')
  if (name.length > NAME_MAX) throw new HttpError(400, `Category names are at most ${NAME_MAX} characters.`)
  if (description.length > DESC_MAX) throw new HttpError(400, `Descriptions are at most ${DESC_MAX} characters.`)
  return { name, description }
}

/**
 * Fields that create a default category's document on its first save. Its name, order and
 * default flag always come from code, so they are rewritten on every save.
 */
function defaultDocFields(id) {
  const index = DEFAULT_CATEGORIES.findIndex((c) => c.id === id)
  const { name } = DEFAULT_CATEGORIES[index]
  return {
    $set: { categoryId: id, docType: DOC_TYPE, isDefault: true, sortOrder: index, name, nameKey: nameKey(name) },
    $setOnInsert: { createdAt: new Date() },
  }
}

/** A default category as listed before anything is stored for it. */
function unsavedDefault(c) {
  return { _id: c.id, name: c.name, description: '', isDefault: true, testMaster: null }
}

function toCategory(doc) {
  const builtIn = defaultById(doc._id)
  return {
    id: doc._id,
    name: builtIn ? builtIn.name : doc.name,
    description: doc.description ?? '',
    isDefault: Boolean(builtIn),
    createdAt: time(doc.createdAt),
    updatedAt: time(doc.updatedAt),
  }
}

const SUMMARY_PROJECTION = {
  name: 1,
  description: 1,
  isDefault: 1,
  createdAt: 1,
  updatedAt: 1,
  'testMaster.itemCount': 1,
  'testMaster.fileName': 1,
  'testMaster.uploadedAt': 1,
}

function toSummary(doc) {
  const master = doc.testMaster
  const category = toCategory(doc)
  return {
    ...category,
    testCount: master ? (master.itemCount ?? 0) : null,
    fileName: master ? (master.fileName ?? null) : null,
    lastUpdated: Math.max(category.updatedAt, time(master?.uploadedAt)),
  }
}

/** The defaults in their fixed order, then the categories users added, oldest first. */
export async function listCategorySummaries() {
  const collection = await getCollection()
  const docs = await collection.find({ docType: DOC_TYPE }, { projection: SUMMARY_PROJECTION }).toArray()
  const stored = new Map(docs.map((d) => [d._id, d]))
  const defaults = DEFAULT_CATEGORIES.map((c) => stored.get(c.id) ?? unsavedDefault(c))
  const custom = docs.filter((d) => !DEFAULT_IDS.has(d._id)).sort((a, b) => time(a.createdAt) - time(b.createdAt))
  return [...defaults, ...custom].map(toSummary)
}

export async function getCategory(id) {
  const collection = await getCollection()
  const doc = await collection.findOne({ _id: id, docType: DOC_TYPE }, { projection: { testMaster: 0 } })
  if (doc) return toCategory(doc)
  const builtIn = defaultById(id)
  return builtIn ? toCategory(unsavedDefault(builtIn)) : null
}

export async function createCategory(body) {
  const collection = await getCollection()
  const { name, description } = validateCategory(body)
  // Unsaved defaults have no document for the unique index to catch.
  if (DEFAULT_NAME_KEYS.has(nameKey(name))) throw duplicateName()
  const now = new Date()
  const categoryId = randomUUID()
  const doc = {
    _id: categoryId,
    categoryId,
    docType: DOC_TYPE,
    name,
    nameKey: nameKey(name),
    description,
    isDefault: false,
    sortOrder: CUSTOM_SORT_ORDER,
    createdAt: now,
    updatedAt: now,
    testMaster: null,
  }
  try {
    await collection.insertOne(doc)
  } catch (err) {
    if (isDuplicateKey(err)) throw duplicateName()
    throw err
  }
  return toCategory(doc)
}

export async function updateCategory(id, body) {
  const collection = await getCollection()
  const { name, description } = validateCategory(body)
  const builtIn = defaultById(id)

  if (builtIn) {
    if (name !== builtIn.name) throw new HttpError(409, `"${builtIn.name}" is a default category and can't be renamed.`)
    const fields = defaultDocFields(id)
    const doc = await collection.findOneAndUpdate(
      { _id: id },
      {
        $set: { ...fields.$set, description, updatedAt: new Date() },
        $setOnInsert: { ...fields.$setOnInsert, testMaster: null },
      },
      { upsert: true, returnDocument: 'after', projection: { testMaster: 0 } },
    )
    return toCategory(doc)
  }

  if (DEFAULT_NAME_KEYS.has(nameKey(name))) throw duplicateName()
  try {
    const doc = await collection.findOneAndUpdate(
      { _id: id, docType: DOC_TYPE },
      { $set: { categoryId: id, name, nameKey: nameKey(name), description, updatedAt: new Date() } },
      { returnDocument: 'after', projection: { testMaster: 0 } },
    )
    if (!doc) throw notFound()
    return toCategory(doc)
  } catch (err) {
    if (isDuplicateKey(err)) throw duplicateName()
    throw err
  }
}

export async function deleteCategory(id) {
  if (DEFAULT_IDS.has(id)) throw new HttpError(409, "Default categories can't be deleted.")
  const collection = await getCollection()
  const res = await collection.deleteOne({ _id: id, docType: DOC_TYPE })
  if (res.deletedCount === 0) throw notFound()
}

// Excel headers become `extra` keys and may contain "." or start with "$", which MongoDB
// field names don't allow everywhere, so extras are stored as [{ column, value }] pairs.
function itemToDoc(item) {
  const { extra, ...rest } = item
  return extra ? { ...rest, extra: Object.entries(extra).map(([column, value]) => ({ column, value })) } : rest
}

function itemFromDoc(item) {
  const { extra, ...rest } = item
  return Array.isArray(extra) ? { ...rest, extra: Object.fromEntries(extra.map((e) => [e.column, e.value])) } : rest
}

function validateTestMaster(body) {
  const strings = (value) => Array.isArray(value) && value.every((v) => typeof v === 'string')
  if (!body || typeof body !== 'object') throw new HttpError(400, 'Send the parsed test master as JSON.')
  if (typeof body.fileName !== 'string' || !body.fileName) throw new HttpError(400, 'fileName is required.')
  if (typeof body.sheetName !== 'string') throw new HttpError(400, 'sheetName is required.')
  if (!strings(body.columns)) throw new HttpError(400, 'columns must be a list of column names.')
  if (body.warnings !== undefined && !strings(body.warnings)) throw new HttpError(400, 'warnings must be a list of strings.')
  if (!Array.isArray(body.items) || body.items.some((i) => !i || typeof i !== 'object' || Array.isArray(i))) {
    throw new HttpError(400, 'items must be a list of test items.')
  }
  return body
}

export async function getTestMaster(categoryId) {
  const collection = await getCollection()
  const doc = await collection.findOne({ _id: categoryId, docType: DOC_TYPE }, { projection: { testMaster: 1 } })
  if (!doc && !DEFAULT_IDS.has(categoryId)) throw notFound()
  const master = doc?.testMaster
  if (!master) return null
  return {
    categoryId,
    uploadId: master.uploadId,
    uploadedAt: time(master.uploadedAt),
    fileName: master.fileName,
    sheetName: master.sheetName,
    columns: master.columns ?? [],
    warnings: master.warnings ?? [],
    items: (master.items ?? []).map(itemFromDoc),
  }
}

/**
 * Replaces the category's test master in one update and returns the item count now stored.
 * A default category's first upload creates its document; later uploads update it in place.
 */
export async function saveTestMaster(categoryId, body) {
  const collection = await getCollection()
  const parsed = validateTestMaster(body)
  const testMaster = {
    categoryId,
    uploadId: randomUUID(),
    fileName: parsed.fileName,
    sheetName: parsed.sheetName,
    columns: parsed.columns,
    warnings: parsed.warnings ?? [],
    itemCount: parsed.items.length,
    items: parsed.items.map(itemToDoc),
    uploadedAt: new Date(),
  }

  if (DEFAULT_IDS.has(categoryId)) {
    const fields = defaultDocFields(categoryId)
    await collection.updateOne(
      { _id: categoryId },
      {
        $set: { ...fields.$set, testMaster },
        $setOnInsert: { ...fields.$setOnInsert, description: '', updatedAt: testMaster.uploadedAt },
      },
      { upsert: true },
    )
  } else {
    const res = await collection.updateOne({ _id: categoryId, docType: DOC_TYPE }, { $set: { categoryId, testMaster } })
    if (res.matchedCount === 0) throw notFound()
  }
  return { uploadId: testMaster.uploadId, itemCount: testMaster.itemCount }
}

/** What this app actually holds in the collection, without the items themselves. */
export async function describeStorage() {
  const collection = await getCollection()
  const docs = await collection
    .find({ docType: DOC_TYPE }, { projection: SUMMARY_PROJECTION })
    .sort({ sortOrder: 1, createdAt: 1 })
    .toArray()
  const summaries = docs.map(toSummary)
  const withMaster = summaries.filter((s) => s.testCount !== null)
  return {
    categories: summaries.length,
    testMasters: withMaster.length,
    testItems: withMaster.reduce((sum, s) => sum + s.testCount, 0),
    documents: summaries.map((s) => ({
      id: s.id,
      name: s.name,
      isDefault: s.isDefault,
      testCount: s.testCount,
      fileName: s.fileName,
      lastUpdated: s.lastUpdated,
    })),
  }
}
