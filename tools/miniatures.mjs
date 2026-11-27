import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import * as THREE from 'three'
import { createServer } from 'vite'
import { bakeRowFiles } from './lib/grids.mjs'
import { loadConfig, parseArgs, rel } from './lib/paths.mjs'

/**
 * Whether a season's miniature, and what the season lays round its globe (the `dressing` of its kit), is the same thing
 * built in one piece and built in steps.
 *
 * Before the first picture and on a page that captures, both are built in one piece. While the live page draws they are
 * built in steps, a few a frame (src/scene/steps.ts, `make` in src/scene/stage.ts). A step put in the wrong place makes the
 * same shapes in another order, and the order is seen: the ids three.js counts up decide which of two things at one depth
 * is drawn first. So the two ways are held against each other down to the ids: every object in its order, every
 * attribute's bytes, every material's values, and the program text and uniforms its hook leaves.
 *
 * On the page other work runs between two steps: frames, and after a press a second season's making, turn by turn. A
 * making that keeps a number between two steps where the other can write over it builds another shape then, and only
 * then. So a third way, `mixed`, builds in steps with a second making of the same thing one step behind it, and is
 * held against the whole one with each id as its place among the thing's own ids, since the second making counts
 * ids in between. A dressing may hold a piece there is one of (summer's pool of light), and a second dressing takes it
 * from the first however the two are made. So the dressing with a second made in between is held against the first of
 * two that were each made in one piece, both seen when the second is done.
 *
 *   node tools/miniatures.mjs [--seasons winter,fall] [--way whole|steps|mixed] [--json FILE]
 *     no --way    builds every season all three ways and says `pass` or what differs first; exit code 1 where they differ.
 *     --way       builds one way and prints each season's sha256, to hold one tree against another.
 *     --json      with --way: the whole record as a file.
 *
 * Each way is built in a process of its own, because the second thing made in a process counts its ids on from the
 * first. The dressings are built after every miniature, so a miniature's ids are what they were before a dressing was
 * held here. The models and pictures are the tracked files of the web set; a picture is only asked for its size. A
 * season that asks its host for rows the build makes (summer's grains) is given them as the build makes them, so that
 * its steps are the page's and not the working out a page without the file falls back on.
 * The times are this machine's, in Node, one way after the other: they say which step is long, not how long a page takes.
 */

const args = parseArgs(process.argv.slice(2))
const str = (k, d) => (args[k] && args[k] !== true ? String(args[k]) : d)
const seasons = str('seasons', loadConfig().seasons.join(',')).split(',')
const way = str('way', '')
const WAYS = ['whole', 'steps', 'mixed']
if (way && !WAYS.includes(way)) throw new Error(`--way is one of ${WAYS.join(', ')}, not ${way}`)

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex')
const bytes = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength)
const ms = (t) => (t < 10 ? t.toFixed(1) : t.toFixed(0))

function recorder() {
  const pictures = new Map()
  const nth = (t) => {
    if (!pictures.has(t)) pictures.set(t, pictures.size)
    return pictures.get(t)
  }

  function plain(v, depth = 0, open = new Set()) {
    if (v === null) return null
    if (v === undefined) return 'undefined'
    const t = typeof v
    if (t === 'number') return Object.is(v, -0) ? '-0' : Number.isFinite(v) ? v : String(v)
    if (t === 'string' || t === 'boolean') return v
    if (t === 'function') return `function ${sha(v.toString())}`
    if (ArrayBuffer.isView(v)) return `${v.constructor.name}[${v.length}] ${sha(bytes(v))}`
    if (open.has(v)) return 'itself'
    if (depth > 9) return 'deeper'
    open.add(v)
    try {
      if (Array.isArray(v)) return v.map((x) => plain(x, depth + 1, open))
      if (v.isTexture) return { picture: v.name, nth: nth(v), kind: v.constructor.name, size: [v.image?.width ?? null, v.image?.height ?? null], wrap: [v.wrapS, v.wrapT], filter: [v.minFilter, v.magFilter], space: v.colorSpace, anisotropy: v.anisotropy, flipY: v.flipY, mipmaps: v.generateMipmaps, version: v.version }
      if (v.isBufferAttribute || v.isInterleavedBufferAttribute) {
        const rest = {}
        for (const k of Object.keys(v).sort()) if (!['array', 'uuid', 'name', 'itemSize', 'count', 'normalized', 'usage', 'version', 'gpuType', 'updateRanges', 'onUploadCallback'].includes(k)) rest[k] = plain(v[k], depth + 1, open)
        return { kind: v.constructor.name, name: v.name, itemSize: v.itemSize, count: v.count, normalized: v.normalized, usage: v.usage, version: v.version, array: v.array ? plain(v.array) : null, rest }
      }
      if (v.isBufferGeometry) return geometry(v, depth, open)
      if (v.isMaterial) return `material ${v.id}`
      if (v.isObject3D) return `object ${v.id}`
      const out = {}
      for (const k of Object.keys(v).sort()) if (k !== 'uuid') out[k] = plain(v[k], depth + 1, open)
      return out
    } finally {
      open.delete(v)
    }
  }

  function geometry(g, depth = 0, open = new Set()) {
    const attributes = {}
    for (const k of Object.keys(g.attributes).sort()) attributes[k] = plain(g.attributes[k], depth + 1, open)
    return {
      id: g.id,
      name: g.name,
      kind: g.constructor.name,
      attributes,
      index: g.index ? plain(g.index, depth + 1, open) : null,
      morph: Object.keys(g.morphAttributes).sort(),
      groups: plain(g.groups, depth + 1, open),
      drawRange: [g.drawRange.start, String(g.drawRange.count)],
      box: g.boundingBox ? [g.boundingBox.min.toArray(), g.boundingBox.max.toArray()] : null,
      sphere: g.boundingSphere ? [g.boundingSphere.center.toArray(), g.boundingSphere.radius] : null,
      userData: plain(g.userData, depth + 1, open),
    }
  }

  const LIBRARY = [
    ['isMeshPhysicalMaterial', 'physical'],
    ['isMeshStandardMaterial', 'standard'],
    ['isMeshBasicMaterial', 'basic'],
    ['isMeshLambertMaterial', 'lambert'],
    ['isPointsMaterial', 'points'],
  ]

  function material(m) {
    const own = {}
    for (const k of Object.keys(m).sort()) if (k !== 'uuid') own[k] = plain(m[k], 1)
    const said = (run) => {
      try {
        return run()
      } catch (e) {
        return `threw ${e.message}`
      }
    }
    const lib = m.isShaderMaterial ? null : THREE.ShaderLib[LIBRARY.find(([is]) => m[is])?.[1] ?? 'standard']
    const shader = lib
      ? { name: m.type, uniforms: THREE.UniformsUtils.clone(lib.uniforms), vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, defines: {} }
      : { name: m.type, uniforms: m.uniforms, vertexShader: m.vertexShader, fragmentShader: m.fragmentShader, defines: m.defines }
    const hook = said(() => (m.onBeforeCompile(shader, {}), 'ran'))
    return {
      id: m.id,
      type: m.type,
      kind: m.constructor.name,
      key: said(() => m.customProgramCacheKey()),
      own,
      program: { hook, vertex: sha(shader.vertexShader ?? ''), fragment: sha(shader.fragmentShader ?? ''), defines: plain(shader.defines ?? null), uniforms: plain(shader.uniforms, 1) },
    }
  }

  const APART = ['uuid', 'parent', 'children', 'geometry', 'material', 'up', 'position', 'rotation', 'quaternion', 'scale', 'matrix', 'matrixWorld', 'layers', 'userData', 'animations', 'modelViewMatrix', 'normalMatrix']

  return function objects(root) {
    const rows = []
    const walk = (o, depth) => {
      const own = {}
      for (const k of Object.keys(o).sort()) if (!APART.includes(k)) own[k] = plain(o[k], 1)
      rows.push({
        depth,
        id: o.id,
        type: o.type,
        kind: o.constructor.name,
        name: o.name,
        position: o.position.toArray(),
        quaternion: o.quaternion.toArray(),
        scale: o.scale.toArray(),
        matrix: Array.from(o.matrix.elements),
        layers: o.layers.mask,
        hooks: ['onBeforeRender', 'onAfterRender', 'onBeforeShadow', 'onAfterShadow'].map((k) => plain(o[k])),
        userData: plain(o.userData, 1),
        own,
        children: o.children.length,
        geometry: o.geometry ? geometry(o.geometry) : null,
        material: o.material ? (Array.isArray(o.material) ? o.material.map(material) : material(o.material)) : null,
      })
      for (const c of o.children) walk(c, depth + 1)
    }
    walk(root, 0)
    return rows
  }
}

/**
 * What `make` gives, built the way asked for, and how long each piece took. In `mixed` a second making runs one step
 * behind, and is brought to its end after the first where `both` are wanted whole.
 */
function builtBy(make, stepsOf, how, both = false) {
  const times = []
  let made
  if (how === 'whole') {
    const from = performance.now()
    made = make()
    times.push(performance.now() - from)
    return { made, times }
  }
  const steps = stepsOf()
  const behind = how === 'mixed' ? stepsOf() : null
  for (let step = { done: false }; !step.done; ) {
    const from = performance.now()
    step = steps.next()
    times.push(performance.now() - from)
    made = step.value
    if (behind && times.length > 1 && !step.done) behind.next()
  }
  if (behind && both) while (!behind.next().done);
  return { made, times }
}

/** `run` with a host behind it that has the rows the build makes (tools/lib/grids.mjs) and nothing else. */
async function withRows(run) {
  const fetchWas = globalThis.fetch
  let files
  globalThis.document = { baseURI: 'https://host.example/' }
  globalThis.fetch = async (address) => {
    const name = /\/assets\/rows\/([a-z-]+)\.bin$/.exec(new URL(address).pathname)?.[1]
    const file = name ? (await (files ??= bakeRowFiles()))[name] : null
    return file ? new Response(file) : new Response(null, { status: 404 })
  }
  try {
    return await run()
  } finally {
    delete globalThis.document
    globalThis.fetch = fetchWas
  }
}

async function build(how) {
  globalThis.createImageBitmap = async (from, o = {}) => {
    if (typeof from.arrayBuffer !== 'function') return { width: o.resizeWidth ?? from.width, height: o.resizeHeight ?? from.height, close() {} }
    const { width, height } = await sharp(Buffer.from(await from.arrayBuffer())).metadata()
    return { width, height, close() {} }
  }
  // No socket of its own: the baking of the rows loads the source a second time beside this one (tools/lib/grids.mjs), and two that ask for the one port log an error.
  const server = await createServer({ configFile: rel('vite.config.ts'), root: rel(), server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
  const out = {}
  try {
    const { Assets } = await server.ssrLoadModule('/src/core/assets.ts')
    const { prepareGroup } = await server.ssrLoadModule('/src/core/textures.ts')
    const assets = new Assets()
    assets.use(JSON.parse(fs.readFileSync(rel('public', 'assets', 'index.json'), 'utf8')), 'web')
    assets.fetchFile = async (file) => {
      const b = await fs.promises.readFile(rel('public', 'assets', file))
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
    }
    await prepareGroup(assets, 'shared')
    const objects = recorder()
    for (const season of seasons) {
      await prepareGroup(assets, season)
      const part = await server.ssrLoadModule(`/src/seasons/${season}/miniature.ts`)
      await part.prepare()
      const { made, times } = builtBy(part.miniature, () => part.miniature.steps(), how)
      const rows = objects(made)
      out[season] = { rows, times, sha256: sha(JSON.stringify(rows)) }
    }
    const { stepsOf } = await server.ssrLoadModule('/src/scene/steps.ts')
    for (const season of seasons) {
      const { kit } = await server.ssrLoadModule(`/src/seasons/${season}/index.ts`)
      await withRows(async () => kit.prepare?.())
      // What the page makes of a season before its dressing: a dressing may ask for something of it (fall's cobweb, of the base).
      kit.base()
      kit.arrival()
      kit.lights()
      const dressing = () => stepsOf(kit.dressing)
      const { made, times } = builtBy(kit.dressing, dressing, how, true)
      const seen = () => [...objects(made.glass), ...objects(made.surface)]
      const rows = seen()
      if (how !== 'mixed') builtBy(kit.dressing, dressing, how)
      out[season].dressing = { rows, beside: seen(), times, sha256: sha(JSON.stringify(rows)) }
    }
  } finally {
    await server.close()
  }
  return out
}

const allOf = (made) => sha(seasons.map((s) => made[s].sha256).join(' '))
const dressingsOf = (made) => sha(seasons.map((s) => made[s].dressing.sha256).join(' '))

/** The record with each id as its place among the ids of its kind in this record, least first. */
function placed(rows) {
  const ids = { object: new Set(), geometry: new Set(), material: new Set() }
  for (const r of rows) {
    ids.object.add(r.id)
    if (r.geometry) ids.geometry.add(r.geometry.id)
    for (const m of [r.material].flat()) if (m) ids.material.add(m.id)
  }
  const place = {}
  for (const [kind, set] of Object.entries(ids)) place[kind] = new Map([...set].sort((a, b) => a - b).map((id, n) => [id, n]))
  const named = (v) => {
    if (typeof v === 'string') {
      const m = /^(material|object) (\d+)$/.exec(v)
      return m ? `${m[1]} ${place[m[1]].get(Number(m[2])) ?? 'of another'}` : v
    }
    if (v === null || typeof v !== 'object') return v
    if (Array.isArray(v)) return v.map(named)
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, named(x)]))
  }
  return rows.map((r) => {
    const out = named(r)
    out.id = place.object.get(r.id)
    if (out.geometry) out.geometry.id = place.geometry.get(r.geometry.id)
    const materials = [r.material].flat()
    ;[out.material].flat().forEach((m, n) => m && (m.id = place.material.get(materials[n].id)))
    return out
  })
}

function firstDifference(a, b, at = '') {
  if (a === b) return null
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return `${at || 'the record'}: ${JSON.stringify(a)} whole, ${JSON.stringify(b)} this way`
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = firstDifference(a[k], b[k], at ? `${at}.${k}` : k)
    if (d) return d
  }
  return null
}

if (way) {
  const made = await build(way)
  const said = (name, m) => console.log(`${name}: ${m.rows.length} objects; ${way === 'whole' ? 'whole' : `${m.times.length} steps`}; sha256 ${m.sha256}`)
  for (const season of seasons) said(season, made[season])
  for (const season of seasons) said(`${season}, the dressing`, made[season].dressing)
  console.log(`dressings: sha256 ${dressingsOf(made)}`)
  console.log(`all: sha256 ${allOf(made)}`)
  const file = str('json', '')
  if (file) fs.writeFileSync(path.resolve(file), JSON.stringify(made))
} else {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'miniatures-'))
  const one = (how) => {
    const file = path.join(folder, `${how}.json`)
    const run = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--way', how, '--seasons', seasons.join(','), '--json', file], { encoding: 'utf8', maxBuffer: 1 << 26 })
    if (run.status !== 0) throw new Error(`building ${how} failed: ${run.stderr || run.stdout}`)
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  }
  const differs = (a, b) => {
    if (JSON.stringify(a) === JSON.stringify(b)) return null
    const n = a.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(b[i]))
    return n < 0 ? `${a.length} objects whole, ${b.length} this way` : `object ${n + 1} (${a[n].kind} "${a[n].name}"), ${firstDifference(a[n], b[n] ?? null)}`
  }
  let same = true
  try {
    const whole = one('whole')
    const steps = one('steps')
    const mixed = one('mixed')
    const held = (name, w, s, m) => {
      const longest = Math.max(...s.times)
      const sum = s.times.reduce((a, b) => a + b, 0)
      const timed = `${w.rows.length} objects; whole ${ms(w.times[0])} ms; ${s.times.length} steps, ${ms(sum)} ms in all, the longest ${ms(longest)} ms (step ${s.times.indexOf(longest) + 1})`
      const inSteps = differs(w.rows, s.rows) ?? (w.beside ? differs(w.beside, s.beside) : null)
      const inTurns = inSteps ? null : differs(placed(w.beside ?? w.rows), placed(m.beside ?? m.rows))
      if (inSteps || inTurns) same = false
      const read = inSteps ? `not the same in steps: ${inSteps}` : inTurns ? `not the same with a second making in between: ${inTurns}` : `the same all three ways, sha256 ${w.sha256}`
      console.log(`${name}: ${timed}; ${read}`)
    }
    for (const season of seasons) held(season, whole[season], steps[season], mixed[season])
    for (const season of seasons) held(`${season}, the dressing`, whole[season].dressing, steps[season].dressing, mixed[season].dressing)
    console.log(`dressings: sha256 ${dressingsOf(whole)}`)
    console.log(same ? `pass: sha256 ${allOf(whole)}` : 'fail')
  } finally {
    fs.rmSync(folder, { recursive: true, force: true })
  }
  if (!same) process.exitCode = 1
}
