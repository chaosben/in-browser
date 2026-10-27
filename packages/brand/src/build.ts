// Injected at build time via Vite `define` (see `appConfig()` in @in-browser/vite); missing in tests and tools.
declare const __COMMIT__: string | undefined;

/** Commit the app was built from (`abc1234`, `abc1234-dirty` with uncommitted changes), otherwise `dev` */
export const COMMIT: string = typeof __COMMIT__ === 'string' ? __COMMIT__ : 'dev';
