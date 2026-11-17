/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_IOSENSE_API_ROOT?: string
  readonly VITE_IOSENSE_INSIGHT_ID?: string
  readonly VITE_IOSENSE_ORGANISATION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
