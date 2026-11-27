import fs from 'node:fs'
import * as THREE from 'three'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { readGlb, writeGlb as packedGlb } from '../../tools/lib/glbpack.mjs'
import { rel } from '../../tools/lib/paths.mjs'
import { loadLayout, loadRoof } from '../village/layout.mjs'
import { loadSource } from '../trunk/source.mjs'
import { Bag, KIND, TILE_MM, add3, clamp, fbm, lin, mix3, mul3, noise, norm3, rng, smooth, surf, writePng } from '../village/kit.mjs'

const L = await loadLayout()
const RF = await loadRoof()
const [TF] = await loadSource(['/src/seasons/summer/mini/turf.ts'])
const C = L.cottage
const R = rng(7717)
const TAU = Math.PI * 2
const sc = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const pick = (list) => list[Math.floor(R() * list.length) % list.length]
const range = (a, b) => a + (b - a) * R()

const IVY = { leaves: 520, roses: 14, low: 4.5, size: 0.85, coat: 620, coatSize: 1.45, coatRoses: 18, coatOut: [0.5, 1.2] }
const LEAF = { cup: 0.6, sink: 0.07, lift: 0.1, shadeMm: 0.28, shadeDropMm: 0.22, shadeTone: 0.1 }
const TURF = { lumpMm: 0.6, fineMm: 0.12, sandMm: 1.3, sandReach: 5.0, sandSides: 0.35 }
const GRASS = { tufts: 21000, keep: 0.6, edge: 1100, edgeFrom: 0.1, edgeTo: 0.6, edgeWide: 1.6, edgeTuft: [1.3, 2.6], edgeLean: [0.35, 0.9], blades: 3, tall: [0.4, 1.15], clump: 1.5, wide: [0.13, 0.23], rimTall: 1.5, sandFrom: 0.55, sandTo: 1.0, edgeTall: 1.0, dye: [0.85, 0.72, 1.0] }
const BLOOMS_KEEP = 0.2
const LEVEL = { seed: 4107, medium: { back: 0.4, front: 0.72 }, low: { back: 0.25, front: 0.5 }, zFrom: -12, zTo: 6 }
const WATER_CLEAR_MM = 2.2
// The turf comes down over the upper half of the bank; under it lies the sand, a thin pale layer against the glass.
// Of the bank only its upper three tenths stand over the collar: there the rows lie close (`rowsPow`).
const BANK = { turfTo: 0.03, turfVary: 0.05, turfLeast: 0.012, sandTo: 0.3, rowsPow: 1.8, hang: 220, hangTuft: [0.7, 1.7], hangWide: 1.5, hangDown: 0.25, lawn: 250, rootMm: 0.62, tipMm: 0.42 }
const turfTo = (th) => clamp(BANK.turfTo + BANK.turfVary * fbm(Math.cos(th) * 9 + 2.3, Math.sin(th) * 9 + 9.1, 4.7, 3) + 0.02 * fbm(Math.cos(th) * 41 + 5.1, Math.sin(th) * 41 + 1.3, 7.9, 2), BANK.turfLeast, 0.2)
const STEP = { seed: 9091, rise: 0.4, pale: 2.4, fenceFrontMm: 6, fenceLow: 0.4, at: [[150, 0.93, 2.6], [171, 0.9, 3.1], [192, 0.92, 2.7], [212, 0.9, 3.0]] }
const STONE = { lift: 1.7, buried: 0.25, sink: 0.45, lumps: 0.36, chips: 0.11, wet: 0.6, moss: 0.8, mossFrom: 0.5, mossTo: 0.85, foot: 0.4, top: 1.2, rim: 18, rimTufts: 420, tones: ['#8f887a', '#a39a88', '#7b7568', '#b0a692', '#9a8c74', '#6f6a62'] }
// The bank as the approved image has it: the path's slabs and a row of loaves along the pond's far rim, brown, worn smooth and
// mossy on top, pebbles at the water's edge and reeds in the shallows. The rubble that lay at the pond's left end is left out;
// its stones keep their numbers in the run, so that the lawn and the flowers stand where they stood.
const LOAF = { seed: 5081, dome: 0.85, shear: 0.25, sink: 0.3, wet: 0.45, tones: ['#a8957f', '#b3a08c', '#9c8872', '#bba995'], lumps: 0.12, chips: 0.03, moss: 0.85, mossFrom: 0.35, mossTo: 0.7, mossTone: '#5f7030', lift: 1.0, foot: 0.8, top: 0.3, crease: 0.3, creaseMm: 0.45, heel: 0.45, heelMm: 0.8, row: [[-4.4, -0.5, 2.4, 1.3, 0.42], [-1.4, -0.75, 2.3, 1.25, 0.44], [1.6, -0.45, 2.5, 1.3, 0.4], [4.6, -0.7, 2.3, 1.25, 0.44], [7.4, -0.45, 1.9, 1.1, 0.42]], hide: [262, 246, 230, 214, 199, 255, 239, 222, 207, 188, 173, 161], fill: 2.2 }
// The path's slabs keep their flat tops and take the loaves' pale grey brown.
const SLAB = { tones: ['#a8957f', '#b3a08c', '#9c8872', '#bba995'], lumps: 0.16, chips: 0.04, moss: 0.6, mossFrom: 0.5, mossTo: 0.85, mossTone: '#6f7a3c', lift: 1.0, foot: 0.7, top: 0.4, heel: 0.5, heelMm: 0.6 }
// Pebbles lie in handfuls at the loaves' feet and along the rims, not in an even string.
const PEBBLE = { clusters: 22, each: [4, 9], spread: 1.5, size: [0.25, 0.65], fine: 0.45, from: 150, to: 400, feet: 6, clearMm: 0.2, tones: ['#b5a58c', '#cfc2a8', '#9a8a74', '#ddd0b8'], lumps: 0.2, chips: 0.05, moss: 0.25, mossFrom: 0.5, mossTo: 0.85, lift: 0.8, foot: 0.75, top: 0.35, wet: 0.5, crease: 0.35, creaseMm: 0.3, heel: 0.5, heelMm: 0.3 }
const REED = { blades: 6, tall: [2.5, 4.5], wide: [0.2, 0.32], lean: [0.04, 0.28], standDeg: 5, stands: [[165, 5], [178, 7], [192, 6], [215, 3], [305, 3], [325, 5], [342, 7], [357, 6], [375, 5]], dry: { x: -17.5, z: 24.6, r: 1.5, n: 9, tall: 0.75 }, sun: { rim: [[24, 3], [34, 4], [44, 4], [54, 4], [64, 3], [74, 3], [84, 3], [94, 3], [104, 3], [114, 4], [124, 4], [134, 4], [144, 4], [154, 3]], field: [0.985, 1.03], lawn: [[29, 12, 5, 9], [32, 21, 4.5, 9], [27, 28, 3.5, 6], [19, 10, 3, 4], [-18, 30, 4, 4], [-16, 38, 3, 3], [-1.5, 1.5, 2.6, 9], [4.2, 0.5, 3, 12], [2, -3.5, 3.5, 10]], tries: 6, blades: 7, tall: [1.2, 2.3], rimTall: [0.8, 1.5], wide: [0.15, 0.24], top: TF.SUN_TUFT.top, neck: TF.SUN_TUFT.neck, fan: 0.35, lit: [0.55, 1.0], rimLit: [0.8, 1.0] } }
const GARLAND = { seed: 5087, r: 5.4, from: 0.1, to: 0.86, over: 18, down: 9, w: [0.6, 1.5], leaves: 13, leaf: 1.1, tone: [0.35, 1.1], shade: 0.4, rose: [0.4, 0.6], roseEvery: 1, shrubRose: 1.35 }
const TONES = {
  grass: ['#1c3413', '#274616', '#30531a', '#213c15'].map(lin),
  tip: ['#566f27', '#6b8230', '#465f20'].map(lin),
  straw: ['#c9b674', '#d8c88c', '#b9a460'].map(lin),
  earth: lin('#2a3019'),
  mud: lin('#1b2013'),
  sand: lin('#efe5ca'),
  bed: lin('#16201c'),
  leaf: ['#233d18', '#2f4e1d', '#1d3516', '#395a24'].map(lin),
  rose: ['#e9a0a8', '#f2c3bd', '#f4e3cf', '#d97f8e', '#f0d2c0'].map(lin),
  petal: ['#f2a516', '#f7b82a', '#e3930f', '#f9c33a'].map((c) => mul3(lin(c), 1.15)),
  moss: lin('#5f7430'),
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
const sandAt = (x, z) => (1 - smooth(0.5, TURF.sandReach * (0.45 + 1.3 * clamp(0.5 + 1.3 * fbm(x * 0.13 + 1.7, z * 0.13 + 5.3, 3.3, 3)) + 0.5 * clamp(0.5 + 1.5 * fbm(x * 0.45 + 8.1, z * 0.45 + 2.9, 6.7, 2))), wallGap(x, z))) * (TURF.sandSides + (1 - TURF.sandSides) * front(x, z))
const blob = (x, z, cx, cz, rx, rz) => Math.exp(-(((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2))
// Where the low sun reaches the floor between the crown, the trunk and the cottage (read off the approved image): right of
// the trunk out to the sunflowers, behind the lamp, a little by the fence and on the near right bank.
const sunAt = (x, z) => clamp((1.5 * blob(x, z, 24, 4, 13, 9) + 0.7 * blob(x, z, 6, -4, 9, 6) + 0.4 * blob(x, z, -24, 21, 6, 5) + 1.0 * blob(x, z, 24, 22, 9, 6) + 1.2 * blob(x, z, -17.5, 24.6, 2.4, 2.0)) * (0.5 + 1.0 * clamp(0.5 + 1.4 * fbm(x * 0.3 + 9, z * 0.3 + 4, 6.1, 2))))
const turfAt = (x, z) => TURF.lumpMm * fbm(x * 0.22 + 3.1, z * 0.22 + 1.7, 2.2, 3) + TURF.fineMm * fbm(x * 0.9, z * 0.9, 5.5, 2)
const topAt = (x, z) => L.groundAt(x, z) + TF.riseAt(x, z) + turfAt(x, z) * smooth(0.98, 1.1, L.pondField(x, z)) + TURF.sandMm * sandAt(x, z) * (0.3 + 0.7 * fbm(x * 0.26, z * 0.26, 9, 3) + 0.9 * clamp(0.5 + 1.2 * fbm(x * 0.075 + 4.4, z * 0.075 + 9.1, 2.9, 2)))
const keepHard = (role) => role === 'cottage' || role === 'chimney' || role === 'path' || role === 'post' || role === 'fence'
const hardGap = (x, z) => L.solidDistance(x, L.groundAt(x, z) + 0.6, z, keepHard)
const trunkGap = (x, z) => Math.hypot(x - L.tree.x, z - L.tree.z) - 5.2
// Triangles are counted, so no tuft is planted where neither the hero lens nor the macro lens sees it: behind the cottage,
// behind the trunk, on ground that falls away from both. Behind the house the rest of the lawn is thinned, where tufts hide tufts.
const SHOW = JSON.parse(fs.readFileSync(new URL('../../config/showcase.json', import.meta.url), 'utf8'))
const lensAt = (c) => {
  const yaw = c.yawDeg * Math.PI / 180
  const pitch = c.pitchDeg * Math.PI / 180
  const centre = SHOW.globe.baseHeightMm - SHOW.globe.collarDepthMm + SHOW.globe.sphereDiameterMm / 2
  return [c.distanceMm * Math.sin(yaw) * Math.cos(pitch), c.aimHeightMm - centre + c.distanceMm * Math.sin(pitch), c.distanceMm * Math.cos(yaw) * Math.cos(pitch)]
}
const LENSES = [lensAt(SHOW.cameras.hero), lensAt(SHOW.cameras.macro)]
if (!LENSES.every((p) => p.every(Number.isFinite))) throw new Error('village-summer: the lenses are not read')
const HIDE = { stepMm: 0.8, wallIn: 0.8, trunkMm: 2.2, trunkTall: 14, groundMm: 0.25, farFrom: 8, farTo: 24, farKeep: 0.74 }
const houseO = L.cottagePoint(0, 0, 0)
const houseU = [L.cottagePoint(0, 0, 1)[0] - houseO[0], L.cottagePoint(0, 0, 1)[2] - houseO[2]]
const houseV = [L.cottagePoint(1, 0, 0)[0] - houseO[0], L.cottagePoint(1, 0, 0)[2] - houseO[2]]
const seenAt = (x, y, z) => LENSES.some((lens) => {
  const d = norm3([lens[0] - x, lens[1] - y, lens[2] - z])
  for (let s = HIDE.stepMm; s < 2 * L.innerRadiusMm; s += HIDE.stepMm) {
    const qx = x + d[0] * s
    const qy = y + d[1] * s
    const qz = z + d[2] * s
    if (Math.hypot(qx, qy, qz) > L.innerRadiusMm) return true
    if (qy < houseO[1] + C.wall && Math.abs((qx - houseO[0]) * houseU[0] + (qz - houseO[2]) * houseU[1]) < C.halfLength - HIDE.wallIn && Math.abs((qx - houseO[0]) * houseV[0] + (qz - houseO[2]) * houseV[1]) < C.halfWidth - HIDE.wallIn) return false
    if (qy < houseO[1] + HIDE.trunkTall && Math.hypot(qx - L.tree.x, qz - L.tree.z) < HIDE.trunkMm) return false
    if (qy < topAt(qx, qz) - HIDE.groundMm) return false
  }
  return true
})
let unseen = 0

// The bank's turf is the lawn's green: it knows nothing of the pond's mud above it.
const slopeTone = (x, z) => mul3(mix3(TONES.tip[2], TONES.tip[1], clamp(0.5 + 0.9 * fbm(x * 0.16 + 7, z * 0.16 + 2, 1.1, 3))), 1.1)

function groundTone(x, z) {
  const f = L.pondField(x, z)
  const patch = fbm(x * 0.16 + 7, z * 0.16 + 2, 1.1, 3)
  const g = mix3(TONES.grass[0], TONES.grass[2], clamp(0.5 + 0.9 * patch))
  const shore = 1 - smooth(1.0, 1.09, f)
  const bare = clamp(Math.exp(-Math.max(hardGap(x, z), 0) / 0.9) * 0.7 + Math.exp(-Math.max(trunkGap(x, z), 0) / 1.6) * 0.5)
  let c = mix3(g, TONES.earth, clamp(0.25 + 0.5 * bare))
  c = mix3(c, TONES.mud, shore)
  c = mix3(c, TONES.bed, 1 - smooth(0.88, 0.98, f))
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
        const q = Math.pow((k - shore.length - outer + 1) / skirt, BANK.rowsPow)
        const phi = phi0 + (Math.min(phi1, phi0 - 0.12) - phi0) * q
        const ux = Math.cos(th) * Math.sin(phi)
        const uy = -Math.cos(phi)
        const uz = Math.sin(th) * Math.sin(phi)
        const lump = clamp(0.5 + 0.75 * fbm(ux * 9 + 3.1, uy * 9, uz * 9 + 7.7, 3))
        const rr = r - 0.15 - 0.3 * lump * smooth(0.05, 0.4, q)
        x = ux * rr
        y = uy * rr
        z = uz * rr
        const q0 = turfTo(th)
        under = q < q0 ? (q - q0) / q0 - 1e-3 : (q - q0) / (BANK.sandTo - q0) + 1e-3
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
  ground.add(g, { color: (p, _n, i) => mix3(below[i] < 0 ? slopeTone(p[0], p[2]) : groundTone(p[0], p[2]), mix3(TONES.earth, TONES.sand, 0.8 + 0.2 * front(p[0], p[2])), smooth(0, 0.25, below[i])), surf: (p, _n, i) => [below[i] > 0 ? 1 : 0, below[i]], uv: (p, n) => (Math.abs(n[1]) > 0.55 ? [p[0], p[2]] : [Math.atan2(p[2], p[0]) * 56, p[1] * 1.3]) })
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
      // The sheet stops short of the glass: at the front the pond's own edge lies beyond the bank.
      let t = rho / unit
      const within = (tt) => Math.hypot(L.pond.x + dx * tt, L.moundAt(L.pond.z + dz * tt) - L.pond.level, L.pond.z + dz * tt) < L.innerRadiusMm - WATER_CLEAR_MM
      while (t > 0 && !within(t)) t -= 0.05
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

// One stone, worn flat on top, half sunk, mossy where it faces up. It draws its numbers from the run it is given and returns its turn.
function stone(x, z, rx, rz, rise, rnd, detail, pale = 1, look = null, turn = null, others = null) {
  const lk = look && look !== 'hide' ? look : STONE
  const rg = (a, b) => a + (b - a) * rnd()
  const drawn = rg(0, TAU)
  const yaw = turn === null ? drawn : turn
  const h = rx * rise
  const g = new THREE.IcosahedronGeometry(1, detail)
  const P = g.getAttribute('position')
  const seed = rnd() * 50
  const cap = rg(0.45, 0.8)
  const tilt = [rg(-0.3, 0.3), rg(-0.3, 0.3)]
  const sink = lk.sink ?? STONE.sink
  for (let i = 0; i < P.count; i++) {
    const nx = P.getX(i)
    const ny = P.getY(i)
    const nz = P.getZ(i)
    const k = 1 + lk.lumps * (noise(nx * 1.25 + seed, ny * 1.25, nz * 1.25) - 0.5) * 2 + lk.chips * (noise(nx * 4.3 + seed, ny * 4.3 + 5, nz * 4.3) - 0.5) * 2
    if (lk.dome) {
      // A loaf is round over its whole top and full at its shoulders: seen from the side it shows its lit back, not a dark flank under a thin cap.
      const r = Math.hypot(nx, nz)
      const f = r > 1e-6 ? r ** lk.dome / r : 1
      P.setXYZ(i, nx * f * rx * k, (ny + lk.shear * (tilt[0] * nx + tilt[1] * nz) * Math.max(ny, 0)) * h * k, nz * f * rz * k)
      continue
    }
    // A stone that water has worn is flat on top and broken at its edge, not a ball.
    const top = cap + tilt[0] * nx + tilt[1] * nz
    const sy = ny > top ? top + (ny - top) * 0.22 : ny
    P.setXYZ(i, nx * rx * k, (sy / cap) * h * k, nz * rz * k)
  }
  g.rotateY(yaw)
  const y = L.groundAt(x, z) + TF.riseAt(x, z) + h * (1 - 2 * sink) + 0.1
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
  const tone = mul3(lin(lk.tones[Math.floor(rnd() * lk.tones.length) % lk.tones.length]), rg(0.8, 1.3) * pale)
  if (look === 'hide') return yaw
  // A stone that would stand in the glass at the front is left out, its place kept bare: through the bank it showed as a dark mark.
  if (Math.hypot(x, y, z) + Math.max(rx, rz) * (1 + lk.lumps + lk.chips) > L.innerRadiusMm - WATER_CLEAR_MM) return yaw
  // Wet and dark where the stone stands in the pond, dry and pale above.
  const wetAt = (p) => (1 - smooth(1.0, 1.1, L.pondField(p[0], p[2]))) * (1 - smooth(0.1, 0.9, p[1] - (L.moundAt(p[2]) - L.pond.level)))
  const mossAt = (p) => lk.moss * smooth(lk.mossFrom, lk.mossTo, (p[1] - (y - h)) / (2 * h)) * smooth(0.3, 0.6, noise(p[0] * 1.6 + seed, p[1] * 1.6, p[2] * 1.6))
  const mossTone = lk.mossTone ? lin(lk.mossTone) : TONES.moss
  // Stones that lie against each other are dark in the crease between them, and dark at the heel where they meet the ground or the water.
  const creaseAt = (p) => {
    if (!others || !lk.crease) return 1
    let d = Infinity
    for (const o of others) {
      if (o.x === x && o.z === z) continue
      const c = Math.cos(o.yaw)
      const sn = Math.sin(o.yaw)
      const lx = (p[0] - o.x) * c - (p[2] - o.z) * sn
      const lz = (p[0] - o.x) * sn + (p[2] - o.z) * c
      d = Math.min(d, (Math.hypot(lx / o.rx, (p[1] - o.y) / o.h, lz / o.rz) - 1) * Math.min(o.rx, o.h, o.rz))
    }
    return lk.crease + (1 - lk.crease) * smooth(0, lk.creaseMm, d)
  }
  const heelAt = (p) => {
    if (!lk.heel) return 1
    const floor = L.pondField(p[0], p[2]) < 1 ? Math.max(topAt(p[0], p[2]), L.moundAt(p[2]) - L.pond.level) : topAt(p[0], p[2])
    return lk.heel + (1 - lk.heel) * smooth(0, lk.heelMm, p[1] - floor)
  }
  const wet = lk.wet ?? STONE.wet
  decor.add(g, { color: (p) => mul3(mix3(mul3(tone, lk.lift * (lk.foot + lk.top * clamp((p[1] - (y - h)) / (2 * h)) ** 2 + 0.5 * (noise(p[0] * 2.1 + seed, p[1] * 2.1, p[2] * 2.1) - 0.5) + 0.25 * (noise(p[0] * 7 + seed, p[1] * 7, p[2] * 7) - 0.5)) * (1 - wet * wetAt(p))), mossTone, mossAt(p)), creaseAt(p) * heelAt(p)), surf: [surf(KIND.stone, 0.85), 0], renormal: true })
  return yaw
}

// Rounded stepping stones from the door down to the pond's left shore and along it, over the shared path's small slabs.
const stoneList = []
const loafList = []
const loafSet = []
function gapTo(list, x, z) {
  let d = Infinity
  for (const [sx, sz, rx, rz, yaw] of list) {
    const c = Math.cos(yaw)
    const s = Math.sin(yaw)
    const lx = (x - sx) * c - (z - sz) * s
    const lz = (x - sx) * s + (z - sz) * c
    d = Math.min(d, (Math.hypot(lx / rx, lz / rz) - 1) * Math.min(rx, rz))
  }
  return d
}
function shoreAt(deg, field) {
  const a = (deg / 180) * Math.PI
  let t = 0
  while (t < 60 && L.pondField(L.pond.x + Math.cos(a) * t, L.pond.z + Math.sin(a) * t) < field) t += 0.05
  return [L.pond.x + Math.cos(a) * t, L.pond.z + Math.sin(a) * t]
}
{
  const edgeAt = (deg, field) => {
    const a = (deg / 180) * Math.PI
    let t = 0
    while (t < 60 && L.pondField(L.pond.x + Math.cos(a) * t, L.pond.z + Math.sin(a) * t) < field) t += 0.05
    return [L.pond.x + Math.cos(a) * t, L.pond.z + Math.sin(a) * t]
  }
  const shore = [[262, 1.1, 1.7], [246, 1.09, 2.1], [230, 1.085, 2.9], [214, 1.08, 2.2], [199, 1.08, 3.1], [150, 1.07, 2.4], [133, 1.065, 1.9], [38, 1.07, 2.0], [4, 1.075, 2.6]]
  // Between the large stones lie small ones at no even step, some half in the water: the bank is no ring of one size.
  const small = [[255, 1.05, 1.0], [239, 1.04, 0.8], [222, 1.05, 1.25], [207, 1.035, 0.9], [188, 1.05, 1.4], [173, 1.06, 1.0], [161, 1.04, 0.75], [142, 1.045, 1.1], [121, 1.06, 1.3], [98, 1.06, 0.85], [61, 1.055, 1.0], [23, 1.05, 1.2], [287, 1.065, 1.3]]
  const along = [...L.stones.map(([x, z], i) => [x, z, 2.3 + 0.22 * i, 1.7 + 0.12 * i, 0.3, 3, SLAB]), ...[...shore, ...small].map(([deg, f, w]) => [...edgeAt(deg + range(-3, 3), f), w * range(0.85, 1.2), w * range(0.55, 0.85), range(0.34, 0.56), w < 1.5 ? 2 : 3, LOAF.hide.includes(deg) ? 'hide' : null])]
  for (const [x, z, rx, rz, rise, detail, look] of along) stoneList.push([x, z, rx, rz, stone(x, z, rx, rz, rise, R, detail, 1, look), look === 'hide'])
  // Flat pale stones stand in the shallow water at the pond's left end, mossy on top: stepping stones, from a run of their own
  // so that the lawn and the flowers keep their places.
  const S = rng(STEP.seed)
  for (const [deg, f, w] of STEP.at) {
    const [x, z] = edgeAt(deg, f)
    const rx = w * (0.95 + 0.2 * S())
    const rz = w * (0.68 + 0.14 * S())
    stoneList.push([x, z, rx, rz, stone(x, z, rx, rz, STEP.rise, S, 2, STEP.pale)])
  }
  // The loaves lie packed along the far rim, each turned along it, so that one stands against the next.
  const B = rng(LOAF.seed)
  const rimZ = (x) => {
    let z = L.pond.z
    while (L.pondField(x, z) < 1 && z > -30) z -= 0.02
    return z
  }
  for (const [i, [x, off, rx, rz, rise]] of LOAF.row.entries()) {
    const z = rimZ(x) + off
    const h = rx * rise
    loafSet.push({ x, z, rx, rz, rise, h, yaw: -Math.atan2(rimZ(x + 0.5) - rimZ(x - 0.5), 1) + 0.25 * Math.sin(i * 2.4 + 1), y: L.groundAt(x, z) + TF.riseAt(x, z) + h * (1 - 2 * LOAF.sink) + 0.1 })
  }
  for (const o of loafSet) loafList.push([o.x, o.z, o.rx, o.rz, stone(o.x, o.z, o.rx, o.rz, o.rise, B, 4, 1, LOAF, o.yaw, loafSet)])
}
const stoneGap = (x, z) => gapTo(stoneList, x, z)
const loafGap = (x, z) => gapTo(loafList, x, z)

let tufts = 0
let planted = 0
let filled = 0
let pebbles = 0
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
  // Two tufts in five are left out by a run of numbers of their own: the lawn's run stays as long as it was, so the flowers set after it keep their places.
  const K = rng(4421)
  const fenceLong = Math.hypot(L.fence.to[0] - L.fence.from[0], L.fence.to[1] - L.fence.from[1])
  const fenceRun = [(L.fence.to[0] - L.fence.from[0]) / fenceLong, (L.fence.to[1] - L.fence.from[1]) / fenceLong]
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
    // Tuft by tuft the sun is caught or missed, and each tuft has its own depth of green: the lawn reads as blades, not as a wash.
    const own = (k) => { const v = Math.sin(x * 12.9898 * k + z * 78.233 + k * 3.7) * 43758.5453; return v - Math.floor(v) }
    const lit = sunAt(x, z) * (own(1) < 0.28 ? 0.2 : 0.75 + 0.6 * own(2))
    const deep = own(3) < 0.3 ? 0.5 : 0.85 + 0.7 * own(4)
    const lush = clamp(0.55 + 0.9 * fbm(x * 0.16 + 7, z * 0.16 + 2, 1.1, 3))
    const worn = Math.exp(-Math.max(hardGap(x, z), 0) / 1.6)
    if (R() < 0.55 * worn) continue
    const y0 = topAt(x, z) - 0.05
    // The grass before the fence is cropped short: its lower rail is seen over it.
    const fx = x - L.fence.from[0]
    const fz = z - L.fence.from[1]
    const fenceT = (fx * fenceRun[0] + fz * fenceRun[1]) / fenceLong
    const fenceOff = fz * fenceRun[0] - fx * fenceRun[1]
    const cropped = 1 - (1 - STEP.fenceLow) * smooth(-1.5, -0.5, fenceOff) * (1 - smooth(STEP.fenceFrontMm * 0.6, STEP.fenceFrontMm, fenceOff)) * smooth(-0.2, -0.05, fenceT) * (1 - smooth(1.05, 1.2, fenceT))
    // Most of the lawn is short as moss; here and there a clump of tufts stands over it.
    const clump = smooth(0.56, 0.8, clamp(0.5 + 1.5 * fbm(x * 0.5 + 31, z * 0.5 + 17, 4.4, 2)))
    const tall = range(GRASS.tall[0], GRASS.tall[1]) * (1 + GRASS.clump * clump) * (0.6 + 0.6 * lush) * (1 - 0.45 * worn) * (1 + (GRASS.rimTall - 1) * smooth(1.035, 1.09, f) * (1 - smooth(1.09, 1.25, f))) * (1 + GRASS.edgeTall * smooth(0.06, 0.4, sand)) * cropped
    const patch = 0.45 + 0.75 * clamp(0.5 + 1.4 * fbm(x * 0.09 + 3, z * 0.09 + 11, 2.3, 2))
    const base = mul3(mix3(pick(TONES.grass), pick(TONES.straw), sand * 0.25), patch * deep)
    const top = mul3(mix3(pick(TONES.tip), pick(TONES.straw), clamp(sand * 0.3 + 0.08 * R())), patch * deep)
    const cell = { key: morton(x, z), pos: [], nor: [], col: [], tip: [], sun: [] }
    const seen = seenAt(x, y0 + 1.1 * tall, z)
    if (!seen) unseen++
    if (K() < (seen ? GRASS.keep * (1 - (1 - HIDE.farKeep) * smooth(HIDE.farFrom, HIDE.farTo, -z)) : 0) && loafGap(x, z) >= 0.15) {
      list.push(cell)
      planted++
    }
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
        cell.col.push(c[0] * (0.32 + 0.95 * t) * GRASS.dye[0], c[1] * (0.32 + 0.95 * t) * GRASS.dye[1], c[2] * (0.32 + 0.95 * t) * GRASS.dye[2])
        cell.tip.push(t)
        cell.sun.push(lit)
      }
    }
    tufts++
  }
  // Tufts that grow out over the bank's upper edge, from a run of numbers of their own so that the lawn and the flowers keep their places.
  const E = rng(9137)
  const er = (a, b) => a + (b - a) * E()
  const ep = (set) => set[Math.floor(E() * set.length) % set.length]
  let over = 0
  for (let i = 0; i < GRASS.edge * 40 && over < GRASS.edge; i++) {
    const a = E() * TAU
    const rr = edge - E() * 13
    const x = Math.cos(a) * rr
    const z = Math.sin(a) * rr
    if (wallGap(x, z) < 0.7 || front(x, z) < 0.25) continue
    const sand = sandAt(x, z)
    if (sand < GRASS.edgeFrom || sand > GRASS.edgeTo) continue
    if (L.pondField(x, z) < 1.035 || hardGap(x, z) < 0.3 || stoneGap(x, z) < 0.15) continue
    const y0 = topAt(x, z) - 0.05
    const lit = clamp(0.25 + 0.3 * E() + 0.35 * smooth(-10, 25, x))
    const deep = 0.7 + 0.6 * E()
    const base = mul3(ep(TONES.grass), deep * 1.3)
    const top = mul3(mix3(ep(TONES.tip), ep(TONES.straw), 0.15), deep)
    const cell = { key: morton(x, z), pos: [], nor: [], col: [], tip: [], sun: [] }
    const up = norm3([(E() - 0.5) * 0.5, 1, (E() - 0.5) * 0.5])
    const out = norm3([x, 0, z])
    for (let b = 0; b < GRASS.blades; b++) {
      const yaw = Math.atan2(out[2], out[0]) + er(-1.3, 1.3)
      const lean = er(GRASS.edgeLean[0], GRASS.edgeLean[1])
      const dir = [Math.cos(yaw), 0, Math.sin(yaw)]
      const side = [-dir[2], 0, dir[0]]
      const w = er(GRASS.wide[0], GRASS.wide[1]) * GRASS.edgeWide
      const h = er(GRASS.edgeTuft[0], GRASS.edgeTuft[1])
      const ox = x + er(-0.25, 0.25)
      const oz = z + er(-0.25, 0.25)
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
    if (seenAt(x, y0 + GRASS.edgeTuft[1], z)) {
      list.push(cell)
      planted++
    } else unseen++
    over++
  }
  // The turf comes down over the bank: tufts laid on its upper half, hanging toward the sand, and tufts on the lawn's edge
  // where the sand lay before. Both come from a run of numbers of their own.
  {
    const H = rng(5519)
    const hr = (a, b) => a + (b - a) * H()
    const hp = (set) => set[Math.floor(H() * set.length) % set.length]
    const r = L.innerRadiusMm - 0.6
    const phi1 = Math.acos(clamp(-(L.collarY - 1.5) / r, -1, 1))
    const rimAt = (th) => {
      let lo = 20
      let hi = r
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2
        const y = topAt(Math.cos(th) * mid, Math.sin(th) * mid)
        if (mid * mid + y * y < r * r) lo = mid
        else hi = mid
      }
      return Math.atan2(lo, -topAt(Math.cos(th) * lo, Math.sin(th) * lo))
    }
    const push = (cell, A, B, T, base, top, up, lit) => {
      for (const [q, c, t] of [[A, base, 0], [B, base, 0], [T, top, 1]]) {
        cell.pos.push(...q)
        cell.nor.push(...up)
        cell.col.push(c[0] * (0.32 + 0.95 * t), c[1] * (0.32 + 0.95 * t), c[2] * (0.32 + 0.95 * t))
        cell.tip.push(t)
        cell.sun.push(lit)
      }
    }
    for (let i = 0; i < BANK.hang; i++) {
      const th = hr(-0.5, Math.PI + 0.5)
      const phi0 = rimAt(th)
      const q = hr(0, turfTo(th))
      const phi = phi0 + (Math.min(phi1, phi0 - 0.12) - phi0) * q
      const out = [Math.cos(th) * Math.sin(phi), -Math.cos(phi), Math.sin(th) * Math.sin(phi)]
      const down = [-Math.cos(th) * Math.cos(phi), -Math.sin(phi), -Math.sin(th) * Math.cos(phi)]
      const round = [-Math.sin(th), 0, Math.cos(th)]
      const root = sc(out, L.innerRadiusMm - BANK.rootMm)
      const lit = clamp(0.12 + 0.3 * H() + 0.2 * smooth(-10, 25, root[0]))
      const deep = 0.7 + 0.6 * H()
      const base = mul3(hp(TONES.tip), deep * 0.8)
      const top = mul3(mix3(hp(TONES.tip), hp(TONES.straw), 0.1), deep * 1.5)
      const cell = { key: morton(root[0], root[2]), pos: [], nor: [], col: [], tip: [], sun: [] }
      const up = norm3([out[0] * 0.5 + (H() - 0.5) * 0.4, 1, out[2] * 0.5 + (H() - 0.5) * 0.4])
      for (let b = 0; b < GRASS.blades; b++) {
        // Most blades grow up the slope, laid against it; one in four hangs down over the sand.
        const yaw = hr(-1.2, 1.2)
        const way = H() < BANK.hangDown ? 1 : -1
        const dir = add3(sc(down, way * Math.cos(yaw)), sc(round, Math.sin(yaw)))
        const side = add3(sc(round, Math.cos(yaw)), sc(down, -way * Math.sin(yaw)))
        const w = hr(GRASS.wide[0], GRASS.wide[1]) * BANK.hangWide
        const h = hr(BANK.hangTuft[0], BANK.hangTuft[1])
        const o = add3(root, add3(sc(round, hr(-0.3, 0.3)), sc(down, hr(-0.3, 0.3))))
        const tip = sc(norm3(add3(o, sc(dir, h))), L.innerRadiusMm - BANK.tipMm)
        push(cell, add3(o, sc(side, -w)), add3(o, sc(side, w)), tip, base, top, up, lit)
      }
      list.push(cell)
      planted++
    }
    let lawn = 0
    for (let i = 0; i < BANK.lawn * 60 && lawn < BANK.lawn; i++) {
      const a = H() * TAU
      const rr = edge - H() * 9
      const x = Math.cos(a) * rr
      const z = Math.sin(a) * rr
      if (wallGap(x, z) < 0.7 || sandAt(x, z) < 0.45) continue
      if (L.pondField(x, z) < 1.035 || hardGap(x, z) < 0.3 || stoneGap(x, z) < 0.15) continue
      const y0 = topAt(x, z) - 0.05
      const lit = clamp(0.25 + 0.3 * H() + 0.35 * smooth(-10, 25, x))
      const deep = 0.7 + 0.6 * H()
      const base = mul3(hp(TONES.grass), deep * 1.3)
      const top = mul3(mix3(hp(TONES.tip), hp(TONES.straw), 0.15), deep)
      const cell = { key: morton(x, z), pos: [], nor: [], col: [], tip: [], sun: [] }
      const up = norm3([(H() - 0.5) * 0.5, 1, (H() - 0.5) * 0.5])
      const out = norm3([x, 0, z])
      for (let b = 0; b < GRASS.blades; b++) {
        const yaw = Math.atan2(out[2], out[0]) + hr(-1.5, 1.5)
        const lean = hr(GRASS.edgeLean[0], GRASS.edgeLean[1])
        const dir = [Math.cos(yaw), 0, Math.sin(yaw)]
        const side = [-dir[2], 0, dir[0]]
        const w = hr(GRASS.wide[0], GRASS.wide[1]) * GRASS.edgeWide
        const h = hr(GRASS.edgeTuft[0], GRASS.edgeTuft[1]) * 0.8
        const ox = x + hr(-0.25, 0.25)
        const oz = z + hr(-0.25, 0.25)
        let T = [ox + dir[0] * h * lean, y0 + h, oz + dir[2] * h * lean]
        const far = Math.hypot(T[0], T[1], T[2])
        if (far > L.innerRadiusMm - BANK.tipMm) T = sc(T, (L.innerRadiusMm - BANK.tipMm) / far)
        push(cell, [ox - side[0] * w, y0, oz - side[2] * w], [ox + side[0] * w, y0, oz + side[2] * w], T, base, top, up, lit)
      }
      if (seenAt(x, y0 + GRASS.edgeTuft[1] * 0.8, z)) {
        list.push(cell)
        planted++
      } else unseen++
      lawn++
    }
  }
  // The pond's rim is broken: small mossy stones half in the water between the large ones, and tufts that lean out over it.
  // Both come from a run of numbers of their own, after the lawn is set.
  {
    const W = rng(7331)
    const wr = (a, b) => a + (b - a) * W()
    const wp = (set) => set[Math.floor(W() * set.length) % set.length]
    const pc = Math.cos(L.pond.yaw)
    const ps = Math.sin(L.pond.yaw)
    const rimAt = (a, field) => {
      const dx = Math.cos(a) * pc + Math.sin(a) * ps
      const dz = -Math.cos(a) * ps + Math.sin(a) * pc
      let t = 0
      while (t < 60 && L.pondField(L.pond.x + dx * t, L.pond.z + dz * t) < field) t += 0.05
      return [L.pond.x + dx * t, L.pond.z + dz * t, dx, dz]
    }
    const before = stoneList.length
    for (let i = 0; i < STONE.rim * 8 && stoneList.length - before < STONE.rim; i++) {
      const [x, z] = rimAt(wr(0, TAU), wr(0.985, 1.03))
      const w = wr(0.6, 1.25)
      const rx = w * wr(0.85, 1.2)
      const rz = w * wr(0.55, 0.85)
      const rise = wr(0.4, 0.62)
      if (stoneGap(x, z) < 0.4 || wallGap(x, z) < 3 || hardGap(x, z) < 0.5) continue
      stoneList.push([x, z, rx, rz, stone(x, z, rx, rz, rise, W, 1, 1, loafGap(x, z) < 0.3 ? 'hide' : null), loafGap(x, z) < 0.3])
    }
    let rim = 0
    for (let i = 0; i < STONE.rimTufts * 30 && rim < STONE.rimTufts; i++) {
      const [x, z, dx, dz] = rimAt(wr(0, TAU), wr(1.0, 1.05))
      const tall = wr(1.0, 2.3)
      const deep = 0.7 + 0.7 * W()
      const lit = clamp(0.15 + 0.35 * W())
      if (stoneGap(x, z) < 0.15 || wallGap(x, z) < 2.4 || hardGap(x, z) < 0.3) continue
      const y0 = topAt(x, z) - 0.05
      const base = mul3(wp(TONES.grass), deep * 1.2)
      const top = mul3(mix3(wp(TONES.tip), wp(TONES.straw), 0.1), deep)
      const cell = { key: morton(x, z), pos: [], nor: [], col: [], tip: [], sun: [] }
      const up = norm3([(W() - 0.5) * 0.5, 1, (W() - 0.5) * 0.5])
      for (let b = 0; b < GRASS.blades; b++) {
        const yaw = Math.atan2(-dz, -dx) + wr(-1.1, 1.1)
        const lean = wr(0.45, 1.0)
        const dir = [Math.cos(yaw), 0, Math.sin(yaw)]
        const side = [-dir[2], 0, dir[0]]
        const wd = wr(GRASS.wide[0], GRASS.wide[1]) * 1.3
        const h = tall * wr(0.6, 1.1)
        const ox = x + wr(-0.25, 0.25)
        const oz = z + wr(-0.25, 0.25)
        for (const [q, c, t] of [[[ox - side[0] * wd, y0, oz - side[2] * wd], base, 0], [[ox + side[0] * wd, y0, oz + side[2] * wd], base, 0], [[ox + dir[0] * h * lean, y0 + h * 0.8, oz + dir[2] * h * lean], top, 1]]) {
          cell.pos.push(...q)
          cell.nor.push(...up)
          cell.col.push(c[0] * (0.32 + 0.95 * t), c[1] * (0.32 + 0.95 * t), c[2] * (0.32 + 0.95 * t))
          cell.tip.push(t)
          cell.sun.push(lit)
        }
      }
      if (loafGap(x, z) >= 0.15) {
        list.push(cell)
        planted++
      }
      rim++
    }
  }
  const shown = stoneList.filter((s) => !s[5])
  // Reeds stand in the shallows and along the rim, wider than the lawn's blades: from a run of numbers of their own.
  {
    const Q = rng(LOAF.seed + 2)
    const qr = (a, b) => a + (b - a) * Q()
    const qp = (set) => set[Math.floor(Q() * set.length) % set.length]
    let reeds = 0
    // They grow in stands at the pond's two ends and between the loaves, and one dry stand catches the sun at the fence's last post.
    const places = []
    for (const [deg, n] of REED.stands) for (let k = 0; k < n; k++) places.push(() => shoreAt(deg + qr(-REED.standDeg, REED.standDeg), qr(0.975, 1.03)))
    for (let k = 0; k < REED.dry.n; k++) places.push(() => { const a = qr(0, TAU); const d = REED.dry.r * Math.sqrt(Q()); return [REED.dry.x + Math.cos(a) * d, REED.dry.z + Math.sin(a) * d * 0.7] })
    const shade = places.length
    const rimEnd = shade + REED.sun.rim.reduce((sum, [, n]) => sum + n, 0)
    // Tufts the low sun shines through stand last in the run, so the reeds before them keep their places: a ragged fringe along
    // the pond's near rim and clusters on the banks. Their blades are broad, face the lens and end in a short point over a
    // neck, three triangles each, so that a quality level drops whole blades. The shader knows them by a surface number of 2 and more.
    for (const [deg, n] of REED.sun.rim) for (let k = 0; k < n; k++) places.push(() => shoreAt(deg + qr(-REED.standDeg, REED.standDeg), qr(REED.sun.field[0], REED.sun.field[1])))
    for (const [cx, cz, r, n] of REED.sun.lawn) for (let k = 0; k < n; k++) places.push(() => { const a = qr(0, TAU); const d = r * Math.sqrt(Q()); return [cx + Math.cos(a) * d, cz + Math.sin(a) * d * 0.7] })
    for (const [i, place] of places.entries()) {
      const dry = i >= shade - REED.dry.n && i < shade
      const sun = i >= shade
      const rim = sun && i < rimEnd
      let [x, z] = place()
      const tall = rim ? qr(REED.sun.rimTall[0], REED.sun.rimTall[1]) : sun ? qr(REED.sun.tall[0], REED.sun.tall[1]) : qr(REED.tall[0], REED.tall[1]) * (dry ? REED.dry.tall : 1)
      const deep = 0.8 + 0.5 * Q()
      const lit = dry ? clamp(0.8 + 0.3 * Q()) : clamp(0.45 + 0.45 * Q())
      const taken = () => gapTo(shown, x, z) < 0.1 || loafGap(x, z) < 0.1 || hardGap(x, z) < 0.5
      // A sun tuft that would stand in a stone looks for a place beside it; a reed keeps the one draw it always had.
      if (sun) for (let t = 1; t < REED.sun.tries && taken(); t++) [x, z] = place()
      if (taken()) continue
      const y0 = Math.max(topAt(x, z), L.moundAt(z) - L.pond.level) - 0.05
      const base = mul3(qp(TONES.grass), deep * 1.6)
      const top = mul3(mix3(qp(TONES.tip), qp(TONES.straw), dry ? 0.6 : 0.4), deep * 1.15)
      const cell = { key: morton(x, z), pos: [], nor: [], col: [], tip: [], sun: [] }
      const up = norm3([(Q() - 0.5) * 0.4, 1, (Q() - 0.5) * 0.4])
      for (let b = 0; b < (sun ? REED.sun.blades : REED.blades); b++) {
        if (sun) {
          const turn = qr(-0.5, 0.5)
          const side = [Math.cos(turn), 0, Math.sin(turn)]
          const w = qr(REED.sun.wide[0], REED.sun.wide[1])
          const h = tall * qr(0.55, 1.1)
          const ox = x + qr(-0.45, 0.45)
          const oz = z + qr(-0.3, 0.3)
          const own = 2 + (rim ? qr(REED.sun.rimLit[0], REED.sun.rimLit[1]) : qr(REED.sun.lit[0], REED.sun.lit[1]))
          let T = [ox + h * qr(-REED.sun.fan, REED.sun.fan), y0 + h, oz + h * qr(-0.15, 0.15)]
          const far = Math.hypot(T[0], T[1], T[2])
          if (far > L.innerRadiusMm - BANK.tipMm) T = sc(T, (L.innerRadiusMm - BANK.tipMm) / far)
          const O = [ox, y0, oz]
          const N = [O[0] + (T[0] - O[0]) * REED.sun.neck, O[1] + (T[1] - O[1]) * REED.sun.neck, O[2] + (T[2] - O[2]) * REED.sun.neck]
          const A = [[O[0] - side[0] * w, O[1], O[2] - side[2] * w], base, 0]
          const B = [[O[0] + side[0] * w, O[1], O[2] + side[2] * w], base, 0]
          const NA = [[N[0] - side[0] * w * REED.sun.top, N[1], N[2] - side[2] * w * REED.sun.top], top, REED.sun.neck]
          const NB = [[N[0] + side[0] * w * REED.sun.top, N[1], N[2] + side[2] * w * REED.sun.top], top, REED.sun.neck]
          for (const [q, c, t] of [A, B, NB, A, NB, NA, NA, NB, [T, top, 1]]) {
            cell.pos.push(...q)
            cell.nor.push(...up)
            cell.col.push(c[0] * (0.32 + 0.95 * t), c[1] * (0.32 + 0.95 * t), c[2] * (0.32 + 0.95 * t))
            cell.tip.push(t)
            cell.sun.push(own)
          }
          continue
        }
        const yaw = Q() * TAU
        const lean = qr(REED.lean[0], REED.lean[1])
        const dir = [Math.cos(yaw), 0, Math.sin(yaw)]
        const side = [-dir[2], 0, dir[0]]
        const w = qr(REED.wide[0], REED.wide[1])
        const h = tall * qr(0.55, 1.1)
        const ox = x + qr(-0.3, 0.3)
        const oz = z + qr(-0.3, 0.3)
        let T = [ox + dir[0] * h * lean, y0 + h, oz + dir[2] * h * lean]
        const far = Math.hypot(T[0], T[1], T[2])
        if (far > L.innerRadiusMm - BANK.tipMm) T = sc(T, (L.innerRadiusMm - BANK.tipMm) / far)
        for (const [q, c, t] of [[[ox - side[0] * w, y0, oz - side[2] * w], base, 0], [[ox + side[0] * w, y0, oz + side[2] * w], base, 0], [T, top, 1]]) {
          cell.pos.push(...q)
          cell.nor.push(...up)
          cell.col.push(c[0] * (0.32 + 0.95 * t), c[1] * (0.32 + 0.95 * t), c[2] * (0.32 + 0.95 * t))
          cell.tip.push(t)
          cell.sun.push(lit)
        }
      }
      list.push(cell)
      planted++
      reeds++
    }
  }
  // Where the rubble lay the lawn has closed: tufts from a run of numbers of their own, toned as the lawn about them.
  {
    const F = rng(LOAF.seed + 3)
    const fr = (a, b) => a + (b - a) * F()
    const fp = (set) => set[Math.floor(F() * set.length) % set.length]
    for (const [sx, sz, rx, rz, yaw, hidden] of stoneList) {
      if (!hidden) continue
      const c = Math.cos(yaw)
      const s = Math.sin(yaw)
      const n = Math.round(LOAF.fill * Math.PI * (rx + 0.3) * (rz + 0.3))
      for (let i = 0; i < n; i++) {
        const a = F() * TAU
        const q = Math.sqrt(F())
        const lx = Math.cos(a) * q * (rx + 0.3)
        const lz = Math.sin(a) * q * (rz + 0.3)
        const x = sx + lx * c + lz * s
        const z = sz - lx * s + lz * c
        const tall = fr(GRASS.tall[0], GRASS.tall[1]) * (1 + GRASS.clump * smooth(0.56, 0.8, clamp(0.5 + 1.5 * fbm(x * 0.5 + 31, z * 0.5 + 17, 4.4, 2)))) * (0.6 + 0.6 * clamp(0.55 + 0.9 * fbm(x * 0.16 + 7, z * 0.16 + 2, 1.1, 3)))
        const deep = F() < 0.3 ? 0.5 : 0.85 + 0.7 * F()
        const lit = sunAt(x, z) * (F() < 0.28 ? 0.2 : 0.75 + 0.6 * F())
        const patch = 0.45 + 0.75 * clamp(0.5 + 1.4 * fbm(x * 0.09 + 3, z * 0.09 + 11, 2.3, 2))
        const base = mul3(fp(TONES.grass), patch * deep)
        const top = mul3(mix3(fp(TONES.tip), fp(TONES.straw), 0.08 * F()), patch * deep)
        const up = norm3([(F() - 0.5) * 0.5, 1, (F() - 0.5) * 0.5])
        const cell = { key: morton(x, z), pos: [], nor: [], col: [], tip: [], sun: [] }
        for (let b = 0; b < GRASS.blades; b++) {
          const turn = F() * TAU
          const lean = fr(0.15, 0.75)
          const dir = [Math.cos(turn), 0, Math.sin(turn)]
          const side = [-dir[2], 0, dir[0]]
          const w = fr(GRASS.wide[0], GRASS.wide[1])
          const h = tall * fr(0.6, 1.1)
          const ox = x + fr(-0.25, 0.25)
          const oz = z + fr(-0.25, 0.25)
          const y0 = topAt(x, z) - 0.05
          for (const [p, tone, t] of [[[ox - side[0] * w, y0, oz - side[2] * w], base, 0], [[ox + side[0] * w, y0, oz + side[2] * w], base, 0], [[ox + dir[0] * h * lean, y0 + h, oz + dir[2] * h * lean], top, 1]]) {
            cell.pos.push(...p)
            cell.nor.push(...up)
            cell.col.push(tone[0] * (0.32 + 0.95 * t) * GRASS.dye[0], tone[1] * (0.32 + 0.95 * t) * GRASS.dye[1], tone[2] * (0.32 + 0.95 * t) * GRASS.dye[2])
            cell.tip.push(t)
            cell.sun.push(lit)
          }
        }
        if (L.pondField(x, z) < 1.035 || hardGap(x, z) < 0.3 || wallGap(x, z) < 0.7 || gapTo(shown, x, z) < 0.15 || loafGap(x, z) < 0.15) continue
        list.push(cell)
        planted++
        filled++
      }
    }
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

// Pebbles lie at the water's edge, some half in it, in handfuls: from a run of numbers of their own, after every other stone is set.
{
  const P = rng(LOAF.seed + 1)
  const pr = (a, b) => a + (b - a) * P()
  const shown = stoneList.filter((s) => !s[5])
  const centres = []
  for (let i = 0; i < PEBBLE.feet; i++) {
    const o = loafSet[i % loafSet.length]
    centres.push([o.x + pr(-1.3, 1.3), o.z + o.rz * pr(0.95, 1.5)])
  }
  for (let i = 0; i < PEBBLE.clusters; i++) centres.push(shoreAt(pr(PEBBLE.from, PEBBLE.to), pr(0.99, 1.06)))
  const set = []
  for (const [cx, cz] of centres) {
    const n = Math.round(pr(PEBBLE.each[0], PEBBLE.each[1]))
    for (let k = 0; k < n; k++) {
      const a = pr(0, TAU)
      const d = PEBBLE.spread * Math.sqrt(P())
      const x = cx + Math.cos(a) * d
      const z = cz + Math.sin(a) * d * 0.7
      const w = pr(PEBBLE.size[0], PEBBLE.size[1]) * (k === 0 ? 1.25 : 1)
      const rx = w * pr(0.9, 1.3)
      const rz = w * pr(0.7, 1.0)
      const rise = pr(0.5, 0.8)
      const yaw = pr(0, TAU)
      if (gapTo(shown, x, z) < 0.1 || loafGap(x, z) < -0.2 || hardGap(x, z) < 0.3) continue
      if (set.some((o) => Math.hypot(o.x - x, o.z - z) < 0.5 * (o.rx + rx))) continue
      const h = rx * rise
      const y = L.groundAt(x, z) + TF.riseAt(x, z) + h * (1 - 2 * STONE.sink) + 0.1
      // One that the water would cover is left out.
      if (L.pondField(x, z) < 1 && y + h < L.moundAt(z) - L.pond.level + PEBBLE.clearMm) continue
      set.push({ x, z, rx, rz, rise, h, yaw, y })
    }
  }
  const near = [...loafSet, ...set]
  for (const o of set) {
    stone(o.x, o.z, o.rx, o.rz, o.rise, P, o.rx > PEBBLE.fine ? 1 : 0, 1, PEBBLE, o.yaw, near)
    pebbles++
  }
}

const leafSurf = [surf(KIND.leaf, 0.8), 0]
const leafBits = { pos: [], nor: [], col: [] }
// What is muted keeps its numbers in the run and is left out of the mesh.
let mute = false
// A leaf is cupped along its midrib, lobed at its edge and paler along the rib. What shapes it comes from its own place, not
// from the run of numbers, so that everything set after it keeps its place. A prominent one (`fine`) has three lobes.
function leaf(p, out, size, tone, rnd = R, fine = false, shade = 0) {
  const tipDir = norm3([out[0] + (rnd() - 0.5) * 1.1, out[1] * 0.5 + 0.3 + (rnd() - 0.5) * 0.8, out[2] + (rnd() - 0.5) * 1.1])
  const sideV = norm3([tipDir[1] * out[2] - tipDir[2] * out[1] + (rnd() - 0.5) * 0.4, tipDir[2] * out[0] - tipDir[0] * out[2], tipDir[0] * out[1] - tipDir[1] * out[0] + (rnd() - 0.5) * 0.4])
  const len = size * (0.8 + 0.5 * rnd())
  if (mute) return
  const w = len * 0.32
  const nn = norm3(add3(sc(out, 0.75), [0, 0.35, 0]))
  const own = (k) => {
    const v = Math.sin(p[0] * 12.9898 * k + p[1] * 78.233 + p[2] * 37.719 + k * 3.7) * 43758.5453
    return v - Math.floor(v)
  }
  const at = (t, side, lift) => add3(add3(add3(p, sc(tipDir, len * t)), sc(sideV, w * side)), sc(nn, len * lift))
  const nSide = (side) => norm3(add3(nn, sc(sideV, -LEAF.cup * side)))
  const A = [p, 0.5, nn]
  const Cc = [at(1, 0, LEAF.lift * (own(5) - 0.3)), 1.1, nn]
  const M = [at(0.5, 0, -LEAF.sink), 1.4, nn]
  const B = [at(0.32 + 0.14 * own(1), 1.0 + 0.5 * own(2), 0), 0.8, nSide(1)]
  const D = [at(0.32 + 0.14 * own(3), -1.0 - 0.5 * own(4), 0), 0.8, nSide(-1)]
  const tris = fine
    ? (() => {
        const B2 = [at(0.6 + 0.08 * own(6), 0.42 + 0.2 * own(7), 0), 0.9, nSide(0.6)]
        const D2 = [at(0.6 + 0.08 * own(8), -0.42 - 0.2 * own(9), 0), 0.9, nSide(-0.6)]
        return [A, B, M, B, B2, M, B2, Cc, M, Cc, D2, M, D2, D, M, D, A, M]
      })()
    : [A, B, M, B, Cc, M, Cc, D, M, D, A, M]
  for (const [q, k, n] of tris) {
    leafBits.pos.push(...q)
    leafBits.nor.push(...n)
    leafBits.col.push(tone[0] * k, tone[1] * k, tone[2] * k)
  }
  // The shade a leaf lays on the masonry under it: a dark card of its outline, a little lower and nearer the wall.
  if (shade > 0 && own(10) < shade) {
    const low = (v) => add3(add3(v, sc(nn, -LEAF.shadeMm)), [0, -LEAF.shadeDropMm, 0])
    const dark = mul3(tone, LEAF.shadeTone)
    for (const v of [A[0], B[0], Cc[0], A[0], Cc[0], D[0]]) {
      leafBits.pos.push(...low(v))
      leafBits.nor.push(...nn)
      leafBits.col.push(...dark)
    }
  }
}

function blossom(p, out, r, tone, petals = 6, rnd = R) {
  const g = new THREE.IcosahedronGeometry(1, 1)
  const P = g.getAttribute('position')
  const seed = rnd() * 40
  if (mute) return
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
  const n = ivy ? 5 : 11
  for (let i = 0; i < n; i++) {
    const yy = ivy ? range(-0.7, 0.85) : range(-0.1, 0.9)
    const a = ivy ? wallOut + (R() - 0.5) * 2.2 : R() * TAU
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy))
    const d = [Math.cos(a) * rr, yy, Math.sin(a) * rr]
    const p = [sh.centre[0] + d[0] * sh.r[0] * 1.02, sh.centre[1] + d[1] * sh.r[1] * 1.02, sh.centre[2] + d[2] * sh.r[2] * 1.02]
    blossom(p, d, range(0.32, 0.52) * GARLAND.shrubRose, pick(TONES.rose))
    counts.roses++
    for (let k = 0; k < 4; k++) leaf(add3(p, [range(-0.6, 0.6), range(-0.6, 0.6), range(-0.6, 0.6)]), d, 0.8, mul3(pick(TONES.leaf), range(0.7, 1.5)))
  }
}

{
  const wallZ = C.halfLength + 0.3
  const door = C.door
  const sill = 0
  const climb = []
  const arch = (t) => {
    const a = Math.PI * t
    return [door.across - Math.cos(a) * (door.width / 2 + 1.7), sill + (door.height - 0.4) * Math.min(1, 1.5 * Math.sin(a)) + 2.6 * Math.sin(a)]
  }
  for (let i = 0; i <= 60; i++) climb.push({ at: arch(i / 60), w: 0.8 })
  for (let i = 0; i <= 40; i++) {
    const t = i / 40
    climb.push({ at: [-C.halfWidth + 0.5 + t * 0.9, 0.5 + t * (C.wall + 1.5) + 0.5 * Math.sin(t * 9)], w: 0.9 })
  }
  for (let i = 0; i <= 30; i++) {
    const t = i / 30
    climb.push({ at: [-C.halfWidth + 2.2 + t * (door.across - door.width / 2 + C.halfWidth - 2), C.wall + 0.6 + 0.8 * Math.sin(t * 7) + 1.4 * t], w: 0.8 })
  }
  for (let i = 0; i <= 24; i++) {
    const t = i / 24
    climb.push({ at: [C.halfWidth - 0.5 - t * 1.2, 0.4 + t * (C.wall - 1) + 0.5 * Math.sin(t * 8)], w: 1.2 })
  }
  const outV = sc(L.cottagePoint(0, 0, 1).map((v, i) => v - L.cottagePoint(0, 0, 0)[i]), 1)
  const out = norm3([outV[0], 0.15, outV[2]])
  // The climbs around the door, up the corners and under the eaves hid the arch's ring: they keep their numbers and are left out.
  mute = true
  for (const c of climb) {
    for (let k = 0; k < 4; k++) {
      const p = L.cottagePoint(c.at[0] + range(-c.w, c.w), c.at[1] + range(-c.w, c.w), wallZ + range(0, 0.5))
      leaf(p, out, 1.25, mul3(pick(TONES.leaf), range(0.35, 1.1)), R, true, 0.5)
    }
    if (R() < 0.3) {
      const p = L.cottagePoint(c.at[0] + range(-c.w, c.w), c.at[1] + range(-c.w, c.w), wallZ + 0.55)
      blossom(p, out, range(0.42, 0.68), pick(TONES.rose))
    }
  }
  mute = false
  // The garland as the approved image has it: pale roses and small leaves in an arc close over the arch, its ring left open,
  // and a trail down the right of the door that widens to its foot. A run of numbers of its own.
  {
    const G = rng(GARLAND.seed)
    const gr = (a, b) => a + (b - a) * G()
    const gp = (set) => set[Math.floor(G() * set.length) % set.length]
    const spring = door.height - door.width / 2
    const footA = door.across + Math.cos(Math.PI * GARLAND.from) * GARLAND.r
    const footU = spring + Math.sin(Math.PI * GARLAND.from) * GARLAND.r
    const line = []
    for (let i = GARLAND.over; i >= 0; i--) {
      const a = Math.PI * (GARLAND.from + (GARLAND.to - GARLAND.from) * (i / GARLAND.over))
      line.push([door.across + Math.cos(a) * GARLAND.r, spring + Math.sin(a) * GARLAND.r, GARLAND.w[0]])
    }
    for (let i = 1; i <= GARLAND.down; i++) {
      const t = i / GARLAND.down
      line.push([footA + 0.4 * Math.sin(t * 7), footU - t * (footU - 0.8), GARLAND.w[0] + (GARLAND.w[1] - GARLAND.w[0]) * t])
    }
    for (const [i, [across, up, w]] of line.entries()) {
      for (let k = 0; k < GARLAND.leaves; k++) leaf(L.cottagePoint(across + gr(-w, w), up + gr(-w, w), wallZ + gr(0, 0.5)), out, GARLAND.leaf, mul3(gp(TONES.leaf), gr(GARLAND.tone[0], GARLAND.tone[1])), G, k === 0, GARLAND.shade)
      if (i % GARLAND.roseEvery === 0) {
        blossom(L.cottagePoint(across + gr(-0.6, 0.6), up + gr(-0.6, 0.6), wallZ + 0.6), out, gr(GARLAND.rose[0], GARLAND.rose[1]), gp(TONES.rose), 6, G)
        counts.roses++
      }
    }
  }
  // The side wall is half grown over: ivy from the footing up to an uneven line under the eaves, open around the window.
  const sideV = L.cottagePoint(-1, 0, 0).map((v, i) => v - L.cottagePoint(0, 0, 0)[i])
  const sideOut = norm3([sideV[0], 0.15, sideV[2]])
  const win = C.sideWindow
  const open = (along, up) => Math.abs(along - win.along) < win.width / 2 + 0.5 && up > win.sill - 0.5 && up < win.sill + win.height + 0.6
  // The first small leaves and roses lie under the coat now. They keep their numbers in the run, so that all that comes
  // after them stands where it stood, and are left out of the mesh.
  const marks = [decor.p, decor.n, decor.c, decor.uv, decor.s, decor.i, leafBits.pos, leafBits.nor, leafBits.col].map((a) => [a, a.length])
  const counted = { ...counts }
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
  for (const [a, n] of marks) a.length = n
  Object.assign(counts, counted)
  // Over the small leaves lies a coat of larger ones up to an uneven line under the eaves, with roses in it: the wall is
  // grown over. It comes from a run of numbers of its own.
  const V = rng(6143)
  const vr = (a, b) => a + (b - a) * V()
  const vp = (set) => set[Math.floor(V() * set.length) % set.length]
  for (let i = 0; i < IVY.coat; i++) {
    const along = vr(-C.halfLength + 0.2, C.halfLength - 0.1)
    const top = C.wall - 0.3 - 1.8 * clamp(0.5 + 1.3 * fbm(along * 0.5 + 1.2, 3.7, 5.9, 2))
    const up = 0.3 + (top - 0.3) * Math.pow(V(), 0.9)
    const outMm = vr(IVY.coatOut[0], IVY.coatOut[1])
    const tone = mul3(vp(TONES.leaf), vr(0.6, 1.5))
    if (open(along, up)) continue
    leaf(L.cottagePoint(-C.halfWidth - outMm, up, along), sideOut, IVY.coatSize, tone, V, true)
    counts.leaves++
  }
  for (let i = 0; i < IVY.coatRoses; i++) {
    const along = vr(-C.halfLength + 1, C.halfLength - 1)
    const up = vr(1.5, C.wall - 1.6)
    const r = vr(0.6, 0.95)
    const tone = vp(TONES.rose)
    if (open(along, up)) continue
    blossom(L.cottagePoint(-C.halfWidth - IVY.coatOut[1] - 0.1, up, along), sideOut, r, tone, 6, V)
    counts.roses++
  }
}

function sunflower(x, z, tall, face) {
  const y0 = topAt(x, z) - 0.1
  const bend = [face[0] * 0.9, 0, face[2] * 0.9]
  const lean = [range(0.7, 1.5) * (R() < 0.5 ? -1 : 1), range(-0.8, 0.8)]
  const tip = [range(-1, 1), range(-0.5, 0.5)]
  const pts = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    const s = Math.sin(t * Math.PI * 0.85) * tall * 0.14 + Math.sin(t * TAU) * tall * 0.03
    const off = t * tall * 0.1
    pts.push(new THREE.Vector3(x + bend[0] * t * t + lean[0] * s + tip[0] * off, y0 + tall * t - 0.35 * t * t * t, z + bend[2] * t * t + lean[1] * s + tip[1] * off))
  }
  const curve = new THREE.CatmullRomCurve3(pts)
  const stem = new THREE.TubeGeometry(curve, 10, 0.3, 5, false)
  decor.add(stem, { color: (p) => mul3(TONES.stem, 1.5 + 1.0 * ((p[1] - y0) / tall)), surf: leafSurf, renormal: true })
  const head = pts[pts.length - 1].toArray()
  const f = norm3(face)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...f))
  const hr = 0.86 * (tall * 0.1 + 0.75)
  const disc = new THREE.SphereGeometry(hr * 0.66, 12, 5, 0, TAU, 0, Math.PI / 2)
  disc.rotateX(Math.PI / 2)
  disc.scale(1, 1, 0.8)
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
      // A petal is cupped: its two edges and its tip turn away from its middle, so the light models it and it is no flat cutout.
      const cup = (side, along) => new THREE.Vector3(0.45 * Math.cos(a), 0.45 * Math.sin(a) + 0.2, 1).addScaledVector(sidev, 0.7 * side).addScaledVector(dirv, 0.6 * along).normalize().applyQuaternion(q)
      const nA = cup(-0.5, -0.4)
      const nB = cup(0.5, -0.4)
      const n1 = cup(-1, 0.1)
      const n2 = cup(1, 0.1)
      const nT = cup(0, 0.9)
      void pn
      for (const [v, s, pv] of [[A, 0.42, nA], [B, 0.42, nB], [M2, 0.95, n2], [A, 0.42, nA], [M2, 0.95, n2], [M1, 0.8, n1], [M1, 0.8, n1], [M2, 0.95, n2], [T, 1.25, nT]]) {
        const w = v.clone().applyMatrix4(place)
        pos.push(w.x, w.y, w.z)
        nor.push(pv.x, pv.y, pv.z)
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
    const size = tall * 0.3 * range(0.75, 1.2) * (1 - 0.35 * t)
    const before = leafBits.pos.length
    leaf(at, d, size, mul3(pick(TONES.leaf), range(2.2, 3.2) * 0.45), R, true)
    void before
  }
  counts.sunflowers++
  return { x, z, y0, tall }
}

const fenceDir = norm3([L.fence.to[0] - L.fence.from[0], 0, L.fence.to[1] - L.fence.from[1]])
const behind = [fenceDir[2], 0, -fenceDir[0]]
const sunList = []
for (const [t, off, tall, turn, nod] of [[-0.16, 2.6, 11.0, -0.1, 0.02], [0.22, 1.3, 5.2, 1.4, -0.7]]) {
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
  // One small flower in five stands: the lawn is moss with a few blooms in it. A run of numbers of its own picks them.
  const F = rng(6203)
  for (const [x, z] of spots) {
    if (L.pondField(x, z) < 1.05 || hardGap(x, z) < 0.5 || wallGap(x, z) < 1.5 || trunkGap(x, z) < -1.2) continue
    if (F() > BLOOMS_KEEP) continue
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
console.log(`village-summer: ${unseen} of ${tufts} places for a tuft stand where neither lens sees them and stay bare`)
console.log(`village-summer: ground ${ground.triangles}, water ${water.triangles}, grass ${grass.triangles} (${planted} tufts, ${grassMedium.length / 3} at medium, ${grassLow.length / 3} at low), decor ${decor.triangles} (${counts.roses} roses, ${counts.leaves} leaves, ${counts.sunflowers} sunflowers, ${counts.blooms} blooms, ${loafList.length} loaves, ${pebbles} pebbles, ${filled} tufts where the rubble lay)`)
