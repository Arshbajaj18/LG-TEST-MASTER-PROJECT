import { fileURLToPath } from 'node:url'

// Optional backend/.env. Variables already set in the environment take precedence.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
} catch (err) {
  if (err.code !== 'ENOENT') throw err
}

function env(name, fallback) {
  const value = process.env[name]?.trim()
  return value || fallback
}

function list(name) {
  return env(name, '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export const config = {
  port: Number(env('PORT', '8431')),
  /** Connection string; credentials, if the server needs them, go here (mongodb://user:pass@host:port). */
  mongoUri: env('MONGODB_URI', 'mongodb://10.102.120.46:27018'),
  database: env('MONGODB_DATABASE', 'productionDB'),
  collection: env('MONGODB_COLLECTION', 'testmaster'),
  /** Origins allowed to call the API cross-origin. Empty allows any (the API is bearer-protected, not cookie-based). */
  corsOrigins: list('CORS_ORIGINS'),
  /** Built frontend to serve next to the API, so one process hosts the whole app. Set to "" to disable. */
  staticDir: process.env.STATIC_DIR ?? fileURLToPath(new URL('../../frontend/dist', import.meta.url)),
  /** Request body cap; a test master is sent in one request. */
  bodyLimit: env('BODY_LIMIT', '20mb'),
}

/** host:port of the MongoDB server with any credentials stripped, for display. */
export function mongoHost(uri = config.mongoUri) {
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]*@)?([^/?]+)/)
  return match ? match[1] : uri
}
