/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLATFORM_ADMIN_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
