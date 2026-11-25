import * as THREE from 'three'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { rel, writeJson } from '../../tools/lib/paths.mjs'
import { loadSource } from '../trunk/source.mjs'

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

const CROWN = { centre: [1.2, 29.5, 1], r: [22.5, 15.5, 15], floor: 14.2, sprays: 132, spacing: 4.1, reach: 13, inner: 0.5, layer: 5.0, layerJitter: 2.5 }
const TWIG = { from: 0.34, to: 0.08, sides: 5, steps: 7 }
const CLUSTER = { step: 1.05, from: 0.26, size: [0.8, 1.3], tip: [1.3, 1.9], flowers: [11, 17], flower: [0.45, 0.74], side: 0.55, flat: 0.72 }
const TONES = ['#f6b3c9', '#f9c6d6', '#f2a7c0', '#fbd7e2', '#f0a2bc', '#f7bdd0', '#fde4ea'].map(lin)
const SHADE = [0.72, 0.62, 0.65]
const HEART = lin('#d86a8a')
const WOOD = [lin('#2a1a12'), lin('#3a2418'), lin('#22150f')]
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
    if (rng.next() < 0.3) {
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
const ico = new THREE.IcosahedronGeometry(1, 1)
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
for (const c of clusters) {
  const open = openness(c)
  const tone = mul(mix(TONES[rng.int(TONES.length)], TONES[rng.int(TONES.length)], rng.next()), 0.92 + 0.16 * rng.next())
  const depth = within(c.p)
  const lit = (0.7 + 0.3 * open) * (0.82 + 0.18 * smooth(0.3, 0.95, depth))
  const crownOut = norm([c.p[0] - CROWN.centre[0], (c.p[1] - CROWN.centre[1]) * 1.3 + 3, c.p[2] - CROWN.centre[2]])
  const base = bloom.p.length / 3
  const seed = rng.next() * 40
  for (const q of icoIndexed.pos) {
    const k = c.r * 0.56 * (0.82 + 0.3 * wob(q[0] * 1.6 + seed, q[1] * 1.6, q[2] * 1.6))
    const p = [c.p[0] + q[0] * k, c.p[1] + q[1] * k * CLUSTER.flat, c.p[2] + q[2] * k]
    bloom.p.push(p[0], p[1], p[2])
    const n = norm(add(mul(q, 0.75), mul(crownOut, 0.45)))
    bloom.n.push(n[0], n[1], n[2])
    const under = 0.62 + 0.38 * smooth(-0.8, 0.5, q[1])
    bloom.c.push(tone[0] * SHADE[0] * lit * under, tone[1] * SHADE[1] * lit * under, tone[2] * SHADE[2] * lit * under)
  }
  for (const v of icoIndexed.idx) bloom.i.push(base + v)
  const count = Math.round((CLUSTER.flowers[0] + rng.next() * (CLUSTER.flowers[1] - CLUSTER.flowers[0])) * (c.r / 1.2) ** 1.6)
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
    const pale = mul(mix(tone, [1, 0.97, 0.97], 0.25 + 0.45 * rng.next()), lit * (0.8 + 0.2 * smooth(-0.9, 0.3, d[1])) * (0.92 + 0.16 * rng.next()))
    const n = norm(add(add(mul(d, 0.5), mul(crownOut, 0.6)), [0, 0.25, 0]))
    const b0 = bloom.p.length / 3
    bloom.p.push(at[0], at[1], at[2])
    bloom.n.push(n[0], n[1], n[2])
    const heart = mix(HEART, pale, 0.78)
    bloom.c.push(heart[0] * lit, heart[1] * lit, heart[2] * lit)
    for (let j = 0; j < 10; j++) {
      const a = spin + (j / 10) * Math.PI * 2
      const tipV = j % 2 === 0
      const rr = size * (tipV ? 1 : 0.7)
      const lift = size * (tipV ? 0.3 : 0.12)
      const q = add(add(at, add(mul(u, Math.cos(a) * rr), mul(v, Math.sin(a) * rr))), mul(out, lift))
      bloom.p.push(q[0], q[1], q[2])
      bloom.n.push(n[0], n[1], n[2])
      const kk = tipV ? 1.04 : 0.9
      bloom.c.push(pale[0] * kk, pale[1] * kk, pale[2] * kk)
    }
    for (let j = 0; j < 10; j++) bloom.i.push(b0, b0 + 1 + j, b0 + 1 + ((j + 1) % 10))
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

const counts = { blossom: bloom.i.length / 3, twigs: wood.i.length / 3 }
const out = writeGlb(rel('assets-full', 'spring', 'tree-blossom.glb'), [
  fromThree('blossom', geometryOf(bloom), { triangles: counts.blossom, clusters: clusters.length, flowers, balls, box: box.map((v) => Number(v.toFixed(2))) }),
  fromThree('twigs', geometryOf(wood), { triangles: counts.twigs, sprays: sprays.length }),
])
writeJson(rel('out', 'work', 'tree', 'build-spring.json'), { made: 'assets-src/tree-spring/build.mjs', file: 'assets-full/spring/tree-blossom.glb', bytes: out.bytes, counts, clusters: clusters.length, flowers, sprays: sprays.length, balls: balls.length, box })
console.log(`tree-spring: ${sprays.length} sprays, ${clusters.length} clusters, ${flowers} flowers, ${balls.length} collider balls; ${out.triangles} triangles, ${(out.bytes / 1e6).toFixed(2)} MB; box ${box.map((v) => v.toFixed(1)).join(' ')}`)
