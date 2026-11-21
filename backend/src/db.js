import { MongoClient } from 'mongodb'
import { config } from './config.js'

/** Marks this app's documents, in case the collection is shared with other writers. */
export const DOC_TYPE = 'lgtm.category'

let connecting = null

/**
 * Connects once and reuses the client; the driver then rides out short outages on its own.
 * A failed first connect closes that client for good, so it is dropped and the next call
 * starts a fresh one: the API can start while MongoDB is down and recover when it is back.
 */
function connect() {
  connecting ??= (async () => {
    const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 5000, appName: 'test-plan-masters' })
    try {
      await client.connect()
    } catch (err) {
      connecting = null
      await client.close().catch(() => {})
      throw err
    }
    await ensureIndexes(client.db(config.database).collection(config.collection))
    return client
  })()
  return connecting
}

export async function getCollection() {
  return (await connect()).db(config.database).collection(config.collection)
}

/**
 * Category names are unique, case-insensitively, among this app's documents. Runs once per
 * connection; a failure is logged rather than blocking reads and writes.
 */
async function ensureIndexes(collection) {
  try {
    await collection.createIndex(
      { docType: 1, nameKey: 1 },
      { name: 'lgtm_unique_name', unique: true, partialFilterExpression: { docType: DOC_TYPE } },
    )
  } catch (err) {
    console.error(`Could not create the unique-name index: ${err.message}`)
  }
}

export async function ping() {
  await (await connect()).db(config.database).command({ ping: 1 })
}

export async function closeDb() {
  const pending = connecting
  connecting = null
  const client = await pending?.catch(() => null)
  await client?.close()
}
