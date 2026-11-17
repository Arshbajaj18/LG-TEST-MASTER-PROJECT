interface RuntimeConfig {
  apiRoot?: string | null
  insightId?: string | null
  organisation?: string | null
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
  /** API root including the `/api` prefix, without trailing slash. */
  apiRoot: pick(runtime.apiRoot, import.meta.env.VITE_IOSENSE_API_ROOT, 'http://10.102.120.46:3002/api').replace(/\/+$/, ''),
  insightId: pick(runtime.insightId, import.meta.env.VITE_IOSENSE_INSIGHT_ID, 'INS_85cbe7954686'),
  organisation: pick(runtime.organisation, import.meta.env.VITE_IOSENSE_ORGANISATION, ''),
}

export const apiHost = (() => {
  try {
    return new URL(config.apiRoot).host
  } catch {
    return config.apiRoot
  }
})()
