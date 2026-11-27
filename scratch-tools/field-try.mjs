// node out/work/p6s/field-try.mjs <tree> [new.txt]: summer's field of sand (slab.ts field()) timed in its three parts and
// counted, as the tree has it; and, with a file of lines to put in place of the march, both ways and compared byte for byte.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const [, , tree = '.', swapFile] = process.argv
const root = path.resolve(tree)
const imp = (p) => import(pathToFileURL(path.join(root, p)).href)
const { createServer } = await imp('node_modules/vite/dist/node/index.js')
process.chdir(root)
const src = fs.readFileSync(path.join(root, 'src/seasons/summer/slab.ts'), 'utf8')
const lines = src.split('\n')
const from = lines.findIndex((l) => l.includes('let least = 1'))
const to = lines.findIndex((l) => l.includes('cast[o] = Math.max(least, 0)'))
if (from < 0 || to < 0) throw new Error('the march was not found')
const OLD = lines.slice(from, to + 1).join('\n')
const run = async (swap, count) => {
  const plugin = {
    name: 'field-try',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\?.*$/, '').endsWith('/src/seasons/summer/slab.ts')) return null
      let out = code
      if (!out.includes(OLD)) throw new Error('old lines not in the module')
      if (swap) {
        const [before, march] = swap.split('\n=====\n')
        const head = '  const C = SAND_LIT.cast\n'
        if (!out.includes(head)) throw new Error('head not found')
        out = out.replace(head, head + before + '\n').replace(OLD, march)
      }
      if (count) {
        const at = 'least = Math.min(least, 0.5 - (soft('
        if (out.includes(at)) out = out.replace(at, 'least = (globalThis.__n++, 0) + Math.min(least, 0.5 - (soft(')
      }
      const mark = (text, k) => {
        if (!out.includes(text)) throw new Error('mark not found: ' + text)
        out = out.replace(text, `globalThis.__t[${k}] = performance.now()\n  ${text}`)
      }
      mark('const step = SLAB.stepMm\n  const [x0, x1] = SLAB.heap.x', 0)
      mark('const key = keyDir()\n  const plan', 1)
      mark('const blurred = (a: Float32Array', 2)
      mark('made = { nx, nz, h, cast: blurred', 3)
      out = out.replace('  made = { nx, nz, h, cast: blurred(cast, SAND_LIT.blur[0]!), lit: blurred(lit, SAND_LIT.blur[1]!) }', '  made = { nx, nz, h, cast: blurred(cast, SAND_LIT.blur[0]!), lit: blurred(lit, SAND_LIT.blur[1]!) }\n  globalThis.__raw = { cast, lit }\n  globalThis.__t[4] = performance.now()')
      return out + '\nexport const __field = field\n'
    },
  }
  const server = await createServer({ configFile: path.join(root, 'vite.config.ts'), root, plugins: [plugin], server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
  try {
    globalThis.__t = []
    globalThis.__n = 0
    for (const f of ['base', 'miniature', 'arrival', 'glass']) await server.ssrLoadModule(`/src/seasons/summer/${f}.ts`)
    const slab = await server.ssrLoadModule('/src/seasons/summer/slab.ts')
    const t0 = performance.now()
    const F = slab.__field()
    const all = performance.now() - t0
    const t = globalThis.__t
    return { F, raw: globalThis.__raw, all, parts: [t[1] - t[0], t[2] - t[1], t[3] - t[2], t[4] - t[3]], n: globalThis.__n }
  } finally {
    await server.close()
  }
}
const same = (a, b) => Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0
const say = (name, r) => console.log(`${name}: field ${r.all.toFixed(0)} ms · heights ${r.parts[0].toFixed(0)} · march ${r.parts[1].toFixed(0)} · blur set up ${r.parts[2].toFixed(0)} · blur ${r.parts[3].toFixed(0)} ms${r.n ? ` · samples ${r.n}` : ''} · cells ${r.F.nx} x ${r.F.nz} = ${r.F.nx * r.F.nz}`)
const quick = !!process.env.QUICK
if (!quick) say('as it is, counted', await run(null, true))
const old = await run(null, false)
say('as it is', old)
if (swapFile && quick) {
  for (const f of swapFile.split(',')) {
    const neu = await run(fs.readFileSync(f, 'utf8').replace(/\n$/, ''), true)
    say(path.basename(f) + ', counted', neu)
    console.log('  ' + JSON.stringify(globalThis.__x))
    console.log('byte for byte the same: ' + JSON.stringify({ h: same(old.F.h, neu.F.h), castRaw: same(old.raw.cast, neu.raw.cast), litRaw: same(old.raw.lit, neu.raw.lit), cast: same(old.F.cast, neu.F.cast), lit: same(old.F.lit, neu.F.lit) }))
  }
} else if (swapFile) {
  const swap = fs.readFileSync(swapFile, 'utf8').replace(/\n$/, '')
  say('with the lines, counted', await run(swap, true))
  for (let k = 0; k < 3; k++) {
    const neu = await run(swap, false)
    say('with the lines', neu)
    const eq = { h: same(old.F.h, neu.F.h), castRaw: same(old.raw.cast, neu.raw.cast), litRaw: same(old.raw.lit, neu.raw.lit), cast: same(old.F.cast, neu.F.cast), lit: same(old.F.lit, neu.F.lit) }
    console.log('byte for byte the same: ' + JSON.stringify(eq))
    const again = await run(null, false)
    say('as it is, again', again)
  }
}
let lo = Infinity, hi = -Infinity, sum = 0, full = 0, none = 0
for (const v of old.raw.cast) { lo = Math.min(lo, v); hi = Math.max(hi, v); sum += v; if (v >= 1) full++; if (v <= 0) none++ }
let high = 0, onHeap = 0
for (const v of old.F.h) { high = Math.max(high, v); if (v > 0) onHeap++ }
console.log(`cast before the blur: least ${lo}, most ${hi}, mean ${(sum / old.raw.cast.length).toFixed(4)}, at 1: ${full}, at 0: ${none}; heights: most ${high.toFixed(3)} mm, cells above 0: ${onHeap}`)
