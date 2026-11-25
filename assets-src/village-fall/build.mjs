import * as THREE from 'three'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { rel, writeJson } from '../../tools/lib/paths.mjs'
import { loadSource } from '../trunk/source.mjs'
import { loadLayout } from '../village/layout.mjs'
import { Bag, KIND, TILE_MM, clamp, fbm, frame, lin, mix3, mul3, noise, rng, shade, slab, smooth, surf, writePng } from '../village/kit.mjs'

const L = await loadLayout()
const [PROPS] = await loadSource(['/src/seasons/fall/mini/props.ts'])
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
const ATTIC = PROPS.ATTIC
const PUMPKINS = PROPS.PUMPKINS
const STONES = PROPS.STONES
const LEAF_TONES = ['#c8541a', '#d9812a', '#a8371a', '#e0a030', '#7a3a18', '#b5651d', '#c9451c', '#8f5a1e'].map(lin)
const GRASS_TONES = ['#35461a', '#4a5a20', '#6f6a2a', '#2c3a16', '#5a5422'].map(lin)

const ground = new Bag('ground')
const water = new Bag('water')
const decor = new Bag('decor')
const glow = new Bag('glow')
const attic = new Bag('pane-attic')

const fenceA = L.fence.from
const fenceB = L.fence.to
function fenceGap(x, z) {
  const dx = fenceB[0] - fenceA[0]
  const dz = fenceB[1] - fenceA[1]
  const t = clamp(((x - fenceA[0]) * dx + (z - fenceA[1]) * dz) / (dx * dx + dz * dz), -0.15, 1.15)
  return Math.hypot(x - fenceA[0] - dx * t, z - fenceA[1] - dz * t)
}
function cottageGap(x, z) {
  const dx = x - C.x
  const dz = z - C.z
  const across = Math.abs(dx * F.v[0] + dz * F.v[1]) - C.halfWidth
  const along = Math.abs(dx * F.u[0] + dz * F.u[1]) - C.halfLength
  return Math.hypot(Math.max(across, 0), Math.max(along, 0)) + Math.min(Math.max(across, along), 0)
}
const treeGap = (x, z) => Math.hypot(x - L.tree.x, z - L.tree.z)
const pathGap = (x, z) => Math.min(...[...L.steps, ...L.stones].map(([sx, sz]) => Math.hypot(x - sx, z - sz)))
const reliefAt = (x, z) => 0.22 * fbm(x * 0.33 + 3.1, z * 0.33 + 7.7, 2, 3) * smooth(1.2, 3.2, pathGap(x, z)) * smooth(1.0, 1.12, L.pondField(x, z)) * smooth(0.5, 2.5, cottageGap(x, z))
const earthAt = (x, z) => L.groundAt(x, z) + reliefAt(x, z)
const litterAt = (x, z) => {
  const base = 0.13 + 0.26 * fbm(x * 0.12 + 1.7, z * 0.12 + 4.2, 5, 3)
  const byFence = 0.42 * (1 - smooth(0.5, 5.5, fenceGap(x, z)))
  const underTree = 0.2 * (1 - smooth(5, 19, treeGap(x, z)))
  const byWall = 0.14 * (1 - smooth(0.3, 3, cottageGap(x, z)))
  const shore = smooth(1.0, 1.16, L.pondField(x, z))
  return clamp((base + byFence + underTree + byWall) * (0.25 + 0.75 * shore), 0, 1)
}
const mossAt = (x, z) => {
  const patch = 0.36 + 1.1 * fbm(x * 0.09 + 9.3, z * 0.09 + 2.2, 8, 3)
  const bank = 0.2 * (1 - smooth(1.02, 1.3, L.pondField(x, z)))
  const wall = 0.3 * (1 - smooth(0.2, 2.2, cottageGap(x, z)))
  return clamp(patch + bank + wall - 0.35 * (1 - smooth(4, 12, treeGap(x, z))), 0, 1)
}

{
  const rings = 130
  const around = 400
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
  const under = (p) => smooth(0.25, 2.2, L.groundAt(p[0], p[2]) - p[1])
  const wet = (x, z) => 0.5 + 0.5 * smooth(0.95, 1.12, L.pondField(x, z))
  const contact = (x, z) => 0.55 + 0.45 * smooth(0, 1.6, cottageGap(x, z))
  ground.add(g, {
    color: (p) => {
      const k = (0.86 + 0.24 * fbm(p[0] * 0.21, p[2] * 0.21, 1, 3)) * wet(p[0], p[2]) * contact(p[0], p[2]) * (0.62 + 0.38 * smooth(0.8, 5, treeGap(p[0], p[2]) - 4))
      const d = 1 - 0.72 * under(p)
      return [k * d, k * d, k * d]
    },
    surf: (p) => [litterAt(p[0], p[2]) * (1 - under(p)), mossAt(p[0], p[2]) * (1 - 0.6 * under(p))],
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
  const tone = lin('#d9661a')
  const deep = lin('#7a2a08')
  for (let j = 0; j <= nv; j++)
    for (let i = 0; i <= nu; i++) {
      const th = (i / nu) * TAU - Math.PI
      const ph = 0.0015 + (j / nv) * (Math.PI - 0.003)
      const p = shell(th, ph, 1)
      const q = shell(th, ph, 0.84)
      pos.push(p[0], p[1], p[2])
      inner.push(q[0], q[1], q[2])
      const low = smooth(-0.9, 0.2, p[1] / H)
      const c = mul3(mix3(deep, tone, 0.25 + 0.75 * smooth(0.05, 0.7, p[3])), (0.5 + 0.5 * low) * (0.9 + 0.2 * noise(th * 5, ph * 7, 3 + o.r)))
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
  decor.add(g, { matrix: M, color: lin('#5d5e58'), surf: [surf(KIND.stone, 0.9), 0], renormal: true })
  stoneList.push(s.at[0], +gy.toFixed(3), s.at[1], s.w / 2, s.h / 2, s.d / 2, s.yaw, s.lean)
}

{
  const W = frame(L.cottagePoint(0, 0, C.halfLength), V3, UP, U3)
  const a = ATTIC
  const cy = a.sill + a.height / 2
  const FRAME = lin('#3d2a1c')
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

const blocked = (x, z, margin = 0) => {
  if (L.pondField(x, z) < 1.03) return true
  if (cottageGap(x, z) < 0.25 + margin) return true
  if (Math.hypot(x, z) > L.islandEdge(Math.atan2(z, x)) - 1.2) return true
  for (let i = 0; i < pumpkinList.length; i += 6) if (Math.hypot(x - pumpkinList[i], z - pumpkinList[i + 2]) < pumpkinList[i + 3] * 0.8 + margin) return true
  return false
}

let leafCount = 0
{
  const pos = []
  const col = []
  const want = 1700
  let tries = 0
  while (leafCount < want && tries++ < want * 60) {
    const a = R() * TAU
    const rr = 54 * Math.sqrt(R())
    const x = rr * Math.cos(a)
    const z = rr * Math.sin(a)
    if (blocked(x, z)) continue
    const lit = litterAt(x, z)
    if (R() > lit * lit * 1.5 + 0.04) continue
    if (treeGap(x, z) < 3.2) continue
    const len = between(0.8, 1.7)
    const wide = len * between(0.5, 0.75)
    const yaw = R() * TAU
    const curl = between(0.06, 0.3) * len
    const tilt = between(-0.35, 0.35)
    const lift = between(0.05, 0.22) + (pathGap(x, z) < 1.6 ? 0.55 : 0)
    const tone = mul3(LEAF_TONES[Math.floor(R() * LEAF_TONES.length)], between(0.22, 0.6))
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
      push(mid, 0.6)
      push(ring[k], 1)
      push(ring[k + 1], 1)
    }
    push(mid, 0.6)
    push(base, 0.8)
    push(ring[0], 1)
    push(mid, 0.6)
    push(ring[ring.length - 1], 1)
    push(base, 0.8)
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
      const w = between(0.09, 0.16)
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
      const seg = 4
      for (let s = 0; s < seg; s++) {
        const t0 = s / seg
        const t1 = (s + 1) / seg
        const quad = [at(t0, -1), at(t0, 1), at(t1, 1), at(t0, -1), at(t1, 1), at(t1, -1)]
        for (const [qi, q] of quad.entries()) {
          pos.push(q[0], q[1], q[2])
          const t = qi === 2 || qi >= 4 ? t1 : t0
          const sh = 0.45 + 0.75 * t
          col.push(k[0] * sh, k[1] * sh, k[2] * sh)
        }
      }
    }
    tuftCount++
  }
  let tries = 0
  while (tuftCount < 190 && tries++ < 40000) {
    const a = R() * TAU
    const rr = 54 * Math.sqrt(R())
    const x = rr * Math.cos(a)
    const z = rr * Math.sin(a)
    if (blocked(x, z, 0.3) || pathGap(x, z) < 1.9 || treeGap(x, z) < 4) continue
    const bank = 1 - smooth(1.05, 1.6, L.pondField(x, z))
    const post = 1 - smooth(0.4, 1.6, fenceGap(x, z))
    const rim = 1 - smooth(1.5, 7, L.islandEdge(Math.atan2(z, x)) - Math.hypot(x, z))
    const patch = smooth(0.0, 0.5, fbm(x * 0.14 + 5, z * 0.14 + 1, 4, 2))
    const east = smooth(4, 16, x) * smooth(-4, 8, z)
    if (R() > 0.02 + 0.3 * bank + 0.45 * post + 0.25 * rim + 0.12 * patch + 0.75 * east) continue
    tuft(x, z, 0.8 + 0.3 * bank + 0.2 * rim + 0.5 * east)
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
    const pebble = smooth(0.78, 0.9, 0.5 + 0.5 * noise(u * 3.5 + 11, v * 3.5 + 3, 6.6, 56)) * smooth(0.3, 0.7, grit + 0.2)
    const h = clamp(0.55 * clod + 0.25 * fine + 0.2 * grit + 0.35 * pebble)
    const soil = mix3(hexRgb('#1d140d'), hexRgb('#4a3523'), clamp(0.15 + 0.9 * clod * (0.6 + 0.6 * fine)))
    const c = mix3(soil, hexRgb('#6f6a60'), pebble * 0.8)
    const fibre = smooth(0.62, 0.8, 0.5 + 0.5 * noise(u * 14 + 2, v * 2.2 + 8, 1.3, [224, 0])) * 0.5
    const out = mix3(c, hexRgb('#6a5230'), fibre * (1 - pebble))
    return [out[0], out[1], out[2], h]
  },
  4,
)

const litter = new Float32Array(SIZE * SIZE * 4)
{
  const RL = rng(90211)
  const tones = ['#c2521a', '#d98a2c', '#9a3418', '#e2aa3a', '#6e3516', '#b4601c', '#c43f1a', '#8a551c', '#d06a22', '#54301a'].map(hexRgb)
  const n = 190
  for (let k = 0; k < n; k++) {
    const cx = RL() * SIZE
    const cy = RL() * SIZE
    const len = 55 + 50 * RL()
    const wide = len * (0.5 + 0.25 * RL())
    const ang = RL() * TAU
    const ca = Math.cos(ang)
    const sa = Math.sin(ang)
    const tone = tones[Math.floor(RL() * tones.length)]
    const dark = 0.65 + 0.5 * RL()
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
        const s = dark * rib * vein * mott * (0.55 + 0.45 * edge)
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
const out = writeGlb(rel('assets-full', 'fall', 'village-fall.glb'), names.map((b) => fromThree(b.name, b.geometry(), b === decor ? extras : undefined)))
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
console.log(`village-fall: ${out.triangles} triangles in ${out.meshes} meshes (${Object.entries(record.model.meshes).map(([k, v]) => `${k} ${v}`).join(', ')}), ${(out.bytes / 1e6).toFixed(2)} MB; ${leafCount} leaves, ${tuftCount} tufts; maps ${((earthBytes + litterBytes) / 1e6).toFixed(2)} MB`)
