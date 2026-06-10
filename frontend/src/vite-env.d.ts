/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for cross-origin deploys (e.g. Vercel). Empty = same-origin. */
  readonly VITE_API_URL?: string;
  /** "false" restores the live app; anything else (default) runs the static "demo retired" showcase. */
  readonly VITE_DEMO_RETIRED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
