/// <reference types="vite/client" />

declare const __ENGINE_HASH__: string
declare const __APPROVED_PRESENT__: string[]
declare const __VERSIONS__: Record<string, string>
declare const __AUDIO_INDEX__: import('./core/bridge').AudioIndex | null

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
