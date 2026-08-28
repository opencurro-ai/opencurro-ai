/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend target used by the Vite /api proxy (also configurable via CURRO_API_URL). */
  readonly VITE_CURRO_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
