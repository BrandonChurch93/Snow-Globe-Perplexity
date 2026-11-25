import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { rel, writeJson } from '../../tools/lib/paths.mjs'
import { loadSource } from '../trunk/source.mjs'
import { loadLayout } from '../village/layout.mjs'

const TAU = Math.PI * 2
const GLASS_CLEAR = 3.2
const BOUGH = { perLimb: [2, 4], from: 0.3, length: [6.5, 12], seg: 1.05, radius: 0.92, minR: 0.36, turn: 0.3, kink: 0.95, kinkShare: 0.3, rise: 0.1 }
const TWIG = { each: [2, 4], length: [0.3, 0.55], seg: 0.8, radius: 0.8, turn: 0.3, kink: 1.0, kinkShare: 0.3 }
const SPIKE = { each: [1, 2], length: [0.28, 0.5], seg: 0.6, radius: 0.78, turn: 0.2, kink: 0.6, kinkShare: 0.15 }
const TIP_R = 0.075
const EMBER = { count: 74, apart: 2.3, r: [0.2, 0.3], drop: [0.3, 0.75], stalk: 0.045, cap: 0.6 }

const [T, RNG] = await loadSource(['/src/miniature/trunk.ts', '/src/core/rng.ts'])
const L = await loadLayout()
const rng = RNG.stream('tree-fall')
const S = T.trunkShape
const V = (p) => new THREE.Vector3(p[0], p[1], p[2])
const inside = (p) => {
  const w = T.placePoint([p.x, p.y, p.z])
  return Math.hypot(w[0], w[1], w[2]) < L.innerRadiusMm - GLASS_CLEAR && w[1] > L.groundAt(w[0], w[2]) + 5
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
      d.y = Math.abs(d.y) * 0.8 + 0.15
      grow(pts[i], d.normalize(), rng.range(BOUGH.length[0], BOUGH.length[1]) * (0.75 + 0.5 * (1 - t)), Math.max(BOUGH.minR, limb.radii[i] * BOUGH.radius), 0, BOUGH)
    }
    grow(pts[pts.length - 1], tan(pts.length - 1), rng.range(7, 11), Math.max(BOUGH.minR, limb.radii[limb.radii.length - 1] * 0.95), 0, BOUGH)
  } else if (limb.kind === 'twig') {
    const last = pts.length - 1
    grow(pts[last], tan(last), rng.range(3, 6.5), Math.max(TIP_R * 2, limb.radii[last] * 0.95), 1, TWIG)
    if (rng.next() < 0.7) grow(pts[Math.floor(last * 0.55)], turned(tan(Math.floor(last * 0.55)), rng.range(0.6, 1.1)), rng.range(2, 4.5), 0.13, 1, TWIG)
  }
}

function tube(chain, n) {
  const sides = chain.radii[0] > 0.2 ? 7 : 5
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
    const knot = 1 + 0.16 * Math.sin(along * 2.6 + n) + (i === 0 ? 0.35 : 0)
    const r = i === count ? 0.012 : chain.radii[k] * knot
    const c = pts[k].clone()
    if (i === count) c.add(tk.clone().multiplyScalar(0.4 + 2.2 * chain.radii[k]))
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

const twigs = mergeGeometries(chains.map((c, i) => tube(c, i + 1)))

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
    const sway = new THREE.Vector3(rng.range(-0.25, 0.25), -1, rng.range(-0.25, 0.25)).normalize()
    const at = s.at.clone().addScaledVector(sway, drop + r)
    if (!inside(at)) continue
    embers.push({ hang: s.at.clone(), at, r, sway, drop, phase: rng.next(), warm: rng.next() })
  }
}

const parts = []
for (const e of embers) {
  const g = new THREE.IcosahedronGeometry(e.r, 2)
  g.deleteAttribute('uv')
  g.applyMatrix4(new THREE.Matrix4().makeScale(1, 1.25, 1))
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), e.sway))
  g.applyMatrix4(new THREE.Matrix4().makeTranslation(e.at.x, e.at.y, e.at.z))
  g.computeVertexNormals()
  colourOf(g, 1, 0.5 + 0.14 * e.warm, 0.14 + 0.1 * e.warm, 1)
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
const out = writeGlb(rel('assets-full', 'fall', 'tree-fall.glb'), [fromThree('twigs', twigs, { triangles: tri(twigs), chains: solid }), fromThree('lights', lights, { triangles: tri(lights), bulbs })])
const depths = [0, 1, 2].map((d) => chains.filter((c) => c.depth === d).length)
writeJson(rel('out', 'work', 'tree-fall', 'build.json'), { made: 'assets-src/tree-fall/build.mjs', file: 'assets-full/fall/tree-fall.glb', bytes: out.bytes, triangles: out.triangles, chains: depths, embers: embers.length })
console.log(`tree-fall: ${out.triangles} triangles (twigs ${tri(twigs)}, lights ${tri(lights)}), ${(out.bytes / 1e6).toFixed(2)} MB; chains by depth ${depths.join(' / ')}; ${embers.length} embers`)
