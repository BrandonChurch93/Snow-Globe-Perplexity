// node out/work/p6s/field-same.mjs <tree as it was> <tree with the field in steps>: summer's field of sand (slab.ts) made
// in the first tree in one piece, and in the second in one piece, in steps, in steps by two makings in turn, and in steps
// with a grain that asks for its sun in between. The five arrays (heights; the shade and the sun before their blur; the
// shade and the sun) are held against the first tree's byte for byte.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const [, , treeA, treeB] = process.argv
const sha = (a) => crypto.createHash('sha256').update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)).digest('hex')
const OLD_END = '  made = { nx, nz, h, cast: blurred(cast, SAND_LIT.blur[0]!), lit: blurred(lit, SAND_LIT.blur[1]!) }'
const NEW_END = '  return { nx, nz, h, cast: yield* blurred(cast, SAND_LIT.blur[0]!), lit: yield* blurred(lit, SAND_LIT.blur[1]!) }'
const RAW = '  globalThis.__raw = { cast: cast.slice(), lit: lit.slice() }\n'
async function load(tree) {
  const root = path.resolve(tree)
  const { createServer } = await import(pathToFileURL(path.join(root, 'node_modules/vite/dist/node/index.js')).href)
  let which = ''
  const plugin = {
    name: 'field-same',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\?.*$/, '').endsWith('/src/seasons/summer/slab.ts')) return null
      const end = code.includes(OLD_END) ? OLD_END : code.includes(NEW_END) ? NEW_END : null
      if (!end) throw new Error(`the end of the field was not found in ${id}`)
      which = end === OLD_END ? 'in one piece' : 'in rows'
      return code.replace(end, RAW + end) + `\nexport const __x = { field, steps: typeof fieldInSteps === 'function' ? fieldInSteps : null }\n`
    },
  }
  const cwd = process.cwd()
  process.chdir(root)
  const server = await createServer({ configFile: path.join(root, 'vite.config.ts'), root, plugins: [plugin], server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
  // The arrival first: slab.ts and arrival.ts read each other, and the arrival reads the slab's numbers as it loads.
  await server.ssrLoadModule('/src/seasons/summer/arrival.ts')
  const slab = await server.ssrLoadModule('/src/seasons/summer/slab.ts')
  process.chdir(cwd)
  return { slab, which, close: () => server.close() }
}
const five = (F) => ({ heights: sha(F.h), 'shade before the blur': sha(globalThis.__raw.cast), 'sun before the blur': sha(globalThis.__raw.lit), shade: sha(F.cast), sun: sha(F.lit) })
async function way(tree, how) {
  const m = await load(tree)
  try {
    globalThis.__raw = null
    const x = m.slab.__x
    const from = performance.now()
    let F
    let steps = 0
    let longest = 0
    const timed = (g) => {
      const t = performance.now()
      const s = g.next()
      longest = Math.max(longest, performance.now() - t)
      steps++
      return s
    }
    if (how === 'whole') F = x.field()
    else if (how === 'steps') {
      const g = x.steps()
      for (let s = timed(g); ; s = timed(g)) if (s.done) { F = s.value; break }
    } else if (how === 'two in turn') {
      const a = x.steps()
      const b = x.steps()
      let other
      for (let s = timed(a); ; s = timed(a)) {
        if (s.done) { F = s.value; break }
        const t = b.next()
        if (t.done) other = t.value
      }
      const last = other ?? b.next().value
      if (last !== F) throw new Error('the second making laid a field of its own')
    } else if (how === 'a grain asks in between') {
      const g = x.steps()
      for (let k = 0; k < 1000; k++) timed(g)
      const sun = m.slab.sandLitAt(60, 17)
      if (!(sun >= 0)) throw new Error(`the grain was given ${sun}`)
      const s = timed(g)
      if (!s.done) throw new Error('the field was not whole after a grain asked')
      F = s.value
    }
    const ms = performance.now() - from
    if (F !== x.field()) throw new Error('asked again, the field is another')
    return { made: m.which, how, ms, steps, longest, five: five(F), size: `${F.nx} x ${F.nz}` }
  } finally {
    await m.close()
  }
}
const base = await way(treeA, 'whole')
console.log(`${treeA}, made ${base.made}, whole: ${base.size}, ${base.ms.toFixed(0)} ms`)
for (const [k, v] of Object.entries(base.five)) console.log(`  ${k}: sha256 ${v.slice(0, 16)}`)
let all = true
for (const how of ['whole', 'steps', 'two in turn', 'a grain asks in between']) {
  const r = await way(treeB, how)
  const differ = Object.keys(base.five).filter((k) => base.five[k] !== r.five[k])
  if (differ.length) all = false
  console.log(`${treeB}, made ${r.made}, ${how}: ${r.size}, ${r.ms.toFixed(0)} ms${r.steps ? `, ${r.steps} steps, the longest ${r.longest.toFixed(2)} ms` : ''}; ${differ.length ? `NOT the same: ${differ.join(', ')}` : 'the five arrays byte for byte the same'}`)
}
console.log(all ? 'pass' : 'fail')
process.exitCode = all ? 0 : 1
