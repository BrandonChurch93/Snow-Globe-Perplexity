import { config } from '../config'
import type { Emitter, SdfGrid } from '../core/stage'

const G = config.globe
export const outerRadiusMm = G.sphereDiameterMm / 2
export const innerRadiusMm = outerRadiusMm - G.glassThicknessMm
export const centreHeightMm = G.baseHeightMm - G.collarDepthMm + outerRadiusMm
export const groundY = G.islandLevelMm - centreHeightMm
export const domeHeightMm = innerRadiusMm - groundY
export const collarY = G.baseHeightMm - centreHeightMm

const RAD = Math.PI / 180
const PEAK_Z = -15
const FALL = 0.0016
const WALL_GAP = 0.6

export const groundAt = (x: number, z: number): number => groundY - FALL * (x * x + (z - PEAK_Z) * (z - PEAK_Z))

export function islandEdge(angle: number): number {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const r = innerRadiusMm - WALL_GAP
  let lo = 0
  let hi = r
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi)
    const y = groundAt(c * mid, s * mid)
    if (mid * mid + y * y < r * r) lo = mid
    else hi = mid
  }
  return lo
}

export type Role = 'cottage' | 'roof' | 'chimney' | 'trunk' | 'crown' | 'post' | 'lamp' | 'pond' | 'fence' | 'path'

export interface Box {
  kind: 'box'
  role: Role
  centre: [number, number, number]
  half: [number, number, number]
  yaw: number
  roll: number
}
export interface Cone {
  kind: 'cone'
  role: Role
  foot: [number, number, number]
  radius: number
  top: number
  height: number
}
export interface Ball {
  kind: 'ball'
  role: Role
  centre: [number, number, number]
  radius: number
}
export interface Disc {
  kind: 'disc'
  role: Role
  centre: [number, number, number]
  rx: number
  rz: number
  yaw: number
}
export type Shape = Box | Cone | Ball | Disc

const SINK = 0.4

function build(): Shape[] {
  const out: Shape[] = []
  const on = (x: number, z: number) => groundAt(x, z) - SINK
  const box = (role: Role, x: number, z: number, lift: number, half: [number, number, number], yawDeg: number, rollDeg = 0, ground = on(x, z)) =>
    out.push({ kind: 'box', role, centre: [x, ground + lift, z], half, yaw: yawDeg * RAD, roll: rollDeg * RAD })

  const cx = -17
  const cz = -3
  const yaw = 22
  const floor = on(cx, cz)
  const wall = 6.9
  const local = (lx: number, lz: number): [number, number] => {
    const c = Math.cos(yaw * RAD)
    const s = Math.sin(yaw * RAD)
    return [cx + c * lx + s * lz, cz - s * lx + c * lz]
  }
  box('cottage', cx, cz, wall, [10.5, wall, 7.5], yaw, 0, floor)
  box('roof', cx, cz, 2 * wall, [11.3, 5.3, 5.3], yaw, 45, floor)
  const [chx, chz] = local(-5.5, -1.5)
  box('chimney', chx, chz, 2 * wall + 6.4, [1.5, 2.8, 1.5], yaw, 0, floor)

  const tx = 18
  const tz = -5
  const tf = on(tx, tz)
  out.push({ kind: 'cone', role: 'trunk', foot: [tx, tf, tz], radius: 4.4, top: 2.3, height: 34 })
  out.push({ kind: 'ball', role: 'crown', centre: [tx, tf + 46.4, tz], radius: 17.5 })

  const lx = 2.5
  const lz = 13
  const lf = on(lx, lz)
  box('post', lx, lz, 8, [0.7, 8, 0.7], 0, 0, lf)
  out.push({ kind: 'ball', role: 'lamp', centre: [lx, lf + 17.4, lz], radius: 1.9 })

  out.push({ kind: 'disc', role: 'pond', centre: [3, groundAt(3, 33) + 0.25, 33], rx: 13, rz: 7.5, yaw: 0 })

  const f0: [number, number] = [-34, 21]
  const f1: [number, number] = [-15, 34]
  const posts = 5
  for (let i = 0; i < posts; i++) {
    const t = i / (posts - 1)
    const x = f0[0] + (f1[0] - f0[0]) * t
    const z = f0[1] + (f1[1] - f0[1]) * t
    box('fence', x, z, 3, [0.6, 3, 0.6], 0)
  }
  const fyaw = Math.atan2(-(f1[1] - f0[1]), f1[0] - f0[0]) / RAD
  const flen = Math.hypot(f1[0] - f0[0], f1[1] - f0[1]) / 2
  const fmx = (f0[0] + f1[0]) / 2
  const fmz = (f0[1] + f1[1]) / 2
  box('fence', fmx, fmz, 4.4, [flen, 0.45, 0.3], fyaw, 0, (on(f0[0], f0[1]) + on(f1[0], f1[1])) / 2)
  box('fence', fmx, fmz, 2.2, [flen, 0.45, 0.3], fyaw, 0, (on(f0[0], f0[1]) + on(f1[0], f1[1])) / 2)

  const [dx, dz] = local(4, 8.4)
  const stones = 5
  for (let i = 0; i < stones; i++) {
    const t = (i + 0.6) / (stones + 0.4)
    const x = dx + (1.5 - dx) * t + Math.sin(t * Math.PI) * 3
    const z = dz + (24 - dz) * t
    box('path', x, z, 0.3, [2.3, 0.35, 1.7], 30 - 50 * t, 0, groundAt(x, z))
  }
  return out
}

export const shapes: readonly Shape[] = build()

export function boxAxes(b: Box): { x: [number, number, number]; y: [number, number, number]; z: [number, number, number] } {
  const cy = Math.cos(b.yaw)
  const sy = Math.sin(b.yaw)
  const cr = Math.cos(b.roll)
  const sr = Math.sin(b.roll)
  return { x: [cy, 0, -sy], y: [sy * sr, cr, cy * sr], z: [sy * cr, -sr, cy * cr] }
}

export function shapePoints(s: Shape): [number, number, number][] {
  const pts: [number, number, number][] = []
  if (s.kind === 'box') {
    const a = boxAxes(s)
    for (const i of [-1, 1]) for (const j of [-1, 1]) for (const k of [-1, 1])
      pts.push([
        s.centre[0] + i * s.half[0] * a.x[0] + j * s.half[1] * a.y[0] + k * s.half[2] * a.z[0],
        s.centre[1] + i * s.half[0] * a.x[1] + j * s.half[1] * a.y[1] + k * s.half[2] * a.z[1],
        s.centre[2] + i * s.half[0] * a.x[2] + j * s.half[1] * a.y[2] + k * s.half[2] * a.z[2],
      ])
  } else if (s.kind === 'cone') {
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2
      pts.push([s.foot[0] + Math.cos(t) * s.radius, s.foot[1], s.foot[2] + Math.sin(t) * s.radius])
      pts.push([s.foot[0] + Math.cos(t) * s.top, s.foot[1] + s.height, s.foot[2] + Math.sin(t) * s.top])
    }
  } else if (s.kind === 'ball') {
    for (const d of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const)
      pts.push([s.centre[0] + d[0] * s.radius, s.centre[1] + d[1] * s.radius, s.centre[2] + d[2] * s.radius])
    const l = Math.hypot(...s.centre) || 1
    pts.push([s.centre[0] * (1 + s.radius / l), s.centre[1] * (1 + s.radius / l), s.centre[2] * (1 + s.radius / l)])
  } else {
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * Math.PI * 2
      const x = Math.cos(t) * s.rx
      const z = Math.sin(t) * s.rz
      pts.push([s.centre[0] + Math.cos(s.yaw) * x + Math.sin(s.yaw) * z, s.centre[1], s.centre[2] - Math.sin(s.yaw) * x + Math.cos(s.yaw) * z])
    }
  }
  return pts
}

export function shapeTop(s: Shape): number {
  return Math.max(...shapePoints(s).map((p) => p[1]))
}

export function heights(): { cottage: number; tree: number; lamp: number; dome: number; island: number } {
  const top = (roles: Role[]) => Math.max(...shapes.filter((s) => roles.includes(s.role)).map(shapeTop)) - groundY
  return { cottage: top(['cottage', 'roof']), tree: top(['trunk', 'crown']), lamp: top(['post', 'lamp']), dome: domeHeightMm, island: groundY + centreHeightMm }
}

function distance(s: Shape, x: number, y: number, z: number): number {
  if (s.kind === 'ball') return Math.hypot(x - s.centre[0], y - s.centre[1], z - s.centre[2]) - s.radius
  if (s.kind === 'box') {
    const a = boxAxes(s)
    const px = x - s.centre[0]
    const py = y - s.centre[1]
    const pz = z - s.centre[2]
    const qx = Math.abs(px * a.x[0] + py * a.x[1] + pz * a.x[2]) - s.half[0]
    const qy = Math.abs(px * a.y[0] + py * a.y[1] + pz * a.y[2]) - s.half[1]
    const qz = Math.abs(px * a.z[0] + py * a.z[1] + pz * a.z[2]) - s.half[2]
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0)
  }
  if (s.kind === 'cone') {
    const r = Math.hypot(x - s.foot[0], z - s.foot[2])
    const h = y - s.foot[1]
    const t = Math.min(1, Math.max(0, h / s.height))
    const side = (r - (s.radius + (s.top - s.radius) * t)) * Math.cos(Math.atan2(s.radius - s.top, s.height))
    const cap = Math.max(-h, h - s.height)
    return side > 0 && cap > 0 ? Math.hypot(side, cap) : Math.max(side, cap)
  }
  return Infinity
}

export function solidDistance(x: number, y: number, z: number, keep?: (role: Role | 'ground') => boolean): number {
  let d = !keep || keep('ground') ? (y - groundAt(x, z)) / Math.sqrt(1 + 4 * FALL * FALL * (x * x + (z - PEAK_Z) * (z - PEAK_Z))) : Infinity
  for (const s of shapes) {
    if (keep && !keep(s.role)) continue
    const v = distance(s, x, y, z)
    if (v < d) d = v
  }
  return d
}

export const colliderCells = 64

export function gridOf(distanceAt: (x: number, y: number, z: number) => number): SdfGrid {
  const n = colliderCells
  const sizeMm = 2 * innerRadiusMm
  const data = new Float32Array(n * n * n)
  const step = sizeMm / (n - 1)
  const half = sizeMm / 2
  for (let k = 0; k < n; k++) {
    const z = -half + k * step
    for (let j = 0; j < n; j++) {
      const y = -half + j * step
      for (let i = 0; i < n; i++) data[i + n * (j + n * k)] = distanceAt(-half + i * step, y, z)
    }
  }
  return { n, sizeMm, data }
}

export function buildCollider(extra?: (x: number, y: number, z: number) => number): SdfGrid {
  return gridOf(extra ? (x, y, z) => Math.min(solidDistance(x, y, z), extra(x, y, z)) : (x, y, z) => solidDistance(x, y, z))
}

function find<K extends Shape['kind']>(role: Role, kind: K): Extract<Shape, { kind: K }> {
  const s = shapes.find((x) => x.role === role && x.kind === kind)
  if (!s) throw new Error(`the layout has no ${role}`)
  return s as Extract<Shape, { kind: K }>
}

export function onBox(b: Box, lx: number, ly: number, lz: number): [number, number, number] {
  const a = boxAxes(b)
  return [
    b.centre[0] + lx * b.half[0] * a.x[0] + ly * b.half[1] * a.y[0] + lz * b.half[2] * a.z[0],
    b.centre[1] + lx * b.half[0] * a.x[1] + ly * b.half[1] * a.y[1] + lz * b.half[2] * a.z[1],
    b.centre[2] + lx * b.half[0] * a.x[2] + ly * b.half[1] * a.y[2] + lz * b.half[2] * a.z[2],
  ]
}

const walls = find('cottage', 'box')
const crown = find('crown', 'ball')
const lamp = find('lamp', 'ball')
const pond = find('pond', 'disc')

export const anchors = {
  lamp: lamp.centre,
  window: onBox(walls, 0.45, 0.1, 1.06),
  door: onBox(walls, -0.25, -0.45, 1.06),
  crown: crown.centre,
  crownTop: [crown.centre[0], crown.centre[1] + crown.radius, crown.centre[2]] as [number, number, number],
  pond: pond.centre,
  hearth: onBox(walls, 0, 0, 0),
}

const CLEAR = 0.8
const trunk = find('trunk', 'cone')

function shell(c: readonly [number, number, number], radius: number, r: number, dirs: readonly (readonly [number, number, number])[]): Emitter[] {
  return dirs.map((d) => {
    const k = (radius + r + CLEAR) / Math.hypot(d[0], d[1], d[2])
    return { x: c[0] + d[0] * k, y: c[1] + d[1] * k, z: c[2] + d[2] * k, r }
  })
}

const canopy: readonly Emitter[] = shell(crown.centre, crown.radius, 4, [
  [0, 1, 0],
  [1, 1, 0], [-1, 1, 0], [0, 1, 1], [0, 1, -1],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [1, -0.5, 0.4], [-1, -0.5, 0.4], [0, -0.5, 1],
])

function spot(at: readonly [number, number, number], r: number): Emitter {
  return { x: at[0], y: at[1], z: at[2], r }
}

const sparks: readonly Emitter[] = [
  spot([lamp.centre[0], lamp.centre[1] + lamp.radius + 2 + CLEAR, lamp.centre[2]], 2),
  spot(onBox(walls, 0.45, 0.1, 1 + (2 + CLEAR) / walls.half[2]), 2),
  spot(onBox(walls, -0.25, -0.3, 1 + (2 + CLEAR) / walls.half[2]), 2),
  spot([trunk.foot[0] - 7, groundAt(trunk.foot[0] - 7, trunk.foot[2] + 7) + 2.2 + CLEAR, trunk.foot[2] + 7], 2.2),
  ...shell(crown.centre, crown.radius, 2.5, [[-1, -0.35, 0.5], [0.4, -0.3, 1], [1, 0.1, 0.6]]),
]

export const emitters: Readonly<Record<string, readonly Emitter[]>> = { petal: canopy, leaf: canopy, ember: sparks }
