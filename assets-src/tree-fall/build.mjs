import fs from 'node:fs'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { addLevels } from '../../tools/lib/glblevels.mjs'
import { rel, writeJson } from '../../tools/lib/paths.mjs'
import { loadSource } from '../trunk/source.mjs'
import { loadLayout } from '../village/layout.mjs'

const TAU = Math.PI * 2
const LEVELS = { medium: { error: 0.12, worth: 1 }, low: { error: 0.3, worth: 1 } }
const GLASS_CLEAR = 3.2
// The interior camera's frame ends below the top of the glass; nothing of the crown may reach its upper edge (M1).
const CEIL = 24.5
const BOUGH = { perLimb: [1, 2], from: 0.3, length: [9, 15], seg: 1.05, radius: 1.0, minR: 0.5, turn: 0.3, kink: 0.9, kinkShare: 0.3, rise: 0.22, lift: 0.4, tip: [11, 17], tipLift: 0.45 }
const TWIG = { each: [0.3, 0.7], length: [0.3, 0.52], seg: 0.8, radius: 0.86, turn: 0.3, kink: 1.0, kinkShare: 0.3 }
const SPIKE = { each: [0.05, 0.4], length: [0.28, 0.5], seg: 0.6, radius: 0.78, turn: 0.2, kink: 0.6, kinkShare: 0.15 }
const TIP_R = 0.11
const THICK = { limb: 1.3, twig: 1.2, bough: 0.9, tip: 0.9 }
const SLEEVE = { from: -3.2, to: 36.5, split: 15.2, step: [0.45, 0.6], around: [96, 48], out: 0.05, deep: [0.95, 0.34], stem: 0.12, twist: 2.4 }
const EMBER = { count: 26, apart: 4.4, r: [0.15, 0.26], drop: [0.02, 0.22], stalk: 0.045, cap: 0.6 }

const [T, RNG] = await loadSource(['/src/miniature/trunk.ts', '/src/core/rng.ts'])
const L = await loadLayout()
const rng = RNG.stream('tree-fall')
const S = T.trunkShape
const V = (p) => new THREE.Vector3(p[0], p[1], p[2])
const inside = (p) => {
  const w = T.placePoint([p.x, p.y, p.z])
  return Math.hypot(w[0], w[1], w[2]) < L.innerRadiusMm - GLASS_CLEAR && w[1] > L.groundAt(w[0], w[2]) + 5 && w[1] < CEIL
}
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

function turned(dir, angle) {
  const any = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
  const side = new THREE.Vector3().crossVectors(dir, any).normalize()
  side.applyAxisAngle(dir, rng.range(0, TAU))
  return dir.clone().applyAxisAngle(side, angle).normalize()
}

const chains = []
function grow(start, dir, length, r0, depth, o) {
  const pts = [start.clone()]
  const radii = [r0]
  const n = Math.max(2, Math.round(length / o.seg))
  let d = dir.clone()
  let p = start.clone()
  for (let i = 1; i <= n; i++) {
    d = turned(d, rng.next() < o.kinkShare ? rng.range(0.4, o.kink) : rng.range(0, o.turn))
    if (depth === 0) d.y += BOUGH.rise
    else if (d.y < -0.25) d.y *= 0.5
    d.normalize()
    const q = p.clone().addScaledVector(d, o.seg * rng.range(0.75, 1.2))
    if (!inside(q)) break
    p = q
    pts.push(p.clone())
    radii.push(Math.max(TIP_R, r0 * Math.pow(1 - (0.86 * i) / n, 0.85)))
  }
  if (pts.length < 2) return
  chains.push({ pts, radii, depth })
  if (depth >= 2) return
  const next = depth === 0 ? TWIG : SPIKE
  const count = Math.round(rng.range(next.each[0], next.each[1]) * (pts.length / n))
  for (let k = 0; k < count; k++) {
    const i = Math.min(pts.length - 2, 1 + Math.floor(rng.range(0.15, 0.95) * (pts.length - 1)))
    const along = pts[i + 1].clone().sub(pts[i]).normalize()
    grow(pts[i], turned(along, rng.range(0.55, 1.15)), length * rng.range(next.length[0], next.length[1]), Math.max(TIP_R * 1.5, radii[i] * next.radius), depth + 1, next)
  }
}

for (const limb of T.limbs) {
  const pts = limb.local.map(V)
  const tan = (i) => pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize()
  if (limb.kind === 'limb') {
    const n = Math.round(rng.range(BOUGH.perLimb[0], BOUGH.perLimb[1]))
    for (let k = 0; k < n; k++) {
      const t = BOUGH.from + (1 - BOUGH.from) * ((k + rng.range(0.1, 0.9)) / n)
      const i = Math.min(pts.length - 1, Math.round(t * (pts.length - 1)))
      const d = turned(tan(i), rng.range(0.5, 1.1))
      d.y = Math.abs(d.y) * 0.8 + BOUGH.lift
      grow(pts[i], d.normalize(), rng.range(BOUGH.length[0], BOUGH.length[1]) * (0.75 + 0.5 * (1 - t)), Math.max(BOUGH.minR, limb.radii[i] * BOUGH.radius * THICK.limb * THICK.bough), 0, BOUGH)
    }
    grow(pts[pts.length - 1], tan(pts.length - 1).add(new THREE.Vector3(0, BOUGH.tipLift, 0)).normalize(), rng.range(BOUGH.tip[0], BOUGH.tip[1]), Math.max(BOUGH.minR, limb.radii[limb.radii.length - 1] * THICK.limb * THICK.tip), 0, BOUGH)
    chains.push({ pts, radii: limb.radii.map((r) => r * THICK.limb), depth: 0, sleeve: true })
  } else if (limb.kind === 'twig') {
    const last = pts.length - 1
    grow(pts[last], tan(last), rng.range(3, 6.5), Math.max(TIP_R * 2, limb.radii[last] * THICK.twig * THICK.tip), 1, TWIG)
    chains.push({ pts, radii: limb.radii.map((r) => r * THICK.twig), depth: 1, sleeve: true })
    if (rng.next() < 0.45) grow(pts[Math.floor(last * 0.55)], turned(tan(Math.floor(last * 0.55)), rng.range(0.6, 1.1)), rng.range(2, 4.5), 0.13, 1, TWIG)
  }
}

function tube(chain, n) {
  const sides = chain.radii[0] > 0.9 ? 10 : chain.radii[0] > 0.45 ? 7 : chain.radii[0] > 0.2 ? 5 : 4
  const pts = chain.pts
  const count = pts.length
  const row = sides + 1
  const pos = []
  const uv = []
  const col = []
  const index = []
  const tangent = (i) => pts[Math.min(count - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize()
  const t0 = tangent(0)
  const nrm = new THREE.Vector3(1, 0, 0)
  if (Math.abs(t0.x) > 0.9) nrm.set(0, 0, 1)
  nrm.sub(t0.clone().multiplyScalar(nrm.dot(t0))).normalize()
  let along = hash(n * 3.1) * 4
  const tint = 0.78 + 0.3 * hash(n * 1.7 + 2)
  for (let i = 0; i <= count; i++) {
    const k = Math.min(i, count - 1)
    const tk = tangent(k)
    nrm.sub(tk.clone().multiplyScalar(nrm.dot(tk))).normalize()
    const bin = new THREE.Vector3().crossVectors(tk, nrm)
    if (i > 0 && i < count) along += pts[k].distanceTo(pts[k - 1])
    const knot = 1 + 0.16 * Math.sin(along * 2.6 + n) + (i === 0 && !chain.sleeve ? 0.35 : 0)
    const r = i === count ? 0.012 : chain.radii[k] * knot
    const c = pts[k].clone()
    if (i === count) c.add(tk.clone().multiplyScalar(0.12 + 1.1 * chain.radii[k]))
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * TAU
      const rr = r * (1 + 0.14 * Math.sin(3 * a + along * 1.3 + n))
      const p = c.clone().add(nrm.clone().multiplyScalar(Math.cos(a) * rr)).add(bin.clone().multiplyScalar(Math.sin(a) * rr))
      pos.push(p.x, p.y, p.z)
      uv.push((j / sides) * Math.max(1, Math.round(r * 4)) * 0.34 + n * 0.37, along / S.barkMm)
      const shade = tint * (0.62 + 0.38 * Math.pow(Math.abs(Math.sin(1.5 * a + along * 0.9 + n)), 0.7)) * (i === 0 ? 0.6 : 1)
      col.push(shade, shade * 0.99, shade * 0.97)
    }
  }
  for (let i = 0; i < count; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * row + j
      const b = a + row
      index.push(a, a + 1, b, a + 1, b + 1, b)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  const N = g.getAttribute('normal')
  for (let k = 0; k <= count; k++) {
    const a = k * row
    const b = a + row - 1
    const v = new THREE.Vector3(N.getX(a) + N.getX(b), N.getY(a) + N.getY(b), N.getZ(a) + N.getZ(b)).normalize()
    N.setXYZ(a, v.x, v.y, v.z)
    N.setXYZ(b, v.x, v.y, v.z)
  }
  return g
}

const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
function barkAt(phi, h) {
  const a = phi + T.trunkTwist(h) * SLEEVE.twist
  const wander = 0.4 * Math.sin(2 * a + 0.27 * h + 1.1) + 0.28 * Math.sin(3 * a - 0.33 * h + 0.5)
  const broad = Math.pow(Math.abs(Math.sin(4.5 * a + wander)), 0.6)
  const fine = Math.pow(Math.abs(Math.sin(11.5 * a + 1.8 * wander + 0.7 * Math.sin(0.55 * h) + 0.9)), 0.75)
  const split = 1 - 0.5 * Math.exp(-Math.pow(Math.sin(0.9 * h + 2.3 * Math.sin(3 * a + 1.3) + 5 * a), 2) / 0.02)
  return (0.76 * broad + 0.24 * fine) * split
}
function sleeve(from, to, step, around, v0) {
  const hs = []
  for (let h = from; h < to - step * 0.5; h += step) hs.push(h)
  hs.push(to)
  const row = around + 1
  const pos = []
  const uv = []
  const col = []
  const index = []
  let v = v0
  let last = null
  for (let k = 0; k < hs.length; k++) {
    const h = hs[k]
    const [ax, az] = T.trunkAxis(h)
    const mean = T.trunkRadius(1.1, h)
    if (last) v += Math.hypot(h - last.h, mean - last.mean)
    last = { h, mean }
    const up = smoothstep(2, S.fork + 4, h)
    const deep = SLEEVE.deep[0] + (SLEEVE.deep[1] - SLEEVE.deep[0]) * up
    const stout = 1 + SLEEVE.stem * smoothstep(S.fork - 3, S.fork + 7, h)
    const end = smoothstep(SLEEVE.to, SLEEVE.to - 3, h)
    for (let j = 0; j <= around; j++) {
      const phi = (j / around) * TAU
      const b = barkAt(phi, h)
      const r = T.trunkRadius(phi, h) * stout + SLEEVE.out + deep * b * (0.35 + 0.65 * end)
      pos.push(ax + Math.cos(phi) * r, h, az + Math.sin(phi) * r)
      uv.push(((phi + T.trunkTwist(h)) / TAU) * S.barkAround, v / S.barkMm)
      const shade = (0.16 + 0.84 * Math.pow(smoothstep(0.08, 0.85, b), 1.5)) * (0.8 + 0.2 * smoothstep(-1, 5, h))
      const warm = 0.95 + 0.1 * hash(Math.round(((phi + T.trunkTwist(h) * SLEEVE.twist) / TAU) * 9) + 3)
      col.push(shade * warm, shade * 0.99, shade * (2 - warm) * 0.97)
    }
  }
  for (let k = 0; k < hs.length - 1; k++)
    for (let j = 0; j < around; j++) {
      const a = k * row + j
      const b = a + row
      index.push(a, b, a + 1, a + 1, b, b + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  const N = g.getAttribute('normal')
  for (let k = 0; k < hs.length; k++) {
    const a = k * row
    const b = a + row - 1
    const n = new THREE.Vector3(N.getX(a) + N.getX(b), N.getY(a) + N.getY(b), N.getZ(a) + N.getZ(b)).normalize()
    N.setXYZ(a, n.x, n.y, n.z)
    N.setXYZ(b, n.x, n.y, n.z)
  }
  return g
}

const bark = [sleeve(SLEEVE.from, SLEEVE.split, SLEEVE.step[0], SLEEVE.around[0], 0), sleeve(SLEEVE.split - 0.3, SLEEVE.to, SLEEVE.step[1], SLEEVE.around[1], SLEEVE.split - 0.3 - SLEEVE.from)]
const twigs = mergeGeometries([...bark, ...chains.map((c, i) => tube(c, i + 1))])

function colourOf(g, r, gr, b, a) {
  const n = g.getAttribute('position').count
  const col = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) col.set([r, gr, b, a], i * 4)
  g.setAttribute('color', new THREE.BufferAttribute(col, 4))
  return g
}
function phaseOf(g, phase, kind) {
  const n = g.getAttribute('position').count
  const uv = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) uv.set([phase, kind], i * 2)
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

const embers = []
{
  const spots = []
  for (const c of chains) {
    if (c.depth > 1) continue
    for (let i = 1; i < c.pts.length; i++) spots.push({ at: c.pts[i], r: c.radii[i] })
  }
  for (const limb of T.limbs) {
    if (limb.kind !== 'limb') continue
    for (let i = Math.floor(limb.local.length * 0.3); i < limb.local.length; i += 2) spots.push({ at: V(limb.local[i]), r: limb.radii[i] })
  }
  let tries = 0
  while (embers.length < EMBER.count && tries++ < 20000) {
    const s = spots[rng.int(spots.length)]
    if (embers.some((e) => e.hang.distanceTo(s.at) < EMBER.apart)) continue
    const r = rng.range(EMBER.r[0], EMBER.r[1])
    const drop = s.r + rng.range(EMBER.drop[0], EMBER.drop[1])
    const sway = new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 0.5), rng.range(-1, 1)).normalize()
    const at = s.at.clone().addScaledVector(sway, drop + r)
    if (!inside(at)) continue
    embers.push({ hang: s.at.clone(), at, r, sway, drop, phase: rng.next(), warm: rng.next() })
  }
}

const parts = []
for (const e of embers) {
  const g = new THREE.IcosahedronGeometry(e.r, 1)
  g.deleteAttribute('uv')
  g.applyMatrix4(new THREE.Matrix4().makeScale(1, 1.1, 1))
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), e.sway))
  g.applyMatrix4(new THREE.Matrix4().makeTranslation(e.at.x, e.at.y, e.at.z))
  g.computeVertexNormals()
  colourOf(g, 1, 0.34 + 0.16 * e.warm, 0.05 + 0.07 * e.warm, 1)
  parts.push(phaseOf(g, e.phase, 1))
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), e.sway)
  const capAt = e.at.clone().addScaledVector(e.sway, -e.r * 1.05)
  const cap = new THREE.CylinderGeometry(e.r * 0.42, e.r * EMBER.cap, e.r * 0.62, 8, 1, false)
  cap.deleteAttribute('uv')
  cap.applyQuaternion(q)
  cap.applyMatrix4(new THREE.Matrix4().makeTranslation(capAt.x, capAt.y, capAt.z))
  colourOf(cap, 0.05, 0.04, 0.03, 0)
  parts.push(phaseOf(cap.toNonIndexed(), 0, 0))
  const mid = e.hang.clone().lerp(capAt, 0.5)
  const stalk = new THREE.CylinderGeometry(EMBER.stalk, EMBER.stalk, e.hang.distanceTo(capAt), 5, 1, false)
  stalk.deleteAttribute('uv')
  stalk.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), e.hang.clone().sub(capAt).normalize()))
  stalk.applyMatrix4(new THREE.Matrix4().makeTranslation(mid.x, mid.y, mid.z))
  colourOf(stalk, 0.04, 0.035, 0.03, 0)
  parts.push(phaseOf(stalk.toNonIndexed(), 0, 0))
}
const lights = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))

const bulbs = []
for (const e of embers) bulbs.push(+e.at.x.toFixed(3), +e.at.y.toFixed(3), +e.at.z.toFixed(3), +e.phase.toFixed(3))
const solid = []
for (const c of chains) {
  if (c.depth > 0) continue
  solid.push(c.pts.length)
  for (let i = 0; i < c.pts.length; i++) solid.push(+c.pts[i].x.toFixed(2), +c.pts[i].y.toFixed(2), +c.pts[i].z.toFixed(2), +c.radii[i].toFixed(3))
}
const tri = (g) => (g.index ? g.index.count : g.getAttribute('position').count) / 3
const file = rel('assets-full', 'fall', 'tree-fall.glb')
const out = writeGlb(file, [fromThree('twigs', twigs, { triangles: tri(twigs), chains: solid }), fromThree('lights', lights, { triangles: tri(lights), bulbs })])
const levelled = await addLevels(fs.readFileSync(file), { levels: LEVELS })
fs.writeFileSync(file, levelled.glb)
out.bytes = levelled.glb.length
const lighter = Object.fromEntries(Object.keys(LEVELS).map((l) => [l, levelled.meshes.reduce((n, m) => n + (m[l] ?? m.triangles), 0)]))
const depths = [0, 1, 2].map((d) => chains.filter((c) => c.depth === d).length)
writeJson(rel('out', 'work', 'tree-fall', 'build.json'), { made: 'assets-src/tree-fall/build.mjs', file: 'assets-full/fall/tree-fall.glb', bytes: out.bytes, triangles: out.triangles, chains: depths, embers: embers.length })
console.log(`tree-fall: ${out.triangles} triangles (medium ${lighter.medium}, low ${lighter.low}; twigs ${tri(twigs)}, lights ${tri(lights)}), ${(out.bytes / 1e6).toFixed(2)} MB; chains by depth ${depths.join(' / ')}; ${embers.length} embers`)
