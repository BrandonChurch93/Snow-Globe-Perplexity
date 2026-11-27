// node out/work/p6s/kit-order.mjs <tree> [seasons] [--json FILE]: every piece of a season's set in the order the page
// makes it (base, miniature, arrival, lights, dressing), each step timed by itself, the first time it is made in the
// process, as the page makes it. A part that has no steps is one step. Node, this machine, alone.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const argv = process.argv.slice(2)
const jsonAt = argv.indexOf('--json')
const json = jsonAt >= 0 ? argv.splice(jsonAt, 2)[1] : ''
const [tree = '.', list = 'winter,spring,summer,fall'] = argv
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
const { bakeRowFiles } = await imp('tools/lib/grids.mjs')
const rowFiles = await bakeRowFiles()
const server = await createServer({ configFile: path.join(root, 'vite.config.ts'), root, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
const ms = (t) => (t < 10 ? t.toFixed(1) : t.toFixed(0))
const record = {}
try {
  const load = (f) => server.ssrLoadModule(f)
  const assetsOf = await load('/src/core/assets.ts')
  const textures = await load('/src/core/textures.ts')
  const { stepsOf } = await load('/src/scene/steps.ts')
  const assets = new assetsOf.Assets()
  assets.use(JSON.parse(fs.readFileSync(path.join(root, 'public', 'assets', 'index.json'), 'utf8')), 'web')
  assets.fetchFile = async (file) => {
    const b = await fs.promises.readFile(path.join(root, 'public', 'assets', file))
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
  }
  await textures.prepareGroup(assets, 'shared')
  for (const season of list.split(',')) {
    await textures.prepareGroup(assets, season)
    const { kit } = await load(`/src/seasons/${season}/index.ts`)
    const realFetch = globalThis.fetch
    globalThis.document = { baseURI: 'https://host.example/' }
    globalThis.fetch = async (address) => {
      const name = /\/assets\/rows\/([a-z-]+)\.bin$/.exec(new URL(address).pathname)?.[1]
      return name && rowFiles[name] ? new Response(rowFiles[name]) : new Response(null, { status: 404 })
    }
    try {
      await kit.prepare?.()
    } finally {
      delete globalThis.document
      globalThis.fetch = realFetch
    }
    const parts = {}
    let worst = { t: 0 }
    for (const name of ['base', 'miniature', 'arrival', 'lights', 'dressing']) {
      const steps = stepsOf(kit[name])
      const times = []
      for (let step = { done: false }; !step.done; ) {
        const from = performance.now()
        step = steps.next()
        times.push(performance.now() - from)
      }
      const longest = Math.max(...times)
      parts[name] = { steps: times.length, all: times.reduce((a, b) => a + b, 0), longest, at: times.indexOf(longest) + 1, times }
      if (longest > worst.t) worst = { t: longest, name, at: times.indexOf(longest) + 1 }
    }
    record[season] = parts
    const said = Object.entries(parts).map(([name, p]) => (p.steps === 1 ? `${name} ${ms(p.all)}` : `${name} ${p.steps} steps, ${ms(p.all)} in all, the longest ${ms(p.longest)} (step ${p.at})`))
    console.log(`${season}: ${said.join(' · ')} ms; the longest piece ${ms(worst.t)} ms (${worst.name}${parts[worst.name].steps > 1 ? `, step ${worst.at}` : ''})`)
  }
} finally {
  await server.close()
}
if (json) fs.writeFileSync(path.resolve(json), JSON.stringify(record))
