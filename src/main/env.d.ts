/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly MAIN_VITE_JARVIS_TELEMETRY_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
