import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import raw from './config/showcase.json'
import { configProblems } from './src/configCheck'
import { approvedPresent, engineHash, packageVersions, writeAssetIndex } from './tools/lib/hashes.mjs'

const present: string[] = approvedPresent()
const problems = configProblems(raw, present)
if (problems.length) throw new Error(`config/showcase.json is not valid:\n- ${problems.join('\n- ')}`)

const versions = packageVersions() as Record<string, string>

const page = (): Plugin => ({
  name: 'showcase-page',
  buildStart() {
    writeAssetIndex()
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
