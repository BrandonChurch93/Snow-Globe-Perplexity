import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { rel, writeJson } from '../../tools/lib/paths.mjs'
import { loadLayout, loadRoof } from '../village/layout.mjs'
import { addLists } from './levels.mjs'
import { Bag, STACK_LIFT, TILE_MM, add3, basis, clamp, fbm, lin, mix3, mul3, netGeometry, noise, norm3, rng, smin, smooth, sub3, writePng } from '../village/kit.mjs'

const L = await loadLayout()
const RF = await loadRoof()
const C = L.cottage
const F = L.cottageFrame()
const V3 = [F.v[0], 0, F.v[1]]
const UP = [0, 1, 0]
const sc = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const P3 = (a, u, l) => L.cottagePoint(a, u, l)
const R = rng(5171)
const cp = Math.cos(RF.pitch)
const sp = Math.sin(RF.pitch)
const SLOPE = RF.slopeLength
const roofLen = RF.roofLength
const ridgeY = RF.ridgeY
const cottageM = basis(P3(0, 0, 0), V3, UP)
const cottageInv = cottageM.clone().invert()
const local = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(cottageInv)

const TONE = {
  sun: lin('#94a544'),
  grass: lin('#69852f'),
  deep: lin('#4c6a27'),
  moss: lin('#5d7c24'),
  mossDeep: lin('#33491a'),
  earth: lin('#3a2c1e'),
  wet: lin('#2e3a20'),
  blade: lin('#7a9a36'),
  bladeTip: lin('#b4c458'),
  bladeFoot: lin('#3f5a20'),
  stem: lin('#5f8a2e'),
  leaf: lin('#4f7d2c'),
  leafPale: lin('#86a843'),
  shrub: ['#35591f', '#476d25', '#28471b', '#577a2b', '#3d621e'].map(lin),
  ivy: ['#3d6424', '#4f7a2a', '#2c4c1c', '#618a30'].map(lin),
  tulips: [
    [lin('#e4463c'), lin('#ff8a5a')],
    [lin('#ef5a1c'), lin('#ffb03a')],
    [lin('#f4b21c'), lin('#ffe07a')],
    [lin('#ee6a8e'), lin('#ffb8ca')],
    [lin('#f08aa8'), lin('#ffd9e2')],
    [lin('#c81e3c'), lin('#f0607a')],
  ],
  bloom: ['#ffe9ee', '#ffd0dc', '#fff6f2', '#f7b4c8', '#ffe0e6'].map(lin),
  heart: lin('#e9b93a'),
  petal: ['#ffd6df', '#ffe8ec', '#f9bccd', '#fff3f1'].map(lin),
}

const turf = new Bag('turf')
const water = new Bag('water')
const tally = {}

const ch = C.chimney
const stackTop = ch.top + STACK_LIFT
const prism = (a, l) => {
  const qa = Math.abs(a - ch.across) - ch.half
  const ql = Math.abs(l - ch.along) - ch.halfAlong
  return Math.hypot(Math.max(qa, 0), Math.max(ql, 0)) + Math.min(Math.max(qa, ql), 0)
}
const slopeOf = (sd, a, h) => [sd * a * cp - (h - ridgeY) * sp, sd * a * sp + (h - ridgeY) * cp]

const MOSS = { ridgeMm: 0.7, ridgeReach: 2.6, patchMm: 0.46, eaveMm: 0.36, eaveFrom: 2.4, courseMm: 1.55, jointMm: 0.13, floor: 0.09, collarMm: 0.5, cell: 0.2 }
function mossDepth(sd, s, l) {
  const ridge = 1 - smooth(0.25, MOSS.ridgeReach + 1.3 * noise(l * 0.37, sd * 2.1, 3.3), s)
  const patch = smooth(0.0, 0.34, fbm(s * 0.36 + 7.3 * sd, l * 0.36, 1.7, 3) - 0.2 + 0.2 * ridge)
  const eave = smooth(SLOPE - MOSS.eaveFrom, SLOPE - 0.2, s) * smooth(-0.25, 0.3, noise(l * 0.62, sd * 4.1, 8.8))
  const course = Math.abs(((s / MOSS.courseMm) % 1) - 0.5) * 2
  const joint = smooth(0.72, 0.98, course) * smooth(-0.2, 0.35, noise(s * 0.9, l * 0.9, 12.4 + sd))
  const body = MOSS.ridgeMm * ridge * (0.72 + 0.5 * noise(l * 0.8, s * 0.8, sd * 1.9)) + MOSS.patchMm * patch * (0.7 + 0.5 * noise(s * 1.4, l * 1.4, 5.5)) + MOSS.eaveMm * eave + MOSS.jointMm * joint
  return body - MOSS.floor
}
function mossField(a, h, l) {
  let d = 1e9
  for (const sd of [-1, 1]) {
    const [s, lift] = slopeOf(sd, a, h)
    const th = mossDepth(sd, Math.max(s, 0), l)
    const slab = Math.max(lift - th, -0.4 - lift, s - (SLOPE + 0.18), Math.abs(l) - (roofLen + 0.14), -s - 0.7)
    d = smin(d, slab, 0.22)
  }
  const pr = prism(a, l)
  const liftL = slopeOf(-1, a, h)[1]
  const liftR = slopeOf(1, a, h)[1]
  const collar = Math.max(pr - 0.55 - 0.25 * noise(a * 1.3, l * 1.3, 2.2), Math.max(liftL, liftR) - MOSS.collarMm * (1 - smooth(0, 0.9, pr)) - 0.05)
  d = smin(d, collar, 0.3)
  return d + 0.06 * fbm(a * 2.4, h * 2.4, l * 2.4, 2)
}
const overDeck = (a, h, l) => {
  if (prism(a, l) < -0.06 && h < stackTop + 0.2) return false
  const liftL = slopeOf(-1, a, h)[1]
  const liftR = slopeOf(1, a, h)[1]
  return Math.max(liftL, liftR) > 0.015
}
{
  const before = turf.triangles
  const min = [-(C.halfWidth + C.overhang + 0.8), ridgeY - (SLOPE + 0.6) * sp - 0.6, -(roofLen + 0.6)]
  const max = [C.halfWidth + C.overhang + 0.8, ridgeY + 1.6, roofLen + 0.6]
  const g = netGeometry(mossField, min, max, MOSS.cell, overDeck)
  turf.add(g, {
    matrix: cottageM,
    color: (p) => {
      const q = local(p[0], p[1], p[2])
      const sd = q.x < 0 ? -1 : 1
      const [s, lift] = slopeOf(sd, q.x, q.y)
      const k = clamp(lift / 0.55)
      const hue = 0.5 + 0.5 * noise(q.x * 0.9, q.y * 0.9, q.z * 0.9)
      return mul3(mix3(mix3(TONE.mossDeep, TONE.moss, k), TONE.sun, 0.45 * k * hue), 0.8 + 0.3 * noise(s * 3.1, q.z * 3.1, 4.4))
    },
    surf: [1, 0],
  })
  tally.moss = turf.triangles - before
}

const fenceShapes = L.shapes.filter((s) => s.role === 'fence')
const pathShapes = L.shapes.filter((s) => s.role === 'path')
const fposts = fenceShapes.filter((s) => s.half[2] < 2).map((s) => [s.centre[0], s.centre[2]])
const lampAt = [L.lamppost.x, L.lamppost.z]
const shrubList = RF.shrubs()
function wallGap(x, z) {
  const p = local(x, 0, z)
  const qa = Math.abs(p.x) - C.halfWidth
  const ql = Math.abs(p.z) - C.halfLength
  return Math.hypot(Math.max(qa, 0), Math.max(ql, 0)) + Math.min(Math.max(qa, ql), 0)
}
const stoneGap = (x, z) => {
  let d = 1e9
  for (const s of pathShapes) d = Math.min(d, Math.hypot(x - s.centre[0], z - s.centre[2]) - Math.max(s.half[0], s.half[2]) * 0.9)
  return d
}
const treeGap = (x, z) => Math.hypot(x - L.tree.x, z - L.tree.z)

const GROUND = { lumpMm: 0.34, fineMm: 0.12, tuftMm: 0.07, shoreFrom: 0.93, shoreTo: 1.035, underMm: 0.5, rimMm: 0.9, rimReach: 7 }
const edgeOf = (x, z) => Math.sqrt(Math.max(0, (L.innerRadiusMm - 0.6) ** 2 - L.moundAt(z) ** 2)) - Math.hypot(x, z)
function grassAt(x, z) {
  const pf = L.pondField(x, z)
  const lip = smooth(GROUND.shoreFrom, GROUND.shoreTo, pf)
  let extra = GROUND.lumpMm * fbm(x * 0.17, z * 0.17, 3.3, 3) + GROUND.fineMm * fbm(x * 0.62, z * 0.62, 9.1, 2) + GROUND.tuftMm * fbm(x * 2.1, z * 2.1, 5.7, 2)
  extra += 0.22 * Math.exp(-Math.max(wallGap(x, z), 0) / 1.2)
  extra += 0.3 * Math.exp(-Math.max(0, treeGap(x, z) - 3) / 2.2)
  for (const s of pathShapes) extra -= 0.12 * Math.exp(-((x - s.centre[0]) ** 2 + (z - s.centre[2]) ** 2) / 5)
  const bank = 0.4 * smooth(0.99, 1.05, pf) * (1 - smooth(1.08, 1.3, pf)) * (0.6 + 0.8 * noise(x * 0.4, z * 0.4, 7.7))
  return L.moundAt(z) - (L.pond.level + GROUND.underMm) * (1 - lip) + (extra + bank) * lip
}
const rimLift = (x, z) => {
  const e = edgeOf(x, z)
  const near = 1 - smooth(0, GROUND.rimReach, e)
  return GROUND.rimMm * near * (0.45 + 0.9 * clamp(0.5 + fbm(x * 0.21 + 2.2, z * 0.21 + 8.1, 1.1, 3)))
}
const topAt = (x, z) => grassAt(x, z) + rimLift(x, z)
function contact(x, z) {
  let k = 1
  k *= 1 - 0.4 * Math.exp(-Math.max(wallGap(x, z), 0) / 1.2)
  k *= 1 - 0.3 * Math.exp(-Math.hypot(x - lampAt[0], z - lampAt[1]) / 0.8)
  for (const f of fposts) k *= 1 - 0.28 * Math.exp(-Math.hypot(x - f[0], z - f[1]) / 0.8)
  for (const sh of shrubList) k *= 1 - 0.34 * Math.exp(-Math.max(0, Math.hypot(x - sh.centre[0], z - sh.centre[2]) - 1.5) / 0.9)
  k *= 1 - 0.22 * Math.exp(-Math.max(0, stoneGap(x, z)) / 0.5)
  k *= 1 - 0.34 * Math.exp(-Math.max(0, treeGap(x, z) - 3.2) / 1.6)
  return k
}
function grassTone(x, z) {
  const broad = fbm(x * 0.075 + 3.1, z * 0.075 + 1.4, 2.2, 3)
  const mid = fbm(x * 0.36, z * 0.36, 6.3, 2)
  const pf = L.pondField(x, z)
  const e = edgeOf(x, z)
  let c = mix3(TONE.deep, TONE.grass, clamp(0.55 + 1.1 * broad + 0.5 * mid))
  c = mix3(c, TONE.sun, clamp(0.25 + 1.2 * broad + 0.9 * mid) * 0.7)
  c = mix3(c, TONE.moss, 0.6 * (1 - smooth(1.5, 9, e)))
  c = mix3(c, TONE.mossDeep, 0.55 * (1 - smooth(0.2, 4, e)) * clamp(0.6 + noise(x * 0.5, z * 0.5, 2.9)))
  c = mix3(c, TONE.wet, 0.8 * (1 - smooth(0.985, 1.045, pf)))
  c = mix3(c, TONE.earth, 0.35 * smooth(0.25, 0.6, fbm(x * 0.9, z * 0.9, 12.2, 2)) * (1 - smooth(0, 1.2, stoneGap(x, z))))
  return mul3(c, contact(x, z))
}

const SKIRT = { cycles: 6.5, deepMm: 2.8, clumps: 17, clumpMm: 0.85 }
{
  const before = turf.triangles
  const around = 400
  const shore = [0.9, 0.93, 0.95, 0.962, 0.972, 0.981, 0.99, 1.0, 1.012, 1.028, 1.05, 1.08]
  const outer = 32
  const skirt = 18
  const r = L.innerRadiusMm - 0.6
  const footY = L.collarY - 1.5
  const pc = Math.cos(L.pond.yaw)
  const ps = Math.sin(L.pond.yaw)
  const pos = []
  const idx = []
  const depth = []
  const rows = shore.length + outer + skirt
  for (let j = 0; j <= around; j++) {
    const a = (j / around) * Math.PI * 2
    const dx = Math.cos(a) * pc + Math.sin(a) * ps
    const dz = -Math.cos(a) * ps + Math.sin(a) * pc
    const unit = L.pondField(L.pond.x + dx, L.pond.z + dz)
    const inside = (t) => {
      const x = L.pond.x + dx * t
      const z = L.pond.z + dz * t
      const y = L.moundAt(z) + 0.5
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
      let q = 0
      if (k < shore.length) {
        const t = Math.min(shore[k] / unit, t1 * (0.9 + 0.1 * (k / (shore.length - 1))))
        x = L.pond.x + dx * t
        z = L.pond.z + dz * t
        y = topAt(x, z)
      } else if (k < shore.length + outer) {
        const f = (k - shore.length + 1) / outer
        const t = t1 + (edge - t1) * Math.pow(f, 1.15)
        x = L.pond.x + dx * t
        z = L.pond.z + dz * t
        y = topAt(x, z)
        if (f === 1) {
          const l = Math.hypot(x, y, z)
          x *= (r - 0.15) / l
          y *= (r - 0.15) / l
          z *= (r - 0.15) / l
        }
      } else {
        const ex = L.pond.x + dx * edge
        const ez = L.pond.z + dz * edge
        const ey = topAt(ex, ez)
        const th = Math.atan2(ez, ex)
        const phi0 = Math.atan2(Math.hypot(ex, ez), -ey)
        const phi1 = Math.acos(clamp(-footY / r, -1, 1))
        q = (k - shore.length - outer + 1) / skirt
        const phi = phi0 + (Math.min(phi1, phi0 - 0.12) - phi0) * q
        const ux = Math.cos(th) * Math.sin(phi)
        const uy = -Math.cos(phi)
        const uz = Math.sin(th) * Math.sin(phi)
        const wx = ux * 0.81 + uy * 0.45 - uz * 0.37
        const wy = -ux * 0.31 + uy * 0.86 + uz * 0.4
        const wz = ux * 0.5 - uy * 0.24 + uz * 0.83
        const warp = [fbm(wx * 9.3 + 1.7, wy * 9.3, wz * 9.3, 2), fbm(wx * 9.3, wy * 9.3 + 4.4, wz * 9.3 + 2.1, 2), fbm(wx * 9.3 + 8.8, wy * 9.3 + 3.2, wz * 9.3, 2)]
        const lump = clamp(0.5 + 0.75 * fbm(wx * SKIRT.cycles + 3.1 + 0.5 * warp[0], wy * SKIRT.cycles + 0.5 * warp[1], wz * SKIRT.cycles + 7.7 + 0.5 * warp[2], 4))
        const clump = clamp(0.5 + 0.8 * fbm(wx * SKIRT.clumps + 1.3 + 0.9 * warp[1], wy * SKIRT.clumps + 5.9 + 0.9 * warp[2], wz * SKIRT.clumps + 2.2 + 0.9 * warp[0], 4))
        const rr = r - 0.15 - SKIRT.deepMm * Math.pow(lump, 1.5) * smooth(0.06, 0.5, q) - SKIRT.clumpMm * clump * clump * smooth(0.0, 0.2, q)
        x = ux * rr
        y = uy * rr
        z = uz * rr
      }
      pos.push(x, y, z)
      depth.push(q)
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
  const P = g.getAttribute('position')
  const NN = g.getAttribute('normal')
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
  turf.add(g, {
    color: (p, n, i) => {
      const q = depth[i]
      if (q <= 0) return grassTone(p[0], p[2])
      const top = mix3(TONE.grass, TONE.moss, clamp(0.5 + noise(p[0] * 0.45, p[1] * 0.45, p[2] * 0.45)))
      const patch = smooth(-0.1, 0.35, fbm(p[0] * 0.3, p[1] * 0.3, p[2] * 0.3, 3))
      return mul3(mix3(mix3(top, TONE.mossDeep, smooth(0.3, 0.85, q) * (1 - 0.7 * patch)), TONE.sun, 0.6 * patch * (1 - 0.7 * q) * smooth(-0.5, 0.4, n[1])), (1 - 0.25 * smooth(0.4, 1, q)) * (1.25 + 0.6 * smooth(-0.3, 0.6, n[1])))
    },
    surf: (_p, _n, i) => [depth[i] > 0 ? 2 : 0, depth[i]],
  })
  tally.ground = turf.triangles - before
}

const BOULDERS = [
  [148, 1.07, 2.5], [163, 1.06, 1.9], [178, 1.08, 2.7], [196, 1.06, 2.1], [213, 1.08, 2.4], [229, 1.05, 1.7],
  [322, 1.07, 2.2], [341, 1.05, 1.6], [12, 1.07, 2.4], [31, 1.05, 1.5], [96, 1.06, 1.4], [121, 1.05, 1.8],
]
const boulders = []
{
  const before = turf.triangles
  const tones = ['#b3aaa0', '#c4bbb0', '#9d958d', '#b8ab9e'].map(lin)
  for (const [deg, f, size] of BOULDERS) {
    const a = (deg * Math.PI) / 180
    let t = 6
    while (t < 40 && L.pondField(L.pond.x + Math.cos(a) * t, L.pond.z + Math.sin(a) * t) < f) t += 0.05
    const x = L.pond.x + Math.cos(a) * t
    const z = L.pond.z + Math.sin(a) * t
    if (edgeOf(x, z) < 2.2) continue
    const rx = size * (0.9 + 0.3 * R())
    const rz = size * (0.7 + 0.25 * R())
    const ry = size * (0.5 + 0.16 * R())
    const yaw = R() * Math.PI
    const y = topAt(x, z) + ry * 0.28
    const seed = R() * 50
    const g = new THREE.IcosahedronGeometry(1, 4)
    g.deleteAttribute('normal')
    g.deleteAttribute('uv')
    const P = g.getAttribute('position')
    for (let i = 0; i < P.count; i++) {
      const q = [P.getX(i), P.getY(i), P.getZ(i)]
      const lump = 1 + 0.2 * fbm(q[0] * 1.3 + seed, q[1] * 1.3, q[2] * 1.3 + seed, 3) + 0.05 * fbm(q[0] * 5 + seed, q[1] * 5, q[2] * 5, 2)
      const flat = q[1] > 0 ? 1 - 0.18 * q[1] * q[1] : 1
      const lx = q[0] * rx * lump
      const lz = q[2] * rz * lump
      P.setXYZ(i, x + lx * Math.cos(yaw) - lz * Math.sin(yaw), y + q[1] * ry * lump * flat, z + lx * Math.sin(yaw) + lz * Math.cos(yaw))
    }
    const tone = tones[Math.floor(R() * tones.length)]
    turf.add(g, {
      renormal: true,
      color: (p, n) => {
        const up = n[1] + 0.5 * fbm(p[0] * 0.9 + seed, p[1] * 0.9, p[2] * 0.9, 3)
        const moss = smooth(0.7, 1.15, up)
        const low = smooth(0.9, 0.0, (p[1] - (y - ry * 0.28)) / ry)
        const stone = mul3(tone, (0.62 + 0.5 * clamp(0.5 + fbm(p[0] * 2.2, p[1] * 2.2 + seed, p[2] * 2.2, 2))) * (1 - 0.35 * low))
        return mix3(stone, mix3(TONE.mossDeep, TONE.moss, clamp(0.5 + noise(p[0] * 1.7, p[1] * 1.7, p[2] * 1.7))), 0.7 * moss)
      },
      surf: [3, 0],
    })
    boulders.push([Number(x.toFixed(2)), Number(y.toFixed(2)), Number(z.toFixed(2)), Number((Math.min(rx, rz) * 0.9).toFixed(2)), Number(ry.toFixed(2))])
  }
  tally.boulders = turf.triangles - before
}
const boulderGap = (x, z) => boulders.reduce((m, b) => Math.min(m, Math.hypot(x - b[0], z - b[2]) - b[3]), 1e9)

const MOUNDS = { count: 110, sizeMm: [1.2, 3.3], seed: 9133 }
{
  const before = turf.triangles
  const RM = rng(MOUNDS.seed)
  let made = 0
  let tries = 0
  while (made < MOUNDS.count && tries < MOUNDS.count * 14) {
    tries++
    const a = RM() * Math.PI * 2
    const size = MOUNDS.sizeMm[0] + (MOUNDS.sizeMm[1] - MOUNDS.sizeMm[0]) * RM() ** 1.6
    const inset = size * 0.8 + 0.2 + 1.6 * RM() * RM()
    const back = RM()
    if (Math.sin(a) < -0.1 && back < 0.8) continue
    let rr = 20
    while (rr < 70 && edgeOf(Math.cos(a) * (rr + 0.1), Math.sin(a) * (rr + 0.1)) > inset) rr += 0.1
    const x = Math.cos(a) * rr
    const z = Math.sin(a) * rr
    if (edgeOf(x, z) < size * 0.7) continue
    if (L.pondField(x, z) < 1.1 || stoneGap(x, z) < size + 0.4 || wallGap(x, z) < size + 0.6 || treeGap(x, z) < size + 4.5 || boulderGap(x, z) < size * 0.5) continue
    if (fposts.some((f) => Math.hypot(x - f[0], z - f[1]) < size + 0.7)) continue
    const rx = size * (0.95 + 0.35 * RM())
    const rz = size * (0.7 + 0.25 * RM())
    const ry = size * (0.46 + 0.16 * RM())
    const yaw = a + Math.PI / 2 + (RM() - 0.5) * 0.9
    const y = topAt(x, z) - ry * 0.3
    const seed = RM() * 50
    const g = new THREE.IcosahedronGeometry(1, size > 1.5 ? 2 : 1)
    g.deleteAttribute('normal')
    g.deleteAttribute('uv')
    const P = g.getAttribute('position')
    for (let i = 0; i < P.count; i++) {
      const q = [P.getX(i), P.getY(i), P.getZ(i)]
      const lump = 1 + 0.22 * fbm(q[0] * 1.5 + seed, q[1] * 1.5, q[2] * 1.5 + seed, 3) + 0.07 * fbm(q[0] * 5.5 + seed, q[1] * 5.5, q[2] * 5.5, 2)
      const lx = q[0] * rx * lump
      const lz = q[2] * rz * lump
      P.setXYZ(i, x + lx * Math.cos(yaw) - lz * Math.sin(yaw), y + q[1] * ry * lump, z + lx * Math.sin(yaw) + lz * Math.cos(yaw))
    }
    const warm = RM()
    turf.add(mergeVertices(g, 1e-4), {
      renormal: true,
      color: (p, n) => {
        const patch = clamp(0.5 + fbm(p[0] * 1.3 + seed, p[1] * 1.3, p[2] * 1.3, 2))
        const top = mix3(TONE.moss, TONE.sun, 0.25 + 0.5 * patch * warm)
        const low = smooth(0.75, 0.0, (p[1] - (y - ry * 0.3)) / ry)
        return mul3(mix3(top, TONE.mossDeep, 0.75 * smooth(0.55, -0.35, n[1])), (1 - 0.45 * low) * (0.85 + 0.35 * patch))
      },
      surf: [0, 0],
    })
    made++
  }
  tally.mounds = turf.triangles - before
}

{
  const rings = [0, 0.14, 0.28, 0.42, 0.55, 0.66, 0.76, 0.85, 0.92, 0.965, 0.995]
  const around = 120
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
  const nrm = g.getAttribute('normal')
  for (let i = 0; i < nrm.count; i++) if (Math.hypot(nrm.getX(i), nrm.getY(i), nrm.getZ(i)) < 0.5) nrm.setXYZ(i, nrm.getX(0), nrm.getY(0), nrm.getZ(0))
  let vi = 0
  water.add(g, { keepUv: true, color: [1, 1, 1], surf: () => [st[2 * vi++], 0] })
}

class Sprigs {
  constructor() {
    this.p = []
    this.n = []
    this.c = []
    this.s = []
    this.keep = []
    this.rank = 0
  }
  tri(a, b, c, n, ca, cb, cc, kind, thin = 0.5) {
    this.keep.push(this.rank)
    const corners = [[a, ca], [b, cb], [c, cc]]
    for (let k = 0; k < 3; k++) {
      const [q, col] = corners[k]
      this.p.push(q[0], q[1], q[2])
      const m = Array.isArray(n[0]) ? n[k] : n
      this.n.push(m[0], m[1], m[2])
      this.c.push(col[0], col[1], col[2])
      this.s.push(kind, thin)
    }
  }
  get triangles() {
    return this.p.length / 9
  }
  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3))
    g.setAttribute('uv1', new THREE.Float32BufferAttribute(this.s, 2))
    const merged = mergeVertices(g, 1e-5)
    const index = merged.index.array
    if (index.length !== this.keep.length * 3) throw new Error('the merged growth lost triangles')
    const list = (most) => {
      const out = []
      for (let t = 0; t < this.keep.length; t++) if (this.keep[t] < most) out.push(index[3 * t], index[3 * t + 1], index[3 * t + 2])
      return out
    }
    this.lists = { medium: list(LEVEL.medium), low: list(LEVEL.low) }
    return merged
  }
}
const LEVEL = { medium: 0.5, low: 0.25 }
const growth = new Sprigs()
const KIND_OF = { blade: 0, leaf: 1, petal: 2 }
const pick = (list) => list[Math.floor(R() * list.length)]
const groundNormal = (x, z) => {
  const e = 0.3
  return norm3([topAt(x - e, z) - topAt(x + e, z), 2 * e, topAt(x, z - e) - topAt(x, z + e)])
}

function blade(foot, lean, len, wide, n, c0, c1, c2, thin = 0.7) {
  const side = norm3(cross(lean, [0.31, 0.9, 0.17]))
  const mid = add3(add3(foot, sc(lean, len * 0.55)), [0, len * 0.12, 0])
  const tip = add3(add3(foot, sc(lean, len)), [0, -len * 0.08, 0])
  const a = add3(foot, sc(side, wide))
  const b = add3(foot, sc(side, -wide))
  const ma = add3(mid, sc(side, wide * 0.7))
  const mb = add3(mid, sc(side, -wide * 0.7))
  growth.tri(a, b, mb, n, c0, c0, c1, KIND_OF.blade, thin)
  growth.tri(a, mb, ma, n, c0, c1, c1, KIND_OF.blade, thin)
  growth.tri(ma, mb, tip, n, c1, c1, c2, KIND_OF.blade, thin)
}

const BLADES = { tufts: 5900, perTuft: [3, 6], lenMm: [0.5, 1.05], tallMm: 1.15, wideMm: 0.095 }
{
  const before = growth.triangles
  const reach = Math.sqrt((L.innerRadiusMm - 0.6) ** 2 - L.groundY ** 2) + 2
  let made = 0
  let tries = 0
  while (made < BLADES.tufts && tries < BLADES.tufts * 6) {
    tries++
    const a = R() * Math.PI * 2
    const rr = Math.sqrt(R()) * reach
    const x = Math.cos(a) * rr
    const z = Math.sin(a) * rr
    const e = edgeOf(x, z)
    if (e < 0.5) continue
    if (z < -8 && R() < 0.75) continue
    const pf = L.pondField(x, z)
    if (pf < 1.0) continue
    if (wallGap(x, z) < 0.15) continue
    const sg = stoneGap(x, z)
    if (sg < 0.3) continue
    if (boulderGap(x, z) < 0.1) continue
    if (sg < 1.6 && R() < 0.6) continue
    const tg = treeGap(x, z)
    if (tg < 2.6) continue
    const tall =
      0.3 * Math.exp(-Math.max(0, sg - 0.3) / 0.4) +
      0.8 * Math.exp(-Math.max(0, wallGap(x, z)) / 0.9) +
      Math.exp(-Math.abs(pf - 1.03) / 0.03) * 0.9 +
      0.7 * Math.exp(-Math.max(0, tg - 3) / 1.3) +
      fposts.reduce((m, f) => Math.max(m, Math.exp(-Math.hypot(x - f[0], z - f[1]) / 0.8)), 0) +
      0.8 * Math.exp(-Math.hypot(x - lampAt[0], z - lampAt[1]) / 0.9)
    const clump = smooth(-0.15, 0.3, fbm(x * 0.33, z * 0.33, 8.2, 2))
    if (R() > 0.3 + 0.7 * Math.max(clump, Math.min(1, tall))) continue
    const y = topAt(x, z)
    const gn = groundNormal(x, z)
    const base = grassTone(x, z)
    const count = Math.round(BLADES.perTuft[0] + R() * (BLADES.perTuft[1] - BLADES.perTuft[0]))
    const grow = 1 + BLADES.tallMm * Math.min(1, tall) * (0.5 + R())
    for (let i = 0; i < count; i++) {
      const th = R() * Math.PI * 2
      const out = 0.12 + 0.5 * R()
      const lean = norm3([Math.cos(th) * out + gn[0] * 0.5, 1, Math.sin(th) * out + gn[2] * 0.5])
      const len = (BLADES.lenMm[0] + R() * (BLADES.lenMm[1] - BLADES.lenMm[0])) * grow
      const foot = [x + Math.cos(th) * 0.12 * R(), y - 0.05, z + Math.sin(th) * 0.12 * R()]
      const k = 0.8 + 0.45 * R()
      const n = norm3([gn[0] + lean[0] * 0.35, gn[1] + 0.4, gn[2] + lean[2] * 0.35])
      growth.rank = ((made * 7 + i * 5) % 16) / 16
      blade(foot, lean, len, BLADES.wideMm * (0.7 + 0.6 * R()), n, mul3(mix3(base, TONE.bladeFoot, 0.5), 0.8), mul3(mix3(base, TONE.blade, 0.6), k), mul3(mix3(base, TONE.bladeTip, 0.7), k * 1.1))
    }
    made++
  }
  growth.rank = 0
  tally.blades = growth.triangles - before
}

function leafCard(p, tip, sideV, len, w, n, tone, kind, thin) {
  const mid = add3(p, sc(tip, len * 0.45))
  const b = add3(mid, sc(sideV, w))
  const c = add3(p, sc(tip, len))
  const d = add3(mid, sc(sideV, -w))
  growth.tri(p, b, c, n, mul3(tone, 0.6), mul3(tone, 0.95), mul3(tone, 1.2), kind, thin)
  growth.tri(p, c, d, n, mul3(tone, 0.6), mul3(tone, 1.2), mul3(tone, 0.95), kind, thin)
}

function flower(at, out, size, tone, heart) {
  const ref = Math.abs(out[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]
  const u = norm3(cross(out, ref))
  const v = cross(out, u)
  const spin = R() * Math.PI * 2
  for (let k = 0; k < 5; k++) {
    const a0 = spin + (k / 5) * Math.PI * 2
    const dir = add3(sc(u, Math.cos(a0)), sc(v, Math.sin(a0)))
    const sideV = add3(sc(u, -Math.sin(a0)), sc(v, Math.cos(a0)))
    const tipP = add3(add3(at, sc(dir, size)), sc(out, size * 0.22))
    const mid = add3(add3(at, sc(dir, size * 0.55)), sc(out, size * 0.12))
    const n = norm3(add3(out, sc(dir, 0.35)))
    growth.tri(at, add3(mid, sc(sideV, size * 0.36)), tipP, n, heart, tone, tone, KIND_OF.petal, 0.8)
    growth.tri(at, tipP, add3(mid, sc(sideV, -size * 0.36)), n, heart, tone, tone, KIND_OF.petal, 0.8)
  }
}

const SHRUB = { leaves: 1500, blooms: 150, ivyBlooms: 0 }
{
  const before = growth.triangles
  for (const sh of shrubList) {
    const ivy = RF.isIvy(sh.r)
    const centre = sh.centre
    const leaves = ivy ? Math.round(70 * sh.r[1] * (sh.r[0] + sh.r[2])) : SHRUB.leaves
    const place = () => {
      const u = R() * 2 - 0.25
      const yy = ivy ? 0.75 * u - 0.3125 : clamp(u, -0.25, 1)
      const a = ivy ? RF.wallOutward() + (R() - 0.5) * Math.PI * 1.2 : R() * Math.PI * 2
      const rr = Math.sqrt(Math.max(0, 1 - yy * yy))
      return [Math.cos(a) * rr, yy, Math.sin(a) * rr]
    }
    for (let i = 0; i < leaves; i++) {
      const d = place()
      const k = 0.92 + 0.22 * R()
      const p = [centre[0] + d[0] * sh.r[0] * k, centre[1] + d[1] * sh.r[1] * k, centre[2] + d[2] * sh.r[2] * k]
      const tip = norm3([d[0] + (R() - 0.5) * 0.9, d[1] * 0.6 + 0.45 + (R() - 0.5) * 0.6, d[2] + (R() - 0.5) * 0.9])
      const sideV = norm3([tip[1] * d[2] - tip[2] * d[1] + (R() - 0.5) * 0.4, tip[2] * d[0] - tip[0] * d[2], tip[0] * d[1] - tip[1] * d[0] + (R() - 0.5) * 0.4])
      const tone = mul3(pick(ivy ? TONE.ivy : TONE.shrub), (0.7 + 0.6 * R()) * (0.55 + 0.45 * smooth(-0.3, 0.7, d[1])))
      growth.rank = ((i * 11) % 16) / 24
      leafCard(p, tip, sideV, 0.34 + 0.26 * R(), 0.11 + 0.07 * R(), norm3(add3(sc(d, 0.75), [0, 0.35, 0])), tone, KIND_OF.leaf, 0.6)
    }
    growth.rank = 0
    const blooms = ivy ? SHRUB.ivyBlooms : SHRUB.blooms
    for (let i = 0; i < blooms; i++) {
      const d = place()
      if (d[1] < -0.05) continue
      const k = 1.08 + 0.12 * R()
      const p = [centre[0] + d[0] * sh.r[0] * k, centre[1] + d[1] * sh.r[1] * k, centre[2] + d[2] * sh.r[2] * k]
      flower(p, norm3([d[0], d[1] + 0.3, d[2]]), 0.2 + 0.1 * R(), mul3(pick(TONE.bloom), 0.9 + 0.2 * R()), TONE.heart)
    }
  }
  tally.shrubs = growth.triangles - before
}

function tulip(x, z, tall, hue, turn) {
  const y0 = topAt(x, z) - 0.1
  const bend = [Math.cos(turn) * 0.22, Math.sin(turn) * 0.22]
  const at = (t) => [x + bend[0] * tall * t * t, y0 + tall * t, z + bend[1] * tall * t * t]
  const seg = 5
  const rad = 0.085
  for (let i = 0; i < seg; i++) {
    const p0 = at(i / seg)
    const p1 = at((i + 1) / seg)
    for (let k = 0; k < 3; k++) {
      const a0 = (k / 3) * Math.PI * 2
      const a1 = ((k + 1) / 3) * Math.PI * 2
      const o0 = [Math.cos(a0) * rad, 0, Math.sin(a0) * rad]
      const o1 = [Math.cos(a1) * rad, 0, Math.sin(a1) * rad]
      const n = norm3([Math.cos((a0 + a1) / 2), 0.2, Math.sin((a0 + a1) / 2)])
      const c0 = mul3(TONE.stem, 0.6 + 0.5 * (i / seg))
      const c1 = mul3(TONE.stem, 0.6 + 0.5 * ((i + 1) / seg))
      growth.tri(add3(p0, o0), add3(p0, o1), add3(p1, o1), n, c0, c0, c1, KIND_OF.leaf, 0.2)
      growth.tri(add3(p0, o0), add3(p1, o1), add3(p1, o0), n, c0, c1, c1, KIND_OF.leaf, 0.2)
    }
  }
  const leaves = 2 + (R() < 0.5 ? 1 : 0)
  for (let i = 0; i < leaves; i++) {
    const th = turn + 1.2 + (i / leaves) * Math.PI * 2 + (R() - 0.5) * 0.8
    const len = tall * (0.62 + 0.3 * R())
    const out = [Math.cos(th), 0, Math.sin(th)]
    const sideV = [-Math.sin(th), 0, Math.cos(th)]
    const steps = 5
    const w = 0.26 + 0.1 * R()
    const flop = 0.35 + 0.3 * R()
    const spine = (t) => [x + out[0] * len * flop * t * t, y0 + len * (t - 0.28 * t * t), z + out[2] * len * flop * t * t]
    const wide = (t) => w * Math.sin(Math.PI * Math.pow(t, 0.7)) + 0.02
    const tone = mul3(mix3(TONE.leaf, TONE.leafPale, R() * 0.6), 0.85 + 0.3 * R())
    for (let k = 0; k < steps; k++) {
      const t0 = k / steps
      const t1 = (k + 1) / steps
      const p0 = spine(t0)
      const p1 = spine(t1)
      const cup = sc(out, -0.06)
      const a0 = add3(add3(p0, sc(sideV, wide(t0))), cup)
      const b0 = add3(add3(p0, sc(sideV, -wide(t0))), cup)
      const a1 = add3(add3(p1, sc(sideV, wide(t1))), cup)
      const b1 = add3(add3(p1, sc(sideV, -wide(t1))), cup)
      const n = norm3([out[0] * (0.9 - t0 * 0.6), 0.35 + t0 * 0.6, out[2] * (0.9 - t0 * 0.6)])
      const c0 = mul3(tone, 0.55 + 0.6 * t0)
      const c1 = mul3(tone, 0.55 + 0.6 * t1)
      growth.tri(a0, p0, p1, n, c0, mul3(c0, 0.8), mul3(c1, 0.8), KIND_OF.leaf, 0.5)
      growth.tri(a0, p1, a1, n, c0, mul3(c1, 0.8), c1, KIND_OF.leaf, 0.5)
      growth.tri(p0, b0, b1, n, mul3(c0, 0.8), c0, c1, KIND_OF.leaf, 0.5)
      growth.tri(p0, b1, p1, n, mul3(c0, 0.8), c1, mul3(c1, 0.8), KIND_OF.leaf, 0.5)
    }
  }
  const top = at(1)
  const cupH = 2.0 + 0.6 * R()
  const cupR = 1.02 + 0.22 * R()
  const open = 0.72 + 0.3 * R()
  const [deep, pale] = TONE.tulips[hue]
  const tilt = norm3([bend[0] * 2, 1, bend[1] * 2])
  const ref = norm3(cross(tilt, [0.2, 0.1, 1]))
  const ref2 = cross(tilt, ref)
  const petals = 6
  const rows = 5
  const cols = 4
  for (let k = 0; k < petals; k++) {
    const mid = (k / petals) * Math.PI * 2 + (k % 2) * 0.12
    const inner = k % 2 === 1
    const span = (Math.PI * 2) / petals * 0.78
    const shape = (u, v) => {
      const a = mid + (u - 0.5) * span * (1 - 0.9 * Math.pow(v, 2.4))
      const belly = Math.sin(Math.PI * Math.pow(v, 0.62)) * 0.95 + 0.1 * v
      const rr = cupR * (inner ? 0.86 : 1) * (0.16 + belly * (0.6 + 0.4 * open * v)) * (1 - 0.1 * Math.abs(u - 0.5))
      const h = cupH * (v * (inner ? 0.94 : 1) - 0.06 * Math.abs(u - 0.5) * v)
      const dir = add3(sc(ref, Math.cos(a)), sc(ref2, Math.sin(a)))
      return { p: add3(add3(top, sc(tilt, h - 0.05)), sc(dir, rr)), n: norm3(add3(dir, sc(tilt, 0.25 - 0.5 * v))) }
    }
    const tone = (v, u) => mul3(mix3(mix3(pale, deep, smooth(0.0, 0.55, v)), pale, 0.35 * smooth(0.7, 1, v)), (inner ? 0.9 : 1) * (0.97 + 0.06 * Math.abs(u - 0.5)) * (0.66 + 0.46 * v))
    for (let j = 0; j < rows; j++) {
      const v0 = j / rows
      const v1 = (j + 1) / rows
      for (let i = 0; i < cols; i++) {
        const u0 = i / cols
        const u1 = (i + 1) / cols
        const A = shape(u0, v0)
        const B = shape(u1, v0)
        const Cc = shape(u1, v1)
        const D = shape(u0, v1)
        growth.tri(A.p, B.p, Cc.p, [A.n, B.n, Cc.n], tone(v0, u0), tone(v0, u1), tone(v1, u1), KIND_OF.petal, 0.8)
        growth.tri(A.p, Cc.p, D.p, [A.n, Cc.n, D.n], tone(v0, u0), tone(v1, u1), tone(v1, u0), KIND_OF.petal, 0.8)
      }
    }
  }
}

const fenceMid = [(L.fence.from[0] + L.fence.to[0]) / 2, (L.fence.from[1] + L.fence.to[1]) / 2]
const fenceDir = norm3([L.fence.to[0] - L.fence.from[0], 0, L.fence.to[1] - L.fence.from[1]])
const fenceIn = [fenceDir[2], 0, -fenceDir[0]]
const TULIP_TALL = 0.64
const BEDS = [
  { at: [fenceMid[0] + fenceIn[0] * 2.4, fenceMid[1] + fenceIn[2] * 2.4], along: [fenceDir[0], fenceDir[2]], half: [6.2, 1.9], count: 17, tall: [4.4, 6.4], hues: [3, 1, 4, 0, 2, 1, 3] },
  { at: [L.tree.x + 9.2, L.tree.z + 9.6], along: [0.86, 0.5], half: [4.2, 2.2], count: 15, tall: [4.6, 6.8], hues: [4, 2, 1, 4, 3, 2] },
  { at: [L.tree.x + 15.5, L.tree.z + 4], along: [0.5, -0.86], half: [2.6, 1.6], count: 8, tall: [3.6, 5.2], hues: [4, 3, 2] },
  { at: [fenceMid[0] - fenceIn[0] * 2.2 + fenceDir[0] * 3, fenceMid[1] - fenceIn[2] * 2.2 + fenceDir[2] * 3], along: [fenceDir[0], fenceDir[2]], half: [3.4, 1.1], count: 9, tall: [3.2, 4.6], hues: [4, 2, 3] },
]
{
  const before = growth.triangles
  for (const bed of BEDS) {
    const placed = []
    let tries = 0
    while (placed.length < bed.count && tries < bed.count * 40) {
      tries++
      const u = (R() * 2 - 1) * bed.half[0]
      const v = (R() * 2 - 1) * bed.half[1]
      if ((u / bed.half[0]) ** 2 + (v / bed.half[1]) ** 2 > 1) continue
      const x = bed.at[0] + bed.along[0] * u - bed.along[1] * v
      const z = bed.at[1] + bed.along[1] * u + bed.along[0] * v
      if (edgeOf(x, z) < 2 || L.pondField(x, z) < 1.04 || wallGap(x, z) < 0.8 || stoneGap(x, z) < 0.4 || treeGap(x, z) < 4) continue
      if (placed.some((q) => Math.hypot(q[0] - x, q[1] - z) < 1.7)) continue
      placed.push([x, z])
      tulip(x, z, TULIP_TALL * (bed.tall[0] + R() * (bed.tall[1] - bed.tall[0])), bed.hues[Math.floor(R() * bed.hues.length)], R() * Math.PI * 2)
    }
  }
  tally.tulips = growth.triangles - before
}

const DAISIES = { count: 260, sizeMm: [0.3, 0.5] }
{
  const before = growth.triangles
  let made = 0
  let tries = 0
  while (made < DAISIES.count && tries < DAISIES.count * 30) {
    tries++
    const a = R() * Math.PI * 2
    const rr = Math.sqrt(R()) * 46
    const x = Math.cos(a) * rr
    const z = Math.sin(a) * rr
    if (edgeOf(x, z) < 1.5 || L.pondField(x, z) < 1.03 || wallGap(x, z) < 0.5 || stoneGap(x, z) < 0.2 || treeGap(x, z) < 3.4) continue
    if (fbm(x * 0.14 + 9.3, z * 0.14 + 2.7, 4.4, 2) < 0.02 && R() > 0.12) continue
    const y = topAt(x, z)
    const h = 0.7 + 0.7 * R()
    const lean = norm3([(R() - 0.5) * 0.5, 1, (R() - 0.5) * 0.5])
    const head = [x + lean[0] * h, y + lean[1] * h, z + lean[2] * h]
    blade([x, y - 0.05, z], lean, h, 0.035, norm3([lean[0], 1, lean[2]]), mul3(TONE.stem, 0.6), TONE.stem, TONE.stem, 0.3)
    flower(head, norm3([lean[0] + (R() - 0.5) * 0.6, 1, lean[2] + (R() - 0.5) * 0.6 + 0.35]), DAISIES.sizeMm[0] + R() * (DAISIES.sizeMm[1] - DAISIES.sizeMm[0]), mul3(pick(TONE.bloom), 0.95 + 0.15 * R()), TONE.heart)
    made++
  }
  tally.daisies = growth.triangles - before
}

const FALLEN = { ground: 420, pond: 12, sizeMm: [0.5, 0.95] }
function petalDown(x, y, z, n, size, tone, yaw) {
  const ref = norm3(cross(n, [Math.cos(yaw), 0, Math.sin(yaw)]))
  const fwd = cross(ref, n)
  const p = [x, y, z]
  const tip = add3(p, sc(fwd, size))
  const back = add3(p, sc(fwd, -size * 0.7))
  const l = add3(add3(p, sc(ref, size * 0.62)), sc(n, size * 0.14))
  const r = add3(add3(p, sc(ref, -size * 0.62)), sc(n, size * 0.14))
  growth.tri(back, r, tip, n, mul3(tone, 0.85), tone, tone, KIND_OF.petal, 0.6)
  growth.tri(back, tip, l, n, mul3(tone, 0.85), tone, tone, KIND_OF.petal, 0.6)
}
{
  const before = growth.triangles
  let made = 0
  let tries = 0
  while (made < FALLEN.ground && tries < FALLEN.ground * 30) {
    tries++
    const a = R() * Math.PI * 2
    const rr = Math.sqrt(R()) * 34
    const x = L.tree.x - 4 + Math.cos(a) * rr
    const z = L.tree.z + 9 + Math.sin(a) * rr
    if (edgeOf(x, z) < 1 || L.pondField(x, z) < 1.02 || wallGap(x, z) < 0.3 || treeGap(x, z) < 3.2) continue
    if (R() > Math.exp(-Math.max(0, treeGap(x, z) - 8) / 16)) continue
    const lift = stoneGap(x, z) < -0.25 ? 0.75 : 0.32 + 0.3 * R()
    petalDown(x, topAt(x, z) + lift, z, groundNormal(x, z), FALLEN.sizeMm[0] + R() * (FALLEN.sizeMm[1] - FALLEN.sizeMm[0]), mul3(pick(TONE.petal), 0.9 + 0.2 * R()), R() * 6.3)
    made++
  }
  made = 0
  tries = 0
  while (made < FALLEN.pond && tries < FALLEN.pond * 30) {
    tries++
    const x = L.pond.x + (R() * 2 - 1) * L.pond.rx
    const z = L.pond.z + (R() * 2 - 1) * L.pond.rz
    if (L.pondField(x, z) > 0.9) continue
    petalDown(x, L.moundAt(z) - L.pond.level + 0.03, z, UP, FALLEN.sizeMm[0] * 1.2 + R() * FALLEN.sizeMm[1] * 0.6, mul3(pick(TONE.petal), 0.95 + 0.15 * R()), R() * 6.3)
    made++
  }
  tally.fallen = growth.triangles - before
}

const highest = { y: -1e9, at: [0, 0] }
for (let z = -50; z <= 50; z += 1)
  for (let x = -50; x <= 50; x += 1) {
    if (edgeOf(x, z) < 1) continue
    const y = topAt(x, z)
    if (y > highest.y) {
      highest.y = y
      highest.at = [x, z]
    }
  }

const meshes = [fromThree('turf', turf.geometry()), fromThree('growth', growth.geometry()), fromThree('water', water.geometry(), { level: L.pond.level, boulders })]
const out = writeGlb(rel('assets-full', 'spring', 'village-spring.glb'), meshes)
out.bytes = addLists(rel('assets-full', 'spring', 'village-spring.glb'), 'growth', growth.lists)
tally.growthMedium = growth.lists.medium.length / 3
tally.growthLow = growth.lists.low.length / 3

const SIZE = 1024
const WATER_SIZE = 512
const hashed = (a, b, c) => {
  const v = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453
  return v - Math.floor(v)
}
const cell = (u, v, n, seed) => {
  const x = u * n
  const y = v * n
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  let best = 9
  let id = 0
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = (((xi + i) % n) + n) % n
      const cy = (((yi + j) % n) + n) % n
      const hx = hashed(cx, cy, seed)
      const hy = hashed(cx, cy, seed + 11)
      const d = Math.hypot(xi + i + hx - x, yi + j + hy - y)
      if (d < best) {
        best = d
        id = hashed(cx, cy, seed + 23)
      }
    }
  return [best, id]
}
const turfBytes = writePng(rel('assets-full', 'spring', 'village-turf.lin.tile.png'), SIZE, (px, py) => {
  const u = px / SIZE
  const v = py / SIZE
  const [d1, id1] = cell(u, v, 110, 1)
  const [d2, id2] = cell(u, v, 46, 2)
  const sprig = (1 - smooth(0.05, 0.62, d1)) * (0.45 + 0.55 * id1)
  const cushion = (1 - smooth(0.1, 0.8, d2)) * (0.5 + 0.5 * id2)
  const fine = 0.5 + 0.5 * fbm(u * 64, v * 64, 3, 3, 64)
  const tone = 0.5 + 0.8 * fbm(u * 7, v * 7, 5, 4, 7)
  return [0.55 * sprig + 0.45 * fine, tone, 0.6 * cushion + 0.4 * (0.5 + 0.7 * fbm(u * 12, v * 12, 9, 3, 12))]
})
const waterBytes = writePng(rel('assets-full', 'spring', 'village-water.lin.tile.png'), WATER_SIZE, (px, py) => {
  const u = px / WATER_SIZE
  const v = py / WATER_SIZE
  const a = 0.5 + 0.9 * fbm(u * 9, v * 9, 1, 4, 9)
  const b = 0.5 + 0.9 * fbm(u * 14 + 3, v * 14 + 5, 7, 3, 14)
  const c = 0.5 + 0.9 * fbm(u * 5, v * 5, 13, 4, 5)
  return [a, b, c]
})

const record = {
  tally,
  highest,
  made: 'assets-src/village-spring/build.mjs',
  model: { file: 'assets-full/spring/village-spring.glb', bytes: out.bytes, triangles: out.triangles },
  maps: {
    'assets-full/spring/village-turf.lin.tile.png': { px: SIZE, bytes: turfBytes, tileMm: TILE_MM },
    'assets-full/spring/village-water.lin.tile.png': { px: WATER_SIZE, bytes: waterBytes, tileMm: TILE_MM },
  },
}
writeJson(rel('out', 'work', 'village', 'build-spring.json'), record)
console.log(JSON.stringify(tally))
console.log(`village-spring: ${out.triangles} triangles in ${out.meshes} meshes, ${(out.bytes / 1e6).toFixed(2)} MB; ground highest ${highest.y.toFixed(2)} mm at x ${highest.at[0]}, z ${highest.at[1]}; turf map ${(turfBytes / 1e6).toFixed(2)} MB, water map ${(waterBytes / 1e6).toFixed(2)} MB`)
