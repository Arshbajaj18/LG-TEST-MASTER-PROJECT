import express, { Router } from 'express'
import { config, mongoHost } from './config.js'
import { ping } from './db.js'
import * as store from './store.js'

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data })

export const api = Router()

// Parsed inside the router so a bad or oversized body gets the JSON error below.
api.use(express.json({ limit: config.bodyLimit }))

/** Liveness check for whoever runs the server. */
api.get('/health', async (_req, res) => {
  try {
    await ping()
    ok(res, { mongo: 'up' })
  } catch (err) {
    res.status(503).json({ success: false, errors: [`MongoDB at ${mongoHost()} is not reachable: ${err.message}`] })
  }
})

api.get('/testmaster/status', async (_req, res) => {
  const storage = await store.describeStorage()
  ok(res, {
    host: mongoHost(),
    database: config.database,
    collection: config.collection,
    checkedAt: Date.now(),
    ...storage,
  })
})

api.get('/testmaster/categories', async (_req, res) => {
  ok(res, await store.listCategorySummaries())
})

api.post('/testmaster/categories', async (req, res) => {
  ok(res, await store.createCategory(req.body), 201)
})

api.get('/testmaster/categories/:id', async (req, res) => {
  const category = await store.getCategory(req.params.id)
  if (!category) throw new store.HttpError(404, 'Category not found. It may have been deleted.')
  ok(res, category)
})

api.put('/testmaster/categories/:id', async (req, res) => {
  ok(res, await store.updateCategory(req.params.id, req.body))
})

api.delete('/testmaster/categories/:id', async (req, res) => {
  await store.deleteCategory(req.params.id)
  ok(res, { id: req.params.id })
})

api.get('/testmaster/categories/:id/master', async (req, res) => {
  ok(res, await store.getTestMaster(req.params.id))
})

api.put('/testmaster/categories/:id/master', async (req, res) => {
  ok(res, await store.saveTestMaster(req.params.id, req.body))
})

api.use((req, res) => {
  res.status(404).json({ success: false, errors: [`No route for ${req.method} ${req.originalUrl}`] })
})

// Express 5 forwards rejected async handlers here; it needs all four parameters to treat this as an error handler.
api.use((err, _req, res, _next) => {
  if (err instanceof store.HttpError) {
    res.status(err.status).json({ success: false, errors: [err.message] })
    return
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ success: false, errors: [`The request is larger than ${config.bodyLimit}.`] })
    return
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ success: false, errors: ['The request body is not valid JSON.'] })
    return
  }
  if (['MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoTopologyClosedError'].includes(err?.name)) {
    console.error(`MongoDB unreachable: ${err.message}`)
    res.status(503).json({ success: false, errors: [`MongoDB at ${mongoHost()} is not reachable.`] })
    return
  }
  console.error(err)
  res.status(500).json({ success: false, errors: ['Unexpected server error. Check the API log.'] })
})
