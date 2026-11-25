import fs from 'node:fs'
import * as THREE from 'three'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { readGlb, writeGlb as packedGlb } from '../../tools/lib/glbpack.mjs'
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

const IVY = { leaves: 760, roses: 14, low: 4.5, size: 0.62 }
const TURF = { lumpMm: 0.35, fineMm: 0.12, sandMm: 0.7, sandReach: 6.5, sandSides: 0.35 }
const GRASS = { tufts: 21000, blades: 3, tall: [0.55, 1.6], wide: [0.11, 0.2], rimTall: 1.5, sandFrom: 0.12, sandTo: 0.55 }
const LEVEL = { seed: 4107, medium: { back: 0.4, front: 0.72 }, low: { back: 0.25, front: 0.5 }, zFrom: -12, zTo: 6 }
const STONE = { buried: 0.25, sink: 0.45, lumps: 0.22, tones: ['#8f887a', '#a39a88', '#7b7568', '#b0a692'] }
const TONES = {
  grass: ['#1c3413', '#274616', '#30531a', '#213c15'].map(lin),
  tip: ['#566f27', '#6b8230', '#465f20'].map(lin),
  straw: ['#c9b674', '#d8c88c', '#b9a460'].map(lin),
  earth: lin('#3b2c1c'),
  mud: lin('#231c12'),
  sand: lin('#efe5ca'),
  bed: lin('#16201c'),
  leaf: ['#2b4a1c', '#3a5f22', '#24401a', '#47702a'].map(lin),
  rose: ['#e9a0a8', '#f2c3bd', '#f4e3cf', '#d97f8e', '#f0d2c0'].map(lin),
  petal: ['#f2a516', '#f7b82a', '#e3930f', '#f9c33a'].map((c) => mul3(lin(c), 1.15)),
  seed: lin('#2c1a0c'),
  seedHeart: lin('#4a3a14'),
  seedRim: lin('#8a4a12'),
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
const sandAt = (x, z) => (1 - smooth(0.5, TURF.sandReach * (0.6 + 1.1 * clamp(0.5 + 1.3 * fbm(x * 0.13 + 1.7, z * 0.13 + 5.3, 3.3, 3))), wallGap(x, z))) * (TURF.sandSides + (1 - TURF.sandSides) * front(x, z))
const blob = (x, z, cx, cz, rx, rz) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2))
// Where the low sun reaches the floor between the crown, the trunk and the cottage (read off the approved image): right of
// the trunk out to the sunflowers, behind the lamp, a little by the fence and on the near right bank.
const sunAt = (x, z) => clamp((1.0 * blob(x, z, 27, 3, 9, 8) + 0.85 * blob(x, z, 3, -8, 7, 6) + 0.4 * blob(x, z, -24, 21, 6, 5) + 0.5 * blob(x, z, 24, 22, 9, 6)) * (0.5 + 1.0 * clamp(0.5 + 1.4 * fbm(x * 0.3 + 9, z * 0.3 + 4, 6.1, 2))))
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
  // The bed under the dark water and the skirt against the glass carry little: they are the rows the mesh can spare.
  const around = 280
  const shore = [0.6, 0.9, 0.97, 1.0, 1.012, 1.028, 1.05, 1.08]
  const outer = 34
  const skirt = 16
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
  ground.add(g, { color: (p, _n, i) => mix3(groundTone(p[0], p[2]), mix3(TONES.earth, TONES.sand, 0.8 + 0.2 * front(p[0], p[2])), smooth(0, 0.25, below[i])), surf: (p, _n, i) => [sandAt(p[0], p[2]), below[i]], uv: (p, n) => (Math.abs(n[1]) > 0.55 ? [p[0], p[2]] : [Math.atan2(p[2], p[0]) * 56, p[1] * 1.3]) })
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

// Rounded stepping stones from the door down to the pond's left shore and along it, over the shared path's small slabs.
const stoneList = []
{
  const edgeAt = (deg, field) => {
    const a = (deg / 180) * Math.PI
    let t = 0
    while (t < 60 && L.pondField(L.pond.x + Math.cos(a) * t, L.pond.z + Math.sin(a) * t) < field) t += 0.05
    return [L.pond.x + Math.cos(a) * t, L.pond.z + Math.sin(a) * t]
  }
  const along = [...L.stones.map(([x, z], i) => [x, z, 2.3 + 0.22 * i, 1.7 + 0.12 * i]), ...[[262, 1.1, 1.7], [246, 1.09, 2.1], [230, 1.085, 2.5], [214, 1.08, 2.2], [199, 1.08, 2.7], [150, 1.07, 2.4], [133, 1.065, 1.9], [118, 1.065, 2.3], [38, 1.07, 2.0], [4, 1.075, 2.4], [318, 1.08, 1.8]].map(([deg, f, w]) => [...edgeAt(deg, f), w, w * range(0.62, 0.8)])]
  for (const [x, z, rx, rz] of along) {
    const yaw = range(0, TAU)
    const h = rx * range(0.34, 0.46)
    const g = new THREE.IcosahedronGeometry(1, 2)
    const P = g.getAttribute('position')
    const seed = R() * 50
    for (let i = 0; i < P.count; i++) {
      const k = 1 + STONE.lumps * (noise(P.getX(i) * 1.6 + seed, P.getY(i) * 1.6, P.getZ(i) * 1.6) - 0.5) * 2
      const sy = P.getY(i)
      P.setXYZ(i, P.getX(i) * rx * k, (sy > 0 ? Math.pow(sy, 0.6) : sy) * h * k, P.getZ(i) * rz * k)
    }
    g.rotateY(yaw)
    const y = L.groundAt(x, z) + h * (1 - 2 * STONE.sink) + 0.1
    g.translate(x, y, z)
    {
      // The sunk half of a stone is never seen: its triangles are left out.
      const Q = g.getAttribute('position').array
      const kept = []
      for (let i = 0; i < Q.length; i += 9) {
        let hidden = true
        for (let j = 0; j < 9; j += 3) if (Q[i + j + 1] > L.groundAt(Q[i + j], Q[i + j + 2]) - STONE.buried) hidden = false
        if (!hidden) for (let j = 0; j < 9; j++) kept.push(Q[i + j])
      }
      g.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3))
      g.deleteAttribute('normal')
      g.deleteAttribute('uv')
    }
    const tone = mul3(lin(pick(STONE.tones)), range(0.8, 1.15))
    decor.add(g, { color: (p) => mul3(tone, 0.45 + 0.75 * clamp((p[1] - (y - h)) / (2 * h)) + 0.25 * (noise(p[0] * 3 + seed, p[1] * 3, p[2] * 3) - 0.5)), surf: [surf(KIND.stone, 0.85), 0], renormal: true })
    stoneList.push([x, z, rx, rz, yaw])
  }
}
const stoneGap = (x, z) => {
  let d = Infinity
  for (const [sx, sz, rx, rz, yaw] of stoneList) {
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    const lx = (x - sx) * c - (z - sz) * s
    const lz = (x - sx) * s + (z - sz) * c
    d = Math.min(d, (Math.hypot(lx / rx, lz / rz) - 1) * Math.min(rx, rz))
  }
  return d
}

let tufts = 0
{
  const pos = []
  const nor = []
  const col = []
  const tip = []
  const sun = []
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
    if (hardGap(x, z) < 0.3 || trunkGap(x, z) < -1.4 || stoneGap(x, z) < 0.15) continue
    const sand = sandAt(x, z)
    if (R() < smooth(GRASS.sandFrom, GRASS.sandTo, sand)) continue
    const lit = sunAt(x, z)
    const lush = clamp(0.55 + 0.9 * fbm(x * 0.16 + 7, z * 0.16 + 2, 1.1, 3))
    const worn = Math.exp(-Math.max(hardGap(x, z), 0) / 1.6)
    if (R() < 0.55 * worn) continue
    const y0 = topAt(x, z) - 0.05
    const tall = range(GRASS.tall[0], GRASS.tall[1]) * (0.6 + 0.6 * lush) * (1 - 0.45 * worn) * (1 + (GRASS.rimTall - 1) * smooth(1.035, 1.09, f) * (1 - smooth(1.09, 1.25, f)))
    const patch = 0.45 + 0.75 * clamp(0.5 + 1.4 * fbm(x * 0.09 + 3, z * 0.09 + 11, 2.3, 2))
    const base = mul3(mix3(pick(TONES.grass), pick(TONES.straw), sand * 0.8), patch)
    const top = mul3(mix3(pick(TONES.tip), pick(TONES.straw), clamp(sand * 0.9 + 0.08 * R())), patch)
    const cell = { key: morton(x, z), pos: [], nor: [], col: [], tip: [], sun: [] }
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
        cell.col.push(c[0] * (0.32 + 0.95 * t), c[1] * (0.32 + 0.95 * t), c[2] * (0.32 + 0.95 * t))
        cell.tip.push(t)
        cell.sun.push(lit)
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
    for (const v of c.sun) sun.push(v)
  }
  let vi = 0
  soup(grass, pos, nor, col, () => {
    const o = [tip[vi], sun[vi]]
    vi++
    return o
  })
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
    blossom(p, d, range(0.2, 0.36), pick(TONES.rose))
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
    for (let k = 0; k < 12; k++) {
      const p = L.cottagePoint(c.at[0] + range(-c.w, c.w), c.at[1] + range(-c.w, c.w), wallZ + range(0, 0.5))
      leaf(p, out, 0.5, mul3(pick(TONES.leaf), range(0.55, 1.25)))
    }
    if (R() < 0.42) {
      const p = L.cottagePoint(c.at[0] + range(-c.w, c.w), c.at[1] + range(-c.w, c.w), wallZ + 0.55)
      blossom(p, out, range(0.18, 0.32), pick(TONES.rose))
      counts.roses++
    }
  }
  // The side wall is half grown over: ivy from the footing up to an uneven line under the eaves, open around the window.
  const sideV = L.cottagePoint(-1, 0, 0).map((v, i) => v - L.cottagePoint(0, 0, 0)[i])
  const sideOut = norm3([sideV[0], 0.15, sideV[2]])
  const win = C.sideWindow
  const open = (along, up) => Math.abs(along - win.along) < win.width / 2 + 0.5 && up > win.sill - 0.5 && up < win.sill + win.height + 0.6
  for (let i = 0; i < IVY.leaves; i++) {
    const along = range(-C.halfLength + 0.3, C.halfLength - 0.2)
    const top = IVY.low + (C.wall - 0.5 - IVY.low) * clamp(0.5 + 1.3 * fbm(along * 0.35 + 4.2, 1.7, 2.9, 3))
    const up = 0.2 + (top - 0.2) * Math.pow(R(), 1.25)
    if (open(along, up)) continue
    leaf(L.cottagePoint(-C.halfWidth - range(0.1, 0.55), up, along), sideOut, IVY.size, mul3(pick(TONES.leaf), range(0.5, 1.25)))
  }
  for (let i = 0; i < IVY.roses; i++) {
    const along = range(-C.halfLength + 0.8, C.halfLength - 0.8)
    const up = range(0.8, IVY.low + 1.5)
    if (open(along, up)) continue
    blossom(L.cottagePoint(-C.halfWidth - 0.6, up, along), sideOut, range(0.2, 0.34), pick(TONES.rose))
    counts.roses++
  }
}

function sunflower(x, z, tall, face) {
  const y0 = topAt(x, z) - 0.1
  const bend = [face[0] * 0.9, 0, face[2] * 0.9]
  const lean = [range(-0.5, 0.5), range(-0.4, 0.4)]
  const pts = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    const s = Math.sin(t * Math.PI) * tall * 0.07
    pts.push(new THREE.Vector3(x + bend[0] * t * t + lean[0] * s, y0 + tall * t - 0.35 * t * t * t, z + bend[2] * t * t + lean[1] * s))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const stem = new THREE.TubeGeometry(curve, 14, 0.15, 6, false)
  decor.add(stem, { color: (p) => mul3(TONES.stem, 0.7 + 0.5 * ((p[1] - y0) / tall)), surf: leafSurf, renormal: true })
  const head = pts[pts.length - 1].toArray()
  const f = norm3(face)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...f))
  const hr = 0.86 * (tall * 0.1 + 0.75)
  const disc = new THREE.SphereGeometry(hr * 0.66, 14, 8, 0, TAU, 0, Math.PI / 2)
  disc.rotateX(Math.PI / 2)
  disc.scale(1, 1, 0.45)
  const place = new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition(head[0] + f[0] * 0.12, head[1] + f[1] * 0.12, head[2] + f[2] * 0.12)
  decor.add(disc, { matrix: place, color: (p) => {
      const ring = clamp(Math.hypot(p[0] - head[0] - f[0] * 0.12, p[1] - head[1] - f[1] * 0.12, p[2] - head[2] - f[2] * 0.12) / (hr * 0.66))
      return mul3(mix3(TONES.seedHeart, mix3(TONES.seed, TONES.seedRim, smooth(0.55, 1, ring)), smooth(0.15, 0.5, ring)), 0.7 + 1.1 * noise(p[0] * 9, p[1] * 9, p[2] * 9))
    }, surf: [surf(KIND.leaf, 0.9), 0], renormal: true })
  const back = new THREE.CircleGeometry(hr * 1.05, 14)
  back.rotateY(Math.PI)
  decor.add(back, { matrix: place, color: mul3(TONES.stem, 0.8), surf: leafSurf, renormal: true })
  const pos = []
  const nor = []
  const col = []
  for (const [count, len, turn, tilt] of [[19, 1.05, 0, 0.14], [17, 0.9, 0.17, 0.34], [13, 0.62, 0.3, 0.6]]) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU + turn + range(-0.06, 0.06)
      const pl = hr * len * range(1.05, 1.3)
      const pw = hr * 0.2
      const curl = range(-0.35, 0.1)
      const dirv = new THREE.Vector3(Math.cos(a), Math.sin(a), tilt * range(0.5, 1.3)).normalize()
      const sidev = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0)
      const o = new THREE.Vector3(Math.cos(a) * hr * 0.5, Math.sin(a) * hr * 0.5, 0.02)
      const A = o.clone().addScaledVector(sidev, -pw * 0.6)
      const B = o.clone().addScaledVector(sidev, pw * 0.6)
      const M1 = o.clone().addScaledVector(dirv, pl * 0.55).addScaledVector(sidev, -pw)
      const M2 = o.clone().addScaledVector(dirv, pl * 0.55).addScaledVector(sidev, pw)
      const T = o.clone().addScaledVector(dirv, pl)
      T.z += curl * pl
      const pn = new THREE.Vector3(0.45 * Math.cos(a), 0.45 * Math.sin(a) + 0.2, 1).normalize().applyQuaternion(q)
      const tone = pick(TONES.petal)
      for (const [v, s] of [[A, 0.5], [B, 0.5], [M2, 0.95], [A, 0.5], [M2, 0.95], [M1, 0.95], [M1, 0.95], [M2, 0.95], [T, 1.2]]) {
        const w = v.clone().applyMatrix4(place)
        pos.push(w.x, w.y, w.z)
        nor.push(pn.x, pn.y, pn.z)
        col.push(tone[0] * s, tone[1] * s, tone[2] * s)
      }
    }
  }
  soup(decor, pos, nor, col, () => [surf(KIND.leaf, 0.6), 0])
  for (let i = 0; i < 7; i++) {
    const t = 0.14 + 0.115 * i + range(-0.03, 0.03)
    const at = curve.getPoint(t).toArray()
    const a = i * 2.4 + range(-0.4, 0.4)
    const d = [Math.cos(a), range(-0.35, 0.2), Math.sin(a)]
    const size = tall * 0.36 * range(0.75, 1.2) * (1 - 0.35 * t)
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
for (const [t, off, tall, turn, nod] of [[-0.08, 2.6, 9.4, -0.1, 0.02], [0.22, 1.3, 5.6, 0.5, -0.12]]) {
  const x = L.fence.from[0] + (L.fence.to[0] - L.fence.from[0]) * t + behind[0] * off
  const z = L.fence.from[1] + (L.fence.to[1] - L.fence.from[1]) * t + behind[2] * off
  sunList.push(sunflower(x, z, tall, norm3([turn + range(-0.1, 0.1), nod, 1])))
}
for (const [x, z, tall, turn, nod] of [[27.5, 7.5, 7.4, -0.45, 0.25], [22.6, 11.2, 4.8, 0.35, -0.1], [32.6, 10.4, 4.0, 0.75, -0.3]]) sunList.push(sunflower(x, z, tall, norm3([turn + range(-0.1, 0.1), nod, 1])))

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
const GRASS_SNAP = { position: 64, normal: 16, uv: 512 }
const TONE_BITS = 6
function snap(mesh) {
  const by = mesh.name === grass.name ? GRASS_SNAP : SNAP
  if (by === GRASS_SNAP) for (let v = 0; v < mesh.color.length / 3; v++) {
    const top = Math.max(mesh.color[v * 3], mesh.color[v * 3 + 1], mesh.color[v * 3 + 2], 1e-6)
    const step = 2 ** (Math.floor(Math.log2(top)) + 1 - TONE_BITS)
    for (let j = 0; j < 3; j++) mesh.color[v * 3 + j] = Math.round(mesh.color[v * 3 + j] / step) * step
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

// Lighter lists for the lower quality levels of the live page (src/core/models.ts reads `extras.levels`, and
// tools/lib/glblevels.mjs leaves a mesh alone that names its own). The simplifier cannot thin a field of single blades, so the
// grass names its own list: whole tufts are left out, more of them behind the cottage and the tree than in front.
function addLists(file, lists) {
  const { json, bin } = readGlb(fs.readFileSync(file))
  const parts = [bin]
  let length = bin.length
  for (const mesh of json.meshes) {
    const want = lists[mesh.name]
    if (!want) continue
    const prim = mesh.primitives[0]
    const type = json.accessors[prim.indices].componentType
    const levels = {}
    for (const [level, list] of Object.entries(want)) {
      const data = type === 5123 ? Uint16Array.from(list) : Uint32Array.from(list)
      const padding = (4 - (length % 4)) % 4
      if (padding) parts.push(Buffer.alloc(padding))
      length += padding
      json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.byteLength })
      json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType: type, count: data.length, type: 'SCALAR' })
      parts.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength))
      length += data.byteLength
      levels[level] = json.accessors.length - 1
    }
    prim.extras = { ...(prim.extras ?? {}), levels }
  }
  json.buffers[0].byteLength = length
  fs.writeFileSync(file, packedGlb(json, Buffer.concat(parts, length)))
}
const grassMedium = []
const grassLow = []
{
  const m = meshes[2]
  const per = GRASS.blades * 3
  const pick01 = rng(LEVEL.seed)
  for (let i = 0; i < m.index.length; i += per) {
    const z = m.position[m.index[i] * 3 + 2]
    const u = pick01()
    const near = smooth(LEVEL.zFrom, LEVEL.zTo, z)
    if (u < LEVEL.medium.back + (LEVEL.medium.front - LEVEL.medium.back) * near) for (let j = 0; j < per; j++) grassMedium.push(m.index[i + j])
    if (u < LEVEL.low.back + (LEVEL.low.front - LEVEL.low.back) * near) for (let j = 0; j < per; j++) grassLow.push(m.index[i + j])
  }
}
addLists(rel('assets-full', 'summer', 'village-summer.glb'), { grass: { medium: grassMedium, low: grassLow } })
console.log(`village-summer: ground ${ground.triangles}, water ${water.triangles}, grass ${grass.triangles} (${tufts} tufts, ${grassMedium.length / 3} at medium, ${grassLow.length / 3} at low), decor ${decor.triangles} (${counts.roses} roses, ${counts.leaves} leaves, ${counts.sunflowers} sunflowers, ${counts.blooms} blooms)`)
