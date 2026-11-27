// node out/work/p6s/kit-steps.mjs <tree> [seasons]: how long each piece of a season's set other than the miniature takes in
// Node here, the first time it is made in the process (as the page makes it) and the least of three more.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const [, , tree = '.', list = 'winter,spring,summer,fall'] = process.argv
const root = path.resolve(tree)
const imp = (p) => import(pathToFileURL(path.join(root, p)).href)
const { createServer } = await imp('node_modules/vite/dist/node/index.js')
const sharp = (await imp('node_modules/sharp/dist/index.cjs')).default
process.chdir(root)
globalThis.createImageBitmap = async (src, o = {}) => {
  if (typeof src.arrayBuffer === 'function') {
    const m = await sharp(Buffer.from(await src.arrayBuffer())).metadata()
    return { width: m.width, height: m.height, close() {} }
  }
  return { width: o.resizeWidth ?? src.width, height: o.resizeHeight ?? src.height, close() {} }
}
const server = await createServer({ configFile: path.join(root, 'vite.config.ts'), root, server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const load = (f) => server.ssrLoadModule(f)
  const assetsOf = await load('/src/core/assets.ts')
  const textures = await load('/src/core/textures.ts')
  const assets = new assetsOf.Assets()
  assets.use(JSON.parse(fs.readFileSync(path.join(root, 'public', 'assets', 'index.json'), 'utf8')), 'web')
  assets.fetchFile = async (file) => {
    const b = await fs.promises.readFile(path.join(root, 'public', 'assets', file))
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
  }
  await textures.prepareGroup(assets, 'shared')
  for (const season of list.split(',')) {
    await textures.prepareGroup(assets, season)
    const dir = `/src/seasons/${season}`
    const has = (f) => fs.existsSync(path.join(root, 'src', 'seasons', season, f))
    const parts = { base: await load(`${dir}/base.ts`), miniature: await load(`${dir}/miniature.ts`), arrival: await load(`${dir}/arrival.ts`), glass: has('glass.ts') ? await load(`${dir}/glass.ts`) : null, slab: has('slab.ts') ? await load(`${dir}/slab.ts`) : null, frost: has('frost.ts') ? await load(`${dir}/frost.ts`) : null }
    // The rows the build bakes are asked of the host by the page; here they are read from the built folder, so the pieces are timed as the page makes them.
    const rowsDir = path.join(root, 'dist', 'assets', 'rows')
    const realFetch = globalThis.fetch
    if (fs.existsSync(rowsDir)) {
      globalThis.document = { baseURI: 'http://local/' }
      globalThis.fetch = async (u) => {
        const f = path.join(rowsDir, path.basename(new URL(u).pathname))
        return fs.existsSync(f) ? new Response(fs.readFileSync(f)) : new Response(null, { status: 404 })
      }
    }
    try {
      await Promise.all(Object.values(parts).map((p) => p?.prepare?.()))
    } finally {
      delete globalThis.document
      globalThis.fetch = realFetch
    }
    const pieces = { base: () => parts.base.base(), arrival: () => parts.arrival.arrival(), lights: () => parts.miniature.lights() }
    if (parts.glass?.dressing) pieces.glass = () => parts.glass.dressing()
    if (parts.slab?.dressing) pieces.surface = () => parts.slab.dressing()
    if (parts.frost?.dressing) pieces.frost = () => parts.frost.dressing()
    const out = []
    for (const [name, make] of Object.entries(pieces)) {
      const time = () => {
        const from = performance.now()
        make()
        return performance.now() - from
      }
      const first = time()
      const least = Math.min(time(), time(), time())
      out.push(`${name} ${first.toFixed(0)} (${least.toFixed(0)})`)
    }
    console.log(`${season}: ${out.join(' · ')} ms`)
  }
} finally {
  await server.close()
}
