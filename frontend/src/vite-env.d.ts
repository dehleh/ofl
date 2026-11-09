/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_ENV?: string;
  readonly VITE_ENABLE_DEV_SWITCHER?: string;
  readonly VITE_ENABLE_API_BADGE?: string;
  readonly VITE_ENABLE_DEMO_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

