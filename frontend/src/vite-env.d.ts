/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for cross-origin deploys (e.g. Vercel). Empty = same-origin. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
