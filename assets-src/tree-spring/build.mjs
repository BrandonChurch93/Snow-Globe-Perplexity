import * as THREE from 'three'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { rel, writeJson } from '../../tools/lib/paths.mjs'
import { loadSource } from '../trunk/source.mjs'
import { addLists } from '../village-spring/levels.mjs'

const [T, R] = await loadSource(['/src/miniature/trunk.ts', '/src/core/rng.ts'])
const rng = R.stream('tree-spring')
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const norm = (a) => {
  const l = len(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const lin = (hex) => {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}

const CROWN = { centre: [1.2, 27.6, 1], r: [23, 13.4, 15.5], floor: 14.2, sprays: 132, spacing: 4.3, reach: 13, inner: 0.42, layer: 4.2, layerJitter: 1.9 }
const TWIG = { from: 0.36, to: 0.06, sides: 5, steps: 7 }
const CLUSTER = { step: 1.25, from: 0.3, size: [0.85, 1.3], tip: [1.15, 1.6], flowers: [9.5, 13.5], flower: [0.4, 0.64], side: 0.6, flat: 0.78, extra: 0.22, core: 0.46 }
const TONES = ['#f6b3c9', '#f9c6d6', '#f2a7c0', '#fbd7e2', '#f0a2bc', '#f7bdd0', '#fde4ea'].map(lin)
const SHADE = [0.72, 0.62, 0.65]
const HEART = lin('#d86a8a')
const WOOD = [lin('#7a5038'), lin('#8a5c40'), lin('#694430')]
const FORK = T.trunkShape.fork

const within = (p) => Math.hypot((p[0] - CROWN.centre[0]) / CROWN.r[0], (p[1] - CROWN.centre[1]) / CROWN.r[1], (p[2] - CROWN.centre[2]) / CROWN.r[2])

const skeleton = []
for (const l of T.limbs) {
  if (l.kind === 'root') continue
  for (let i = 0; i < l.local.length; i++) {
    const p = l.local[i]
    if (p[1] < FORK + 0.8) continue
    if (l.kind === 'stem' && p[1] < 22) continue
    skeleton.push({ p, r: l.radii[i] })
  }
}

const targets = []
{
  let tries = 0
  while (targets.length < CROWN.sprays && tries < 60000) {
    tries++
    const d = norm([rng.gauss(), rng.gauss() * 0.9 + 0.25, rng.gauss()])
    const k = CROWN.inner + (1 - CROWN.inner) * Math.pow(rng.next(), 0.55)
    const p = [CROWN.centre[0] + d[0] * CROWN.r[0] * k, CROWN.centre[1] + d[1] * CROWN.r[1] * k, CROWN.centre[2] + d[2] * CROWN.r[2] * k]
    p[1] = CROWN.floor + 1.4 + Math.round((p[1] - CROWN.floor - 1.4) / CROWN.layer) * CROWN.layer + rng.range(-CROWN.layerJitter, CROWN.layerJitter)
    if (p[1] < CROWN.floor) continue
    const side = Math.hypot(p[0], p[2])
    if (p[1] < 20 && side < 7) continue
    if (targets.some((q) => len(sub(q, p)) < CROWN.spacing)) continue
    targets.push(p)
  }
  targets.sort((a, b) => Math.hypot(a[0], a[2]) + 0.4 * Math.abs(a[1] - 26) - (Math.hypot(b[0], b[2]) + 0.4 * Math.abs(b[1] - 26)))
}

const sprays = []
for (const target of targets) {
  let best = null
  let bestD = Infinity
  for (const s of skeleton) {
    const v = sub(target, s.p)
    const d = len(v) + 1.4 * Math.max(0, s.p[1] - target[1]) + 0.25 * Math.max(0, Math.hypot(s.p[0], s.p[2]) - Math.hypot(target[0], target[2]))
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  if (!best) continue
  const span = len(sub(target, best.p))
  if (span < 1.2) continue
  const end = span > CROWN.reach ? add(best.p, mul(norm(sub(target, best.p)), CROWN.reach)) : target
  const mid = add(mix(best.p, end, 0.5), [rng.range(-0.12, 0.12) * span, (0.1 + 0.16 * rng.next()) * span, rng.range(-0.12, 0.12) * span])
  const r0 = Math.min(TWIG.from * (0.7 + 0.05 * span), best.r * 0.8)
  const at = (t) => {
    const a = mix(best.p, mid, t)
    const b = mix(mid, end, t)
    return mix(a, b, t)
  }
  const pts = []
  const radii = []
  for (let i = 0; i <= TWIG.steps; i++) {
    const t = i / TWIG.steps
    pts.push(at(t))
    radii.push(r0 + (TWIG.to - r0) * Math.pow(t, 0.8))
  }
  sprays.push({ pts, radii, span, at })
  for (let i = 2; i <= TWIG.steps; i++) skeleton.push({ p: pts[i], r: radii[i] })
}

const wood = { p: [], n: [], c: [], i: [] }
function tube(pts, radii, tone) {
  const base = wood.p.length / 3
  for (let i = 0; i < pts.length; i++) {
    const dir = norm(sub(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]))
    const ref = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
    const u = norm(cross(dir, ref))
    const v = cross(dir, u)
    for (let k = 0; k < TWIG.sides; k++) {
      const a = (k / TWIG.sides) * Math.PI * 2
      const o = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)))
      const q = add(pts[i], mul(o, radii[i]))
      wood.p.push(q[0], q[1], q[2])
      wood.n.push(o[0], o[1], o[2])
      const k2 = 0.8 + 0.4 * ((i * 7 + k * 3) % 5) / 5
      wood.c.push(tone[0] * k2, tone[1] * k2, tone[2] * k2)
    }
  }
  for (let i = 0; i < pts.length - 1; i++)
    for (let k = 0; k < TWIG.sides; k++) {
      const a = base + i * TWIG.sides + k
      const b = base + i * TWIG.sides + ((k + 1) % TWIG.sides)
      wood.i.push(a, b, b + TWIG.sides, a, b + TWIG.sides, a + TWIG.sides)
    }
}

const clusters = []
const plant = (p, r, tip) => {
  if (p[1] < FORK + 1.2) return
  clusters.push({ p, r, tip })
}
for (const s of sprays) {
  tube(s.pts, s.radii, WOOD[rng.int(WOOD.length)])
  const count = Math.max(2, Math.round((s.span * (1 - CLUSTER.from)) / CLUSTER.step))
  for (let i = 0; i < count; i++) {
    const t = CLUSTER.from + (1 - CLUSTER.from) * ((i + rng.next() * 0.6) / count)
    const p = s.at(Math.min(1, t))
    const r = rng.range(CLUSTER.size[0], CLUSTER.size[1]) * (0.7 + 0.5 * t)
    const off = norm([rng.gauss(), rng.gauss() + 0.5, rng.gauss()])
    plant(add(p, mul(off, r * CLUSTER.side * rng.next())), r, false)
    if (rng.next() < CLUSTER.extra) {
      const off2 = norm([rng.gauss(), rng.gauss() * 0.6 + 0.2, rng.gauss()])
      plant(add(p, mul(off2, r * (0.9 + 0.8 * rng.next()))), r * rng.range(0.6, 0.85), false)
    }
  }
  plant(s.at(1), rng.range(CLUSTER.tip[0], CLUSTER.tip[1]), true)
}
for (const l of T.limbs) {
  if (l.kind !== 'twig' && l.kind !== 'limb') continue
  const n = l.local.length
  const from = l.kind === 'twig' ? 0.6 : 0.86
  for (let i = Math.floor(n * from); i < n; i += l.kind === 'twig' ? 2 : 3) {
    const p = l.local[i]
    const r = rng.range(CLUSTER.size[0], CLUSTER.size[1])
    plant(add(p, mul(norm([rng.gauss(), rng.gauss() + 0.8, rng.gauss()]), r * 0.6)), r, i >= n - 2)
  }
}

const near = (p, radius) => {
  let n = 0
  for (const c of clusters) {
    const d = sub(c.p, p)
    if (Math.abs(d[0]) > radius || Math.abs(d[1]) > radius || Math.abs(d[2]) > radius) continue
    if (len(d) < radius) n++
  }
  return n
}
const openness = (c) => {
  let cover = 0
  for (const o of clusters) {
    if (o === c) continue
    const d = sub(o.p, c.p)
    const l = len(d)
    if (l > 6.5 || l < 1e-6) continue
    const out = norm([c.p[0] - CROWN.centre[0], (c.p[1] - CROWN.centre[1]) * 1.2 + 4, c.p[2] - CROWN.centre[2] + 6])
    const facing = (d[0] * out[0] + d[1] * out[1] + d[2] * out[2]) / l
    if (facing > 0.1) cover += facing * (1 - l / 6.5) * (o.r / 1.4)
  }
  return 1 / (1 + 0.24 * cover)
}

const bloom = { p: [], n: [], c: [], i: [] }
const ico = new THREE.IcosahedronGeometry(1, 0)
const icoIndexed = (() => {
  const P = ico.getAttribute('position')
  const map = new Map()
  const pos = []
  const idx = []
  for (let i = 0; i < P.count; i++) {
    const key = `${P.getX(i).toFixed(4)},${P.getY(i).toFixed(4)},${P.getZ(i).toFixed(4)}`
    let v = map.get(key)
    if (v === undefined) {
      v = pos.length
      pos.push([P.getX(i), P.getY(i), P.getZ(i)])
      map.set(key, v)
    }
    idx.push(v)
  }
  return { pos, idx }
})()
const wob = (x, y, z) => Math.sin(x * 2.3 + y * 1.7) * Math.cos(z * 2.1 - x * 0.9) * 0.5 + Math.sin(y * 3.1 + z * 1.3) * 0.5

let flowers = 0
const cores = []
const full = [[], [], []]
const light = [[], [], []]
const lighter = [[], [], []]
for (const c of clusters) {
  const open = openness(c)
  const tone = mul(mix(TONES[rng.int(TONES.length)], TONES[rng.int(TONES.length)], rng.next()), 0.92 + 0.16 * rng.next())
  const depth = within(c.p)
  const lit = (0.52 + 0.48 * open) * (0.72 + 0.28 * smooth(0.3, 0.95, depth))
  const crownOut = norm([c.p[0] - CROWN.centre[0], (c.p[1] - CROWN.centre[1]) * 1.3 + 3, c.p[2] - CROWN.centre[2]])
  const base = bloom.p.length / 3
  const seed = rng.next() * 40
  for (const q of icoIndexed.pos) {
    const k = c.r * CLUSTER.core * (0.82 + 0.3 * wob(q[0] * 1.6 + seed, q[1] * 1.6, q[2] * 1.6))
    const p = [c.p[0] + q[0] * k, c.p[1] + q[1] * k * CLUSTER.flat, c.p[2] + q[2] * k]
    bloom.p.push(p[0], p[1], p[2])
    const n = norm(add(mul(q, 0.75), mul(crownOut, 0.45)))
    bloom.n.push(n[0], n[1], n[2])
    const under = 0.62 + 0.38 * smooth(-0.8, 0.5, q[1])
    bloom.c.push(tone[0] * SHADE[0] * lit * under, tone[1] * SHADE[1] * lit * under, tone[2] * SHADE[2] * lit * under)
  }
  for (const v of icoIndexed.idx) cores.push(base + v)
  const count = Math.round((CLUSTER.flowers[0] + rng.next() * (CLUSTER.flowers[1] - CLUSTER.flowers[0])) * (c.r / 1.1) ** 1.5)
  for (let f = 0; f < count; f++) {
    const d = norm([rng.gauss(), rng.gauss() * 0.9 + 0.25, rng.gauss()])
    const k = c.r * (0.74 + 0.4 * rng.next())
    const at = [c.p[0] + d[0] * k, c.p[1] + d[1] * k * CLUSTER.flat, c.p[2] + d[2] * k]
    const out = norm(add(add(d, mul(crownOut, 0.35)), [rng.range(-0.35, 0.35), rng.range(-0.2, 0.4), rng.range(-0.35, 0.35) + 0.25]))
    const ref = Math.abs(out[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
    const u = norm(cross(out, ref))
    const v = cross(out, u)
    const size = rng.range(CLUSTER.flower[0], CLUSTER.flower[1])
    const spin = rng.next() * Math.PI * 2
    const cup = rng.range(0.12, 0.5)
    const top = 0.74 + 0.26 * smooth(-0.9, 0.45, d[1])
    const pale = mul(mix(tone, [1, 0.965, 0.97], 0.3 + 0.45 * rng.next()), lit * top * (0.84 + 0.3 * rng.next()))
    const b0 = bloom.p.length / 3
    const heart = mul(mix(HEART, pale, 0.5), 0.92)
    const nc = norm(add(out, mul(crownOut, 0.35)))
    bloom.p.push(at[0], at[1], at[2])
    bloom.n.push(nc[0], nc[1], nc[2])
    bloom.c.push(heart[0], heart[1], heart[2])
    for (let j = 0; j < 5; j++) {
      const a = spin + (j / 5) * Math.PI * 2 + rng.range(-0.12, 0.12)
      const dir = add(mul(u, Math.cos(a)), mul(v, Math.sin(a)))
      const side = add(mul(u, -Math.sin(a)), mul(v, Math.cos(a)))
      const long = size * rng.range(0.86, 1.1)
      const kk = 0.9 + 0.2 * rng.next()
      const corner = (along, across, lift, bright) => {
        const q = add(add(add(at, mul(dir, along * long)), mul(side, across * long)), mul(out, lift * long))
        const n = norm(add(add(mul(out, 1 - 0.5 * along), mul(dir, 0.75 * along - 0.5 * cup)), add(mul(side, 0.9 * across), mul(crownOut, 0.3))))
        bloom.p.push(q[0], q[1], q[2])
        bloom.n.push(n[0], n[1], n[2])
        bloom.c.push(pale[0] * bright * kk, pale[1] * bright * kk, pale[2] * bright * kk)
      }
      corner(0.56, 0.4, cup * 0.5, 0.86)
      corner(1, 0.2, cup, 1.08)
      corner(1, -0.2, cup, 1.08)
      corner(0.56, -0.4, cup * 0.5, 0.86)
      const q0 = b0 + 1 + j * 4
      full[flowers % 3].push(b0, q0, q0 + 1, b0, q0 + 1, q0 + 2, b0, q0 + 2, q0 + 3)
      light[flowers % 3].push(b0, q0 + 1, q0 + 3)
      if (flowers % 2 === 0) lighter[flowers % 3].push(b0, q0 + 1, q0 + 3)
    }
    flowers++
  }
}

const geometryOf = (bag) => {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(bag.p, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(bag.n, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(bag.c, 3))
  g.setIndex(bag.i)
  return g
}

const balls = []
{
  const taken = []
  for (const c of clusters) {
    if (taken.some((q) => len(sub(q, c.p)) < 4.2)) continue
    if (near(c.p, 3.4) < 5) continue
    taken.push(c.p)
    balls.push([Number(c.p[0].toFixed(2)), Number(c.p[1].toFixed(2)), Number(c.p[2].toFixed(2)), 2.6])
  }
}

const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
for (const c of clusters)
  for (let j = 0; j < 3; j++) {
    box[j] = Math.min(box[j], c.p[j] - c.r)
    box[j + 3] = Math.max(box[j + 3], c.p[j] + c.r)
  }

bloom.i = [...cores, ...full.flat()]
const lists = { medium: [...cores, ...light.flat()], low: [...cores, ...lighter.flat()] }
const shadow = { high: cores.length + full[0].length, medium: cores.length + light[0].length, low: cores.length + lighter[0].length }
const counts = { blossom: bloom.i.length / 3, twigs: wood.i.length / 3, medium: lists.medium.length / 3, low: lists.low.length / 3, shadow }
const out = writeGlb(rel('assets-full', 'spring', 'tree-blossom.glb'), [
  fromThree('blossom', geometryOf(bloom), { triangles: counts.blossom, clusters: clusters.length, flowers, balls, shadow, box: box.map((v) => Number(v.toFixed(2))) }),
  fromThree('twigs', geometryOf(wood), { triangles: counts.twigs, sprays: sprays.length }),
])
out.bytes = addLists(rel('assets-full', 'spring', 'tree-blossom.glb'), 'blossom', lists)
writeJson(rel('out', 'work', 'tree', 'build-spring.json'), { made: 'assets-src/tree-spring/build.mjs', file: 'assets-full/spring/tree-blossom.glb', bytes: out.bytes, counts, clusters: clusters.length, flowers, sprays: sprays.length, balls: balls.length, box })
console.log(`tree-spring: ${sprays.length} sprays, ${clusters.length} clusters, ${flowers} flowers, ${balls.length} collider balls; ${out.triangles} triangles (blossom ${counts.blossom}, medium ${counts.medium}, low ${counts.low}; in the shadow ${shadow.high / 3}, ${shadow.medium / 3}, ${shadow.low / 3}), ${(out.bytes / 1e6).toFixed(2)} MB; box ${box.map((v) => v.toFixed(1)).join(' ')}`)
