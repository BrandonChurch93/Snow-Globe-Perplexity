import * as THREE from 'three'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { rel, writeJson } from '../../tools/lib/paths.mjs'
import { loadLayout, loadRoof } from '../village/layout.mjs'
import { Bag, KIND, STOUT, TILE_MM, add3, basis, boxMatrix, clamp, fbm, frame, lin, mul3, netGeometry, noise, norm3, rng, shade, smin, smooth, sub3, surf, writePng } from '../village/kit.mjs'

const L = await loadLayout()
const RF = await loadRoof()
const C = L.cottage
const F = L.cottageFrame()
const U3 = [F.u[0], 0, F.u[1]]
const V3 = [F.v[0], 0, F.v[1]]
const UP = [0, 1, 0]
const neg = (a) => [-a[0], -a[1], -a[2]]
const sc = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const P3 = (a, u, l) => L.cottagePoint(a, u, l)
const R = rng(4409)
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z)
const cp = Math.cos(RF.pitch)
const sp = Math.sin(RF.pitch)
const SLOPE = RF.slopeLength
const roofLen = RF.roofLength
const ridgeY = RF.ridgeY
const cottageM = basis(P3(0, 0, 0), V3, UP)
const cottageInv = cottageM.clone().invert()
const local = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(cottageInv)

const SNOW = lin('#edf1f8')
const ROOF_TONE = [0.84, 0.73, 0.65]
const ICE_SHADE = { dark: 0.68, from: 0.15, to: 0.85, back: [0.3, 1] }
const snow = new Bag('snow')
const ice = new Bag('ice')
const decor = new Bag('decor')
const bulbs = new Bag('bulbs')
const fresh = new Bag('fresh')

const snowTone = (k = 1) => (p, n) => mul3(SNOW, k * (0.9 + 0.08 * noise(p[0] * 0.8, p[1] * 0.8, p[2] * 0.8)) * (0.72 + 0.28 * smooth(-0.7, 0.35, n[1])))
const tally = {}
const addSnow = (g, matrix, cover = 0.5, bag = snow, label = 'caps', tone = 1) => {
  const before = bag.triangles
  const base = snowTone(Array.isArray(tone) ? 1 : tone)
  bag.add(g, { matrix, color: Array.isArray(tone) ? (p, n) => base(p, n).map((v, i) => v * tone[i]) : base, surf: [cover, 0] })
  tally[label] = (tally[label] ?? 0) + bag.triangles - before
}

const rbox = (x, y, z, hx, hy, hz, r) => {
  const qx = Math.abs(x) - (hx - r)
  const qy = Math.abs(y) - (hy - r)
  const qz = Math.abs(z) - (hz - r)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r
}
const ell = (x, y, z, rx, ry, rz) => (Math.hypot(x / rx, y / ry, z / rz) - 1) * Math.min(rx, ry, rz)

const T0 = 1.6
const RR = 0.74
const ROLL = { out: 0.85, dropMm: 0.55, round: 0.34, clear: 0.14 }
const ch = C.chimney
const stackTop = ch.top - 0.95
const prism = (a, l) => {
  const qa = Math.abs(a - ch.across) - ch.half
  const ql = Math.abs(l - ch.along) - ch.halfAlong
  return Math.hypot(Math.max(qa, 0), Math.max(ql, 0)) + Math.min(Math.max(qa, ql), 0)
}
const dents = [
  [-1, 6.2, -2.4, 1.5, 0.38],
  [-1, 10.4, 4.6, 1.9, 0.3],
  [-1, 3.6, 6.8, 1.3, 0.24],
  [-1, 8.4, -7.2, 1.2, 0.22],
  [1, 7.5, 2, 1.7, 0.28],
  [1, 11.2, -5, 1.4, 0.24],
]
const dent = (sd, s, l) => {
  let v = 0
  for (const d of dents) if (d[0] === sd) v += d[4] * Math.exp(-((s - d[1]) ** 2 + (l - d[2]) ** 2) / (d[3] * d[3]))
  return v
}
const slopeOf = (sd, a, h) => [sd * a * cp - (h - ridgeY) * sp, sd * a * sp + (h - ridgeY) * cp]

function roofSnow(extra, lumps) {
  return (a, h, l) => {
    let d = 1e9
    for (const sd of [-1, 1]) {
      const [s, lift] = slopeOf(sd, a, h)
      const eave = SLOPE + ROLL.out + 0.42 * (noise(l * 0.34, sd * 3.1, 1.7) - 0.5) + 0.14 * noise(l * 1.5, sd * 1.3, 5.2)
      const gable = roofLen + ROLL.out + 0.1 * noise(s * 0.5, sd * 5.3, l > 0 ? 2.2 : 8.4) + 0.05 * noise(s * 1.9, sd * 2.3, l > 0 ? 4.2 : 6.4)
      const th = T0 * (0.86 + 0.3 * noise(s * 0.33, l * 0.33, 7 + sd)) - dent(sd, s, l) + extra
      const s0 = -T0 * (sp / cp) + 0.12
      const box = rbox(s - (s0 + eave) / 2, lift - th / 2, l, (eave - s0) / 2, th / 2, gable, Math.min(RR, th / 2 - 0.02))
      const drop = ROLL.dropMm * (0.8 + 0.5 * noise(l * 0.9, s * 0.9, 3 + sd))
      const vw = (gable - roofLen - ROLL.clear) / 2
      const verge = rbox(s - (s0 + eave) / 2, lift - (th - drop) / 2, Math.abs(l) - (gable - vw), (eave - s0) / 2, (th + drop) / 2, vw, Math.min(ROLL.round, vw - 0.02))
      d = smin(d, smin(box, verge, 0.22), 0.5)
    }
    const pr = prism(a, l)
    const [, liftL] = slopeOf(-1, a, h)
    const [, liftR] = slopeOf(1, a, h)
    const bank = Math.max(pr - 0.5, Math.max(liftL, liftR) - (T0 + 0.42 - 0.5 * smooth(0, 0.7, pr)))
    d = smin(d, bank, 0.45)
    return d + lumps * fbm(a * 1.05, h * 1.05, l * 1.05, 2)
  }
}
const underDeck = (a, h, l) => {
  for (const sd of [-1, 1]) {
    const [s, lift] = slopeOf(sd, a, h)
    if (sd * a > -0.05 && lift < 0.12 && s < SLOPE + 0.06 && Math.abs(l) < roofLen + 0.1) return true
  }
  return false
}
const keepRoof = (a, h, l) => !(prism(a, l) < -0.08 && h < stackTop + 0.2) && !underDeck(a, h, l)
const roofMin = [-(C.halfWidth + C.overhang + 1.2), ridgeY - (SLOPE + 1.1) * sp - 0.7, -(roofLen + 1.1)]
const roofMax = [C.halfWidth + C.overhang + 1.2, ridgeY + T0 / cp + 0.7, roofLen + 1.1]
addSnow(netGeometry(roofSnow(0, 0.07), roofMin, roofMax, 0.45, keepRoof), cottageM, 1, snow, 'roof', ROOF_TONE)

{
  const sdf = (a, h, l) => {
    const y = h - (stackTop + 0.85)
    let d = Math.max(ell(a - ch.across, y + 0.1, l - ch.along, ch.half + 0.12, 0.66, ch.halfAlong + 0.12), rbox(a - ch.across, y - 0.3, l - ch.along, ch.half + 0.1, 0.5, ch.halfAlong + 0.1, 0.3))
    d = Math.max(d, 0.66 - Math.hypot(a - (ch.across - 0.2), l - (ch.along + 0.1)))
    return d + 0.05 * fbm(a * 2, h * 2, l * 2, 2)
  }
  addSnow(netGeometry(sdf, [ch.across - ch.half - 0.7, stackTop + 0.5, ch.along - ch.halfAlong - 0.7], [ch.across + ch.half + 0.7, stackTop + 1.8, ch.along + ch.halfAlong + 0.7], 0.2, (a, h) => h > stackTop + 0.9), cottageM, 0.6)
}

function strip(n, at, across, up, w, h, seg = 6) {
  const pos = []
  const idx = []
  const row = seg + 1
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const p = at(t)
    const ax = across(t)
    const u = typeof up === 'function' ? up(t) : up
    const end = Math.sin(Math.PI * clamp(Math.min(t, 1 - t) * n * 0.5, 0, 0.5))
    const hw = w(t) * (0.35 + 0.65 * end)
    const hh = h(t) * end
    for (let j = 0; j <= seg; j++) {
      const ang = Math.PI * (j / seg)
      const cx = Math.cos(ang) * hw
      const cy = Math.sin(ang) * hh - 0.03
      pos.push(p[0] + ax[0] * cx + u[0] * cy, p[1] + ax[1] * cx + u[1] * cy, p[2] + ax[2] * cx + u[2] * cy)
    }
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < seg; j++) {
      const a = i * row + j
      idx.push(a, a + 1, a + row + 1, a, a + row + 1, a + row)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const N = g.getAttribute('normal')
  const u0 = typeof up === 'function' ? up(0.5) : up
  let facing = 0
  for (let i = 0; i < N.count; i++) facing += N.getX(i) * u0[0] + N.getY(i) * u0[1] + N.getZ(i) * u0[2]
  if (facing < 0) {
    const I = g.index.array
    for (let i = 0; i < I.length; i += 3) {
      const k = I[i + 1]
      I[i + 1] = I[i + 2]
      I[i + 2] = k
    }
    g.computeVertexNormals()
  }
  return g
}

const fenceShapes = L.shapes.filter((s) => s.role === 'fence')
for (const s of fenceShapes) {
  const M = boxMatrix(s)
  if (s.half[2] < 2) {
    const seed = R() * 40
    const top = s.half[1] + 0.12
    const fat = 0.56 + 0.22 * R()
    const tall = 0.26 + 0.2 * R()
    const lean = 0.24 * (R() - 0.5)
    const wide = s.half[0] * STOUT.post + 0.06 + 0.1 * (fat - 0.56)
    const sdf = (x, y, z) => {
      const dome = ell(x - 0.5 * lean, y - top + 0.1, z + 0.25 * lean, wide, tall + 0.34, wide)
      const hem = top - 0.06 - 0.16 * noise(x * 2.4 + seed, z * 2.4, 3) - y
      return Math.max(dome, hem) + 0.045 * fbm(x * 2.2 + seed, y * 2.2, z * 2.2, 2)
    }
    addSnow(netGeometry(sdf, [-1.4, top - 0.7, -1.4], [1.4, top + 1.05, 1.4], 0.18), M, 0.6, snow, 'posts')
  } else {
    const seed = R() * 40
    const len = s.half[2]
    const low = s.centre[1] < fenceShapes.filter((q) => q.half[2] >= 2).reduce((m, q) => Math.max(m, q.centre[1]), -1e9) - 0.1
    const g = strip(
      70,
      (t) => [0, s.half[1] * STOUT.rail, -len + 0.4 + t * (2 * len - 0.8)],
      () => [1, 0, 0],
      [0, 1, 0],
      (t) => 0.3 * STOUT.rail + 0.05 * noise(t * 30, seed, 2),
      (t) => (low ? 0.2 : 0.3) * clamp(0.75 + 0.6 * noise(t * 22, seed, 5) + 0.3 * noise(t * 60, seed, 9), 0.12, 1.4),
      5,
    )
    addSnow(g, M, 0.6, snow, 'rails')
  }
}

{
  const lampM = new THREE.Matrix4().makeRotationY(RF.LAMP.yaw).setPosition(...RF.lampFoot())
  const y0 = RF.LAMP.cageHi + 0.62
  const sdf = (x, y, z) => ell(x + 0.42, y - y0, z - 0.2, 0.46, 0.2, 0.5) + 0.03 * fbm(x * 2 + 3, y * 2, z * 2, 2)
  addSnow(netGeometry(sdf, [-1.2, y0 - 0.5, -1], [1, y0 + 0.5, 1.2], 0.12), lampM, 0.6)
}

const front = frame(P3(0, 0, C.halfLength), V3, UP, U3)
const left = frame(P3(-C.halfWidth, 0, 0), U3, UP, neg(V3))
for (const [M, w] of [[front, { x: C.window.across, sill: C.window.sill, width: C.window.width }], [left, { x: C.sideWindow.along, sill: C.sideWindow.sill, width: C.sideWindow.width }]]) {
  const seed = R() * 30
  const hw = w.width / 2 + 0.6
  const g = strip(22, (t) => [w.x - hw + t * 2 * hw, w.sill - 0.33, 0.28], () => [0, 0, 1], [0, 1, 0], () => 0.4, (t) => 0.3 * clamp(0.8 + 0.5 * noise(t * 7, seed, 3), 0.3, 1.3), 5)
  addSnow(g, M, 0.4)
}

const pathShapes = L.shapes.filter((s) => s.role === 'path')
for (const [i, s] of pathShapes.entries()) {
  const M = boxMatrix(s)
  const seed = R() * 50
  if (i < L.steps.length) {
    for (const side of [-1, 1]) {
      const cx = side * (s.half[0] - 0.5)
      const sdf = (x, y, z) => rbox(x - cx, y - s.half[1] - 0.12, z + 0.15, 0.85, 0.24, s.half[2] + 0.1, 0.22) + 0.07 * fbm(x * 1.8 + seed, y * 1.8, z * 1.8, 2)
      addSnow(netGeometry(sdf, [cx - 1.3, s.half[1] - 0.35, -s.half[2] - 0.6], [cx + 1.3, s.half[1] + 0.6, s.half[2] + 0.6], 0.3, (x, y) => y > s.half[1] - 0.3), M, 0.6, snow, 'steps')
    }
  } else {
    const sdf = (x, y, z) => ell(x, y - s.half[1] - 0.02, z, s.half[0] * 0.8, 0.27, s.half[2] * 0.78) + 0.06 * fbm(x * 1.6 + seed, y * 1.6, z * 1.6, 2)
    addSnow(netGeometry(sdf, [-s.half[0], s.half[1] - 0.35, -s.half[2]], [s.half[0], s.half[1] + 0.5, s.half[2]], 0.24, (x, y) => y > s.half[1] - 0.02), M, 0.6, snow, 'stones')
  }
}

const shrubList = RF.shrubs()
for (const [i, sh] of shrubList.entries()) {
  const [cx, cy, cz] = sh.centre
  const seed = 11 * i + 3
  const SR = rng(977 + 31 * i)
  const clumps = Array.from({ length: i < 2 ? 13 : 10 }, () => {
    const a = SR() * Math.PI * 2
    const up = 0.45 + 0.55 * Math.sqrt(SR())
    const rr = Math.sqrt(Math.max(0, 1 - up * up))
    const wide = 0.36 + 0.42 * SR()
    return { at: [cx + Math.cos(a) * rr * sh.r[0] * 0.95, cy + up * sh.r[1] * 0.95, cz + Math.sin(a) * rr * sh.r[2] * 0.95], wide, tall: wide * (0.42 + 0.3 * SR()) }
  })
  const sdf = (x, y, z) => {
    let d = 1e9
    for (const c of clumps) d = smin(d, ell(x - c.at[0], y - c.at[1], z - c.at[2], c.wide, c.tall, c.wide), 0.16)
    return d + 0.06 * fbm(x * 2.4 + seed, y * 2.4, z * 2.4, 2)
  }
  const inside = (x, y, z) => ell(x - cx, y - cy, z - cz, sh.r[0] * 0.78, sh.r[1] * 0.78, sh.r[2] * 0.78) < 0
  addSnow(netGeometry(sdf, [cx - sh.r[0] - 0.9, cy - sh.r[1], cz - sh.r[2] - 0.9], [cx + sh.r[0] + 0.9, cy + sh.r[1] + 1, cz + sh.r[2] + 0.9], 0.2, (x, y, z) => !inside(x, y, z)), undefined, 0.6, snow, 'shrubs')
}

const fposts = fenceShapes.filter((s) => s.half[2] < 2).map((s) => [s.centre[0], s.centre[2]])
const lampAt = [L.lamppost.x, L.lamppost.z]
function wallGap(x, z) {
  const p = local(x, 0, z)
  const qa = Math.abs(p.x) - C.halfWidth
  const ql = Math.abs(p.z) - C.halfLength
  return Math.hypot(Math.max(qa, 0), Math.max(ql, 0)) + Math.min(Math.max(qa, ql), 0)
}
function snowAt(x, z) {
  const pf = L.pondField(x, z)
  const m = L.moundAt(z) + L.bankAt(x, z) + L.rimAt(x, z) + L.driftAt(x, z) + L.heapAt(x, z)
  const lip = smooth(0.94, 1.03, pf)
  let extra = 0.34 * fbm(x * 0.17, z * 0.17, 3.3, 3) + 0.1 * fbm(x * 0.62, z * 0.62, 9.1, 2)
  const gap = wallGap(x, z)
  extra += 0.42 * Math.exp(-Math.max(gap, 0) / 1.5) * (0.75 + 0.4 * noise(x * 0.5, z * 0.5, 6.1))
  extra += 0.28 * Math.exp(-Math.hypot(x - lampAt[0], z - lampAt[1]) / 1.1)
  for (const f of fposts) extra += 0.26 * Math.exp(-Math.hypot(x - f[0], z - f[1]) / 0.9)
  for (const sh of shrubList) extra += 0.3 * Math.exp(-Math.max(0, Math.hypot(x - sh.centre[0], z - sh.centre[2]) - 1.6) / 1.1)
  const td = Math.hypot(x - L.tree.x, z - L.tree.z)
  extra += 0.36 * Math.exp(-((td - 5) ** 2) / 8)
  for (const s of pathShapes) {
    const dd = Math.hypot(x - s.centre[0], z - s.centre[2])
    extra -= 0.2 * Math.exp(-(dd * dd) / 5)
  }
  extra = clamp(extra, -0.42, 0.48)
  return m - (L.pond.level + 0.3) * (1 - lip) + extra * lip
}
const BANK_TOP = 0.3
const BANK_BLEND_MM = 5
const BILLOW = { cycles: 6.5, deepMm: 2.2, clumps: 21, clumpMm: 0.7, grains: 40, grainMm: 0.32, crestMm: 0.45, crestFine: 0.2 }
const UNDERCUT = { dark: 0.88, from: 0.985, to: 1.022, arc: [-135, -115, -5, 25] }
function contact(x, z) {
  let k = 1
  k *= 1 - 0.34 * Math.exp(-Math.max(wallGap(x, z), 0) / 1.3)
  k *= 1 - 0.3 * Math.exp(-Math.hypot(x - lampAt[0], z - lampAt[1]) / 0.9)
  for (const f of fposts) k *= 1 - 0.28 * Math.exp(-Math.hypot(x - f[0], z - f[1]) / 0.8)
  for (const sh of shrubList) k *= 1 - 0.3 * Math.exp(-Math.max(0, Math.hypot(x - sh.centre[0], z - sh.centre[2]) - 1.7) / 0.9)
  for (const s of pathShapes) k *= 1 - 0.16 * Math.exp(-((x - s.centre[0]) ** 2 + (z - s.centre[2]) ** 2) / 4.5)
  k *= 1 - 0.3 * Math.exp(-Math.max(0, Math.hypot(x - L.tree.x, z - L.tree.z) - 3.4) / 1.6)
  return k
}

{
  const around = 480
  const shore = [0.9, 0.93, 0.95, 0.962, 0.972, 0.981, 0.99, 1.0, 1.012, 1.028, 1.05, 1.08]
  const outer = 38
  const skirt = 34
  const r = L.innerRadiusMm - 0.6
  const footY = L.collarY - 1.5
  const pc = Math.cos(L.pond.yaw)
  const ps = Math.sin(L.pond.yaw)
  const pos = []
  const idx = []
  const bankOf = []
  const row = around + 1
  const rows = shore.length + outer + skirt
  const topAt = (x, z) => L.moundAt(z) + L.bankAt(x, z) + L.rimAt(x, z)
  const crestAt = (x, z) => {
    const l = Math.hypot(x, z) || 1
    const u = (x / l) * 9
    const v = (z / l) * 9
    return BILLOW.crestMm * (fbm(u * 2.1 + 4.2, 0.3, v * 2.1 + 1.1, 2) - 0.1) + BILLOW.crestFine * fbm(u * 7 + 0.6, 2.9, v * 7 + 3.3, 2)
  }
  for (let j = 0; j <= around; j++) {
    const a = (j / around) * Math.PI * 2
    const dx = Math.cos(a) * pc + Math.sin(a) * ps
    const dz = -Math.cos(a) * ps + Math.sin(a) * pc
    const unit = L.pondField(L.pond.x + dx, L.pond.z + dz)
    const inside = (t) => {
      const x = L.pond.x + dx * t
      const z = L.pond.z + dz * t
      const y = topAt(x, z)
      return x * x + y * y + z * z < r * r
    }
    let lo = 0
    let hi = 140
    for (let k = 0; k < 48; k++) {
      const mid = (lo + hi) / 2
      if (inside(mid)) lo = mid
      else hi = mid
    }
    const edge = lo
    const t1 = Math.min(shore[shore.length - 1] / unit, edge * 0.97)
    for (let k = 0; k < rows; k++) {
      let x
      let y
      let z
      let bank = 0
      if (k < shore.length) {
        const t = Math.min(shore[k] / unit, t1 * (0.9 + 0.1 * (k / (shore.length - 1))))
        x = L.pond.x + dx * t
        z = L.pond.z + dz * t
        y = snowAt(x, z)
        bank = BANK_TOP * (1 - smooth(0, BANK_BLEND_MM, edge - t))
      } else if (k < shore.length + outer) {
        const q = (k - shore.length + 1) / outer
        const t = t1 + (edge - t1) * Math.pow(q, 1.25)
        x = L.pond.x + dx * t
        z = L.pond.z + dz * t
        y = snowAt(x, z)
        const near = 1 - smooth(0, 2.6, edge - t)
        y += near * crestAt(x, z)
        if (q === 1) y = topAt(x, z) + crestAt(x, z)
        bank = BANK_TOP * (1 - smooth(0, BANK_BLEND_MM, edge - t))
      } else {
        const ex = L.pond.x + dx * edge
        const ez = L.pond.z + dz * edge
        const ey = topAt(ex, ez) + crestAt(ex, ez)
        const th = Math.atan2(ez, ex)
        const phi0 = Math.atan2(Math.hypot(ex, ez), -ey)
        const phi1 = Math.acos(clamp(-footY / r, -1, 1))
        const q = (k - shore.length - outer + 1) / skirt
        const phi = phi0 + (Math.min(phi1, phi0 - 0.12) - phi0) * q
        const ux = Math.cos(th) * Math.sin(phi)
        const uy = -Math.cos(phi)
        const uz = Math.sin(th) * Math.sin(phi)
        const lump = clamp(0.5 + 0.75 * fbm(ux * BILLOW.cycles + 3.1, uy * BILLOW.cycles, uz * BILLOW.cycles + 7.7, 3))
        const clump = clamp(0.5 + 0.8 * fbm(ux * BILLOW.clumps + 1.3, uy * BILLOW.clumps + 5.9, uz * BILLOW.clumps + 2.2, 2))
        const grain = clamp(0.5 + 0.9 * fbm(ux * BILLOW.grains + 8.1, uy * BILLOW.grains + 0.7, uz * BILLOW.grains + 4.4, 2))
        const rr = r - 0.15 - BILLOW.deepMm * Math.pow(lump, 1.5) * smooth(0.08, 0.5, q) - (BILLOW.clumpMm * clump * clump + BILLOW.grainMm * grain) * smooth(0.0, 0.16, q)
        x = ux * rr
        y = uy * rr
        z = uz * rr
        bank = BANK_TOP + (1 - BANK_TOP) * q
      }
      pos.push(x, y, z)
      bankOf.push(bank)
    }
  }
  for (let j = 0; j < around; j++)
    for (let k = 0; k < rows - 1; k++) {
      const a = j * rows + k
      const b = a + rows
      idx.push(a, a + 1, b + 1, a, b + 1, b)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const N = g.getAttribute('normal')
  let upward = 0
  for (let i = 0; i < N.count; i++) upward += N.getY(i)
  if (upward < 0) {
    const I = g.index.array
    for (let i = 0; i < I.length; i += 3) {
      const k = I[i + 1]
      I[i + 1] = I[i + 2]
      I[i + 2] = k
    }
    g.computeVertexNormals()
  }
  const seamless = g
  const P = seamless.getAttribute('position')
  const NN = seamless.getAttribute('normal')
  for (let k = 0; k < rows; k++) {
    const a = k
    const b = around * rows + k
    const nx = NN.getX(a) + NN.getX(b)
    const ny = NN.getY(a) + NN.getY(b)
    const nz = NN.getZ(a) + NN.getZ(b)
    const l = Math.hypot(nx, ny, nz) || 1
    NN.setXYZ(a, nx / l, ny / l, nz / l)
    NN.setXYZ(b, nx / l, ny / l, nz / l)
    P.setXYZ(b, P.getX(a), P.getY(a), P.getZ(a))
  }
  const puff = (_p, _n, i) => [1, bankOf[i]]
  const undercut = (x, z) => {
    const pf = L.pondField(x, z)
    if (pf > UNDERCUT.to) return 1
    const deg = (Math.atan2(z - L.pond.z, x - L.pond.x) * 180) / Math.PI
    const arc = smooth(UNDERCUT.arc[0], UNDERCUT.arc[1], deg) * (1 - smooth(UNDERCUT.arc[2], UNDERCUT.arc[3], deg))
    return 1 - UNDERCUT.dark * arc * (1 - smooth(UNDERCUT.from, UNDERCUT.to, pf))
  }
  snow.add(g, { color: (p) => mul3(SNOW, (0.9 + 0.08 * noise(p[0] * 0.5, p[2] * 0.5, 3)) * contact(p[0], p[2]) * undercut(p[0], p[2])), surf: puff })
}

{
  const rings = [0, 0.22, 0.42, 0.6, 0.74, 0.85, 0.92, 0.965, 0.99]
  const around = 96
  const pc = Math.cos(L.pond.yaw)
  const ps = Math.sin(L.pond.yaw)
  const pos = []
  const uv = []
  const st = []
  const idx = []
  const row = around + 1
  for (const rho of rings)
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2
      const dx = Math.cos(a) * pc + Math.sin(a) * ps
      const dz = -Math.cos(a) * ps + Math.sin(a) * pc
      const unit = L.pondField(L.pond.x + dx, L.pond.z + dz)
      const t = rho / unit
      const x = L.pond.x + dx * t
      const z = L.pond.z + dz * t
      pos.push(x, L.moundAt(z) - L.pond.level, z)
      uv.push(x / TILE_MM, z / TILE_MM)
      st.push(rho, 0)
    }
  for (let k = 0; k < rings.length - 1; k++)
    for (let j = 0; j < around; j++) {
      const a = k * row + j
      const b = a + row
      idx.push(a, b, b + 1, a, b + 1, a + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  if (g.getAttribute('normal').getY(5) < 0) {
    const I = g.index.array
    for (let i = 0; i < I.length; i += 3) {
      const k = I[i + 1]
      I[i + 1] = I[i + 2]
      I[i + 2] = k
    }
    g.computeVertexNormals()
  }
  let vi = 0
  const shadeAt = (p) => {
    const k = 1 - ICE_SHADE.dark * smooth(ICE_SHADE.from, ICE_SHADE.to, L.pondField(p[0], p[2])) * smooth(ICE_SHADE.back[0], ICE_SHADE.back[1], (L.pond.z - p[2]) / L.pond.rz)
    return [k, k, k]
  }
  ice.add(g, { keepUv: true, color: shadeAt, surf: () => [st[2 * vi++], 0] })
}

const GREENS = ['#17361a', '#20441d', '#122b15', '#274d21', '#1b3a19'].map(lin)
const RED = lin('#b3121b')
const WIRE = lin('#101a12')
const leafSurf = [surf(KIND.leaf, 0.55), 0]
const off = () => [R() * 7, R() * 7]
{
  const door = C.door
  const cx = door.across
  const cy = door.height * 0.64
  const zc = -0.5 + 0.27 + 0.3
  const ringR = 1.12
  const core = new THREE.TorusGeometry(ringR, 0.27, 7, 22).applyMatrix4(T(cx, cy, zc))
  decor.add(core, { matrix: front, color: lin('#12240f'), surf: leafSurf, uvOffset: off(), renormal: true })
  const pos = []
  const nor = []
  const col = []
  for (let i = 0; i < 300; i++) {
    const th = R() * Math.PI * 2
    const ph = (R() - 0.5) * Math.PI * 1.25
    const rr = 0.3 + 0.1 * R()
    const radial = [Math.cos(th), Math.sin(th), 0]
    const out = norm3([radial[0] * Math.sin(ph), radial[1] * Math.sin(ph), Math.cos(ph)])
    const base = [cx + radial[0] * (ringR + Math.sin(ph) * rr * 0.6), cy + radial[1] * (ringR + Math.sin(ph) * rr * 0.6), zc + Math.cos(ph) * rr * 0.6]
    const tangent = [-Math.sin(th), Math.cos(th), 0]
    const tip = norm3(add3(add3(sc(tangent, 0.9 + 0.3 * R()), sc(out, 0.5 + 0.5 * R())), [(R() - 0.5) * 0.5, (R() - 0.5) * 0.5, (R() - 0.5) * 0.3]))
    const side = norm3([tip[1] * out[2] - tip[2] * out[1], tip[2] * out[0] - tip[0] * out[2], tip[0] * out[1] - tip[1] * out[0]])
    const len = 0.42 + 0.3 * R()
    const w = 0.1 + 0.06 * R()
    const mid = add3(base, sc(tip, len * 0.45))
    const A = base
    const B = add3(mid, sc(side, w))
    const Cc = add3(base, sc(tip, len))
    const D = add3(mid, sc(side, -w))
    const tone = mul3(GREENS[Math.floor(R() * GREENS.length)], 0.7 + 0.7 * R())
    const nn = norm3(add3(out, [0, 0.3, 0.4]))
    for (const [q, s] of [[A, 0.5], [B, 0.9], [Cc, 1.2], [A, 0.5], [Cc, 1.2], [D, 0.9]]) {
      pos.push(...q)
      nor.push(...nn)
      col.push(tone[0] * s, tone[1] * s, tone[2] * s)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(Array.from({ length: pos.length / 3 }, (_, i) => i))
  g.applyMatrix4(front)
  decor.add(g, { surf: leafSurf, uvOffset: off() })
  const red = (geo, k = 1) => {
    shade(geo, (x, y, z) => 0.75 + 0.35 * noise(x * 4, y * 4, z * 4))
    decor.add(geo, { matrix: front, color: mul3(RED, k), surf: [surf(KIND.stone, 0.38), 0], uvOffset: off(), renormal: true })
  }
  const by = cy + ringR * 0.62
  const bz = zc + 0.34
  for (const sd of [-1, 1]) {
    red(new THREE.TorusGeometry(0.4, 0.14, 6, 12).applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.5, sd * 0.5, sd * 0.35)).scale(new THREE.Vector3(1.5, 0.85, 1)).setPosition(cx + sd * 0.56, by + 0.08, bz)))
    const tail = new THREE.BoxGeometry(0.3, 1.5, 0.06, 1, 4, 1)
    const P = tail.getAttribute('position')
    for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + sd * 0.12 * (0.5 - P.getY(i)) + 0.04 * Math.sin(P.getY(i) * 7), P.getY(i), P.getZ(i) + 0.05 * Math.sin(P.getY(i) * 6 + sd))
    red(tail.applyMatrix4(T(cx + sd * 0.24, by - 0.8, bz - 0.06)), 0.85)
  }
  red(new THREE.SphereGeometry(0.2, 8, 6).applyMatrix4(T(cx, by + 0.06, bz + 0.05)), 1.1)
  for (let i = 0; i < 9; i++) {
    const th = R() * Math.PI * 2
    if (Math.abs(th - Math.PI * 0.5) < 0.5) continue
    red(new THREE.SphereGeometry(0.085 + 0.03 * R(), 7, 5).applyMatrix4(T(cx + Math.cos(th) * (ringR + (R() - 0.5) * 0.25), cy + Math.sin(th) * (ringR + (R() - 0.5) * 0.25), zc + 0.3)), 1.15)
  }
}

const hangs = { eave: RF.eaveHangs(), rake: RF.rakeHangs() }
const bulbTones = ['#ffb14e', '#ffa53c', '#ffbb5e', '#ff9a30', '#ffb354'].map(lin)
let bulbIndex = 0
for (const run of [hangs.eave, hangs.rake]) {
  const tops = run.map((p) => [p[0], p[1] + 0.56, p[2]])
  const pos = []
  const idx = []
  const ring = 3
  const push = (p, dir) => {
    const ref = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
    const a = norm3([dir[1] * ref[2] - dir[2] * ref[1], dir[2] * ref[0] - dir[0] * ref[2], dir[0] * ref[1] - dir[1] * ref[0]])
    const b = [dir[1] * a[2] - dir[2] * a[1], dir[2] * a[0] - dir[0] * a[2], dir[0] * a[1] - dir[1] * a[0]]
    for (let k = 0; k < ring; k++) {
      const t = (k / ring) * Math.PI * 2
      pos.push(p[0] + 0.05 * (Math.cos(t) * a[0] + Math.sin(t) * b[0]), p[1] + 0.05 * (Math.cos(t) * a[1] + Math.sin(t) * b[1]), p[2] + 0.05 * (Math.cos(t) * a[2] + Math.sin(t) * b[2]))
    }
  }
  const pts = []
  for (let i = 0; i < tops.length - 1; i++) {
    const A = tops[i]
    const B = tops[i + 1]
    const sag = 0.16 + 0.1 * R()
    for (let k = 0; k < 6; k++) {
      const t = k / 6
      pts.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - sag * 4 * t * (1 - t), A[2] + (B[2] - A[2]) * t])
    }
  }
  pts.push(tops[tops.length - 1])
  for (let i = 0; i < pts.length; i++) push(pts[i], norm3(sub3(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)])))
  for (let i = 0; i < pts.length - 1; i++)
    for (let k = 0; k < ring; k++) {
      const a = i * ring + k
      const b = i * ring + ((k + 1) % ring)
      idx.push(a, b, b + ring, a, b + ring, a + ring)
    }
  const wire = new THREE.BufferGeometry()
  wire.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  wire.setIndex(idx)
  wire.computeVertexNormals()
  decor.add(wire, { color: WIRE, surf: [surf(KIND.iron, 0.6), 0], uvOffset: off() })
  for (const p of run) {
    const socket = new THREE.CylinderGeometry(0.13, 0.17, 0.3, 6, 1).applyMatrix4(T(p[0], p[1] + 0.42, p[2]))
    decor.add(socket, { color: lin('#1c2a1d'), surf: [surf(KIND.iron, 0.55), 0], uvOffset: off(), renormal: true })
    const bulb = new THREE.SphereGeometry(0.26, 6, 4).applyMatrix4(new THREE.Matrix4().makeScale(0.92, 1.22, 0.92).setPosition(p[0], p[1], p[2]))
    const tone = bulbTones[bulbIndex % bulbTones.length]
    const phase = R()
    bulbs.add(bulb, { color: tone, keepUv: true, surf: [bulbIndex, phase] })
    bulbIndex++
  }
}

addSnow(netGeometry(roofSnow(0.2, 0.1), roofMin.map((v) => v - 0.4), roofMax.map((v) => v + 0.4), 0.85, (a, h, l) => keepRoof(a, h, l) && Math.max(slopeOf(-1, a, h)[1], slopeOf(1, a, h)[1]) > 0.45), cottageM, 1, fresh, 'fresh', ROOF_TONE)
for (const s of fenceShapes.filter((q) => q.half[2] < 2)) {
  const top = s.half[1] + 0.12
  const wide = s.half[0] * STOUT.post + 0.13
  const seed = s.centre[0] * 3.1 + s.centre[2] * 1.7
  const sdf = (x, y, z) => Math.max(ell(x, y - top + 0.12, z, wide, 0.62, wide), top - 0.1 - 0.22 * noise(x * 2.4 + seed, z * 2.4, 5) - y) + 0.05 * fbm(x * 2 + seed, y * 2, z * 2, 2)
  addSnow(netGeometry(sdf, [-1.5, top - 0.7, -1.5], [1.5, top + 1.3, 1.5], 0.2), boxMatrix(s), 1, fresh, 'fresh')
}

const names = [snow, ice, decor, bulbs, fresh]
const meshes = names.map((b) => fromThree(b.name, b.geometry(), b === bulbs ? { count: bulbIndex } : b === ice ? { level: L.pond.level } : undefined))
const out = writeGlb(rel('assets-full', 'winter', 'village-winter.glb'), meshes)

const SIZE = 1024
const cell = (u, v, n, seed) => {
  const x = u * n
  const y = v * n
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  let best = 9
  let id = 0
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = ((xi + i) % n + n) % n
      const cy = ((yi + j) % n + n) % n
      const hx = (noise(cx + 0.5, cy + 0.5, seed) + 1) / 2
      const hy = (noise(cx + 0.5, cy + 0.5, seed + 11) + 1) / 2
      const d = Math.hypot(xi + i + hx - x, yi + j + hy - y)
      if (d < best) {
        best = d
        id = (noise(cx + 0.5, cy + 0.5, seed + 23) + 1) / 2
      }
    }
  return [best, id]
}
const snowBytes = writePng(rel('assets-full', 'winter', 'village-snow.lin.tile.png'), SIZE, (px, py) => {
  const u = px / SIZE
  const v = py / SIZE
  const [d1] = cell(u, v, 96, 1)
  const [d2] = cell(u, v, 220, 2)
  const grain = 0.5 + 0.34 * fbm(u * 40, v * 40, 0, 4, 40) + 0.3 * (0.5 - smooth(0, 0.6, d1)) + 0.22 * (0.5 - smooth(0, 0.6, d2))
  const [d3, id] = cell(u, v, 150, 3)
  const spark = id > 0.8 ? (1 - smooth(0.05, 0.3, d3)) * (0.5 + 0.5 * ((id - 0.8) / 0.2)) : 0
  const lumps = 0.5 + 0.75 * fbm(u * 5, v * 5, 4, 4, 5)
  return [grain, spark, lumps]
})
const iceBytes = writePng(rel('assets-full', 'winter', 'village-ice.lin.tile.png'), SIZE, (px, py) => {
  const u = px / SIZE
  const v = py / SIZE
  let scratch = 0
  for (let k = 0; k < 5; k++) {
    const ang = k * 1.27 + 0.4
    const c = Math.round(Math.cos(ang) * 3)
    const s = Math.round(Math.sin(ang) * 3) || 1
    const t = u * c + v * s
    const w = u * -s * 9 + v * c * 9
    const line = noise(t * 37 + k * 5, Math.floor(w) * 0.37 + k, 7, 0)
    const lane = Math.abs((w % 1 + 1) % 1 - 0.5)
    scratch = Math.max(scratch, smooth(0.62, 0.9, line) * (1 - smooth(0.0, 0.07 + 0.05 * k, lane)))
  }
  const frost = 0.5 + 0.8 * fbm(u * 6, v * 6, 2, 5, 6)
  const [d, id] = cell(u, v, 40, 9)
  const bubble = id > 0.55 ? 1 - smooth(0.04, 0.16 + 0.1 * id, d) : 0
  return [scratch, frost, bubble]
})

tally.field = snow.triangles - Object.values(tally).reduce((a, b) => a + b, 0) + (tally.fresh ?? 0)
const record = {
  tally,
  made: 'assets-src/village-winter/build.mjs',
  model: { file: 'assets-full/winter/village-winter.glb', bytes: out.bytes, triangles: out.triangles, meshes: Object.fromEntries(names.map((b) => [b.name, b.triangles])) },
  bulbs: bulbIndex,
  maps: {
    'assets-full/winter/village-snow.lin.tile.png': { px: SIZE, bytes: snowBytes, tileMm: TILE_MM },
    'assets-full/winter/village-ice.lin.tile.png': { px: SIZE, bytes: iceBytes, tileMm: TILE_MM },
  },
}
writeJson(rel('out', 'work', 'village', 'build-winter.json'), record)
console.log(JSON.stringify(tally))
console.log(`village-winter: ${out.triangles} triangles in ${out.meshes} meshes (${Object.entries(record.model.meshes).map(([k, v]) => `${k} ${v}`).join(', ')}), ${(out.bytes / 1e6).toFixed(2)} MB; ${bulbIndex} bulbs; snow map ${(snowBytes / 1e6).toFixed(2)} MB, ice map ${(iceBytes / 1e6).toFixed(2)} MB`)
