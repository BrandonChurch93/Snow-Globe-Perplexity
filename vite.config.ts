import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import raw from './config/showcase.json' with { type: 'json' }
import { existsSync, readFileSync } from 'node:fs'
import { configProblems } from './src/configCheck.ts'
import { approvedPresent, engineHash, packageVersions, writeAssetIndex } from './tools/lib/hashes.mjs'

const present: string[] = approvedPresent()
const problems = configProblems(raw, present)
if (problems.length) throw new Error(`config/showcase.json is not valid:\n- ${problems.join('\n- ')}`)

const versions = packageVersions() as Record<string, string>

const audioIndex = (): unknown => {
  const file = new URL('./public/audio/index.json', import.meta.url)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

const page = (): Plugin => ({
  name: 'showcase-page',
  buildStart() {
    writeAssetIndex()
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'build.json', source: JSON.stringify({ engineHash: engineHash() }) + '\n' })
  },
  transformIndexHtml: (html) => html.replaceAll('%NAME%', raw.name),
})

export default defineConfig({
  base: './',
  plugins: [page()],
  define: {
    __ENGINE_HASH__: JSON.stringify(engineHash()),
    __APPROVED_PRESENT__: JSON.stringify(present),
    __VERSIONS__: JSON.stringify({ three: versions.three, gsap: versions.gsap, vite: versions.vite, typescript: versions.typescript }),
    __AUDIO_INDEX__: JSON.stringify(audioIndex()),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
    rollupOptions: { input: { main: 'index.html' } },
  },
  server: { host: '127.0.0.1' },
  test: { include: ['tests/**/*.test.ts'], environment: 'node', testTimeout: 60000 },
})
