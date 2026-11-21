interface RuntimeConfig {
  dataApiRoot?: string | null
}

declare global {
  interface Window {
    APP_CONFIG?: RuntimeConfig
  }
}

const runtime: RuntimeConfig = (typeof window !== 'undefined' && window.APP_CONFIG) || {}

function pick(runtimeValue: string | null | undefined, envValue: string | undefined, fallback: string): string {
  const value = runtimeValue?.trim() || envValue?.trim() || fallback
  return value
}

export const config = {
  /**
   * Test Plan Masters API (backend/, backed by MongoDB), without trailing slash. A relative value
   * resolves against the page, so the default works when the backend also serves the frontend.
   */
  dataApiRoot: pick(runtime.dataApiRoot, import.meta.env.VITE_TESTMASTER_API_ROOT, 'api').replace(/\/+$/, ''),
}
