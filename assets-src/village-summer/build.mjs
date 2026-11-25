import * as THREE from 'three'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { rel } from '../../tools/lib/paths.mjs'
import { loadLayout, loadRoof } from '../village/layout.mjs'
import { Bag, KIND, TILE_MM, add3, clamp, fbm, lin, mix3, mul3, noise, norm3, rng, smooth, surf, writePng } from '../village/kit.mjs'

const L = await loadLayout()
const RF = await loadRoof()
const C = L.cottage
const R = rng(7717)
const TAU = Math.PI * 2
const sc = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const pick = (list) => list[Math.floor(R() * list.length) % list.length]
const range = (a, b) => a + (b - a) * R()

const TURF = { lumpMm: 0.35, fineMm: 0.12, sandMm: 0.55, sandReach: 4.2 }
const GRASS = { tufts: 30000, blades: 3, tall: [0.9, 2.3], wide: [0.11, 0.2], rimTall: 1.5 }
const TONES = {
  grass: ['#1c3413', '#274616', '#30531a', '#213c15'].map(lin),
  tip: ['#7f9a36', '#9aad44', '#6c8a2e'].map(lin),
  straw: ['#c9b674', '#d8c88c', '#b9a460'].map(lin),
  earth: lin('#3b2c1c'),
  mud: lin('#231c12'),
  sand: lin('#d6c6a0'),
  bed: lin('#16201c'),
  leaf: ['#2b4a1c', '#3a5f22', '#24401a', '#47702a'].map(lin),
  rose: ['#e9a0a8', '#f2c3bd', '#f4e3cf', '#d97f8e', '#f0d2c0'].map(lin),
  petal: ['#f2b322', '#f7c53a', '#e9a016'].map(lin),
  seed: lin('#2c1a0c'),
  stem: lin('#3d5a22'),
  bloom: ['#f5efe0', '#f2c9d2', '#f6dc74', '#e7a4b4', '#ffffff'].map(lin),
}

const ground = new Bag('ground')
const water = new Bag('water')
const grass = new Bag('grass')
const decor = new Bag('decor')

function wallGap(x, z) {
  const y = L.moundAt(z)
  return Math.sqrt(Math.max(0, L.innerRadiusMm * L.innerRadiusMm - y * y)) - Math.hypot(x, z)
}
const front = (x, z) => smooth(-0.2, 0.55, z / (Math.hypot(x, z) || 1))
const sandAt = (x, z) => (1 - smooth(0.6, TURF.sandReach, wallGap(x, z))) * front(x, z)
const turfAt = (x, z) => TURF.lumpMm * fbm(x * 0.22 + 3.1, z * 0.22 + 1.7, 2.2, 3) + TURF.fineMm * fbm(x * 0.9, z * 0.9, 5.5, 2)
const topAt = (x, z) => L.groundAt(x, z) + turfAt(x, z) * smooth(0.98, 1.1, L.pondField(x, z)) + TURF.sandMm * sandAt(x, z) * (0.6 + 0.4 * fbm(x * 0.5, z * 0.5, 9, 2))
const keepHard = (role) => role === 'cottage' || role === 'chimney' || role === 'path' || role === 'post' || role === 'fence'
const hardGap = (x, z) => L.solidDistance(x, L.groundAt(x, z) + 0.6, z, keepHard)
const trunkGap = (x, z) => Math.hypot(x - L.tree.x, z - L.tree.z) - 5.2

function groundTone(x, z) {
  const f = L.pondField(x, z)
  const patch = fbm(x * 0.16 + 7, z * 0.16 + 2, 1.1, 3)
  const g = mix3(TONES.grass[0], TONES.grass[2], clamp(0.5 + 0.9 * patch))
  const shore = 1 - smooth(1.0, 1.09, f)
  const bare = clamp(Math.exp(-Math.max(hardGap(x, z), 0) / 0.9) * 0.7 + Math.exp(-Math.max(trunkGap(x, z), 0) / 1.6) * 0.5)
  let c = mix3(g, TONES.earth, clamp(0.25 + 0.5 * bare))
  c = mix3(c, TONES.mud, shore)
  c = mix3(c, TONES.bed, 1 - smooth(0.88, 0.98, f))
  c = mix3(c, TONES.sand, sandAt(x, z) * 0.85)
  return c
}

{
  const around = 420
  const shore = [0.3, 0.6, 0.8, 0.9, 0.94, 0.97, 0.99, 1.0, 1.012, 1.028, 1.05, 1.08]
  const outer = 44
  const skirt = 30
  const r = L.innerRadiusMm - 0.6
  const footY = L.collarY - 1.5
  const pc = Math.cos(L.pond.yaw)
  const ps = Math.sin(L.pond.yaw)
  const pos = []
  const idx = []
  const below = []
  const rows = shore.length + outer + skirt
  for (let j = 0; j <= around; j++) {
    const a = (j / around) * TAU
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
      let under = 0
      if (k < shore.length) {
        const t = Math.min(shore[k] / unit, t1 * (0.9 + 0.1 * (k / (shore.length - 1))))
        x = L.pond.x + dx * t
        z = L.pond.z + dz * t
        y = topAt(x, z)
      } else if (k < shore.length + outer) {
        const q = (k - shore.length + 1) / outer
        const t = t1 + (edge - t1) * Math.pow(q, 1.15)
        x = L.pond.x + dx * t
        z = L.pond.z + dz * t
        y = topAt(x, z)
      } else {
        const ex = L.pond.x + dx * edge
        const ez = L.pond.z + dz * edge
        const ey = topAt(ex, ez)
        const th = Math.atan2(ez, ex)
        const phi0 = Math.atan2(Math.hypot(ex, ez), -ey)
        const phi1 = Math.acos(clamp(-footY / r, -1, 1))
        const q = (k - shore.length - outer + 1) / skirt
        const phi = phi0 + (Math.min(phi1, phi0 - 0.12) - phi0) * q
        const ux = Math.cos(th) * Math.sin(phi)
        const uy = -Math.cos(phi)
        const uz = Math.sin(th) * Math.sin(phi)
        const lump = clamp(0.5 + 0.75 * fbm(ux * 9 + 3.1, uy * 9, uz * 9 + 7.7, 3))
        const rr = r - 0.15 - 0.3 * lump * smooth(0.05, 0.4, q)
        x = ux * rr
        y = uy * rr
        z = uz * rr
        under = q
      }
      pos.push(x, y, z)
      below.push(under)
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
  ground.add(g, { color: (p, _n, i) => mix3(groundTone(p[0], p[2]), mix3(TONES.earth, TONES.sand, 0.55 + 0.45 * front(p[0], p[2])), smooth(0, 0.25, below[i])), surf: (p, _n, i) => [sandAt(p[0], p[2]), below[i]], uv: (p, n) => (Math.abs(n[1]) > 0.55 ? [p[0], p[2]] : [Math.atan2(p[2], p[0]) * 56, p[1] * 1.3]) })
}

{
  const rings = [0, 0.22, 0.42, 0.6, 0.74, 0.85, 0.92, 0.965, 1.0, 1.03]
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
      const a = (j / around) * TAU
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
  water.add(g, { keepUv: true, color: [1, 1, 1], surf: () => [st[2 * vi++], 0] })
}

function soup(bag, pos, nor, col, surfOf) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(Array.from({ length: pos.length / 3 }, (_, i) => i))
  bag.add(g, { surf: surfOf, uv: (p) => [p[0] + p[1] * 0.37, p[2] + p[1] * 0.61] })
}

let tufts = 0
{
  const pos = []
  const nor = []
  const col = []
  const tip = []
  const list = []
  const spread = (v) => {
    let r = 0
    for (let k = 0; k < 10; k++) r |= ((v >> k) & 1) << (2 * k)
    return r
  }
  const morton = (x, z) => spread(Math.floor((x + 64) * 4)) | (spread(Math.floor((z + 64) * 4)) << 1)
  const edge = L.innerRadiusMm - 1.2
  for (let i = 0; i < GRASS.tufts * 6 && tufts < GRASS.tufts; i++) {
    const a = R() * TAU
    const rr = Math.sqrt(R()) * edge
    const x = Math.cos(a) * rr
    const z = Math.sin(a) * rr
    if (wallGap(x, z) < 0.7) continue
    const f = L.pondField(x, z)
    if (f < 1.035) continue
    if (hardGap(x, z) < 0.3 || trunkGap(x, z) < -1.4) continue
    const sand = sandAt(x, z)
    const lush = clamp(0.55 + 0.9 * fbm(x * 0.16 + 7, z * 0.16 + 2, 1.1, 3))
    const worn = Math.exp(-Math.max(hardGap(x, z), 0) / 1.6)
    if (R() < 0.55 * worn) continue
    const y0 = topAt(x, z) - 0.05
    const tall = range(GRASS.tall[0], GRASS.tall[1]) * (0.6 + 0.6 * lush) * (1 - 0.45 * worn) * (1 + (GRASS.rimTall - 1) * smooth(1.035, 1.09, f) * (1 - smooth(1.09, 1.25, f)))
    const base = mix3(pick(TONES.grass), pick(TONES.straw), sand * 0.8)
    const top = mix3(pick(TONES.tip), pick(TONES.straw), clamp(sand * 0.9 + 0.12 * R()))
    const cell = { key: morton(x, z), pos: [], nor: [], col: [], tip: [] }
    list.push(cell)
    const up = norm3([(R() - 0.5) * 0.5, 1, (R() - 0.5) * 0.5])
    for (let b = 0; b < GRASS.blades; b++) {
      const yaw = R() * TAU
      const lean = range(0.15, 0.75)
      const dir = [Math.cos(yaw), 0, Math.sin(yaw)]
      const side = [-dir[2], 0, dir[0]]
      const w = range(GRASS.wide[0], GRASS.wide[1])
      const h = tall * range(0.6, 1.1)
      const ox = x + range(-0.25, 0.25)
      const oz = z + range(-0.25, 0.25)
      const A = [ox - side[0] * w, y0, oz - side[2] * w]
      const B = [ox + side[0] * w, y0, oz + side[2] * w]
      const T = [ox + dir[0] * h * lean, y0 + h, oz + dir[2] * h * lean]
      for (const [q, c, t] of [[A, base, 0], [B, base, 0], [T, top, 1]]) {
        cell.pos.push(...q)
        cell.nor.push(...up)
        cell.col.push(c[0] * (0.45 + 0.75 * t), c[1] * (0.45 + 0.75 * t), c[2] * (0.45 + 0.75 * t))
        cell.tip.push(t)
      }
    }
    tufts++
  }
  list.sort((p, q) => p.key - q.key)
  for (const c of list) {
    for (const v of c.pos) pos.push(v)
    for (const v of c.nor) nor.push(v)
    for (const v of c.col) col.push(v)
    for (const v of c.tip) tip.push(v)
  }
  let vi = 0
  soup(grass, pos, nor, col, () => [tip[vi++], 0])
}

const leafSurf = [surf(KIND.leaf, 0.8), 0]
const leafBits = { pos: [], nor: [], col: [] }
function leaf(p, out, size, tone) {
  const tipDir = norm3([out[0] + (R() - 0.5) * 1.1, out[1] * 0.5 + 0.3 + (R() - 0.5) * 0.8, out[2] + (R() - 0.5) * 1.1])
  const sideV = norm3([tipDir[1] * out[2] - tipDir[2] * out[1] + (R() - 0.5) * 0.4, tipDir[2] * out[0] - tipDir[0] * out[2], tipDir[0] * out[1] - tipDir[1] * out[0] + (R() - 0.5) * 0.4])
  const len = size * (0.8 + 0.5 * R())
  const w = len * 0.32
  const mid = add3(p, sc(tipDir, len * 0.45))
  const A = p
  const B = add3(mid, sc(sideV, w))
  const Cc = add3(p, sc(tipDir, len))
  const D = add3(mid, sc(sideV, -w))
  const nn = norm3(add3(sc(out, 0.75), [0, 0.35, 0]))
  for (const [q, s] of [[A, 0.55], [B, 0.9], [Cc, 1.2], [A, 0.55], [Cc, 1.2], [D, 0.9]]) {
    leafBits.pos.push(...q)
    leafBits.nor.push(...nn)
    leafBits.col.push(tone[0] * s, tone[1] * s, tone[2] * s)
  }
}

function blossom(p, out, r, tone, petals = 6) {
  const g = new THREE.IcosahedronGeometry(1, 1)
  const P = g.getAttribute('position')
  const seed = R() * 40
  for (let i = 0; i < P.count; i++) {
    const k = 0.82 + 0.3 * noise(P.getX(i) * 2.2 + seed, P.getY(i) * 2.2, P.getZ(i) * 2.2)
    P.setXYZ(i, P.getX(i) * r * k, P.getY(i) * r * k * 0.75, P.getZ(i) * r * k)
  }
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...norm3(out)))
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(p[0], p[1], p[2])
  const heart = mul3(tone, 0.55)
  decor.add(g, { matrix: m, color: (v) => mix3(heart, tone, clamp(0.3 + Math.hypot(v[0] - p[0], v[1] - p[1], v[2] - p[2]) / r)), surf: [surf(KIND.leaf, 0.7), 0], renormal: true })
  void petals
}

const counts = { roses: 0, leaves: 0, sunflowers: 0, blooms: 0 }
const wallOut = RF.wallOutward()
for (const sh of RF.shrubs()) {
  const ivy = RF.isIvy(sh.r)
  const n = ivy ? 7 : 16
  for (let i = 0; i < n; i++) {
    const yy = ivy ? range(-0.7, 0.85) : range(-0.1, 0.9)
    const a = ivy ? wallOut + (R() - 0.5) * 2.2 : R() * TAU
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy))
    const d = [Math.cos(a) * rr, yy, Math.sin(a) * rr]
    const p = [sh.centre[0] + d[0] * sh.r[0] * 1.02, sh.centre[1] + d[1] * sh.r[1] * 1.02, sh.centre[2] + d[2] * sh.r[2] * 1.02]
    blossom(p, d, range(0.3, 0.52), pick(TONES.rose))
    counts.roses++
    for (let k = 0; k < 5; k++) leaf(add3(p, [range(-0.5, 0.5), range(-0.5, 0.5), range(-0.5, 0.5)]), d, 0.5, mul3(pick(TONES.leaf), range(0.8, 1.4)))
  }
}

{
  const wallZ = C.halfLength + 0.3
  const door = C.door
  const sill = 0
  const climb = []
  const arch = (t) => {
    const a = Math.PI * t
    return [door.across - Math.cos(a) * (door.width / 2 + 0.9), sill + (door.height - 1.2) * Math.min(1, 1.5 * Math.sin(a)) + 2.2 * Math.sin(a)]
  }
  for (let i = 0; i <= 60; i++) climb.push({ at: arch(i / 60), w: 0.9 })
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    climb.push({ at: [-C.halfWidth + 0.4 + t * 3.2, 0.5 + t * (C.wall + 2.5) + 0.8 * Math.sin(t * 9)], w: 1.1 })
  }
  for (let i = 0; i <= 30; i++) {
    const t = i / 30
    climb.push({ at: [-C.halfWidth + 2.2 + t * (door.across - door.width / 2 + C.halfWidth - 2), C.wall - 0.6 + 1.1 * Math.sin(t * 7) + 1.4 * t], w: 0.8 })
  }
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    climb.push({ at: [C.halfWidth - 0.5 - t * 1.2, 0.4 + t * (C.wall - 1) + 0.5 * Math.sin(t * 8)], w: 0.9 })
  }
  const outV = sc(L.cottagePoint(0, 0, 1).map((v, i) => v - L.cottagePoint(0, 0, 0)[i]), 1)
  const out = norm3([outV[0], 0.15, outV[2]])
  for (const c of climb) {
    for (let k = 0; k < 9; k++) {
      const p = L.cottagePoint(c.at[0] + range(-c.w, c.w), c.at[1] + range(-c.w, c.w), wallZ + range(0, 0.5))
      leaf(p, out, 0.55, mul3(pick(TONES.leaf), range(0.75, 1.5)))
    }
    if (R() < 0.42) {
      const p = L.cottagePoint(c.at[0] + range(-c.w, c.w), c.at[1] + range(-c.w, c.w), wallZ + 0.55)
      blossom(p, out, range(0.3, 0.5), pick(TONES.rose))
      counts.roses++
    }
  }
}

function sunflower(x, z, tall, face) {
  const y0 = topAt(x, z) - 0.1
  const bend = [face[0] * 0.9, 0, face[2] * 0.9]
  const pts = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    pts.push(new THREE.Vector3(x + bend[0] * t * t, y0 + tall * t, z + bend[2] * t * t))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const stem = new THREE.TubeGeometry(curve, 14, 0.24, 6, false)
  decor.add(stem, { color: (p) => mul3(TONES.stem, 0.7 + 0.5 * ((p[1] - y0) / tall)), surf: leafSurf, renormal: true })
  const head = pts[pts.length - 1].toArray()
  const f = norm3(face)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...f))
  const hr = tall * 0.1 + 0.75
  const disc = new THREE.SphereGeometry(hr, 14, 8, 0, TAU, 0, Math.PI / 2)
  disc.rotateX(Math.PI / 2)
  disc.scale(1, 1, 0.45)
  const place = new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(head[0] + f[0] * 0.12, head[1] + f[1] * 0.12, head[2] + f[2] * 0.12)
  decor.add(disc, { matrix: place, color: (p) => mul3(TONES.seed, 0.7 + 1.2 * noise(p[0] * 6, p[1] * 6, p[2] * 6)), surf: [surf(KIND.leaf, 0.9), 0], renormal: true })
  const back = new THREE.CircleGeometry(hr * 1.05, 14)
  back.rotateY(Math.PI)
  decor.add(back, { matrix: place, color: mul3(TONES.stem, 0.8), surf: leafSurf, renormal: true })
  const pos = []
  const nor = []
  const col = []
  for (const [count, len, turn, tilt] of [[15, 1.05, 0, 0.22], [13, 0.82, 0.21, 0.45]]) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + turn + range(-0.06, 0.06)
      const pl = hr * len * range(0.9, 1.12)
      const pw = hr * 0.2
      const dirv = new THREE.Vector3(Math.cos(a), Math.sin(a), tilt * range(0.5, 1.3)).normalize()
      const sidev = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0)
      const o = new THREE.Vector3(Math.cos(a) * hr * 0.82, Math.sin(a) * hr * 0.82, 0.02)
      const A = o.clone().addScaledVector(sidev, -pw * 0.6)
      const B = o.clone().addScaledVector(sidev, pw * 0.6)
      const M1 = o.clone().addScaledVector(dirv, pl * 0.55).addScaledVector(sidev, -pw)
      const M2 = o.clone().addScaledVector(dirv, pl * 0.55).addScaledVector(sidev, pw)
      const T = o.clone().addScaledVector(dirv, pl)
      const tone = pick(TONES.petal)
      for (const [v, s] of [[A, 0.62], [B, 0.62], [M2, 1], [A, 0.62], [M2, 1], [M1, 1], [M1, 1], [M2, 1], [T, 1.12]]) {
        const w = v.clone().applyMatrix4(place)
        pos.push(w.x, w.y, w.z)
        nor.push(f[0], f[1] + 0.3, f[2])
        col.push(tone[0] * s, tone[1] * s, tone[2] * s)
      }
    }
  }
  soup(decor, pos, nor, col, () => [surf(KIND.leaf, 0.6), 0])
  for (let i = 0; i < 4; i++) {
    const t = 0.22 + 0.17 * i + range(-0.04, 0.04)
    const at = curve.getPoint(t).toArray()
    const a = i * 2.4 + range(-0.4, 0.4)
    const d = [Math.cos(a), 0.25, Math.sin(a)]
    const size = tall * 0.2 * range(0.8, 1.15)
    const before = leafBits.pos.length
    leaf(at, d, size, mul3(pick(TONES.leaf), range(1, 1.5)))
    void before
  }
  counts.sunflowers++
  return { x, z, y0, tall }
}

const fenceDir = norm3([L.fence.to[0] - L.fence.from[0], 0, L.fence.to[1] - L.fence.from[1]])
const behind = [fenceDir[2], 0, -fenceDir[0]]
const sunList = []
for (const [t, off, tall] of [[-0.08, 2.6, 11.2], [0.22, 1.3, 6.4]]) {
  const x = L.fence.from[0] + (L.fence.to[0] - L.fence.from[0]) * t + behind[0] * off
  const z = L.fence.from[1] + (L.fence.to[1] - L.fence.from[1]) * t + behind[2] * off
  sunList.push(sunflower(x, z, tall, norm3([0.25 + range(-0.2, 0.2), 0.18, 1])))
}
for (const [x, z, tall] of [[27.5, 7.5, 8.6], [22.6, 11.2, 5.6], [32.6, 10.4, 4.6]]) sunList.push(sunflower(x, z, tall, norm3([-0.2 + range(-0.2, 0.2), 0.2, 1])))

{
  const spots = []
  for (let i = 0; i < 70; i++) {
    const a = R() * TAU
    const rr = range(4.6, 9.5)
    spots.push([L.tree.x + Math.cos(a) * rr, L.tree.z + Math.sin(a) * rr * 0.9])
  }
  for (let i = 0; i < 260; i++) {
    const a = R() * TAU
    const rr = Math.sqrt(R()) * (L.innerRadiusMm - 3)
    spots.push([Math.cos(a) * rr, Math.sin(a) * rr])
  }
  for (const [x, z] of spots) {
    if (L.pondField(x, z) < 1.05 || hardGap(x, z) < 0.5 || wallGap(x, z) < 1.5 || trunkGap(x, z) < -1.2) continue
    const y = topAt(x, z)
    const h = range(0.7, 1.9)
    const tone = pick(TONES.bloom)
    const r = range(0.2, 0.38)
    const g = new THREE.IcosahedronGeometry(r, 0)
    g.scale(1, 0.6, 1)
    g.translate(x, y + h, z)
    decor.add(g, { color: (p) => mul3(tone, 0.75 + 0.5 * clamp((p[1] - (y + h)) / r + 0.5)), surf: [surf(KIND.leaf, 0.6), 0], renormal: true })
    const pos = [x - 0.05, y, z, x + 0.05, y, z, x, y + h, z]
    soup(decor, pos, [0, 1, 0, 0, 1, 0, 0, 1, 0], [...mul3(TONES.stem, 0.6), ...mul3(TONES.stem, 0.6), ...TONES.stem], () => leafSurf)
    for (let k = 0; k < 3; k++) leaf([x + range(-0.3, 0.3), y + range(0, 0.4), z + range(-0.3, 0.3)], [range(-1, 1), 0.6, range(-1, 1)], 0.5, mul3(pick(TONES.leaf), 1.2))
    counts.blooms++
  }
}

counts.leaves = leafBits.pos.length / 9
soup(decor, leafBits.pos, leafBits.nor, leafBits.col, () => leafSurf)

const size = 512
const period = 8
writePng(rel('assets-full', 'summer', 'village-turf.lin.tile.png'), size, (px, py) => {
  const u = (px / size) * period
  const v = (py / size) * period
  const fine = clamp(0.5 + 0.9 * fbm(u * 6, v * 6, 1.3, 3, period * 6))
  const clump = clamp(0.5 + 1.1 * fbm(u * 1.5, v * 1.5, 4.1, 3, period * 1.5))
  const wide = clamp(0.5 + 1.2 * fbm(u * 0.5, v * 0.5, 8.2, 2, period * 0.5))
  return [fine, clump, wide]
})

const SNAP = { position: 128, normal: 32, color: 128, uv: 2048 }
const GRASS_SNAP = { position: 64, normal: 16, uv: 64 }
function snap(mesh) {
  const by = mesh.name === grass.name ? GRASS_SNAP : SNAP
  if (by === GRASS_SNAP) for (let v = 0; v < mesh.uv.length / 2; v++) {
    const first = v - (v % (GRASS.blades * 3))
    mesh.uv[v * 2] = mesh.uv[first * 2]
    mesh.uv[v * 2 + 1] = mesh.uv[first * 2 + 1]
  }
  for (const k of Object.keys(by)) {
    const a = mesh[k]
    if (!a) continue
    for (let i = 0; i < a.length; i++) a[i] = Math.round(a[i] * by[k]) / by[k]
  }
  return mesh
}
const meshes = [ground, water, grass, decor].map((b) => snap(fromThree(b.name, b.geometry(), b === decor ? { sunflowers: sunList.flatMap((s) => [+s.x.toFixed(3), +s.y0.toFixed(3), +s.z.toFixed(3), +s.tall.toFixed(3)]) } : undefined)))
writeGlb(rel('assets-full', 'summer', 'village-summer.glb'), meshes)
console.log(`village-summer: ground ${ground.triangles}, water ${water.triangles}, grass ${grass.triangles} (${tufts} tufts), decor ${decor.triangles} (${counts.roses} roses, ${counts.leaves} leaves, ${counts.sunflowers} sunflowers, ${counts.blooms} blooms)`)
