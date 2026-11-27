import fs from 'node:fs'
import * as THREE from 'three'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { addLevels } from '../../tools/lib/glblevels.mjs'
import { rel, writeJson } from '../../tools/lib/paths.mjs'
import { loadSource } from '../trunk/source.mjs'
import { loadLayout } from '../village/layout.mjs'
import { Bag, KIND, TILE_MM, clamp, fbm, frame, grainUv, lin, mix3, mul3, noise, planar, rng, shade, slab, smooth, surf, writePng } from '../village/kit.mjs'

const L = await loadLayout()
const [PROPS, RF] = await loadSource(['/src/seasons/fall/mini/props.ts', '/src/miniature/roof.ts'])
const C = L.cottage
const F = L.cottageFrame()
const U3 = [F.u[0], 0, F.u[1]]
const V3 = [F.v[0], 0, F.v[1]]
const UP = [0, 1, 0]
const R = rng(7331)
const TAU = Math.PI * 2
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z)
const between = (a, b) => a + (b - a) * R()

const SIZE = 1024
const POST_WEAR = 0.5
const ATTIC = PROPS.ATTIC
const PUMPKINS = PROPS.PUMPKINS
const STONES = PROPS.STONES
const LEAF_TONES = ['#6a3a1c', '#5a3420', '#7a4a24', '#8a3a1e', '#4e3020', '#70401f', '#a8501e', '#b8742c', '#62422a', '#7c3220'].map(lin)
const GRASS_TONES = ['#4f6a26', '#62782e', '#8f7a34', '#3f5620', '#86572a'].map(lin)

const LITTER = { base: 0.07, patch: 0.24, fence: 0.08, tree: 0.1, wall: 0.1, leaves: 520 }
const LEVELS = { medium: { error: 0.08, worth: 1 }, low: { error: 0.2, worth: 1 } }
const STONE_TONES = ['#d6d0bf', '#c4c0b2', '#e0d9c6', '#b3b0a4', '#cbc5b3'].map(lin).map((c) => [c[0] * 1.2, c[1] * 1.04, c[2] * 0.86])
const ground = new Bag('ground')
const water = new Bag('water')
const decor = new Bag('decor')
const glow = new Bag('glow')
const attic = new Bag('pane-attic')

const fenceGap = PROPS.fenceGapOf
function cottageGap(x, z) {
  const dx = x - C.x
  const dz = z - C.z
  const across = Math.abs(dx * F.v[0] + dz * F.v[1]) - C.halfWidth
  const along = Math.abs(dx * F.u[0] + dz * F.u[1]) - C.halfLength
  return Math.hypot(Math.max(across, 0), Math.max(along, 0)) + Math.min(Math.max(across, along), 0)
}
const treeGap = (x, z) => Math.hypot(x - L.tree.x, z - L.tree.z)
const PATH_LINE = PROPS.PATH_LINE
const lineGap = (x, z) => {
  let d = Infinity
  for (let i = 0; i < PATH_LINE.length - 1; i++) {
    const [ax, az] = PATH_LINE[i]
    const [bx, bz] = PATH_LINE[i + 1]
    const t = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2))
    d = Math.min(d, Math.hypot(x - ax - (bx - ax) * t, z - az - (bz - az) * t))
  }
  return d
}
const pathGap = (x, z) => Math.min(lineGap(x, z) - 2.2, ...[...L.steps, ...L.stones].map(([sx, sz]) => Math.hypot(x - sx, z - sz)))
const rockGap = (x, z) => Math.min(...PROPS.ROCKS.map((r) => Math.hypot(x - r.at[0], z - r.at[1]) - Math.max(r.r[0], r.r[2])))
const reliefAt = (x, z) => 0.42 * fbm(x * 0.33 + 3.1, z * 0.33 + 7.7, 2, 3) * smooth(1.2, 3.2, pathGap(x, z)) * smooth(1.0, 1.12, L.pondField(x, z)) * smooth(0.5, 2.5, cottageGap(x, z))
const earthAt = (x, z) => L.groundAt(x, z) + reliefAt(x, z)
const litterAt = (x, z) => {
  const base = LITTER.base + LITTER.patch * fbm(x * 0.12 + 1.7, z * 0.12 + 4.2, 5, 3)
  const byFence = LITTER.fence * (1 - smooth(0.5, 4.5, fenceGap(x, z)))
  const underTree = LITTER.tree * (1 - smooth(5, 17, treeGap(x, z)))
  const byWall = LITTER.wall * (1 - smooth(0.3, 3, cottageGap(x, z)))
  const shore = smooth(1.0, 1.16, L.pondField(x, z))
  return clamp((base + byFence + underTree + byWall) * (0.25 + 0.75 * shore), 0, 1)
}
// How much of the ground's leaf map shows: thick by the fence and under the tree, thin on the path.
const COVER = { base: 0.42, patch: 0.25, fence: 0.3, tree: 0.3, wall: 0.15, path: 0.25 }
const coverAt = (x, z) => {
  const base = COVER.base + COVER.patch * fbm(x * 0.12 + 1.7, z * 0.12 + 4.2, 5, 3)
  const byFence = COVER.fence * (1 - smooth(0.5, 5, fenceGap(x, z)))
  const underTree = COVER.tree * (1 - smooth(5, 17, treeGap(x, z)))
  const byWall = COVER.wall * (1 - smooth(0.3, 3, cottageGap(x, z)))
  const shore = smooth(1.0, 1.16, L.pondField(x, z))
  return clamp((base + byFence + underTree + byWall) * (0.25 + 0.75 * shore) * (COVER.path + (1 - COVER.path) * smooth(0.2, 2.2, pathGap(x, z))), 0, 1)
}
const mossAt = (x, z) => {
  const patch = 0.26 + 1.1 * fbm(x * 0.09 + 9.3, z * 0.09 + 2.2, 8, 3)
  const bank = 0.2 * (1 - smooth(1.02, 1.3, L.pondField(x, z)))
  const wall = 0.3 * (1 - smooth(0.2, 2.2, cottageGap(x, z)))
  return clamp(patch + bank + wall - 0.35 * (1 - smooth(4, 12, treeGap(x, z))), 0, 1)
}

{
  const rings = 100
  const around = 320
  const skirt = 8
  const r = L.innerRadiusMm - 0.6
  const pos = []
  const idx = []
  const row = around + 1
  for (let k = 0; k <= rings + skirt; k++)
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * TAU
      const edge = L.islandEdge(a)
      const c = Math.cos(a)
      const s = Math.sin(a)
      if (k <= rings) {
        const rr = edge * Math.pow(k / rings, 0.85)
        const fade = smooth(0, 3, edge - rr)
        pos.push(c * rr, L.groundAt(c * rr, s * rr) + fade * reliefAt(c * rr, s * rr), s * rr)
      } else {
        const ye = L.groundAt(c * edge, s * edge)
        const phi = Math.atan2(edge, -ye) * (1 - (0.55 * (k - rings)) / skirt)
        pos.push(c * r * Math.sin(phi), -r * Math.cos(phi), s * r * Math.sin(phi))
      }
    }
  for (let k = 0; k < rings + skirt; k++)
    for (let j = 0; j < around; j++) {
      const a = k * row + j
      const b = a + row
      idx.push(a, b + 1, b, a, a + 1, b + 1)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  const under = (p) => smooth(1.2, 4.2, L.groundAt(p[0], p[2]) - p[1])
  const wet = (x, z) => 0.28 + 0.72 * smooth(0.99, 1.1, L.pondField(x, z))
  // Contact shade: the soil is darker against the cottage's foot, under each pumpkin and along the fence line.
  const pumpkinGap = (x, z) => Math.min(...PUMPKINS.map((o) => Math.hypot(x - o.at[0], z - o.at[2]) - o.r * 0.7))
  const contact = (x, z) => (0.55 + 0.45 * smooth(0, 1.6, cottageGap(x, z))) * (0.42 + 0.58 * smooth(-0.3, 1.9, pumpkinGap(x, z))) * (0.6 + 0.4 * smooth(0.1, 1.3, fenceGap(x, z)))
  ground.add(g, {
    color: (p) => {
      const k = (0.86 + 0.24 * fbm(p[0] * 0.21, p[2] * 0.21, 1, 3)) * wet(p[0], p[2]) * contact(p[0], p[2]) * (0.62 + 0.38 * smooth(0.8, 5, treeGap(p[0], p[2]) - 4))
      const d = 1 - 0.72 * under(p)
      return [k * d, k * d, k * d]
    },
    surf: (p) => [coverAt(p[0], p[2]) * (1 - under(p)), mossAt(p[0], p[2]) * (1 - 0.6 * under(p))],
    uv: (p) => [p[0], p[2]],
  })
}

{
  const around = 160
  const rings = 26
  const pc = Math.cos(L.pond.yaw)
  const ps = Math.sin(L.pond.yaw)
  const pos = []
  const uv = []
  const st = []
  const idx = []
  for (let j = 0; j <= around; j++) {
    const a = (j / around) * TAU
    const dx = Math.cos(a) * pc + Math.sin(a) * ps
    const dz = -Math.cos(a) * ps + Math.sin(a) * pc
    const unit = L.pondField(L.pond.x + dx, L.pond.z + dz)
    for (let k = 0; k <= rings; k++) {
      const rho = (k / rings) * 1.03
      const t = rho / unit
      const x = L.pond.x + dx * t
      const z = L.pond.z + dz * t
      pos.push(x, L.moundAt(z) - L.pond.level, z)
      uv.push(x / TILE_MM, z / TILE_MM)
      st.push(rho, 0)
    }
  }
  for (let j = 0; j < around; j++)
    for (let k = 0; k < rings; k++) {
      const a = j * (rings + 1) + k
      const b = a + rings + 1
      idx.push(a, a + 1, b + 1, a, b + 1, b)
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

function inTri(px, py, a, b, c) {
  const s = (p, q) => (px - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (py - q[1])
  const d1 = s(a, b)
  const d2 = s(b, c)
  const d3 = s(c, a)
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))
}

const FACES = {
  door: (fx, fy) => {
    const ax = Math.abs(fx)
    if (inTri(ax, fy, [0.2, 0.16], [0.62, 0.3], [0.44, 0.52])) return true
    if (inTri(fx, fy, [-0.1, -0.1], [0.1, -0.1], [0, 0.1])) return true
    const u = fx / 0.7
    if (Math.abs(u) >= 1) return false
    const cy = -0.44 + 0.26 * u * u
    const t = 0.03 + 0.13 * Math.sqrt(1 - u * u)
    if (Math.abs(fy - cy) > t) return false
    if (fx > -0.36 && fx < -0.18 && fy > cy + t - 0.12) return false
    if (fx > 0.2 && fx < 0.38 && fy > cy + t - 0.12) return false
    if (fx > -0.09 && fx < 0.09 && fy < cy - t + 0.12) return false
    return true
  },
  tree: (fx, fy) => {
    const ax = Math.abs(fx)
    if (inTri(ax, fy, [0.18, 0.22], [0.58, 0.2], [0.34, 0.5])) return true
    if (inTri(fx, fy, [-0.08, -0.04], [0.08, -0.04], [0, -0.16])) return true
    const u = fx / 0.66
    if (Math.abs(u) >= 1) return false
    const cy = -0.42 + 0.2 * u * u
    const saw = 0.07 * (2 * Math.abs(((fx * 4.2 + 0.25) % 1 + 1) % 1 - 0.5))
    const t = 0.02 + 0.1 * Math.sqrt(1 - u * u)
    return fy < cy + t + saw && fy > cy - t - 0.07 + saw
  },
}

const pumpkinList = []
function pumpkin(o) {
  const nu = 220
  const nv = 100
  const H = PROPS.pumpkinTall(o)
  const centre = PROPS.pumpkinCentre(o)
  const M = new THREE.Matrix4().makeRotationZ(o.lean).premultiply(new THREE.Matrix4().makeRotationY(o.yaw)).setPosition(centre[0], centre[1], centre[2])
  const shell = (th, ph, k) => {
    const bulge = Math.pow(Math.abs(Math.sin((o.ribs * th) / 2 + 0.3)), 0.55)
    const sp = Math.sin(ph)
    const rr = o.r * k * (0.87 + 0.13 * bulge) * Math.pow(sp, 0.72) * (1 + 0.03 * noise(th * 2.2, ph * 3, o.r))
    const y = H * k * (Math.cos(ph) - 0.24 * Math.sign(Math.cos(ph)) * Math.exp(-(sp * sp) / 0.07))
    return [Math.sin(th) * rr, y, Math.cos(th) * rr, bulge]
  }
  const face = FACES[o.name]
  const cut = []
  const pos = []
  const col = []
  const inner = []
  const tone = lin('#e2681a')
  const deep = lin('#4a1604')
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const th = (i / nu) * TAU - Math.PI
      const ph = 0.0015 + (j / nv) * (Math.PI - 0.003)
      const p = shell(th, ph, 1)
      const q = shell(th, ph, 0.84)
      pos.push(p[0], p[1], p[2])
      inner.push(q[0], q[1], q[2])
      const low = smooth(-0.9, 0.2, p[1] / H)
      const c = mul3(mix3(deep, tone, 0.04 + 0.96 * smooth(0.16, 0.86, p[3])), (0.5 + 0.5 * low) * (0.78 + 0.3 * noise(th * 5, ph * 7, 3 + o.r) + 0.24 * noise(th * 19, ph * 23, 7 + o.r)))
      col.push(c[0], c[1], c[2])
      cut.push(Math.abs(th) < 1.2 && face(th, p[1] / H))
    }
  const row = nu + 1
  const body = []
  const hole = []
  const rim = []
  const gone = (a, b, c) => cut[a] && cut[b] && cut[c]
  const quadGone = new Uint8Array(nu * nv)
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * row + i
      const b = a + 1
      const c = a + row
      const d = c + 1
      const g = gone(a, c, b) && gone(b, c, d)
      quadGone[j * nu + i] = g ? 1 : 0
      ;(g ? hole : body).push(a, c, b, b, c, d)
    }
  const open = (i, j) => i >= 0 && j >= 0 && i < nu && j < nv && quadGone[j * nu + i]
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      if (!open(i, j)) continue
      const a = j * row + i
      const b = a + 1
      const c = a + row
      const d = c + 1
      if (!open(i - 1, j)) rim.push([a, c])
      if (!open(i + 1, j)) rim.push([d, b])
      if (!open(i, j - 1)) rim.push([b, a])
      if (!open(i, j + 1)) rim.push([c, d])
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(body)
  g.computeVertexNormals()
  decor.add(g, { matrix: M, surf: [surf(KIND.leaf, 0.5), 0], uv: (p) => [p[0] * 1.6, p[1] * 1.6], uvOffset: [o.r, o.yaw] })

  const hot = [1, 0.62, 0.2]
  const flesh = [1, 0.42, 0.08]
  const rp = []
  const rc = []
  for (const [a, b] of rim) {
    const pa = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]]
    const pb = [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]]
    const qa = [inner[a * 3], inner[a * 3 + 1], inner[a * 3 + 2]]
    const qb = [inner[b * 3], inner[b * 3 + 1], inner[b * 3 + 2]]
    rp.push(...pa, ...pb, ...qb, ...pa, ...qb, ...qa)
    rc.push(...mul3(flesh, 0.5), ...mul3(flesh, 0.5), ...flesh, ...mul3(flesh, 0.5), ...flesh, ...flesh)
  }
  const rg = new THREE.BufferGeometry()
  rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3))
  rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3))
  rg.setIndex(Array.from({ length: rp.length / 3 }, (_, i) => i))
  rg.computeVertexNormals()
  glow.add(rg, { matrix: M, surf: [0, pumpkinList.length / 6], uv: () => [0, 0] })

  const ic = []
  for (let k = 0; k < inner.length; k += 3) {
    const up = inner[k + 1] / (H * 0.84)
    const c = mul3(hot, 0.75 + 0.5 * (1 - smooth(-0.9, 0.5, up)))
    ic.push(c[0], c[1], c[2])
  }
  const ig = new THREE.BufferGeometry()
  ig.setAttribute('position', new THREE.Float32BufferAttribute(inner.map((v) => v * 0.99), 3))
  ig.setAttribute('color', new THREE.Float32BufferAttribute(ic, 3))
  const all = []
  for (let j = 0; j < nv; j += 4)
    for (let i = 0; i < nu; i += 4) {
      const a = j * row + i
      all.push(a, a + 4, a + 4 * row, a + 4, a + 4 * row + 4, a + 4 * row)
    }
  ig.setIndex(all)
  ig.computeVertexNormals()
  glow.add(ig, { matrix: M, surf: [1, pumpkinList.length / 6], uv: () => [0, 0] })

  const stemPts = []
  for (let k = 0; k <= 6; k++) {
    const t = k / 6
    stemPts.push(new THREE.Vector3(0.5 * o.r * 0.3 * t * t, H * 0.74 + o.r * 0.42 * t, -0.12 * o.r * t * t))
  }
  const sg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stemPts), 10, 0.1 * o.r, 7, false)
  const SP = sg.getAttribute('position')
  for (let k = 0; k < SP.count; k++) {
    const y = SP.getY(k)
    const t = clamp((y - H * 0.74) / (o.r * 0.42), 0, 1)
    const s = 1.5 - 0.75 * t
    SP.setXYZ(k, SP.getX(k) * s, y, SP.getZ(k) * s)
  }
  shade(sg, (x, y, z) => 0.7 + 0.5 * noise(x * 9, y * 3, z * 9))
  decor.add(sg, { matrix: M, color: lin('#4a4a22'), surf: [surf(KIND.wood, 0.8), 0], renormal: true })
  pumpkinList.push(+centre[0].toFixed(3), +centre[1].toFixed(3), +centre[2].toFixed(3), o.r, o.yaw, H)
}
for (const p of PUMPKINS) pumpkin(p)

// The approved roof is thick, uneven, weathered shingles in a few staggered rows, dark brown violet, with a ridge that
// sags. These lie just over the shared slope (its fine slates stay underneath, unseen), so the cottage keeps its place and size.
const CAP = { fromMm: 17.6, keep: 0.84, out: 0.42, thick: 0.9 }
const SHINGLE = { rows: 7, over: 1.5, wide: [3.4, 5.4], thick: [0.4, 0.6], rise: [0.5, 0.72], gap: 0.2, eave: 0.3, ends: 0.34, lap: 2.2, round: 0.3, ragged: 0.4, sx: 16, sz: 3, tones: ['#6e4c44', '#7d584a', '#62464c', '#8a6450', '#70525c', '#584048'].map(lin), worn: lin('#b07a55'), wear: 0.55 }
{
  const RS = rng(9241)
  const pick = (a) => a[Math.floor(RS() * a.length)]
  const ch = C.chimney
  const len = RF.roofLength
  const slope = RF.slopeLength
  const e = slope / SHINGLE.rows
  const sag = (along) => SHINGLE.ends * Math.pow(Math.abs(along) / len, 2)
  for (const sd of [-1, 1])
    for (let r = 0; r < SHINGLE.rows; r++) {
      let t = -len - 0.12 + (r % 2 ? 0 : -SHINGLE.lap) - 0.5 * RS()
      while (t < len + 0.1) {
        const w = SHINGLE.wide[0] + (SHINGLE.wide[1] - SHINGLE.wide[0]) * RS()
        const a = Math.max(t, -len - 0.14)
        const b = Math.min(t + w, len + 0.14)
        t += w
        if (b - a < 0.5) continue
        const mid = (a + b) / 2
        const lo = slope + (r === 0 ? SHINGLE.eave : 0) - r * e + (RS() - 0.5) * 0.34
        const long = e * SHINGLE.over * (0.94 + 0.12 * RS())
        const across = sd * (lo - long / 2) * Math.cos(RF.pitch)
        if (Math.abs(across - ch.across) < ch.half - 0.1 && Math.abs(mid - ch.along) < ch.halfAlong - 0.1) continue
        const thick = SHINGLE.thick[0] + (SHINGLE.thick[1] - SHINGLE.thick[0]) * RS()
        const rise = SHINGLE.rise[0] + (SHINGLE.rise[1] - SHINGLE.rise[0]) * RS()
        const seed = RS() * 90
        const skew = (RS() - 0.5) * 0.4
        const curl = 0.2 * RS()
        const g = slab(b - a - SHINGLE.gap, thick, long, { round: 0.08, sx: SHINGLE.sx, sy: 2, sz: SHINGLE.sz, warp: 0.035, seed })
        const P = g.getAttribute('position')
        const col = new Float32Array(P.count * 3)
        const tone = mul3(pick(SHINGLE.tones), 0.5 + 0.5 * RS())
        const halfW = (b - a - SHINGLE.gap) / 2
        for (let i = 0; i < P.count; i++) {
          const x = P.getX(i)
          const y = P.getY(i)
          const z = P.getZ(i)
          const k = clamp(z / long + 0.5)
          const edge = smooth(0.72, 1, k)
          const side = Math.abs(x) / halfW
          const ragged = edge * (SHINGLE.ragged * noise(x * 1.3 + seed, 3.3, 1) + 0.14 * noise(x * 4.3 + seed, 1.1, 2) - SHINGLE.round * long * Math.pow(side, 3))
          const down = lo - long / 2 + z + ragged + skew * x * edge
          const lift = 0.06 + rise * k + y + thick / 2 + curl * edge * side * side + 0.05 * noise(x * 1.7 + seed, z * 1.7, 4) + sag(mid + x)
          const q = RF.roofAt(sd, down, mid + x, lift)
          P.setXYZ(i, q[0], q[1], q[2])
          const top = smooth(-0.1, 0.1, y)
          const streak = 0.68 + 0.6 * noise(x * 3.5 + seed, z * 2.5, 7)
          const lit = top * smooth(0.8, 1, k) * (0.45 + 0.55 * smooth(0.5, 1, noise(x * 3.1 + seed, 9.2, 5) + 0.5))
          const under = 0.22 + 0.78 * smooth(0.34, 0.62, k)
          const cut = 0.16 + 0.84 * smooth(1, 0.7, side)
          const own = 0.35 + 1.3 * noise(seed, 5.7, 3)
          const c = mix3(mul3(tone, streak * (0.18 + 0.82 * top) * under * cut), SHINGLE.worn, clamp(SHINGLE.wear * own * lit))
          col.set(c, i * 3)
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3))
        decor.add(g, { surf: [surf(KIND.wood, 0.74 + 0.12 * RS()), 0], uv: grainUv([sd * V3[0] * Math.cos(RF.pitch), -Math.sin(RF.pitch), sd * V3[2] * Math.cos(RF.pitch)]), uvOffset: [RS() * 7, RS() * 7], renormal: true })
      }
    }
  const tanp = Math.tan(RF.pitch)
  let t = -len - 0.2
  let n = 0
  while (t < len + 0.2) {
    const w = 2.0 + 0.7 * RS()
    const a = t
    const b = Math.min(t + w + 0.35, len + 0.24)
    t += w
    if (b - a < 0.8) continue
    const mid = (a + b) / 2
    const reach = 1.25 + 0.3 * RS()
    const thick = 0.3 + 0.1 * RS()
    const seed = RS() * 90
    const tip = (RS() - 0.5) * 0.12
    const g = slab(b - a, thick, 2 * reach, { round: 0.08, sx: 5, sy: 2, sz: 8, warp: 0.03, seed })
    const P = g.getAttribute('position')
    const col = new Float32Array(P.count * 3)
    const tone = mul3(pick(SHINGLE.tones), 0.8 + 0.7 * RS())
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i)
      const y = P.getY(i)
      const z = P.getZ(i)
      const along = mid + x
      const lap = 0.16 * ((x + (b - a) / 2) / (b - a))
      const up = RF.ridgeY + 0.78 + sag(along) + lap + tip * x + y - (Math.sqrt(z * z + 0.09) - 0.3) * tanp + 0.04 * noise(x * 1.9 + seed, z * 1.9, 3)
      const q = L.cottagePoint(z, up, along)
      P.setXYZ(i, q[0], q[1], q[2])
      const top = smooth(-0.1, 0.1, y)
      const edge = smooth(0.7, 1, Math.abs(z) / reach)
      const c = mix3(mul3(tone, (0.45 + 0.55 * top) * (0.75 + 0.45 * noise(x * 0.9 + seed, z * 4.2, 6))), SHINGLE.worn, 0.45 * top * edge)
      col.set(c, i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    decor.add(g, { surf: [surf(KIND.wood, 0.8), 0], uv: grainUv(V3), uvOffset: [n * 1.7, n * 0.9], renormal: true })
    n++
  }
}

const stoneList = []
for (const s of STONES) {
  const g = slab(s.w, s.h, s.d, { round: 0.14, sx: 6, sy: 10, sz: 2, warp: 0.07, seed: R() * 30 })
  const P = g.getAttribute('position')
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i)
    const x = P.getX(i)
    const top = smooth(s.h / 2 - s.w * 0.55, s.h / 2, y)
    P.setXYZ(i, x * (1 - 0.1 * top), y - top * 0.5 * s.w * (1 - Math.sqrt(Math.max(0, 1 - (2 * x / s.w) ** 2 * 0.95))), P.getZ(i))
  }
  const seed = R() * 30
  shade(g, (x, y, z) => (0.6 + 0.4 * smooth(-s.h / 2, -s.h / 2 + 1.5, y)) * (0.8 + 0.4 * fbm(x * 2 + seed, y * 2, z * 2, 3)))
  const gy = PROPS.stoneBase(s)
  const M = new THREE.Matrix4().makeRotationZ(s.lean).premultiply(new THREE.Matrix4().makeRotationY(s.yaw)).setPosition(s.at[0], gy, s.at[1])
  decor.add(g, { matrix: M, color: lin('#3e403a'), surf: [surf(KIND.stone, 0.9), 0], renormal: true })
  stoneList.push(s.at[0], +gy.toFixed(3), s.at[1], s.w / 2, s.h / 2, s.d / 2, s.yaw, s.lean)
}

{
  const W = frame(L.cottagePoint(0, 0, C.halfLength), V3, UP, U3)
  const a = ATTIC
  const cy = a.sill + a.height / 2
  const FRAME = lin('#17110f')
  const bar = (w, h, x, y) => {
    const g = slab(w, h, a.out + 0.35, { round: 0.05, sx: 2, sy: 2, sz: 1, warp: 0.03, seed: R() * 40 }).applyMatrix4(T(x, y, (a.out - 0.35) / 2))
    shade(g, (px, py) => 0.8 + 0.32 * noise(px * 5, py * 5, x + y))
    decor.add(g, { matrix: W, color: mul3(FRAME, 0.9 + 0.2 * R()), surf: [surf(KIND.wood, 0.78), 0], renormal: true })
  }
  bar(a.width + 2 * a.frame, a.frame, a.across, a.sill + a.height + a.frame / 2)
  bar(a.width + 2 * a.frame + 0.5, a.frame * 1.2, a.across, a.sill - a.frame * 0.6)
  bar(a.frame, a.height, a.across - a.width / 2 - a.frame / 2, cy)
  bar(a.frame, a.height, a.across + a.width / 2 + a.frame / 2, cy)
  const back = slab(a.width + 0.2, a.height + 0.2, a.out + 0.2, { sx: 1, sy: 1, sz: 1 }).applyMatrix4(T(a.across, cy, (a.out - 0.5) / 2 - 0.1))
  decor.add(back, { matrix: W, color: lin('#141210'), surf: [surf(KIND.wood, 0.9), 0], renormal: true })
  const g = new THREE.PlaneGeometry(a.width, a.height, 1, 1).applyMatrix4(T(a.across, cy, a.out - 0.08))
  attic.add(g, { matrix: W, keepUv: true, surf: [a.width, a.height] })
}

// The shared wall is round stones about 1.3 times as wide as the approved's. Fall draws its own on the gable and the
// side wall: flat faced blocks in courses with a thin joint, each with a bevelled rim and chipped corners, standing on
// the shared mortar round the shared openings. The shared round stones are put behind the mortar at load.
const BLOCKS = { rowH: 0.9, rowJ: 0.14, wide: 1.4, wideJ: 0.4, share: [0.7, 1.3], gap: 0.06, bevel: 0.09, out: 0.3, vary: 0.05, tilt: 0.05, cut: [0.1, 0.24], cutShare: 0.5, jitter: 0.03, base: -1.8, plainBelow: -0.6, mortar: -0.5, sideDim: 0.5, gain: 0.8, tone: 0.8, rim: 0.45, chip: [0.45, 1.5], dent: 0.07, inner: 0.55, mark: 0.99, tones: ['#8c867d', '#7c766f', '#979289', '#726d66', '#837e75', '#9e988e', '#79736a', '#908a7f', '#6b6660', '#87837d'].map(lin), dirt: lin('#4b4538') }
let blockCount = 0
let blockTriangles = 0
{
  const RW = rng(4127)
  const B = BLOCKS
  const block = (W, x, y, w, h, o) => {
    const bv = Math.min(B.bevel, 0.3 * Math.min(w, h))
    const at = w / 2 - bv
    const bt = h / 2 - bv
    const top = B.mortar + (o.out ?? B.out) + (RW() - 0.5) * 2 * B.vary
    const tx = (RW() - 0.5) * 2 * B.tilt
    const ty = (RW() - 0.5) * 2 * B.tilt
    const ring = []
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cut = (o.bend || y - h / 2 > B.plainBelow) && RW() < B.cutShare ? Math.min(B.cut[0] + (B.cut[1] - B.cut[0]) * RW(), 0.7 * Math.min(at, bt)) : 0
      const j = () => (RW() - 0.5) * 2 * B.jitter
      if (cut === 0) ring.push([sx * at + j(), sy * bt + j(), sx, sy])
      else {
        const upright = [sx * at + j(), sy * (bt - cut) + j(), sx, sy]
        const level = [sx * (at - cut) + j(), sy * bt + j(), sx, sy]
        if (sx * sy > 0) ring.push(upright, level)
        else ring.push(level, upright)
      }
    }
    const place = (px, py, pz) => {
      if (o.bend) {
        const th = o.bend.at - px / o.bend.r
        return new THREE.Vector3(o.bend.cx + (o.bend.r + py) * Math.cos(th), o.bend.cy + (o.bend.r + py) * Math.sin(th), pz).applyMatrix4(W.M)
      }
      const qx = x + px
      const qy = o.rake ? Math.min(y + py, o.rake(qx)) : y + py
      return new THREE.Vector3(qx, qy, pz).applyMatrix4(W.M)
    }
    const hi = ring.map(([px, py]) => place(px, py, top + tx * px + ty * py))
    const lo = ring.map(([px, py, sx, sy]) => place(px + sx * bv, py + sy * bv, top - bv))
    const tone = mul3((o.tones ?? B.tones)[Math.floor(RW() * B.tones.length) % (o.tones ?? B.tones).length], B.gain * (0.97 - B.tone / 2 + B.tone * RW()) * (o.dim ?? 1))
    const c = mix3(tone, B.dirt, o.bend ? 0 : smooth(1.4, -1.4, y) * 0.5)
    const pos = []
    const nor = []
    const col = []
    const out = new THREE.Vector3(0, 0, 1).transformDirection(W.M)
    const tri = (a, b, d, ka, kb, kd) => {
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(d, a))
      if (n.lengthSq() < 1e-10) return
      n.normalize()
      const order = n.dot(out) < 0 ? [[a, ka], [d, kd], [b, kb]] : [[a, ka], [b, kb], [d, kd]]
      if (n.dot(out) < 0) n.negate()
      for (const [p, k] of order) {
        pos.push(p.x, p.y, p.z)
        nor.push(n.x, n.y, n.z)
        col.push(c[0] * k, c[1] * k, c[2] * k)
      }
    }
    const chip = () => B.chip[0] + (B.chip[1] - B.chip[0]) * RW()
    if (o.bend || y - h / 2 > B.plainBelow) {
      const dent = () => (RW() - 0.5) * 2 * B.dent
      const mid = place(dent(), dent(), top + dent())
      const inner = ring.map(([px, py]) => place(B.inner * px + dent(), B.inner * py + dent(), top + B.inner * (tx * px + ty * py) + dent()))
      for (let k = 0; k < ring.length; k++) {
        const m = (k + 1) % ring.length
        const a = chip()
        const b = chip()
        const d = chip()
        tri(mid, inner[k], inner[m], a, a, a)
        tri(hi[k], hi[m], inner[m], b, b, b)
        tri(hi[k], inner[m], inner[k], d, d, d)
      }
    } else {
      const k0 = chip()
      for (let k = 1; k < ring.length - 1; k++) tri(hi[0], hi[k], hi[k + 1], k0, k0, k0)
    }
    for (let k = 0; k < ring.length; k++) {
      const m = (k + 1) % ring.length
      tri(hi[k], lo[k], lo[m], 0.85, B.rim, B.rim)
      tri(hi[k], lo[m], hi[m], 0.85, B.rim, 0.85)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(Array.from({ length: pos.length / 3 }, (_, i) => i))
    decor.add(g, { surf: [surf(KIND.stone, B.mark), 0], uv: planar(W.U, W.V), uvOffset: [RW() * 7, RW() * 7] })
    blockCount++
    blockTriangles += pos.length / 9
  }
  const courses = (W, region, o = {}) => {
    let y = region.y0
    while (y < region.y1 - 0.3) {
      let h = B.rowH + (RW() - 0.5) * B.rowJ
      if (y + h > region.y1 - 0.45) h = region.y1 - y
      const ym = y + h / 2
      let spans = [[region.x0, region.x1]]
      if (region.top) {
        const half = region.top(ym)
        if (half < 0.4) break
        spans = [[Math.max(region.x0, -half), Math.min(region.x1, half)]]
      }
      for (const hole of region.holes ?? []) {
        let hx0 = hole.x0
        let hx1 = hole.x1
        if (hole.arch && y + h > hole.arch.cy + 0.2) {
          const dd = Math.max(y - hole.arch.cy, 0)
          if (dd >= hole.arch.r) continue
          const half = Math.sqrt(hole.arch.r ** 2 - dd ** 2)
          hx0 = hole.arch.cx - half
          hx1 = hole.arch.cx + half
        } else if (!(y + h > hole.y0 + 0.2 && y < hole.y1 - 0.2)) continue
        spans = spans.flatMap(([a, b]) => {
          if (hx0 >= b || hx1 <= a) return [[a, b]]
          const kept = []
          if (hx0 - a > 0.45) kept.push([a, hx0])
          if (b - hx1 > 0.45) kept.push([hx1, b])
          return kept
        })
      }
      for (const [a, b] of spans) {
        const n = Math.max(1, Math.round((b - a) / (B.wide + (RW() - 0.5) * B.wideJ)))
        const ws = Array.from({ length: n }, () => B.share[0] + (B.share[1] - B.share[0]) * RW())
        const sum = ws.reduce((t, v) => t + v, 0)
        let x = a
        for (let i = 0; i < n; i++) {
          const w = (ws[i] / sum) * (b - a)
          block(W, x + w / 2, ym, w - B.gap, h - B.gap, { ...o, rake: region.rake })
          x += w
        }
      }
      y += h
    }
  }
  const neg = (a) => [-a[0], -a[1], -a[2]]
  const front = { M: frame(L.cottagePoint(0, 0, C.halfLength), V3, UP, U3), U: V3, V: UP }
  const left = { M: frame(L.cottagePoint(-C.halfWidth, 0, 0), U3, UP, neg(V3)), U: U3, V: UP }
  const doorR = C.door.width / 2 + 1.47
  const spring = C.door.height - C.door.width / 2
  const win = C.window
  const side = C.sideWindow
  const a = ATTIC
  courses(front, {
    x0: -C.halfWidth - 0.3,
    x1: C.halfWidth + 0.3,
    y0: B.base,
    y1: C.wall + C.rise - 0.2,
    top: (y) => (y <= C.wall ? C.halfWidth + 0.3 : C.halfWidth * (1 - (y - C.wall) / C.rise)),
    rake: (x) => C.wall + C.rise * (1 - Math.abs(x) / C.halfWidth) - 0.1,
    holes: [
      { x0: C.door.across - doorR, x1: C.door.across + doorR, y0: -9, y1: spring, arch: { cx: C.door.across, cy: spring, r: doorR } },
      { x0: win.across - win.width / 2 - 0.42, x1: win.across + win.width / 2 + 0.42, y0: win.sill - 0.95, y1: win.sill + win.height + 1.25 },
      { x0: a.across - a.width / 2 - a.frame + 0.1, x1: a.across + a.width / 2 + a.frame - 0.1, y0: a.sill - 0.2, y1: a.sill + a.height + a.frame - 0.1 },
    ],
  })
  const ring = { stones: 13, deep: 1.4, out: 0.62, gap: 0.08, from: 0.4, tones: ['#a59f95', '#999388', '#aea89d', '#918b80'].map(lin) }
  const rm = C.door.width / 2 + 0.05 + ring.deep / 2
  for (let i = 0; i < ring.stones; i++) {
    const at = Math.PI * (1 - (i + 0.5) / ring.stones)
    block(front, 0, 0, (Math.PI * rm) / ring.stones - ring.gap, ring.deep - 0.1, { bend: { cx: C.door.across, cy: spring, r: rm, at }, out: ring.out + 0.1 * RW(), tones: ring.tones })
  }
  for (const sd of [-1, 1]) {
    let y = ring.from
    while (y < spring - 0.3) {
      let h = 1.0 + 0.4 * RW()
      if (y + h > spring - 0.55) h = spring - y
      block(front, C.door.across + sd * rm, y + h / 2, ring.deep - 0.12, h - ring.gap, { out: ring.out + 0.1 * RW(), tones: ring.tones })
      y += h
    }
  }
  courses(left, { x0: -C.halfLength - 0.3, x1: C.halfLength + 0.3, y0: B.base, y1: C.wall + 0.1, holes: [{ x0: side.along - side.width / 2 - 0.42, x1: side.along + side.width / 2 + 0.42, y0: side.sill - 0.95, y1: side.sill + side.height + 1.25 }] }, { dim: B.sideDim })
}

const blocked = (x, z, margin = 0) => {
  if (L.pondField(x, z) < 1.03) return true
  if (cottageGap(x, z) < 0.25 + margin) return true
  if (Math.hypot(x, z) > L.islandEdge(Math.atan2(z, x)) - 1.2) return true
  for (let i = 0; i < pumpkinList.length; i += 6) if (Math.hypot(x - pumpkinList[i], z - pumpkinList[i + 2]) < pumpkinList[i + 3] * 0.8 + margin) return true
  return false
}

const conform = (g, x, z, yaw, lift) => {
  const c = Math.cos(yaw)
  const sn = Math.sin(yaw)
  const P = g.getAttribute('position')
  for (let i = 0; i < P.count; i++) {
    const px = P.getX(i)
    const pz = P.getZ(i)
    const wx = x + px * c + pz * sn
    const wz = z - px * sn + pz * c
    P.setXYZ(i, wx, L.groundAt(wx, wz) + lift + P.getY(i), wz)
  }
  return g
}
// The approved path is warm, pinkish slate under the lamp; the cold key light greys a neutral stone, so the flags lean red.
const FLAG_TONE = [1.02, 0.9, 0.78]
// Where a stone stands in the pond it is wet: dark and smooth from the waterline up to a soak line, on the side toward the water.
const WET = { soakMm: 0.85, dark: 0.34, rough: 0.22 }
const wetAt = (p) => {
  const level = L.moundAt(p[2]) - L.pond.level
  return (1 - smooth(level + 0.1, level + WET.soakMm, p[1])) * (1 - smooth(1.05, 1.16, L.pondField(p[0], p[2])))
}
const cobble = (x, z, w, l, h, yaw, lift, dark = 1, flat = false, shore = false) => {
  const seed = R() * 40
  const g = slab(w, h, l, { round: Math.min(h * 0.48, flat ? 0.16 : 0.34), sx: flat ? 9 : 7, sy: 2, sz: flat ? 9 : 7, warp: 0.11, seed })
  const pick = mul3(STONE_TONES[Math.floor(R() * STONE_TONES.length)], between(flat ? 0.95 : 0.8, flat ? 2.3 : 1.75) * dark)
  const tone = flat ? [pick[0] * FLAG_TONE[0], pick[1] * FLAG_TONE[1], pick[2] * FLAG_TONE[2]] : pick
  const side = flat ? 0.1 : 0.2
  shade(g, (px, py, pz) => (side + (1 - side) * smooth(flat ? h * 0.1 : -h * 0.2, h * 0.45, py)) * (0.45 + 1.15 * fbm(px * 2.4 + seed, pz * 2.4, py * 2, 3)) * (0.55 + 0.45 * smooth(0, 0.45, Math.min(w / 2 - Math.abs(px), l / 2 - Math.abs(pz)))))
  if (shore) {
    decor.add(conform(g, x, z, yaw, lift), {
      color: (p) => mul3(tone, 1 - (1 - WET.dark) * wetAt(p)),
      surf: (p) => [surf(KIND.stone, 0.88 - (0.88 - WET.rough) * wetAt(p)), 0],
      renormal: true,
    })
    return
  }
  decor.add(conform(g, x, z, yaw, lift), { color: tone, surf: [surf(KIND.stone, 0.88), 0], renormal: true })
}

let flagCount = 0
{
  const d = C.door
  for (const [k, step] of [[1.35, 7.4], [3.7, 6.8], [6.1, 6.0]].entries()) {
    const at = L.cottagePoint(d.across + 0.25 * k, 0, C.halfLength + step[0])
    const seed = R() * 40
    const g = slab(step[1], 1.7, 2.6, { round: 0.24, sx: 26, sy: 3, sz: 10, warp: 0.1, seed })
    shade(g, (px, py, pz) => (0.12 + 0.88 * smooth(-0.2, 0.5, py)) * (0.45 + 1.15 * fbm(px * 2.2 + seed, pz * 2.2, py * 2, 3)) * (0.7 + 0.6 * smooth(0.35, 0.65, 0.5 + 0.5 * noise(px * 5.5 + seed, pz * 5.5, py * 3))))
    const M = frame([at[0], L.groundAt(at[0], at[2]) + 0.3 + 0.42 * (2 - k), at[2]], V3, UP, U3)
    decor.add(g, { matrix: M, color: mul3(STONE_TONES[k % STONE_TONES.length], 0.8), surf: [surf(KIND.stone, 0.88), 0], renormal: true })
    flagCount++
  }
}
{
  let carry = 0
  for (let i = 0; i < PATH_LINE.length - 1; i++) {
    const [ax, az] = PATH_LINE[i]
    const [bx, bz] = PATH_LINE[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const dx = (bx - ax) / len
    const dz = (bz - az) / len
    const yaw = Math.atan2(-dz, dx)
    let s = carry
    while (s < len) {
      const along = between(3.1, 4.3)
      const widen = 1 + 0.25 * smooth(0, PATH_LINE.length - 2, i)
      const split = between(-0.5, 0.5)
      const span = 7.0 * widen
      const left = span / 2 + split
      const right = span - left
      const cx = ax + dx * (s + along / 2)
      const cz = az + dz * (s + along / 2)
      for (const [off, w] of [[-(left / 2) - 0.08, left - 0.16], [right / 2 + 0.08, right - 0.16]]) {
        const j = between(-0.25, 0.25)
        cobble(cx - dz * off + dx * j, cz + dx * off + dz * j, along - 0.3, w, 1.3, yaw + between(-0.14, 0.14), 0.45 + between(0, 0.45), 1, true)
        flagCount++
      }
      s += along
    }
    carry = s - len
  }
}

let pebbleCount = 0
{
  let tries = 0
  while (pebbleCount < 260 && tries++ < 20000) {
    const a = R() * TAU
    const rr = 52 * Math.sqrt(R())
    const x = rr * Math.cos(a)
    const z = rr * Math.sin(a)
    if (blocked(x, z, 0.2) || pathGap(x, z) < 0.3 || treeGap(x, z) < 5 || rockGap(x, z) < 0.2) continue
    const near = 1 - smooth(0.5, 5, Math.min(pathGap(x, z), rockGap(x, z), L.pondField(x, z) * 18 - 18.5))
    if (R() > 0.12 + 0.88 * near) continue
    const size = between(0.45, 1.0) * (0.8 + 0.5 * near)
    const seed = R() * 40
    const g = slab(size, size * between(0.5, 0.75), size * between(0.65, 0.95), { round: size * 0.2, sx: 1, sy: 1, sz: 1, warp: 0.08, seed })
    shade(g, (px, py) => 0.5 + 0.6 * smooth(-size * 0.3, size * 0.3, py))
    decor.add(conform(g, x, z, R() * TAU, size * 0.12), { color: mul3(STONE_TONES[Math.floor(R() * STONE_TONES.length)], between(0.6, 1.05)), surf: [surf(KIND.stone, 0.9), 0], renormal: true })
    pebbleCount++
  }
}

let rimCount = 0
{
  const pc = Math.cos(L.pond.yaw)
  const ps = Math.sin(L.pond.yaw)
  for (let deg = 0; deg < 360; ) {
    const a = (deg / 180) * Math.PI
    const dx = Math.cos(a) * pc + Math.sin(a) * ps
    const dz = -Math.cos(a) * ps + Math.sin(a) * pc
    const west = smooth(95, 125, deg) * (1 - smooth(255, 285, deg))
    const size = between(1.5, 2.7) * (0.75 + 0.35 * west)
    const t = between(1.035, 1.075) / L.pondField(L.pond.x + dx, L.pond.z + dz)
    const x = L.pond.x + dx * t
    const z = L.pond.z + dz * t
    if (R() < 0.3 + 0.7 * west && cottageGap(x, z) > 1 && rockGap(x, z) > 0.2) {
      cobble(x, z, size, size * between(0.6, 0.9), size * between(0.55, 0.8), Math.atan2(-dx, dz) + between(-0.3, 0.3), size * 0.16, 1.05, false, true)
      rimCount++
    }
    deg += (size * 1.02 * 180) / Math.PI / (Math.hypot(dx * t, dz * t) || 1)
  }
}

for (const r of PROPS.ROCKS) {
  const g = new THREE.IcosahedronGeometry(1, 5)
  const P = g.getAttribute('position')
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i)
    const y = P.getY(i)
    const z = P.getZ(i)
    const lump = 0.3 * fbm(x * 1.1 + r.seed, y * 1.1, z * 1.1 + 3, 3)
    const bed = y * 3.2 + 0.5 * noise(x * 1.5 + r.seed, z * 1.5, 2.2)
    const ledge = 0.2 * (smooth(0.38, 0.46, bed - Math.floor(bed)) - 0.5)
    const crag = 0.3 * Math.abs(noise(x * 2.7 + 5, y * 2.7 + r.seed, z * 2.7)) + 0.12 * Math.abs(noise(x * 6.1, y * 3.2, z * 6.1 + r.seed)) + 0.05 * noise(x * 11, y * 11, z * 11 + r.seed)
    const k = 1 + lump - crag + ledge
    const flat = y < -0.4 ? -0.4 + (y + 0.4) * 0.25 : y
    P.setXYZ(i, x * k, flat * k * (1 + 0.15 * smooth(0.2, 1, y)), z * k)
  }
  shade(g, (x, y, z) => (0.5 + 0.5 * smooth(-0.4, 0.6, y)) * (0.72 + 0.6 * fbm(x * 2.2 + r.seed, y * 2.2, z * 2.2, 4)) * (1 - 0.7 * smooth(0.02, 0.12, 0.12 - Math.abs(noise(x * 2.7 + 5, y * 2.7 + r.seed, z * 2.7)))) * (1 - 0.55 * smooth(0.0, 0.08, 0.08 - Math.abs(noise(x * 6.1, y * 3.2, z * 6.1 + r.seed)))))
  const c = PROPS.rockCentre(r)
  const M = new THREE.Matrix4().makeRotationY(r.yaw).multiply(new THREE.Matrix4().makeScale(r.r[0], r.r[1], r.r[2])).setPosition(c[0], c[1], c[2])
  decor.add(g, { matrix: M, color: (p) => mix3(mul3(lin('#c6c6ba'), 0.8 + 0.4 * fbm(p[0] * 1.9 + r.seed, p[1] * 1.9, p[2] * 1.9, 3)), lin('#4c6030'), 0.85 * smooth(0.42, 0.62, fbm(p[0] * 0.45, p[1] * 0.45, p[2] * 0.45 + r.seed, 3) + 0.5)), surf: [surf(KIND.stone, 0.92), 0], renormal: true })
}

{
  const WOOD = ['#6b5e4c', '#5a4f41', '#766855', '#4e463b'].map(lin)
  for (const b of PROPS.fenceBoards()) {
    const e = [b.b[0] - b.a[0], b.b[1] - b.a[1], b.b[2] - b.a[2]]
    const len = Math.hypot(e[0], e[1], e[2])
    const Y = new THREE.Vector3(e[0] / len, e[1] / len, e[2] / len)
    const Z = new THREE.Vector3(b.out[0], 0, b.out[1])
    Z.addScaledVector(Y, -Z.dot(Y)).normalize()
    const X = new THREE.Vector3().crossVectors(Y, Z)
    const seed = R() * 50
    const g = slab(b.wide, len, b.thick, { round: 0.1, sx: b.picket ? 2 : b.post ? 8 : 5, sy: b.picket ? 3 : Math.max(4, Math.round(len * 0.9)), sz: 1, warp: b.post ? 0.04 : 0.07, seed })
    const P = g.getAttribute('position')
    const half = b.wide / 2
    const from = len / 2 - 1.7 * half
    const crown = (x) => len / 2 - half + 0.92 * Math.sqrt(Math.max(half * half - x * x, 0))
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i)
      const y = P.getY(i)
      const bite = 0.09 * noise(y * 1.3 + seed, x * 3, 0) * Math.sign(x)
      if (!b.post) {
        P.setX(i, x + bite)
        continue
      }
      const cx = Math.max(-half, Math.min(half, x))
      const up = y > from ? from + ((y - from) * (crown(cx) - from)) / (len / 2 - from) : y
      P.setXYZ(i, x + bite * (1 - smooth(from, len / 2, y)), up, P.getZ(i))
    }
    shade(g, (x, y, z) => {
      const grain = 0.2 + 0.4 * noise(x * 6.5 + seed, y * 0.7, z * 6.5)
      const split = 1 - 0.6 * smooth(0.55, 0.7, noise(x * 9 + 3, y * 0.35 + seed, 1.7))
      const end = b.post ? 1 : 0.7 + 0.7 * smooth(len / 2 - 0.7, len / 2, Math.abs(y))
      const foot = b.post ? 0.5 + 0.5 * smooth(-len / 2 + 0.4, -len / 2 + 2.2, y) : 1
      const side = b.picket ? 0 : smooth(half - 0.22, half - 0.02, Math.abs(x))
      const arch = b.post ? smooth(0.1, 0.02, crown(Math.max(-half, Math.min(half, x))) - y) : 0
      const worn = 1 + Math.max((b.post ? POST_WEAR : 5) * side, 3 * arch)
      return grain * split * end * foot * worn
    })
    const mid = [(b.a[0] + b.b[0]) / 2, (b.a[1] + b.b[1]) / 2, (b.a[2] + b.b[2]) / 2]
    const M = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(mid[0], mid[1], mid[2])
    decor.add(g, { matrix: M, color: mul3(WOOD[Math.floor(R() * WOOD.length)], between(0.75, 1.05) * (b.hidden ? 0 : 1)), surf: [surf(KIND.wood, 0.84), 0], renormal: true })
  }
}

// The stack's cap: one wider course of dark stone at its top, as the approved chimney has.
{
  const ch = C.chimney
  const top = CAP.fromMm + (ch.top - CAP.fromMm) * CAP.keep
  const g = slab(2 * (ch.half + CAP.out), CAP.thick, 2 * (ch.halfAlong + CAP.out), { round: 0.16, sx: 6, sy: 2, sz: 6, warp: 0.09, seed: 17 })
  const P = g.getAttribute('position')
  shade(g, (x, y, z) => (0.55 + 0.45 * smooth(-0.2, 0.3, y)) * (0.7 + 0.6 * fbm(x * 2.4, y * 2.4, z * 2.4 + 3, 3)) * (1 - 0.6 * smooth(0.03, 0.12, 0.12 - Math.abs(noise(x * 2.2 + 1, z * 2.2, 8)))))
  for (let i = 0; i < P.count; i++) {
    const q = L.cottagePoint(ch.across + P.getX(i), top - 0.25 + P.getY(i), ch.along + P.getZ(i))
    P.setXYZ(i, q[0], q[1], q[2])
  }
  decor.add(g, { color: lin('#62625a'), surf: [surf(KIND.stone, 0.92), 0], renormal: true })
}


let leafCount = 0
{
  const pos = []
  const col = []
  const want = LITTER.leaves
  let tries = 0
  while (leafCount < want && tries++ < want * 60) {
    const a = R() * TAU
    const rr = 54 * Math.sqrt(R())
    const x = rr * Math.cos(a)
    const z = rr * Math.sin(a)
    if (blocked(x, z)) continue
    const lit = litterAt(x, z)
    if (R() > lit * lit * 1.5 + 0.04) continue
    if (treeGap(x, z) < 3.2 || rockGap(x, z) < 0.2) continue
    const len = between(0.8, 1.7)
    const wide = len * between(0.5, 0.75)
    const yaw = R() * TAU
    const curl = between(0.02, 0.13) * len
    const tilt = between(-0.35, 0.35)
    const lift = between(0.05, 0.22) + (pathGap(x, z) < 1.2 ? 0.75 : 0)
    const tone = mul3(LEAF_TONES[Math.floor(R() * LEAF_TONES.length)], between(0.45, 1.2))
    const y = earthAt(x, z) + lift
    const M = new THREE.Matrix4().makeRotationX(tilt).premultiply(new THREE.Matrix4().makeRotationY(yaw)).setPosition(x, y, z)
    const lobes = 5
    const ring = []
    for (let k = 0; k <= lobes * 2; k++) {
      const t = k / (lobes * 2)
      const ang = Math.PI * (t - 0.5) * 1.75
      const spike = k % 2 === 0 ? 1 : 0.58
      const reach = spike * (0.55 + 0.45 * Math.cos(ang * 0.55))
      ring.push([Math.sin(ang) * reach * wide, curl * Math.abs(Math.sin(ang)) * reach, Math.cos(ang) * reach * len * 0.62 + len * 0.05])
    }
    const base = [0, 0.02, -len * 0.42]
    const mid = [0, -0.04 * len, len * 0.06]
    const push = (p, k) => {
      const v = new THREE.Vector3(p[0], p[1], p[2]).applyMatrix4(M)
      pos.push(v.x, v.y, v.z)
      col.push(tone[0] * k, tone[1] * k, tone[2] * k)
    }
    for (let k = 0; k < ring.length - 1; k++) {
      push(mid, 0.55)
      push(ring[k], 1)
      push(ring[k + 1], 1)
    }
    push(mid, 0.55)
    push(base, 0.5)
    push(ring[0], 1)
    push(mid, 0.55)
    push(ring[ring.length - 1], 1)
    push(base, 0.5)
    leafCount++
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(Array.from({ length: pos.length / 3 }, (_, i) => i))
  g.computeVertexNormals()
  const N = g.getAttribute('normal')
  for (let i = 0; i < N.count; i++) if (N.getY(i) < 0) N.setXYZ(i, -N.getX(i), -N.getY(i), -N.getZ(i))
  const base = decor.p.length / 3
  for (let i = 0; i < N.count; i++) {
    decor.p.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
    decor.n.push(N.getX(i), N.getY(i), N.getZ(i))
    decor.c.push(col[i * 3], col[i * 3 + 1], col[i * 3 + 2])
    decor.uv.push(pos[i * 3] / TILE_MM * 3, pos[i * 3 + 2] / TILE_MM * 3)
    decor.s.push(surf(KIND.leaf, 0.62), 0)
    decor.i.push(base + i)
  }
}

let tuftCount = 0
{
  const pos = []
  const col = []
  const tuft = (x, z, scale) => {
    const blades = 7 + Math.floor(R() * 6)
    const gy = earthAt(x, z) - 0.1
    const tone = GRASS_TONES[Math.floor(R() * GRASS_TONES.length)]
    for (let b = 0; b < blades; b++) {
      const a = R() * TAU
      const out = between(0.15, 1.0)
      const tall = scale * between(0.9, 2.2)
      const w = between(0.12, 0.21)
      const ox = x + Math.cos(a) * between(0, 0.45)
      const oz = z + Math.sin(a) * between(0, 0.45)
      const sx = -Math.sin(a) * w
      const sz = Math.cos(a) * w
      const k = mul3(tone, between(0.7, 1.25))
      const at = (t, side) => {
        const bend = out * tall * t * t * 0.55
        const ww = (1 - t) * side
        return [ox + Math.cos(a) * bend + sx * ww, gy + tall * t * (1 - 0.18 * out * t), oz + Math.sin(a) * bend + sz * ww]
      }
      const seg = 3
      for (let s = 0; s < seg; s++) {
        const t0 = s / seg
        const t1 = (s + 1) / seg
        const quad = [at(t0, -1), at(t0, 1), at(t1, 1), at(t0, -1), at(t1, 1), at(t1, -1)]
        for (const [qi, q] of quad.entries()) {
          pos.push(q[0], q[1], q[2])
          const t = qi === 2 || qi >= 4 ? t1 : t0
          const sh = 0.2 + 1.7 * t * t
          col.push(k[0] * sh, k[1] * sh, k[2] * sh)
        }
      }
    }
    tuftCount++
  }
  let tries = 0
  while (tuftCount < 420 && tries++ < 60000) {
    const a = R() * TAU
    const rr = 54 * Math.sqrt(R())
    const x = rr * Math.cos(a)
    const z = rr * Math.sin(a)
    if (blocked(x, z, 0.3) || fenceGap(x, z) < 16 || pathGap(x, z) < 1.2 || treeGap(x, z) < 4 || rockGap(x, z) < -0.3) continue
    const bank = 1 - smooth(1.05, 1.6, L.pondField(x, z))
    const rock = 1 - smooth(0, 1.6, rockGap(x, z))
    const rim = 1 - smooth(1.5, 7, L.islandEdge(Math.atan2(z, x)) - Math.hypot(x, z))
    const patch = smooth(0.0, 0.5, fbm(x * 0.14 + 5, z * 0.14 + 1, 4, 2))
    const east = smooth(4, 16, x) * smooth(-4, 8, z)
    // The front rim (toward the hero camera) carries tall grass that stands up through the low fog and breaks its level edge.
    const front = rim * smooth(-0.2, 0.5, z / Math.max(1, Math.hypot(x, z)))
    if (R() > 0.02 + 0.3 * bank + 0.2 * rim + 0.75 * front + 0.08 * patch + 0.6 * east + 0.9 * rock) continue
    tuft(x, z, 0.8 + 0.3 * bank + 0.2 * rim + 1.1 * front + 0.5 * east + 0.5 * rock)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(Array.from({ length: pos.length / 3 }, (_, i) => i))
  g.computeVertexNormals()
  const N = g.getAttribute('normal')
  const base = decor.p.length / 3
  for (let i = 0; i < N.count; i++) {
    const up = 0.75
    const nx = N.getX(i) * (1 - up)
    const ny = Math.abs(N.getY(i)) * (1 - up) + up
    const nz = N.getZ(i) * (1 - up)
    const l = Math.hypot(nx, ny, nz)
    decor.p.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
    decor.n.push(nx / l, ny / l, nz / l)
    decor.c.push(col[i * 3], col[i * 3 + 1], col[i * 3 + 2])
    decor.uv.push(pos[i * 3] / TILE_MM * 2, pos[i * 3 + 1] / TILE_MM * 2)
    decor.s.push(surf(KIND.leaf, 0.7), 0)
    decor.i.push(base + i)
  }
}

const srgb = (c) => c.map((v) => Math.pow(clamp(v), 1 / 2.2))
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]

const earthBytes = writePng(
  rel('assets-full', 'fall', 'village-earth.srgb.tile.w1024.png'),
  SIZE,
  (px, py) => {
    const u = (px / SIZE) * 16
    const v = (py / SIZE) * 16
    const clod = 0.5 + fbm(u, v, 1.5, 5, 16)
    const fine = 0.5 + 0.5 * noise(u * 8, v * 8, 4.2, 128)
    const grit = 0.5 + 0.5 * noise(u * 20, v * 20, 9.1, 320)
    const pebble = Math.max(smooth(0.78, 0.9, 0.5 + 0.5 * noise(u * 3.5 + 11, v * 3.5 + 3, 6.6, 56)) * smooth(0.3, 0.7, grit + 0.2), smooth(0.74, 0.8, 0.5 + 0.5 * noise(u * 1.5 + 4, v * 1.5 + 9, 2.4, 24)))
    const h = clamp(0.55 * clod + 0.25 * fine + 0.2 * grit + 0.35 * pebble)
    const soil = mix3(hexRgb('#170f09'), hexRgb('#5e4029'), clamp(0.05 + 1.05 * clod * (0.5 + 0.75 * fine)))
    const c = mix3(soil, hexRgb('#a39d8c'), pebble * 0.85)
    const fibre = smooth(0.62, 0.8, 0.5 + 0.5 * noise(u * 14 + 2, v * 2.2 + 8, 1.3, [224, 0])) * 0.5
    const out = mix3(c, hexRgb('#6a5230'), fibre * (1 - pebble))
    return [out[0], out[1], out[2], h]
  },
  4,
)

const litter = new Float32Array(SIZE * SIZE * 4)
{
  const RL = rng(90211)
  const tones = ['#b4541c', '#c87a28', '#8c2e16', '#d09a3c', '#5a2c18', '#a8481c', '#e0a040', '#742818', '#96601e', '#40241a', '#c06420', '#6a3c20'].map(hexRgb)
  const n = 760
  for (let k = 0; k < n; k++) {
    const cx = RL() * SIZE
    const cy = RL() * SIZE
    const len = 26 + 26 * RL()
    const wide = len * (0.5 + 0.25 * RL())
    const ang = RL() * TAU
    const ca = Math.cos(ang)
    const sa = Math.sin(ang)
    const tone = tones[Math.floor(RL() * tones.length)]
    const dark = 0.45 + 0.75 * RL()
    const rank = 0.06 + 0.94 * ((k + 0.5) / n)
    const lobes = 5 + Math.floor(RL() * 3)
    const ph = RL() * 9
    const reach = Math.ceil(len * 1.05)
    for (let dy = -reach; dy <= reach; dy++)
      for (let dx = -reach; dx <= reach; dx++) {
        const lu = (dx * ca + dy * sa) / len
        const lv = (-dx * sa + dy * ca) / wide
        if (Math.abs(lu) > 1) continue
        const along = (lu + 1) / 2
        const body = Math.pow(Math.sin(Math.PI * Math.pow(along, 0.8)), 0.7)
        const tooth = 0.72 + 0.28 * Math.abs(Math.sin(along * Math.PI * lobes + ph))
        const half = body * tooth
        const av = Math.abs(lv)
        if (av > half) continue
        const x = (((Math.round(cx) + dx) % SIZE) + SIZE) % SIZE
        const y = (((Math.round(cy) + dy) % SIZE) + SIZE) % SIZE
        const o = (y * SIZE + x) * 4
        const edge = smooth(0, 0.16, half - av)
        const rib = 1 - 0.38 * Math.exp(-(lv * lv) / 0.0025)
        const vein = 1 - 0.22 * Math.pow(Math.abs(Math.sin((along * 5 + av * 2.2) * Math.PI)), 12) * smooth(0.05, 0.2, av)
        const mott = 0.82 + 0.3 * noise(x * 0.09, y * 0.09, k * 1.37, 0)
        const s = dark * rib * vein * mott * (0.35 + 0.65 * edge)
        litter[o] = tone[0] * s
        litter[o + 1] = tone[1] * s
        litter[o + 2] = tone[2] * s
        litter[o + 3] = rank
      }
  }
}
const litterBytes = writePng(rel('assets-full', 'fall', 'village-litter.srgb.tile.w1024.png'), SIZE, (px, py) => {
  const o = (py * SIZE + px) * 4
  return [litter[o], litter[o + 1], litter[o + 2], litter[o + 3]]
}, 4)

const names = [ground, water, decor, glow, attic]
const extras = { pumpkins: pumpkinList, stones: stoneList, tileMm: TILE_MM }
const file = rel('assets-full', 'fall', 'village-fall.glb')
const out = writeGlb(file, names.map((b) => fromThree(b.name, b.geometry(), b === decor ? extras : undefined)))
const levelled = await addLevels(fs.readFileSync(file), { levels: LEVELS })
fs.writeFileSync(file, levelled.glb)
out.bytes = levelled.glb.length
const lighter = Object.fromEntries(Object.keys(LEVELS).map((l) => [l, levelled.meshes.reduce((n, m) => n + (m[l] ?? m.triangles), 0)]))
const record = {
  made: 'assets-src/village-fall/build.mjs',
  model: { file: 'assets-full/fall/village-fall.glb', bytes: out.bytes, triangles: out.triangles, meshes: Object.fromEntries(names.map((b) => [b.name, b.triangles])) },
  leaves: leafCount,
  tufts: tuftCount,
  pumpkins: pumpkinList,
  maps: {
    'assets-full/fall/village-earth.srgb.tile.w1024.png': { px: SIZE, bytes: earthBytes, tileMm: TILE_MM },
    'assets-full/fall/village-litter.srgb.tile.w1024.png': { px: SIZE, bytes: litterBytes, tileMm: TILE_MM },
  },
}
writeJson(rel('out', 'work', 'village', 'build-fall.json'), record)
console.log(`village-fall: ${out.triangles} triangles (medium ${lighter.medium}, low ${lighter.low}) in ${out.meshes} meshes (${Object.entries(record.model.meshes).map(([k, v]) => `${k} ${v}`).join(', ')}), ${(out.bytes / 1e6).toFixed(2)} MB; ${leafCount} leaves, ${tuftCount} tufts, ${flagCount} flagstones, ${rimCount} rim stones, ${pebbleCount} pebbles, ${blockCount} wall blocks of ${blockTriangles} triangles; maps ${((earthBytes + litterBytes) / 1e6).toFixed(2)} MB`)
