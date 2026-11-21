import { existsSync } from 'node:fs'
import express from 'express'
import { config, mongoHost } from './config.js'
import { closeDb, getCollection } from './db.js'
import { api } from './routes.js'

const app = express()
app.disable('x-powered-by')

app.use('/api', (req, res, next) => {
  const origin = req.get('origin')
  if (origin && (config.corsOrigins.length === 0 || config.corsOrigins.includes(origin))) {
    res.set('Access-Control-Allow-Origin', origin)
    res.set('Vary', 'Origin')
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE')
    res.set('Access-Control-Allow-Headers', 'Content-Type')
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})
app.use('/api', api)

if (config.staticDir && existsSync(config.staticDir)) {
  app.use(express.static(config.staticDir))
  console.log(`Serving the frontend from ${config.staticDir}`)
}

/** Connects early so problems show in the log at startup; a failure is retried by the next request. */
async function prepareCollection() {
  try {
    await getCollection()
    console.log(`MongoDB ready: ${mongoHost()}/${config.database}.${config.collection}`)
  } catch (err) {
    console.error(`MongoDB at ${mongoHost()} not ready yet: ${err.message}`)
  }
}

const server = app.listen(config.port, () => {
  console.log(`Test Plan Masters API listening on :${config.port}`)
  void prepareCollection()
})

function shutdown() {
  server.close(() => void closeDb().finally(() => process.exit(0)))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
