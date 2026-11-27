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
const CEIL = 25.8
// Each of the layout's limbs and the stem's top runs on into one tip; each fork place of the layout grows one twig. A tip
// and a twig are one long curve to a fine hooked point. They are laid one after another so that, seen from the hero
// camera (pitch `pitch`), a curve leaves the wood it grows from once and then keeps `gap` from every other piece.
const LOOK = { pitch: 4.5, gap: 0.8, leaveBy: 0.5 }
const CURVE = { step: 0.32, point: 0.07, taper: 0.95, sweep: [0.15, 0.7], wave: 0.5, tilt: 0.5, hookFrom: [0.66, 0.86], hook: [0.45, 1.35] }
const TIP = { length: [5, 9], lift: 0.25, spread: 0.45, tries: 300, radius: 0.97, leader: -0.3, up: [0.3, 0.9] }
// The approved's finest twigs reach up and out on the left of the upper crown: the fork places above `high.above` on that
// side grow the long ones.
const TWIG = { length: [2.6, 8], high: { above: 30, length: [5.5, 9.5], up: 0.6 }, fan: [0.6, 1.25], deep: 0.35, droop: -0.25, radius: [1.5, 0.26, 0.5], apart: 1.3, reach: 1, tries: 400, beside: 4.5, same: 0.7 }
const THICK = { limb: 1.3, stem: 1.05 }
const SLEEVE = { from: -3.2, to: 36.5, split: 15.2, step: [0.6, 0.6], around: [192, 48], out: 0.05, deep: [1.15, 0.4], stem: 0.12, twist: 2.4 }
// The approved bark takes the lamp as thin lines: the two finer ridge families are narrow crests over wide dark grooves.
const RIDGE = { fine: 2, hair: 2.5, mix: [0.4, 0.3, 0.3] }
const EMBER = { count: 26, apart: 4.4, r: [0.15, 0.26], drop: [0.02, 0.22], stalk: 0.045, cap: 0.6, under: 1.3 }

const [T, RNG] = await loadSource(['/src/miniature/trunk.ts', '/src/core/rng.ts'])
const L = await loadLayout()
const rng = RNG.stream('tree-fall')
const S = T.trunkShape
const V = (p) => new THREE.Vector3(p[0], p[1], p[2])
const inside = (p, ceil = CEIL) => {
  const w = T.placePoint([p.x, p.y, p.z])
  return Math.hypot(w[0], w[1], w[2]) < L.innerRadiusMm - GLASS_CLEAR && w[1] > L.groundAt(w[0], w[2]) + 5 && w[1] < ceil
}
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}
const UP = new THREE.Vector3(0, 1, 0)
const across = (dir, angle) => {
  const any = Math.abs(dir.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0)
  return new THREE.Vector3().crossVectors(dir, any).normalize().applyAxisAngle(dir, angle)
}
const tangentAt = (pts, i) => pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize()

const pitch = (LOOK.pitch * Math.PI) / 180
const seen = (p) => [p.x, p.y * Math.cos(pitch) - p.z * Math.sin(pitch)]
const laid = []
function lay(pts, radii) {
  const at = pts.map(seen)
  for (let i = 0; i + 1 < at.length; i++) laid.push([at[i][0], at[i][1], at[i + 1][0] - at[i][0], at[i + 1][1] - at[i][1], radii[i], radii[i + 1]])
}
function room(s, r) {
  let best = Infinity
  for (const g of laid) {
    const px = s[0] - g[0]
    const py = s[1] - g[1]
    const l = g[2] * g[2] + g[3] * g[3]
    const t = l > 0 ? Math.min(1, Math.max(0, (px * g[2] + py * g[3]) / l)) : 0
    const d = Math.hypot(px - g[2] * t, py - g[3] * t) - (g[4] + (g[5] - g[4]) * t) - r
    if (d < best) best = d
  }
  return best
}

const VIEW = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch))
const tilted = () => VIEW.clone().applyAxisAngle(across(VIEW, rng.range(0, TAU)), rng.range(0, CURVE.tilt)).multiplyScalar(rng.next() < 0.5 ? 1 : -1)
function curve(start, dir, length, r0) {
  const n = Math.max(8, Math.round(length / CURVE.step))
  const step = length / n
  const side = tilted()
  const sweep = rng.range(CURVE.sweep[0], CURVE.sweep[1])
  const wave = rng.next() < CURVE.wave
  const from = Math.round(rng.range(CURVE.hookFrom[0], CURVE.hookFrom[1]) * n)
  const hook = rng.range(CURVE.hook[0], CURVE.hook[1])
  const axis = tilted()
  const last = n - from
  const pts = []
  const radii = []
  const d = dir.clone()
  const p = start.clone()
  for (let i = 1; i <= n; i++) {
    if (i <= from) d.applyAxisAngle(side, (sweep / from) * (wave ? 1.6 * Math.cos((Math.PI * i) / from) : 1))
    else d.applyAxisAngle(axis, (hook * (0.5 + (i - from) / last)) / (last * 0.5 + (last + 1) / 2))
    p.addScaledVector(d, step)
    pts.push(p.clone())
    radii.push(CURVE.point + (r0 - CURVE.point) * Math.pow(1 - i / n, CURVE.taper))
  }
  return { pts, radii }
}

// The best of `tries` curves from one place: every point inside the glass and under the ceiling, out of the wood it starts
// in by `leaveBy` of its length, never back under wood once it shows, and from there on never nearer than `gap` to another
// piece as the hero camera sees them.
function best(tries, make, worth) {
  let found = null
  for (let k = 0; k < tries; k++) {
    const c = make()
    let left = -1
    let out = false
    let clear = Infinity
    let ok = true
    for (let i = 0; i < c.pts.length && ok; i++) {
      if (!inside(c.pts[i])) ok = false
      else {
        const d = room(seen(c.pts[i]), c.radii[i])
        if (left < 0) {
          if (d >= LOOK.gap) left = i
          else if (i > LOOK.leaveBy * c.pts.length || (out && d < 0)) ok = false
          else if (d > 0) out = true
        } else if (d < LOOK.gap) ok = false
        else clear = Math.min(clear, d)
      }
    }
    if (!ok || left < 0) continue
    const a = seen(c.pts[0])
    const b = seen(c.pts[c.pts.length - 1])
    let run = 0
    for (let i = left + 1; i < c.pts.length; i++) {
      const s0 = seen(c.pts[i - 1])
      const s1 = seen(c.pts[i])
      run += Math.hypot(s1[0] - s0[0], s1[1] - s0[1])
    }
    const score = run + 0.6 * Math.min(clear, 1.5) + worth(a, b, seen(c.pts[Math.min(c.pts.length - 1, left + 3)]))
    if (!found || score > found.score) found = { ...c, score }
  }
  return found
}

const chains = []
const stem = T.limbs.find((l) => l.kind === 'stem')
const boughs = T.limbs.filter((l) => l.kind === 'limb')
const axisX = (h) => T.trunkAxis(Math.min(S.top, h))[0]
lay(stem.local.map(V), stem.radii.map((r) => r * THICK.stem + SLEEVE.deep[1]))
for (const limb of boughs) {
  const pts = limb.local.map(V)
  const radii = limb.radii.map((r) => r * THICK.limb)
  lay(pts, radii)
  chains.push({ pts, radii, kind: 'limb', sleeve: true })
}

const tips = []
for (const limb of [...boughs, stem]) {
  const all = limb.local.map(V)
  const last = all.length - 1
  const thick = limb.kind === 'stem' ? THICK.stem : THICK.limb * TIP.radius
  const pts = all.slice(last - 2)
  const radii = limb.radii.slice(last - 2).map((r) => r * thick)
  const out = Math.sign(all[last].x - axisX(all[last].y)) || -1
  const along = tangentAt(all, last)
  const got = best(
    TIP.tries,
    () => {
      const d = along.clone().add(new THREE.Vector3(limb.kind === 'stem' ? TIP.leader : 0, TIP.lift, 0)).normalize()
      d.applyAxisAngle(across(d, rng.range(0, TAU)), rng.range(0, TIP.spread))
      return curve(all[last], d, rng.range(TIP.length[0], TIP.length[1]), radii[2])
    },
    (a, b) => TIP.up[limb.kind === 'stem' ? 1 : 0] * (b[1] - a[1]) + 0.3 * out * (b[0] - a[0]),
  )
  if (!got) continue
  const tip = { pts: [...pts, ...got.pts], radii: [...radii, ...got.radii], kind: 'tip', sleeve: true }
  tips.push(tip)
  chains.push(tip)
  lay(got.pts, got.radii)
}

const forks = []
for (const twig of T.limbs.filter((l) => l.kind === 'twig')) {
  const at = V(twig.local[0])
  let near = null
  for (const limb of [...boughs, stem]) {
    const pts = limb.local
    for (let i = 0; i < pts.length; i++) {
      const d = Math.hypot(pts[i][0] - at.x, pts[i][1] - at.y, pts[i][2] - at.z) - limb.radii[i]
      if (!near || d < near.d) near = { d, limb, i }
    }
  }
  if (near.d > TWIG.reach) continue
  const along = tangentAt(near.limb.local.map(V), near.i)
  const flat = seen(along)
  forks.push({ at, r: twig.radii[0], way: Math.atan2(flat[1], flat[0]), out: Math.sign(at.x - axisX(at.y)) || -1 })
}
forks.sort((a, b) => b.at.y - a.at.y)
const grown = []
const apartAngle = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
for (const f of forks) {
  if (grown.some((g) => g.at.distanceTo(f.at) < TWIG.apart)) continue
  const r0 = Math.min(TWIG.radius[2], Math.max(TWIG.radius[1], f.r * TWIG.radius[0]))
  const high = f.out < 0 && f.at.y > TWIG.high.above
  const reach = high ? rng.range(TWIG.high.length[0], TWIG.high.length[1]) : rng.range(TWIG.length[0], TWIG.length[1])
  const beside = grown.filter((g) => g.at.distanceTo(f.at) < TWIG.beside)
  const got = best(
    TWIG.tries,
    () => {
      const way = f.way + (rng.next() < 0.5 ? 1 : -1) * rng.range(TWIG.fan[0], TWIG.fan[1])
      const d = new THREE.Vector3(Math.cos(way), Math.max(TWIG.droop, Math.sin(way)), rng.range(-TWIG.deep, TWIG.deep))
      return curve(f.at, d.normalize(), reach * rng.range(0.75, 1), r0)
    },
    (a, b, c) => {
      const way = Math.atan2(c[1] - a[1], c[0] - a[0])
      const same = beside.reduce((n, g) => n + (apartAngle(way, g.way) < TWIG.same ? 2.5 : 0), 0)
      return (high ? TWIG.high.up : 0.3) * (b[1] - a[1]) + 0.3 * f.out * (b[0] - a[0]) - same
    },
  )
  if (!got) continue
  const a = seen(got.pts[0])
  const c = seen(got.pts[Math.min(got.pts.length - 1, 6)])
  grown.push({ at: f.at, way: Math.atan2(c[1] - a[1], c[0] - a[0]) })
  chains.push({ pts: [f.at.clone(), ...got.pts], radii: [r0, ...got.radii], kind: 'twig' })
  lay(got.pts, got.radii)
}

function tube(chain, n) {
  const sides = chain.radii[0] > 0.9 ? 10 : chain.radii[0] > 0.45 ? 7 : 6
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
      col.push(shade, shade * 0.99, shade * 0.97, 1)
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
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
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
  const fine = Math.pow(Math.abs(Math.sin(11.5 * a + 1.8 * wander + 0.7 * Math.sin(0.55 * h) + 0.9)), RIDGE.fine)
  const hair = Math.pow(Math.abs(Math.sin(21 * a + 2.6 * wander + 1.1 * Math.sin(0.8 * h + 2 * a) + 2.1)), RIDGE.hair)
  const split = 1 - 0.5 * Math.exp(-Math.pow(Math.sin(0.9 * h + 2.3 * Math.sin(3 * a + 1.3) + 5 * a), 2) / 0.02)
  const knot = 1 - 0.45 * Math.exp(-Math.pow(Math.sin(0.37 * h + 1.7 * Math.sin(2 * a + 0.4) + 3 * a + 0.8), 2) / 0.012)
  return (RIDGE.mix[0] * broad + RIDGE.mix[1] * fine + RIDGE.mix[2] * hair) * split * knot
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
      const shade = (0.07 + 0.93 * Math.pow(smoothstep(0.08, 0.85, b), 1.5)) * (0.8 + 0.2 * smoothstep(-1, 5, h))
      const warm = 0.95 + 0.1 * hash(Math.round(((phi + T.trunkTwist(h) * SLEEVE.twist) / TAU) * 9) + 3)
      col.push(shade * warm, shade * 0.99, shade * (2 - warm) * 0.97, 0)
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
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
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
  for (const c of chains) for (let i = c.kind === 'limb' ? Math.floor(c.pts.length * 0.3) : 2; i < c.pts.length - 2; i += c.kind === 'limb' ? 2 : 1) spots.push({ at: c.pts[i], r: c.radii[i] })
  let tries = 0
  while (embers.length < EMBER.count && tries++ < 20000) {
    const s = spots[rng.int(spots.length)]
    if (embers.some((e) => e.hang.distanceTo(s.at) < EMBER.apart)) continue
    const r = rng.range(EMBER.r[0], EMBER.r[1])
    const drop = s.r + rng.range(EMBER.drop[0], EMBER.drop[1])
    const sway = new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 0.5), rng.range(-1, 1)).normalize()
    const at = s.at.clone().addScaledVector(sway, drop + r)
    if (!inside(at, CEIL - EMBER.under)) continue
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
  if (c.kind === 'limb') continue
  const keep = c.pts.map((_, i) => i).filter((i) => i % 3 === 0 || i === c.pts.length - 1)
  solid.push(keep.length)
  for (const i of keep) solid.push(+c.pts[i].x.toFixed(2), +c.pts[i].y.toFixed(2), +c.pts[i].z.toFixed(2), +c.radii[i].toFixed(3))
}
const tri = (g) => (g.index ? g.index.count : g.getAttribute('position').count) / 3
const file = rel('assets-full', 'fall', 'tree-fall.glb')
const out = writeGlb(file, [fromThree('twigs', twigs, { triangles: tri(twigs), chains: solid }), fromThree('lights', lights, { triangles: tri(lights), bulbs })])
const levelled = await addLevels(fs.readFileSync(file), { levels: LEVELS })
fs.writeFileSync(file, levelled.glb)
out.bytes = levelled.glb.length
const lighter = Object.fromEntries(Object.keys(LEVELS).map((l) => [l, levelled.meshes.reduce((n, m) => n + (m[l] ?? m.triangles), 0)]))
const kinds = ['limb', 'tip', 'twig'].map((k) => chains.filter((c) => c.kind === k).length)
writeJson(rel('out', 'work', 'tree-fall', 'build.json'), { made: 'assets-src/tree-fall/build.mjs', file: 'assets-full/fall/tree-fall.glb', bytes: out.bytes, triangles: out.triangles, limbs: kinds[0], tips: kinds[1], twigs: kinds[2], forks: forks.length, embers: embers.length })
console.log(`tree-fall: ${out.triangles} triangles (medium ${lighter.medium}, low ${lighter.low}; twigs ${tri(twigs)}, lights ${tri(lights)}), ${(out.bytes / 1e6).toFixed(2)} MB; ${kinds[0]} limbs, ${kinds[1]} tips, ${kinds[2]} twigs of ${forks.length} fork places; ${embers.length} embers`)
