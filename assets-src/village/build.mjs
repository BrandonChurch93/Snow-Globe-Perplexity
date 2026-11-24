import * as THREE from 'three'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { rel, writeJson } from '../../tools/lib/paths.mjs'
import { loadLayout, loadRoof } from './layout.mjs'
import { Bag, KIND, STACK_LIFT, STOUT, TILE_MM, Tris, add3, basis, boxMatrix, clamp, fbm, frame, grainUv, lin, mix3, mul3, noise, norm3, pillow, planar, rng, shade, slab, smooth, sub3, surf, writePng } from './kit.mjs'

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
const R = rng(1871)
const pick = (a) => a[Math.floor(R() * a.length)]
const MORTAR = -0.5
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z)

const STONES = ['#8c867d', '#7c766f', '#979289', '#726d66', '#837e75', '#9e988e', '#79736a', '#908a7f', '#6b6660', '#87837d'].map(lin)
const ARCH = ['#b9b2a6', '#aba498', '#c5beb2', '#a09a8e'].map(lin)
const BRICKS = ['#f3bf9a', '#e6b08c', '#fac9a6', '#dba585', '#eeb893', '#f6c4a0', '#e2ab8a'].map(lin)
const SHINGLES = ['#5c4838', '#4e3d31', '#68523f', '#43352b', '#57483c'].map(lin)
const LEAVES = ['#22401f', '#2d5226', '#1b3319', '#3a5f2c', '#27481f'].map(lin)
const MORTAR_C = lin('#85766a')
const DIRT = lin('#4b4538')
const IRON = lin('#15161a')
const DOOR = lin('#643921')
const FRAME = lin('#5a3d26')
const FENCE = lin('#a87a55')
const PICKET_C = lin('#d8d2ca')
const PICKET = { each: 7, clear: 0.95, thick: 0.15, wide: 0.24, over: 0.5 }
const SLATE = lin('#8a857f')

const solid = new Bag('solid')
const paneGable = new Bag('pane-gable')
const paneSide = new Bag('pane-side')
const lampGlass = new Bag('lamp-glass')
const ground = new Bag('ground')

const stoneSurf = () => [surf(KIND.stone, 0.8 + 0.14 * R()), 0]
const woodSurf = (r = 0.72) => [surf(KIND.wood, r), 0]
const ironSurf = [surf(KIND.iron, 0.42), 0]
const leafSurf = [surf(KIND.leaf, 0.62), 0]
const off = () => [R() * 7, R() * 7]

function stone(W, x, y, w, h, o = {}) {
  const d = (o.depth ?? 0.34) * (0.7 + 0.6 * R())
  const g = pillow(w, h, d, o.su ?? (w > 1.7 ? 5 : 4), o.sv ?? 3, R, o.pillow)
  const P = g.getAttribute('position')
  for (let i = 0; i < P.count; i++) {
    const px = P.getX(i) + x
    let py = P.getY(i) + y
    if (o.rake) py = Math.min(py, o.rake(px))
    P.setXYZ(i, px, py, P.getZ(i) + MORTAR + (o.lift ?? 0))
  }
  const vary = o.vary ?? 0.7
  const tone = mul3(pick(o.tones ?? STONES), (0.97 - vary / 2 + vary * R()) * (o.dim ?? 1))
  const c = mix3(tone, DIRT, o.dirt === false ? 0 : smooth(1.4, -1.4, y) * 0.5)
  solid.add(g, { matrix: W.M, color: c, surf: stoneSurf(), uv: planar(W.U, W.V), uvOffset: off() })
}

function wall(W, region, o = {}) {
  const rowH = o.rowH ?? 1.02
  const rowJ = o.rowJ ?? 0.55
  const wide = o.wide ?? 1.08
  const wideJ = o.wideJ ?? 0.6
  const gap = o.gap ?? 0.1
  const stack = o.stack ?? 0.25
  const drift = o.drift ?? 0.12
  let y = region.y0
  while (y < region.y1 - 0.3) {
    let h = rowH + (R() - 0.5) * rowJ
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
        const out = []
        if (hx0 - a > 0.45) out.push([a, hx0])
        if (b - hx1 > 0.45) out.push([hx1, b])
        return out
      })
    }
    for (const [a, b] of spans) {
      const n = Math.max(1, Math.round((b - a) / (wide + (R() - 0.5) * wideJ)))
      const ws = Array.from({ length: n }, () => 0.5 + 1.0 * R())
      const sum = ws.reduce((s, v) => s + v, 0)
      let x = a
      for (let i = 0; i < n; i++) {
        const w = (ws[i] / sum) * (b - a)
        const up = (R() - 0.5) * 2 * drift
        if (w > 0.95 && h > 0.9 && R() < stack) {
          const cut = h * (0.42 + 0.16 * R())
          stone(W, x + w / 2, y + cut / 2, w - gap, cut - gap, { ...o.stone, rake: region.rake })
          stone(W, x + w / 2, y + cut + (h - cut) / 2, w - gap, h - cut - gap, { ...o.stone, rake: region.rake })
        } else stone(W, x + w / 2, ym + up, w - gap, h - gap + (R() - 0.5) * drift, { ...o.stone, rake: region.rake })
        x += w
      }
    }
    y += h
  }
}

function mortar(W, x0, x1, y0, y1, gable) {
  const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0, 14, 8).applyMatrix4(T((x0 + x1) / 2, (y0 + y1) / 2, 0))
  const parts = [g]
  if (gable) parts.push(new THREE.PlaneGeometry(x1 - x0, C.rise, 14, 8).applyMatrix4(T((x0 + x1) / 2, y1 + C.rise / 2, 0)))
  for (const q of parts) {
    const P = q.getAttribute('position')
    for (let i = 0; i < P.count; i++) {
      let x = P.getX(i)
      const y = P.getY(i)
      if (y > C.wall) {
        const half = C.halfWidth * Math.max(0, 1 - (y - C.wall) / C.rise)
        x = clamp(x, -half, half)
      }
      P.setXYZ(i, x, y, MORTAR + 0.05 * noise(x * 1.7, y * 1.7, 4))
    }
    shade(q, (x, y) => 0.8 + 0.35 * fbm(x * 0.8, y * 0.8, 2, 3))
    solid.add(q, { matrix: W.M, color: MORTAR_C, surf: [surf(KIND.stone, 0.95), 0], uv: planar(W.U, W.V), uvOffset: off(), renormal: true })
  }
}

function bar(W, w, h, d, x, y, z, color, o = {}) {
  const g = slab(w, h, d, { round: o.round ?? 0.04, sx: o.sx ?? 1, sy: o.sy ?? 1, sz: 1, warp: o.warp ?? 0, seed: R() * 50 }).applyMatrix4(T(x, y, z))
  shade(g, (px, py) => 0.82 + 0.3 * noise(px * (o.along === 'x' ? 0.7 : 6), py * (o.along === 'x' ? 6 : 0.7), R() * 0 + x))
  const axis = o.along === 'x' ? W.U : W.V
  solid.add(g, { matrix: W.M, color, surf: o.surf ?? woodSurf(), uv: grainUv(axis), uvOffset: off() })
}

function windowAt(W, w, pane) {
  const fr = 0.34
  const dep = 0.66
  const z = MORTAR + dep / 2
  const cy = w.sill + w.height / 2
  bar(W, w.width + 2 * fr, fr, dep, w.x, w.sill + w.height + fr / 2, z, mul3(FRAME, 0.9 + 0.2 * R()), { along: 'x' })
  bar(W, w.width + 2 * fr, fr, dep, w.x, w.sill - fr / 2, z, mul3(FRAME, 0.9 + 0.2 * R()), { along: 'x' })
  bar(W, fr, w.height, dep, w.x - w.width / 2 - fr / 2, cy, z, mul3(FRAME, 0.9 + 0.2 * R()))
  bar(W, fr, w.height, dep, w.x + w.width / 2 + fr / 2, cy, z, mul3(FRAME, 0.9 + 0.2 * R()))
  const sill = slab(w.width + 1.5, 0.52, 1.25, { round: 0.17, sx: 7, sy: 2, sz: 3, warp: 0.05, seed: R() * 40 }).applyMatrix4(T(w.x, w.sill - fr - 0.24, MORTAR + 0.6))
  shade(sill, (px, py) => 0.85 + 0.25 * noise(px * 2.2, py * 2.2, 8))
  solid.add(sill, { matrix: W.M, color: mul3(pick(ARCH), 0.95), surf: stoneSurf(), uv: planar(W.U, W.V), uvOffset: off(), renormal: true })
  stone(W, w.x, w.sill + w.height + fr + 0.5, w.width + 1.7, 0.9, { depth: 0.72, su: 8, sv: 3, tones: ARCH, dirt: false })
  const g = new THREE.PlaneGeometry(w.width, w.height, 1, 1).applyMatrix4(T(w.x, cy, MORTAR + 0.2))
  pane.add(g, { matrix: W.M, keepUv: true, surf: [w.width, w.height] })
}

function doorAt(W) {
  const d = C.door
  const r = d.width / 2
  const sy = d.height - r
  const cx = d.across
  const planks = 5
  const pw = d.width / planks
  for (let i = 0; i < planks; i++) {
    const xa = cx - r + i * pw + 0.025
    const xb = cx - r + (i + 1) * pw - 0.025
    const xs = [xa, xa + 0.1, xb - 0.1, xb]
    const zs = [0, 0.13, 0.13, 0]
    const rows = 8
    const pos = []
    const idx = []
    const seed = R() * 60
    for (let j = 0; j <= rows; j++)
      for (let k = 0; k < 4; k++) {
        const x = xs[k]
        const top = sy + Math.sqrt(Math.max(0, r * r - (x - cx) ** 2)) - 0.03
        const y = -0.25 + (top + 0.25) * (j / rows)
        pos.push(x, y, MORTAR + 0.14 + zs[k] + 0.025 * noise(x * 2.5, y * 1.1, seed))
      }
    for (let j = 0; j < rows; j++)
      for (let k = 0; k < 3; k++) {
        const a = j * 4 + k
        idx.push(a, a + 1, a + 5, a, a + 5, a + 4)
      }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    shade(g, (x, y, z, vi) => (vi % 4 === 0 || vi % 4 === 3 ? 0.42 : 1) * (0.66 + 0.34 * smooth(-0.2, 1.8, y)) * (0.86 + 0.2 * noise(x * 7, y * 0.7, seed)))
    solid.add(g, { matrix: W.M, color: mul3(DOOR, 0.82 + 0.34 * R()), surf: woodSurf(0.62), uv: grainUv(UP), uvOffset: off() })
  }
  const iron = (g) => solid.add(g, { matrix: W.M, color: mul3(IRON, 0.8 + 0.5 * R()), surf: ironSurf, uvOffset: off(), renormal: true })
  for (const y of [1.35, 4.75]) {
    iron(slab(3.3, 0.36, 0.1, { round: 0.03, sx: 4 }).applyMatrix4(T(cx - r + 1.72, y, MORTAR + 0.31)))
    for (let k = 0; k < 4; k++) iron(new THREE.SphereGeometry(0.1, 7, 5).applyMatrix4(T(cx - r + 0.35 + k * 0.85, y, MORTAR + 0.37)))
    iron(new THREE.ConeGeometry(0.22, 0.5, 4).applyMatrix4(new THREE.Matrix4().makeRotationZ(-Math.PI / 2).setPosition(cx - r + 3.6, y, MORTAR + 0.3)))
  }
  iron(new THREE.TorusGeometry(0.36, 0.075, 6, 16).applyMatrix4(T(cx + 1.5, 3.35, MORTAR + 0.4)))
  iron(new THREE.CylinderGeometry(0.2, 0.2, 0.09, 10).applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(cx + 1.5, 3.72, MORTAR + 0.32)))
}

function archAt(W) {
  const d = C.door
  const r = d.width / 2
  const sy = d.height - r
  const cx = d.across
  const ri = r + 0.05
  const ring = 1.4
  const rm = ri + ring / 2
  const n = 9
  for (let i = 0; i < n; i++) {
    const t0 = Math.PI * (1 - i / n)
    const t1 = Math.PI * (1 - (i + 1) / n)
    const tc = (t0 + t1) / 2
    const key = i === (n - 1) / 2
    const g = pillow((t0 - t1) * rm - 0.14, ring - 0.1 + (key ? 0.28 : 0), (key ? 1.2 : 0.98) * (0.9 + 0.2 * R()), 6, 4, R, { shear: 0.05, wobble: 0.04 })
    const P = g.getAttribute('position')
    for (let k = 0; k < P.count; k++) {
      const th = tc - P.getX(k) / rm
      const rr = rm + P.getY(k) + (key ? 0.12 : 0)
      P.setXYZ(k, cx + rr * Math.cos(th), sy + rr * Math.sin(th), P.getZ(k) + MORTAR)
    }
    solid.add(g, { matrix: W.M, color: mul3(pick(ARCH), 0.84 + 0.3 * R()), surf: stoneSurf(), uv: planar(W.U, W.V), uvOffset: off() })
  }
  for (const side of [-1, 1]) {
    let y = -1.7
    while (y < sy - 0.3) {
      let h = 1.1 + 0.55 * R()
      if (y + h > sy - 0.55) h = sy - y
      stone(W, cx + side * rm, y + h / 2, ring - 0.12, h - 0.14, { depth: 0.98, tones: ARCH, su: 5, sv: 4 })
      y += h
    }
  }
}

const front = { M: frame(P3(0, 0, C.halfLength), V3, UP, U3), U: V3, V: UP }
const left = { M: frame(P3(-C.halfWidth, 0, 0), U3, UP, neg(V3)), U: U3, V: UP }
const right = { M: frame(P3(C.halfWidth, 0, 0), neg(U3), UP, V3), U: neg(U3), V: UP }
const rear = { M: frame(P3(0, 0, -C.halfLength), neg(V3), UP, neg(U3)), U: neg(V3), V: UP }
const BASE = -1.8
const rake = (x) => C.wall + C.rise * (1 - Math.abs(x) / C.halfWidth) - 0.1
const SIDE_DIM = 0.6
const BLOCK = { rowH: 1.06, rowJ: 0.36, wide: 1.7, wideJ: 0.9, gap: 0.075, stack: 0.1, drift: 0.05, stone: { depth: 0.3, vary: 0.42, pillow: { square: 6.5, shear: 0.11, wobble: 0.05, lump: 0.3, tilt: 0.36, edge: 6.5 } } }
const gableTop = (y) => (y <= C.wall ? C.halfWidth + 0.3 : C.halfWidth * (1 - (y - C.wall) / C.rise))
const doorR = C.door.width / 2 + 1.47
const doorSpring = C.door.height - C.door.width / 2
const win = C.window
const side = C.sideWindow

wall(front, {
  x0: -C.halfWidth - 0.3,
  x1: C.halfWidth + 0.3,
  y0: BASE,
  y1: C.wall + C.rise - 0.2,
  top: gableTop,
  rake,
  holes: [
    { x0: C.door.across - doorR, x1: C.door.across + doorR, y0: -9, y1: doorSpring, arch: { cx: C.door.across, cy: doorSpring, r: doorR } },
    { x0: win.across - win.width / 2 - 0.42, x1: win.across + win.width / 2 + 0.42, y0: win.sill - 0.95, y1: win.sill + win.height + 1.25 },
  ],
}, BLOCK)
mortar(front, -C.halfWidth, C.halfWidth, BASE, C.wall, true)
archAt(front)
doorAt(front)
windowAt(front, { x: win.across, sill: win.sill, width: win.width, height: win.height }, paneGable)

wall(left, { x0: -C.halfLength - 0.3, x1: C.halfLength + 0.3, y0: BASE, y1: C.wall + 0.1, holes: [{ x0: side.along - side.width / 2 - 0.42, x1: side.along + side.width / 2 + 0.42, y0: side.sill - 0.95, y1: side.sill + side.height + 1.25 }] }, { ...BLOCK, stone: { ...BLOCK.stone, dim: SIDE_DIM } })
mortar(left, -C.halfLength, C.halfLength, BASE, C.wall + 0.1, false)
windowAt(left, { x: side.along, sill: side.sill, width: side.width, height: side.height }, paneSide)

const far = { stone: { su: 2, sv: 2 }, wide: 2.6, rowH: 1.5, stack: 0 }
wall(right, { x0: -C.halfLength - 0.3, x1: C.halfLength + 0.3, y0: BASE, y1: C.wall + 0.1 }, far)
mortar(right, -C.halfLength, C.halfLength, BASE, C.wall + 0.1, false)
wall(rear, { x0: -C.halfWidth - 0.3, x1: C.halfWidth + 0.3, y0: BASE, y1: C.wall + C.rise - 0.2, top: gableTop, rake }, far)
mortar(rear, -C.halfWidth, C.halfWidth, BASE, C.wall, true)

const pitch = RF.pitch
const cp = Math.cos(pitch)
const sp = Math.sin(pitch)
const ridgeY = RF.ridgeY
const SLOPE = RF.slopeLength
const roofLen = RF.roofLength
const roofAt = RF.roofAt
const roofDown = (sd) => add3(sc(V3, sd * cp), [0, -sp, 0])
const roofUp = (sd) => add3(sc(V3, sd * sp), [0, cp, 0])
const DECK = 0.42

for (const sd of [-1, 1]) {
  const deck = slab(2 * roofLen - 0.1, DECK, SLOPE, { sx: 6, sz: 4 })
  shade(deck, (x, y, z) => 0.75 + 0.3 * noise(x * 0.9, z * 3, sd))
  solid.add(deck, { matrix: basis(roofAt(sd, SLOPE / 2, 0, -DECK / 2), U3, roofUp(sd)), color: lin('#3c2d22'), surf: woodSurf(0.8), uv: grainUv(U3), uvOffset: off() })
  const tris = new Tris()
  const rows = 14
  const e = SLOPE / rows
  for (let r = 0; r < rows; r++) {
    const s1 = SLOPE - r * e + (r === 0 ? 0.12 : 0)
    let t = -roofLen + 0.03
    const shift = R() * 0.8
    let first = true
    while (t < roofLen - 0.05) {
      let w = 0.85 + 0.6 * R()
      if (first) w = 0.35 + shift
      first = false
      const t1 = Math.min(roofLen - 0.03, t + w)
      const a = t + 0.03
      const b = t1 - 0.03
      if (b - a > 0.12) {
        const drop = (R() - 0.5) * 0.16
        const thick = 0.15 + 0.1 * R()
        const tone = mul3(pick(SHINGLES), 0.78 + 0.42 * R())
        const lo = s1 + drop
        const hi = lo - e - 0.3
        const A = roofAt(sd, lo, a, thick + (R() - 0.5) * 0.05)
        const B = roofAt(sd, lo, b, thick + (R() - 0.5) * 0.05)
        const Cc = roofAt(sd, hi, b, 0.03)
        const D = roofAt(sd, hi, a, 0.03)
        const A0 = roofAt(sd, lo, a, 0)
        const B0 = roofAt(sd, lo, b, 0)
        tris.quad(A, B, Cc, D, roofUp(sd), tone, tone, mul3(tone, 0.6), mul3(tone, 0.6))
        tris.quad(A0, B0, B, A, roofDown(sd), mul3(tone, 0.35), mul3(tone, 0.35), mul3(tone, 0.8), mul3(tone, 0.8))
      }
      t = t1
    }
  }
  solid.add(tris.geometry(), { surf: woodSurf(0.78), uv: grainUv(roofDown(sd)), uvOffset: off() })
  for (const end of [-1, 1]) {
    const board = slab(SLOPE + 0.3, 0.95, 0.3, { round: 0.05, sx: 8, warp: 0.03, seed: R() * 30 })
    shade(board, (x, y) => 0.8 + 0.3 * noise(x * 0.8, y * 5, end + sd))
    solid.add(board, { matrix: basis(roofAt(sd, SLOPE / 2 + 0.1, end * (roofLen + 0.12), -0.42), roofDown(sd), roofUp(sd)), color: mul3(lin('#4a3524'), 0.9 + 0.2 * R()), surf: woodSurf(0.7), uv: grainUv(roofDown(sd)), uvOffset: off() })
  }
  const fascia = slab(2 * roofLen, 0.7, 0.26, { round: 0.05, sx: 10, warp: 0.03, seed: R() * 30 })
  shade(fascia, (x, y) => 0.8 + 0.3 * noise(x * 0.8, y * 5, 3 + sd))
  solid.add(fascia, { matrix: basis(add3(roofAt(sd, SLOPE + 0.08, 0, -0.1), [0, -0.3, 0]), U3, UP), color: mul3(lin('#4a3524'), 0.9 + 0.2 * R()), surf: woodSurf(0.7), uv: grainUv(U3), uvOffset: off() })
}
const cap = new THREE.CylinderGeometry(0.34, 0.34, 2 * roofLen, 8, 10).applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI / 2))
shade(cap, (x, y, z) => 0.8 + 0.3 * noise(z * 1.2, x * 4, 9))
solid.add(cap, { matrix: basis(P3(0, ridgeY + 0.12, 0), V3, UP), color: lin('#4c3c30'), surf: woodSurf(0.8), uv: grainUv(U3), uvOffset: off() })

const ch = C.chimney
const chimneyFaces = [
  { M: frame(P3(ch.across, 0, ch.along + ch.halfAlong), V3, UP, U3), U: V3, V: UP, half: ch.half },
  { M: frame(P3(ch.across - ch.half, 0, ch.along), U3, UP, neg(V3)), U: U3, V: UP, half: ch.halfAlong },
  { M: frame(P3(ch.across + ch.half, 0, ch.along), neg(U3), UP, V3), U: neg(U3), V: UP, half: ch.halfAlong },
  { M: frame(P3(ch.across, 0, ch.along - ch.halfAlong), neg(V3), UP, neg(U3)), U: neg(V3), V: UP, half: ch.half },
]
const stackBase = C.wall + 2.5
const stackTop = ch.top + STACK_LIFT
for (const [k, f] of chimneyFaces.entries()) {
  const W = { M: f.M.clone().multiply(T(0, 0, 0.36)), U: f.U, V: f.V }
  wall(W, { x0: -f.half - 0.12, x1: f.half + 0.12, y0: stackBase, y1: stackTop }, { rowH: 0.54, rowJ: 0.08, wide: 0.95, wideJ: 0.3, gap: 0.09, stack: 0, drift: 0.03, stone: { depth: 0.24, su: 3, sv: 3, tones: BRICKS, dirt: false, pillow: { square: 6, shear: 0.07, wobble: 0.035, lump: 0.34, tilt: 0.3 } } })
  const back = new THREE.PlaneGeometry(2 * f.half, stackTop - stackBase, 4, 8).applyMatrix4(T(0, (stackTop + stackBase) / 2, MORTAR + 0.04))
  shade(back, (x, y) => 0.8 + 0.3 * noise(x * 2, y * 2, k))
  solid.add(back, { matrix: W.M, color: lin('#7c695d'), surf: [surf(KIND.stone, 0.95), 0], uv: planar(f.U, f.V), uvOffset: off(), renormal: true })
}
const crown = (w, l, h, y, tone, round) => {
  const g = slab(w, h, l, { round, sx: 6, sy: 2, sz: 6, warp: 0.035, seed: R() * 20 })
  shade(g, (x, yy, z) => 0.82 + 0.3 * noise(x * 2.4, yy * 2.4, z * 2.4))
  solid.add(g, { matrix: basis(P3(ch.across, y, ch.along), V3, UP), color: tone, surf: stoneSurf(), uvOffset: off(), renormal: true })
}
crown(2 * ch.half + 0.36, 2 * ch.halfAlong + 0.36, 0.86, stackTop + 0.4, lin('#eeb893'), 0.34)
crown(2 * ch.half - 0.4, 2 * ch.halfAlong - 0.4, 0.3, stackTop + 0.8, lin('#c78c73'), 0.14)
const pot = new THREE.LatheGeometry([[0.5, 0], [0.68, 0], [0.68, 1.24], [0.62, 1.3], [0.52, 1.3], [0.5, 0.3]].map(([x, y]) => new THREE.Vector2(x, y)), 16)
shade(pot, (x, y, z) => 0.85 + 0.2 * noise(x * 3, y * 2, z * 3))
solid.add(pot, { matrix: T(...P3(ch.across - 0.2, stackTop + 0.94, ch.along + 0.1)), color: lin('#17181a'), surf: [surf(KIND.iron, 0.5), 0], uvOffset: off(), renormal: true })

const lampM = new THREE.Matrix4().makeRotationY(RF.LAMP.yaw).setPosition(...RF.lampFoot())
const post = new THREE.LatheGeometry(
  [[0, 0], [1.0, 0], [1.02, 0.4], [0.94, 0.55], [0.9, 0.8], [0.96, 0.92], [0.86, 1.1], [0.7, 1.7], [0.58, 2.7], [0.52, 3.4], [0.58, 3.5], [0.58, 3.62], [0.46, 3.75], [0.43, 6.4], [0.5, 6.5], [0.5, 6.64], [0.42, 6.74], [0.39, 9.2], [0.48, 9.32], [0.44, 9.5], [0.66, 9.72], [0.74, 9.8], [0.74, 9.9], [0, 9.9]].map(([x, y]) => new THREE.Vector2(x, y)),
  20,
)
{
  const P = post.getAttribute('position')
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i)
    const y = P.getY(i)
    const z = P.getZ(i)
    const k = smooth(3.9, 4.2, y) * (1 - smooth(6.1, 6.4, y)) + smooth(6.8, 7, y) * (1 - smooth(8.9, 9.2, y)) * 0.6
    const f = 1 - 0.09 * k * (0.5 + 0.5 * Math.cos(8 * Math.atan2(z, x)))
    P.setXYZ(i, x * f, y, z * f)
  }
}
const ironPart = (g, m) => {
  shade(g, (x, y, z) => 0.7 + 0.6 * (0.5 + 0.5 * noise(x * 2.4, y * 1.6, z * 2.4)))
  solid.add(g, { matrix: m ? lampM.clone().multiply(m) : lampM, color: IRON, surf: ironSurf, uvOffset: off(), renormal: true })
}
ironPart(post)
const { cageLo, cageHi, loHalf, hiHalf } = RF.LAMP
const CAP_MM = 1.1
const Q = Math.PI / 4
for (let k = 0; k < 4; k++) {
  const a = Q + (k * Math.PI) / 2
  const A = [Math.cos(a) * loHalf * Math.SQRT2, cageLo, Math.sin(a) * loHalf * Math.SQRT2]
  const B = [Math.cos(a) * hiHalf * Math.SQRT2, cageHi, Math.sin(a) * hiHalf * Math.SQRT2]
  const mid = sc(add3(A, B), 0.5)
  const len = Math.hypot(...sub3(B, A))
  ironPart(slab(0.18, len, 0.18, { round: 0.03, sy: 2 }), basis(mid, [Math.cos(a + Q * 2), 0, Math.sin(a + Q * 2)], norm3(sub3(B, A))))
}
ironPart(new THREE.CylinderGeometry(hiHalf * Math.SQRT2 + 0.12, hiHalf * Math.SQRT2 + 0.05, 0.16, 4, 1).applyMatrix4(new THREE.Matrix4().makeRotationY(Q).setPosition(0, cageHi + 0.06, 0)))
ironPart(new THREE.CylinderGeometry(0.1, hiHalf * Math.SQRT2 + 0.28, CAP_MM, 4, 3).applyMatrix4(new THREE.Matrix4().makeRotationY(Q).setPosition(0, cageHi + 0.14 + CAP_MM / 2, 0)))
ironPart(new THREE.CylinderGeometry(0.08, 0.13, 0.12, 10, 1).applyMatrix4(T(0, cageHi + 0.14 + CAP_MM, 0)))
ironPart(new THREE.SphereGeometry(0.14, 10, 8).applyMatrix4(T(0, cageHi + 0.22 + CAP_MM, 0)))
ironPart(new THREE.ConeGeometry(0.05, 0.22, 8).applyMatrix4(T(0, cageHi + 0.43 + CAP_MM, 0)))
{
  const g = new THREE.CylinderGeometry(hiHalf * Math.SQRT2 - 0.06, loHalf * Math.SQRT2 - 0.05, cageHi - cageLo - 0.04, 4, 1, true).applyMatrix4(new THREE.Matrix4().makeRotationY(Q).setPosition(0, (cageLo + cageHi) / 2, 0))
  lampGlass.add(g.toNonIndexed(), { matrix: lampM, keepUv: true, surf: [0, 0], renormal: true })
  const flame = new THREE.SphereGeometry(0.3, 10, 8).applyMatrix4(new THREE.Matrix4().makeScale(1, 1.7, 1).setPosition(0, cageLo + RF.LAMP.flame, 0))
  flame.getAttribute('uv').array.fill(0.5)
  lampGlass.add(flame, { matrix: lampM, keepUv: true, surf: [1, 0] })
}

const fenceShapes = L.shapes.filter((s) => s.role === 'fence')
const posts = fenceShapes.filter((s) => s.half[2] < 2)
const rails = fenceShapes.filter((s) => s.half[2] >= 2)
for (const s of posts) {
  const g = slab(2 * s.half[0] * STOUT.post, 2 * s.half[1], 2 * s.half[2] * STOUT.post, { round: 0.2, sx: 2, sy: 6, sz: 2, warp: 0.05, seed: R() * 30 })
  const P = g.getAttribute('position')
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i)
    const k = 1 - 0.55 * smooth(s.half[1] - 0.5, s.half[1], y)
    P.setXYZ(i, P.getX(i) * k, y + (y > s.half[1] - 0.01 ? 0.12 : 0), P.getZ(i) * k)
  }
  const seed = R() * 40
  shade(g, (x, y, z) => (0.72 + 0.28 * smooth(-s.half[1], -s.half[1] + 1.6, y)) * (0.82 + 0.3 * noise(x * 5, y * 0.6, z * 5 + seed)))
  solid.add(g, { matrix: boxMatrix(s), color: mul3(FENCE, 0.85 + 0.3 * R()), surf: woodSurf(0.75), uv: grainUv(UP), uvOffset: off(), renormal: true })
}
for (const s of rails) {
  const g = slab(2 * s.half[0] * STOUT.rail, 2 * s.half[1] * STOUT.rail, 2 * s.half[2], { round: 0.12, sx: 1, sy: 1, sz: 26, warp: 0.06, seed: R() * 30 })
  const seed = R() * 40
  shade(g, (x, y, z) => 0.8 + 0.32 * noise(x * 5, y * 5, z * 0.6 + seed))
  const M = boxMatrix(s)
  const axis = new THREE.Vector3(0, 0, 1).transformDirection(M)
  solid.add(g, { matrix: M, color: mul3(FENCE, 0.85 + 0.3 * R()), surf: woodSurf(0.75), uv: grainUv([axis.x, axis.y, axis.z]), uvOffset: off(), renormal: true })
}
{
  const top = rails.reduce((m, s) => (s.centre[1] > m.centre[1] ? s : m), rails[0])
  const low = rails.reduce((m, s) => (s.centre[1] < m.centre[1] ? s : m), rails[0])
  const M = boxMatrix(top)
  const drop = top.centre[1] - low.centre[1]
  const len = top.half[2]
  const bays = L.fence.posts - 1
  for (let i = 0; i < bays; i++)
    for (let j = 0; j < PICKET.each; j++) {
      const z0 = -len + (2 * len * i) / bays + PICKET.clear
      const z1 = -len + (2 * len * (i + 1)) / bays - PICKET.clear
      const at = new THREE.Vector3(0, 0, z0 + ((z1 - z0) * j) / (PICKET.each - 1)).applyMatrix4(M)
      const tall = drop + PICKET.over * (0.8 + 0.4 * noise(i * 3.1, j * 1.7, 5))
      const g = slab(PICKET.thick, tall, PICKET.wide, { round: 0.04, sx: 1, sy: 2, sz: 1, warp: 0.03, seed: i * 7 + j })
      solid.add(g, { matrix: new THREE.Matrix4().makeRotationY(top.yaw).setPosition(at.x, at.y - drop / 2, at.z), color: mul3(PICKET_C, 0.85 + 0.3 * noise(i * 5.3, j * 2.9, 8)), surf: woodSurf(0.8), uv: grainUv(UP), uvOffset: [i * 1.3, j * 0.7], renormal: true })
    }
}
const pathShapes = L.shapes.filter((s) => s.role === 'path')
for (const [i, s] of pathShapes.entries()) {
  const step = i < L.steps.length
  const g = slab(2 * s.half[0], 2 * s.half[1], 2 * s.half[2], { round: step ? 0.2 : 0.29, sx: 9, sy: 2, sz: 6, warp: step ? 0.06 : 0.1, seed: R() * 30 })
  if (!step) {
    const P = g.getAttribute('position')
    const seed = R() * 30
    for (let k = 0; k < P.count; k++) {
      const x = P.getX(k)
      const z = P.getZ(k)
      const a = Math.atan2(z / s.half[2], x / s.half[0])
      const rr = Math.hypot(x / s.half[0], z / s.half[2])
      const squeeze = rr > 0.01 ? (0.9 + 0.12 * noise(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3, 2)) / Math.max(1, 0.72 * rr + 0.28 * Math.max(Math.abs(x / s.half[0]), Math.abs(z / s.half[2])) * 1.25) : 1
      P.setXYZ(k, x * squeeze, P.getY(k), z * squeeze)
    }
  }
  shade(g, (x, y, z) => 0.8 + 0.34 * fbm(x * 1.4, y * 1.4, z * 1.4 + i, 3))
  solid.add(g, { matrix: boxMatrix(s), color: mul3(step ? pick(ARCH) : SLATE, 0.8 + 0.25 * R()), surf: stoneSurf(), uvOffset: off(), renormal: true })
}

const IVY_SHADE = 0.5
const shrubs = RF.shrubs()
const shrubList = []
for (const sh of shrubs) {
  const centre = sh.centre
  shrubList.push({ centre, r: sh.r })
  const core = new THREE.IcosahedronGeometry(1, 2)
  const P = core.getAttribute('position')
  const seed = R() * 50
  for (let i = 0; i < P.count; i++) {
    const k = 0.78 + 0.16 * noise(P.getX(i) * 2 + seed, P.getY(i) * 2, P.getZ(i) * 2)
    P.setXYZ(i, P.getX(i) * sh.r[0] * k, P.getY(i) * sh.r[1] * k, P.getZ(i) * sh.r[2] * k)
  }
  solid.add(core, { matrix: T(...centre), color: mul3(lin('#141f12'), 1), surf: leafSurf, uvOffset: off(), renormal: true })
  const pos = []
  const nor = []
  const col = []
  const ivy = RF.isIvy(sh.r)
  const leaves = ivy ? Math.round(52 * sh.r[1] * (sh.r[0] + sh.r[2])) : 1100
  for (let i = 0; i < leaves; i++) {
    const u = R() * 2 - 0.25
    const yy = ivy ? 0.75 * u - 0.3125 : clamp(u, -0.25, 1)
    const a = ivy ? RF.wallOutward() + (R() - 0.5) * Math.PI * 1.2 : R() * Math.PI * 2
    const rr = Math.sqrt(Math.max(0, 1 - yy * yy))
    const d = [Math.cos(a) * rr, yy, Math.sin(a) * rr]
    const k = 0.84 + 0.2 * R()
    const p = [centre[0] + d[0] * sh.r[0] * k, centre[1] + d[1] * sh.r[1] * k, centre[2] + d[2] * sh.r[2] * k]
    const tip = norm3([d[0] + (R() - 0.5) * 0.9, d[1] * 0.6 + 0.45 + (R() - 0.5) * 0.6, d[2] + (R() - 0.5) * 0.9])
    const len = 0.3 + 0.24 * R()
    const sideV = norm3([tip[1] * d[2] - tip[2] * d[1] + (R() - 0.5) * 0.4, tip[2] * d[0] - tip[0] * d[2], tip[0] * d[1] - tip[1] * d[0] + (R() - 0.5) * 0.4])
    const w = 0.09 + 0.06 * R()
    const mid = add3(p, sc(tip, len * 0.45))
    const A = p
    const B = add3(mid, sc(sideV, w))
    const Cc = add3(p, sc(tip, len))
    const D = add3(mid, sc(sideV, -w))
    const tone = mul3(pick(LEAVES), (0.75 + 0.6 * R()) * (ivy ? IVY_SHADE : 1))
    const nn = norm3(add3(sc(d, 0.75), [0, 0.35, 0]))
    for (const [q, s] of [[A, 0.55], [B, 0.9], [Cc, 1.15], [A, 0.55], [Cc, 1.15], [D, 0.9]]) {
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
  solid.add(g, { surf: leafSurf, uvOffset: off() })
}

{
  const rings = 30
  const around = 96
  const skirt = 6
  const r = L.innerRadiusMm - 0.6
  const pos = []
  const idx = []
  const row = around + 1
  for (let k = 0; k <= rings + skirt; k++)
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2
      const edge = L.islandEdge(a)
      const c = Math.cos(a)
      const s = Math.sin(a)
      if (k <= rings) {
        const rr = edge * Math.pow(k / rings, 0.8)
        pos.push(c * rr, L.groundAt(c * rr, s * rr), s * rr)
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
  shade(g, (x, y, z) => 0.8 + 0.3 * fbm(x * 0.2, z * 0.2, 1, 3))
  ground.add(g, { color: lin('#5b4a36'), surf: [surf(KIND.stone, 0.95), L.pondField(0, 0)], uv: (p) => [p[0], p[2]] })
}

const meshes = [solid, paneGable, paneSide, lampGlass, ground].map((b) => fromThree(b.name, b.geometry(), b === solid ? { shrubs: shrubList, tileMm: TILE_MM } : undefined))
const out = writeGlb(rel('assets-full', 'shared', 'village-model.glb'), meshes)

const SIZE = 1024
const grainBytes = writePng(rel('assets-full', 'shared', 'village-grain.lin.tile.png'), SIZE, (px, py) => {
  const u = px / SIZE
  const v = py / SIZE
  let mineral = 0.5 + 0.6 * fbm(u * 14, v * 14, 0, 5, 14)
  const pit = noise(u * 110, v * 110, 3, 110)
  mineral -= 0.42 * smooth(0.5, 0.86, pit)
  mineral += 0.2 * smooth(0.6, 0.9, noise(u * 56, v * 56, 6, 56))
  let wood = 0.5 + 0.42 * fbm(u * 5, v * 84, 1, 4, [5, 84])
  wood += 0.16 * Math.sin((v * 34 + 0.9 * fbm(u * 3, v * 6, 2, 3, [3, 6])) * Math.PI * 2)
  wood -= 0.3 * smooth(0.62, 0.9, noise(u * 12, v * 190, 5, [12, 190]))
  const mottle = 0.5 + 0.7 * fbm(u * 3, v * 3, 4, 4, 3)
  return [mineral, wood, mottle]
})

const record = {
  made: 'assets-src/village/build.mjs',
  model: { file: 'assets-full/shared/village-model.glb', bytes: out.bytes, triangles: out.triangles, meshes: Object.fromEntries([solid, paneGable, paneSide, lampGlass, ground].map((b) => [b.name, b.triangles])) },
  maps: { 'assets-full/shared/village-grain.lin.tile.png': { px: SIZE, bytes: grainBytes, tileMm: TILE_MM } },
}
writeJson(rel('out', 'work', 'village', 'build.json'), record)
console.log(`village: ${out.triangles} triangles in ${out.meshes} meshes (${Object.entries(record.model.meshes).map(([k, v]) => `${k} ${v}`).join(', ')}), ${(out.bytes / 1e6).toFixed(2)} MB; grain map ${SIZE} px, ${(grainBytes / 1e6).toFixed(2)} MB`)
