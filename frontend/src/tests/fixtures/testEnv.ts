/** Ports and database the Playwright run uses; none of them overlap the dev or production setup. */
export const TEST_MONGO_PORT = 27099
export const TEST_API_PORT = 8432
export const TEST_APP_PORT = 8433
export const TEST_MONGODB_URI = process.env.TEST_MONGODB_URI ?? `mongodb://127.0.0.1:${TEST_MONGO_PORT}`
export const TEST_DATABASE = 'productionDB'
export const TEST_COLLECTION = 'testmaster'
