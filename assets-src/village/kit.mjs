import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PNG } from 'pngjs'
import fs from 'node:fs'
import path from 'node:path'

export const TILE_MM = 12
export const KIND = { stone: 0, wood: 1, iron: 2, leaf: 3 }

export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hash(i, j, k) {
  let h = (Math.imul(i, 0x27d4eb2d) + Math.imul(j, 0x165667b1) + Math.imul(k, 0x9e3779b1)) | 0
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 12
  h = Math.imul(h, 0x297a2d39)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

const lerp = (a, b, t) => a + (b - a) * t
const fade = (t) => t * t * (3 - 2 * t)

export function noise(x, y, z = 0, period = 0) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const w = fade(z - zi)
  const px = Array.isArray(period) ? period[0] : period
  const py = Array.isArray(period) ? period[1] : period
  const wrap = (n, q) => (q ? ((n % q) + q) % q : n)
  const x0 = wrap(xi, px)
  const x1 = wrap(xi + 1, px)
  const y0 = wrap(yi, py)
  const y1 = wrap(yi + 1, py)
  const a = lerp(lerp(hash(x0, y0, zi), hash(x1, y0, zi), u), lerp(hash(x0, y1, zi), hash(x1, y1, zi), u), v)
  const b = lerp(lerp(hash(x0, y0, zi + 1), hash(x1, y0, zi + 1), u), lerp(hash(x0, y1, zi + 1), hash(x1, y1, zi + 1), u), v)
  return 2 * lerp(a, b, w) - 1
}

export function fbm(x, y, z = 0, octaves = 4, period = 0) {
  let s = 0
  let a = 0.5
  let f = 1
  for (let o = 0; o < octaves; o++) {
    s += a * noise(x * f, y * f, z * f + o * 17.3, Array.isArray(period) ? [period[0] * f, period[1] * f] : period ? period * f : 0)
    f *= 2
    a *= 0.5
  }
  return s
}

export const lin = (hex) => {
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
export const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
export const surf = (kind, rough) => kind + 0.02 + 0.9 * clamp(rough, 0, 1)

export const planar = (U, V) => (p) => [p[0] * U[0] + p[1] * U[1] + p[2] * U[2], p[0] * V[0] + p[1] * V[1] + p[2] * V[2]]
export const boxUv = (p, n) => {
  const ax = Math.abs(n[0])
  const ay = Math.abs(n[1])
  const az = Math.abs(n[2])
  if (ay >= ax && ay >= az) return [p[0], p[2]]
  if (ax >= az) return [p[2], p[1]]
  return [p[0], p[1]]
}
export const grainUv = (axis) => (p, n) => {
  const px = n[1] * axis[2] - n[2] * axis[1]
  const py = n[2] * axis[0] - n[0] * axis[2]
  const pz = n[0] * axis[1] - n[1] * axis[0]
  const l = Math.hypot(px, py, pz)
  if (l < 0.3) {
    const b = boxUv(p, n)
    return [b[1], b[0]]
  }
  return [p[0] * axis[0] + p[1] * axis[1] + p[2] * axis[2], (p[0] * px + p[1] * py + p[2] * pz) / l]
}

export class Bag {
  constructor(name) {
    this.name = name
    this.p = []
    this.n = []
    this.c = []
    this.uv = []
    this.s = []
    this.i = []
  }
  add(g, o = {}) {
    let geo = o.matrix ? g.clone().applyMatrix4(o.matrix) : g
    if (!geo.index) geo = mergeVertices(geo)
    if (!geo.getAttribute('normal') || o.matrix || o.renormal) geo.computeVertexNormals()
    const P = geo.getAttribute('position')
    const N = geo.getAttribute('normal')
    const C = geo.getAttribute('color')
    const color = o.color ?? [1, 1, 1]
    const sf = o.surf ?? [surf(KIND.stone, 0.85), 0]
    const uvOf = o.uv ?? boxUv
    const k = (o.uvScale ?? 1) / TILE_MM
    const ou = o.uvOffset ? o.uvOffset[0] : 0
    const ov = o.uvOffset ? o.uvOffset[1] : 0
    const base = this.p.length / 3
    for (let i = 0; i < P.count; i++) {
      const p = [P.getX(i), P.getY(i), P.getZ(i)]
      const n = [N.getX(i), N.getY(i), N.getZ(i)]
      this.p.push(p[0], p[1], p[2])
      this.n.push(n[0], n[1], n[2])
      let c = typeof color === 'function' ? color(p, n, i) : color
      if (C) c = [c[0] * C.getX(i), c[1] * C.getY(i), c[2] * C.getZ(i)]
      this.c.push(c[0], c[1], c[2])
      const s = typeof sf === 'function' ? sf(p, n, i) : sf
      this.s.push(s[0], s[1])
      if (o.keepUv) {
        const T = geo.getAttribute('uv')
        this.uv.push(T.getX(i), T.getY(i))
      } else {
        const t = uvOf(p, n)
        this.uv.push(t[0] * k + ou, t[1] * k + ov)
      }
    }
    const I = geo.index.array
    for (let j = 0; j < I.length; j++) this.i.push(base + I[j])
    return this
  }
  get triangles() {
    return this.i.length / 3
  }
  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.setAttribute('uv1', new THREE.Float32BufferAttribute(this.s, 2))
    g.setIndex(this.i)
    return g
  }
}

export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const norm3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

export function basis(origin, x, y) {
  const X = norm3(x)
  const Z = norm3(cross(X, y))
  const Y = cross(Z, X)
  return frame(origin, X, Y, Z)
}

export function boxMatrix(s) {
  return new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(s.roll, s.yaw, 0, 'YXZ')).setPosition(s.centre[0], s.centre[1], s.centre[2])
}

export class Tris {
  constructor() {
    this.p = []
    this.c = []
  }
  tri(a, b, c, want, ca = 1, cb = ca, cc = ca) {
    const n = cross(sub3(b, a), sub3(c, a))
    const flip = want && dot3(n, want) < 0
    const pts = flip ? [a, c, b] : [a, b, c]
    const cols = flip ? [ca, cc, cb] : [ca, cb, cc]
    for (let i = 0; i < 3; i++) {
      this.p.push(pts[i][0], pts[i][1], pts[i][2])
      const k = cols[i]
      if (typeof k === 'number') this.c.push(k, k, k)
      else this.c.push(k[0], k[1], k[2])
    }
  }
  quad(a, b, c, d, want, ca = 1, cb = ca, cc = ca, cd = ca) {
    this.tri(a, b, c, want, ca, cb, cc)
    this.tri(a, c, d, want, ca, cc, cd)
  }
  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3))
    return g
  }
}

export function frame(origin, right, up, out) {
  return new THREE.Matrix4().makeBasis(new THREE.Vector3(...right), new THREE.Vector3(...up), new THREE.Vector3(...out)).setPosition(origin[0], origin[1], origin[2])
}

export function shade(g, f) {
  const P = g.getAttribute('position')
  const a = new Float32Array(P.count * 3)
  for (let i = 0; i < P.count; i++) {
    const v = f(P.getX(i), P.getY(i), P.getZ(i), i)
    if (typeof v === 'number') a.fill(v, i * 3, i * 3 + 3)
    else a.set(v, i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}

export const STOUT = { post: 1.3, rail: 1.35 }

export function pillow(w, h, d, su, sv, R, o = {}) {
  const k = o.square ?? 2.5 + 2.4 * R()
  const g = new THREE.PlaneGeometry(2, 2, su, sv)
  const P = g.getAttribute('position')
  const sh = (R() - 0.5) * (o.shear ?? 0.26)
  const sk = (R() - 0.5) * (o.shear ?? 0.26) * 0.8
  const off = R() * 97
  const lump = o.lump ?? 0.3
  const tx = (R() - 0.5) * (o.tilt ?? 0.5)
  const ty = (R() - 0.5) * (o.tilt ?? 0.5)
  const edge = o.edge ?? 3.4
  const lobes = [0, 1, 2].map((i) => ({ n: 3 + i, a: (o.wobble ?? 0.1) * (0.5 + R()) * (i === 0 ? 1 : 0.7), p: R() * 6.2832 }))
  const col = new Float32Array(P.count * 3)
  for (let i = 0; i < P.count; i++) {
    let a = P.getX(i)
    let b = P.getY(i)
    a = Math.sign(a) * (1 - Math.pow(1 - Math.abs(a), 1.7))
    b = Math.sign(b) * (1 - Math.pow(1 - Math.abs(b), 1.7))
    const r = Math.min(1, Math.max(Math.abs(a), Math.abs(b)))
    const nk = Math.pow(Math.pow(Math.abs(a), k) + Math.pow(Math.abs(b), k), 1 / k) || 1
    let x = (a * r) / nk
    let y = (b * r) / nk
    const ang = Math.atan2(y, x)
    let wob = 1
    for (const l of lobes) wob += l.a * Math.cos(l.n * ang + l.p)
    x *= wob
    y *= wob
    const x2 = x + y * sh
    const y2 = y + x * sk
    let z = Math.pow(Math.max(0, 1 - Math.pow(r, edge)), 0.55)
    z *= 1 + lump * noise(x * 2.3 + off, y * 2.3 + 7, off + 3) + 0.5 * lump * noise(x * 5.1 + off, y * 5.1 + 3, off + 9) + tx * x + ty * y
    P.setXYZ(i, (x2 * w) / 2, (y2 * h) / 2, Math.max(0, z) * d)
    const s = 0.3 + 0.7 * smooth(0, 0.6, z)
    col.fill(s, i * 3, i * 3 + 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

export function slab(w, h, l, o = {}) {
  const sx = o.sx ?? 1
  const sy = o.sy ?? 1
  const sz = o.sz ?? 1
  const g = new THREE.BoxGeometry(w, h, l, sx, sy, sz)
  const r = o.round ?? 0
  const amp = o.warp ?? 0
  const off = o.seed ?? 0
  if (r > 0 || amp > 0) {
    const P = g.getAttribute('position')
    for (let i = 0; i < P.count; i++) {
      let x = P.getX(i)
      let y = P.getY(i)
      let z = P.getZ(i)
      if (r > 0) {
        const qx = clamp(x, -w / 2 + r, w / 2 - r)
        const qy = clamp(y, -h / 2 + r, h / 2 - r)
        const qz = clamp(z, -l / 2 + r, l / 2 - r)
        const dx = x - qx
        const dy = y - qy
        const dz = z - qz
        const dl = Math.hypot(dx, dy, dz)
        if (dl > 1e-6) {
          x = qx + (dx / dl) * r
          y = qy + (dy / dl) * r
          z = qz + (dz / dl) * r
        }
      }
      if (amp > 0) {
        x += amp * noise(x * 0.9 + off, y * 0.9, z * 0.9)
        y += amp * noise(x * 0.9, y * 0.9 + off, z * 0.9 + 5)
        z += amp * noise(x * 0.9 + 9, y * 0.9, z * 0.9 + off)
      }
      P.setXYZ(i, x, y, z)
    }
  }
  return g
}

export function hard(g) {
  const n = g.toNonIndexed()
  n.computeVertexNormals()
  return n
}

export function surfaceNets(sdf, min, max, cell) {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1
  const F = new Float32Array(nx * ny * nz)
  const at = (i, j, k) => i + nx * (j + ny * k)
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) F[at(i, j, k)] = sdf(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell)
  const cx = nx - 1
  const cy = ny - 1
  const cz = nz - 1
  const vid = new Int32Array(cx * cy * cz).fill(-1)
  const cat = (i, j, k) => i + cx * (j + cy * k)
  const pos = []
  const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]
  const v = new Float32Array(8)
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let mask = 0
        for (let c = 0; c < 8; c++) {
          v[c] = F[at(i + (c & 1), j + ((c >> 1) & 1), k + ((c >> 2) & 1))]
          if (v[c] < 0) mask |= 1 << c
        }
        if (mask === 0 || mask === 255) continue
        let sx = 0
        let sy = 0
        let sz = 0
        let n = 0
        for (const [a, b] of EDGES) {
          if (v[a] < 0 === v[b] < 0) continue
          const t = v[a] / (v[a] - v[b])
          sx += (a & 1) + t * ((b & 1) - (a & 1))
          sy += ((a >> 1) & 1) + t * (((b >> 1) & 1) - ((a >> 1) & 1))
          sz += ((a >> 2) & 1) + t * (((b >> 2) & 1) - ((a >> 2) & 1))
          n++
        }
        vid[cat(i, j, k)] = pos.length / 3
        pos.push(min[0] + (i + sx / n) * cell, min[1] + (j + sy / n) * cell, min[2] + (k + sz / n) * cell)
      }
  const idx = []
  const quad = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return
    idx.push(a, b, c, a, c, d)
  }
  for (let k = 1; k < cz; k++)
    for (let j = 1; j < cy; j++)
      for (let i = 1; i < cx; i++) {
        const f0 = F[at(i, j, k)] < 0
        if (f0 !== F[at(i + 1, j, k)] < 0) quad(vid[cat(i, j - 1, k - 1)], vid[cat(i, j, k - 1)], vid[cat(i, j, k)], vid[cat(i, j - 1, k)])
        if (f0 !== F[at(i, j + 1, k)] < 0) quad(vid[cat(i - 1, j, k - 1)], vid[cat(i, j, k - 1)], vid[cat(i, j, k)], vid[cat(i - 1, j, k)])
        if (f0 !== F[at(i, j, k + 1)] < 0) quad(vid[cat(i - 1, j - 1, k)], vid[cat(i, j - 1, k)], vid[cat(i, j, k)], vid[cat(i - 1, j, k)])
      }
  return { pos, idx }
}

export function netGeometry(sdf, min, max, cell, keep) {
  const { pos, idx } = surfaceNets(sdf, min, max, cell)
  const e = cell * 0.5
  const nor = new Float32Array(pos.length)
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i]
    const y = pos[i + 1]
    const z = pos[i + 2]
    const gx = sdf(x + e, y, z) - sdf(x - e, y, z)
    const gy = sdf(x, y + e, z) - sdf(x, y - e, z)
    const gz = sdf(x, y, z + e) - sdf(x, y, z - e)
    const l = Math.hypot(gx, gy, gz) || 1
    nor[i] = gx / l
    nor[i + 1] = gy / l
    nor[i + 2] = gz / l
  }
  const out = []
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3
    const b = idx[t + 1] * 3
    const c = idx[t + 2] * 3
    const mx = (pos[a] + pos[b] + pos[c]) / 3
    const my = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3
    const mz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3
    if (keep && !keep(mx, my, mz)) continue
    const ux = pos[b] - pos[a]
    const uy = pos[b + 1] - pos[a + 1]
    const uz = pos[b + 2] - pos[a + 2]
    const vx = pos[c] - pos[a]
    const vy = pos[c + 1] - pos[a + 1]
    const vz = pos[c + 2] - pos[a + 2]
    const fx = uy * vz - uz * vy
    const fy = uz * vx - ux * vz
    const fz = ux * vy - uy * vx
    const d = fx * (nor[a] + nor[b] + nor[c]) + fy * (nor[a + 1] + nor[b + 1] + nor[c + 1]) + fz * (nor[a + 2] + nor[b + 2] + nor[c + 2])
    if (d >= 0) out.push(idx[t], idx[t + 1], idx[t + 2])
    else out.push(idx[t], idx[t + 2], idx[t + 1])
  }
  const used = new Int32Array(pos.length / 3).fill(-1)
  const p2 = []
  const n2 = []
  const i2 = []
  for (const i of out) {
    if (used[i] < 0) {
      used[i] = p2.length / 3
      p2.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
      n2.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2])
    }
    i2.push(used[i])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(p2, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n2, 3))
  g.setIndex(i2)
  return g
}

export function boxDistance(b, axes, x, y, z, round = 0) {
  const px = x - b.centre[0]
  const py = y - b.centre[1]
  const pz = z - b.centre[2]
  const qx = Math.abs(px * axes.x[0] + py * axes.x[1] + pz * axes.x[2]) - (b.half[0] - round)
  const qy = Math.abs(px * axes.y[0] + py * axes.y[1] + pz * axes.y[2]) - (b.half[1] - round)
  const qz = Math.abs(px * axes.z[0] + py * axes.z[1] + pz * axes.z[2]) - (b.half[2] - round)
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - round
}

export const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.min(a, b) - h * h * k * 0.25
}

export function writePng(file, size, pixel, channels = 3) {
  const png = new PNG({ width: size, height: size, colorType: channels === 4 ? 6 : 2, inputColorType: 6 })
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = pixel(x, y)
      const o = (y * size + x) * 4
      png.data[o] = Math.round(clamp(v[0]) * 255)
      png.data[o + 1] = Math.round(clamp(v[1]) * 255)
      png.data[o + 2] = Math.round(clamp(v[2]) * 255)
      png.data[o + 3] = channels === 4 ? Math.round(clamp(v[3]) * 255) : 255
    }
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, PNG.sync.write(png, { colorType: channels === 4 ? 6 : 2 }))
  return fs.statSync(file).size
}
