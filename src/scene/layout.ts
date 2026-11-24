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
const WALL_GAP = 0.6

const MOUND = 8.64
const BACK_SLOPE = 0.03
const RAKE = 0.284
const RAKE_FROM = -8
const RAKE_FULL = 4
const RAKE_SPAN = RAKE_FULL - RAKE_FROM

export const pond = { x: 5.6, z: 26.2, rx: 17.2, rz: 18, yaw: -0.1, power: 3, dip: 1.3, level: 0.55 }

export function pondField(x: number, z: number): number {
  const c = Math.cos(pond.yaw)
  const s = Math.sin(pond.yaw)
  const dx = x - pond.x
  const dz = z - pond.z
  const lx = c * dx - s * dz
  const lz = s * dx + c * dz
  const a = Math.atan2(lz, lx)
  const wobble = 1 + 0.045 * Math.sin(3 * a + 1.3) + 0.03 * Math.sin(5 * a + 0.4) + 0.018 * Math.sin(9 * a + 2.1)
  return Math.pow(Math.pow(Math.abs(lx / pond.rx), pond.power) + Math.pow(Math.abs(lz / pond.rz), pond.power), 1 / pond.power) / wobble
}

export function moundAt(z: number): number {
  if (z <= RAKE_FROM) return groundY + MOUND + BACK_SLOPE * (RAKE_FROM - z)
  const t = Math.min(z, RAKE_FULL) - RAKE_FROM
  const eased = groundY + MOUND - BACK_SLOPE * t - ((RAKE - BACK_SLOPE) * t * t) / (2 * RAKE_SPAN)
  return z <= RAKE_FULL ? eased : eased - RAKE * (z - RAKE_FULL)
}

export function moundSlope(z: number): number {
  if (z <= RAKE_FROM) return BACK_SLOPE
  if (z >= RAKE_FULL) return RAKE
  return BACK_SLOPE + ((RAKE - BACK_SLOPE) * (z - RAKE_FROM)) / RAKE_SPAN
}

const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export const groundAt = (x: number, z: number): number => moundAt(z) - pond.dip * (1 - smooth(0.86, 1.04, pondField(x, z)))

const BANK = { front: 0.85, side: 5, back: 3, wave: 0.3, ripple: 0.2, reachFront: 3.2, reachSide: 9.2 }

const wallGap = (x: number, z: number): number => {
  const y = moundAt(z)
  return Math.sqrt(Math.max(0, innerRadiusMm * innerRadiusMm - y * y)) - Math.hypot(x, z)
}

export function bankAt(x: number, z: number): number {
  const gap = wallGap(x, z)
  if (gap >= BANK.reachSide) return 0
  const a = Math.atan2(z, x)
  const turn = Math.atan2(x, z) / RAD
  const side = turn >= 0 ? smooth(20, 50, turn) : smooth(56, 74, -turn)
  const back = smooth(100, 140, Math.abs(turn))
  const wave = 0.5 * Math.sin(3 * a + 0.7) + 0.32 * Math.sin(7 * a + 2.1) + 0.18 * Math.sin(13 * a + 4.4)
  const ripple = 0.5 * Math.sin(23 * a + 1.1) + 0.5 * Math.sin(37 * a + 5.2)
  const rise = BANK.front + (BANK.side - BANK.front) * side * (1 + 0.1 * wave) - (BANK.side - BANK.back) * back + BANK.wave * wave + BANK.ripple * ripple
  const reach = BANK.reachFront + (BANK.reachSide - BANK.reachFront) * Math.max(side, back) * (0.86 + 0.14 * Math.sin(5 * a + 1.9))
  return rise * (1 - smooth(0, reach, gap))
}

const RIM = { riseMm: 1.25, from: 0.97, crest: 1.09, to: 1.5, clearMm: 3, wallMm: 6 }

export function rimAt(x: number, z: number): number {
  const f = pondField(x, z)
  if (f <= RIM.from || f >= RIM.to) return 0
  const a = Math.atan2(z - pond.z, x - pond.x)
  const lumps = 1 + 0.22 * Math.sin(4 * a + 0.6) + 0.16 * Math.sin(9 * a + 2.9) + 0.1 * Math.sin(17 * a + 1.2)
  let clear = smooth(0.5, RIM.wallMm, wallGap(x, z))
  for (const [sx, sz] of [...steps, ...stones, [lamppost.x, lamppost.z] as const]) clear *= 1 - Math.exp(-((x - sx) * (x - sx) + (z - sz) * (z - sz)) / (RIM.clearMm * RIM.clearMm))
  return RIM.riseMm * lumps * clear * smooth(RIM.from, RIM.crest, f) * (1 - smooth(RIM.crest, RIM.to, f))
}

const DRIFT = { riseMm: 1.1, pondFrom: 1.08, pondTo: 1.4, glassFrom: 2.5, glassTo: 9, clearMm: 3.2, treeFrom: 9, treeTo: 13 }
const HEAP = { riseMm: 2.4, dx: -0.3, dz: 4.8, wide: 3.5, deep: 2.5, cut: 0.02 }

export function heapAt(x: number, z: number): number {
  const hx = x - (tree.x + HEAP.dx)
  const hz = z - (tree.z + HEAP.dz)
  return (HEAP.riseMm * Math.max(0, Math.exp(-((hx * hx) / HEAP.wide + (hz * hz) / HEAP.deep)) - HEAP.cut)) / (1 - HEAP.cut)
}

export function driftAt(x: number, z: number): number {
  const f = pondField(x, z)
  if (f <= DRIFT.pondFrom) return 0
  const gap = wallGap(x, z)
  if (gap <= DRIFT.glassFrom) return 0
  const lumps = Math.sin(0.42 * x + 0.21 * z + 0.9) * Math.sin(-0.19 * x + 0.47 * z + 2.3) + 0.55 * Math.sin(0.51 * x - 0.63 * z + 4.1) * Math.sin(0.68 * x + 0.44 * z + 0.5)
  if (lumps <= 0) return 0
  let clear = smooth(DRIFT.pondFrom, DRIFT.pondTo, f) * smooth(DRIFT.glassFrom, DRIFT.glassTo, gap)
  for (const [sx, sz] of [...steps, ...stones, [lamppost.x, lamppost.z] as const]) clear *= 1 - Math.exp(-((x - sx) * (x - sx) + (z - sz) * (z - sz)) / (DRIFT.clearMm * DRIFT.clearMm))
  clear *= smooth(DRIFT.treeFrom, DRIFT.treeTo, Math.hypot(x - tree.x, z - tree.z))
  return DRIFT.riseMm * clear * smooth(0, 1, lumps)
}

export const snowTop = (x: number, z: number): number => groundAt(x, z) + bankAt(x, z) + rimAt(x, z) + driftAt(x, z) + heapAt(x, z)

export function islandEdge(angle: number): number {
  const s = Math.sin(angle)
  const r = innerRadiusMm - WALL_GAP
  let lo = 0
  let hi = r
  for (let i = 0; i < 40; i++) {
    const mid = 0.5 * (lo + hi)
    const y = moundAt(s * mid)
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

export const cottage = {
  x: -14.6,
  z: -10.3,
  yawDeg: 28,
  halfWidth: 8.5,
  halfLength: 10,
  sill: -4.2,
  wall: 8.7,
  footing: 2.6,
  rise: 9.2,
  overhang: 1.3,
  gableOverhang: 1.1,
  roofThick: 0.65,
  chimney: { along: -5.7, across: -2.25, half: 1.5, halfAlong: 2, top: 21.4 },
  door: { across: 2.5, width: 5, height: 7.4 },
  window: { across: -5.2, width: 2.6, height: 3.5, sill: 3.3 },
  sideWindow: { along: 1.7, width: 2.9, height: 3.2, sill: 3.6 },
}

export const lamppost = { x: 1.3, z: 3.9, height: 11.9, lantern: 9.8, radius: 1.5, post: 0.45 }
export const tree = { x: 12.5, z: -5, trunk: 3.5, top: 1.9, height: 17, crownY: 9, crown: 15 }
export const fence = { from: [-33, -4.2] as [number, number], to: [-19.9, 20.8] as [number, number], posts: 5, height: 5.6, post: 0.55, rails: [4.1, 1.7] as [number, number] }
export const steps: readonly [number, number][] = [[-6.7, -2.2], [-5.9, 0.6], [-5.2, 3.4]]
export const stones: readonly [number, number][] = [[-6.4, 7], [-8.6, 10.4], [-10.7, 13.6], [-12.4, 16.9], [-12.9, 20.3]]

export function cottageFrame(): { u: [number, number]; v: [number, number]; floor: number } {
  const c = Math.cos(cottage.yawDeg * RAD)
  const s = Math.sin(cottage.yawDeg * RAD)
  return { u: [s, c], v: [c, -s], floor: moundAt(cottage.sill) }
}

export function cottagePoint(across: number, up: number, along: number): [number, number, number] {
  const f = cottageFrame()
  return [cottage.x + f.v[0] * across + f.u[0] * along, f.floor + up, cottage.z + f.v[1] * across + f.u[1] * along]
}

function build(): Shape[] {
  const out: Shape[] = []
  const on = (x: number, z: number) => groundAt(x, z) - SINK
  const box = (role: Role, at: [number, number, number], half: [number, number, number], yawDeg: number, rollDeg = 0) =>
    out.push({ kind: 'box', role, centre: at, half, yaw: yawDeg * RAD, roll: rollDeg * RAD })

  const c = cottage
  const high = (c.wall + c.footing) / 2
  box('cottage', cottagePoint(0, high - c.footing, 0), [c.halfWidth, high, c.halfLength], c.yawDeg)
  const pitch = Math.atan2(c.rise, c.halfWidth)
  const run = (c.halfWidth + c.overhang) / Math.cos(pitch) / 2
  const lift = c.wall + c.rise + c.roofThick * Math.cos(pitch) - run * Math.sin(pitch)
  const out2 = run * Math.cos(pitch)
  box('roof', cottagePoint(-out2, lift, 0), [c.halfLength + c.gableOverhang, c.roofThick, run], c.yawDeg - 90, pitch / RAD)
  box('roof', cottagePoint(out2, lift, 0), [c.halfLength + c.gableOverhang, c.roofThick, run], c.yawDeg - 90, -pitch / RAD)
  const core = (c.halfWidth - 0.4) / Math.SQRT2
  box('roof', cottagePoint(0, c.wall + c.rise - 0.5 - core * Math.SQRT2, 0), [c.halfLength, core, core], c.yawDeg - 90, 45)
  const stack = (c.chimney.top - c.wall) / 2
  box('chimney', cottagePoint(c.chimney.across, c.wall + stack, c.chimney.along), [c.chimney.half, stack, c.chimney.halfAlong], c.yawDeg)

  const tf = on(tree.x, tree.z)
  out.push({ kind: 'cone', role: 'trunk', foot: [tree.x, tf, tree.z], radius: tree.trunk, top: tree.top, height: tree.height })
  out.push({ kind: 'ball', role: 'crown', centre: [tree.x, tree.crownY, tree.z], radius: tree.crown })

  const lf = on(lamppost.x, lamppost.z)
  box('post', [lamppost.x, lf + lamppost.lantern / 2, lamppost.z], [lamppost.post, lamppost.lantern / 2, lamppost.post], 0)
  out.push({ kind: 'ball', role: 'lamp', centre: [lamppost.x, lf + SINK + lamppost.lantern + 0.6, lamppost.z], radius: lamppost.radius })

  out.push({ kind: 'disc', role: 'pond', centre: [pond.x, moundAt(pond.z) - pond.level, pond.z], rx: pond.rx, rz: pond.rz, yaw: pond.yaw })

  const f = fence
  const fdx = f.to[0] - f.from[0]
  const fdz = f.to[1] - f.from[1]
  const flen = Math.hypot(fdx, fdz)
  for (let i = 0; i < f.posts; i++) {
    const t = i / (f.posts - 1)
    const x = f.from[0] + fdx * t
    const z = f.from[1] + fdz * t
    box('fence', [x, on(x, z) + f.height / 2, z], [f.post, f.height / 2, f.post], Math.atan2(fdx, fdz) / RAD)
  }
  const fy0 = on(f.from[0], f.from[1])
  const fy1 = on(f.to[0], f.to[1])
  const froll = Math.atan2(fy0 - fy1, flen) / RAD
  for (const h of f.rails)
    box('fence', [(f.from[0] + f.to[0]) / 2, (fy0 + fy1) / 2 + h, (f.from[1] + f.to[1]) / 2], [0.28, 0.42, Math.hypot(flen, fy0 - fy1) / 2], Math.atan2(fdx, fdz) / RAD, froll)

  steps.forEach(([x, z], i) => box('path', [x, groundAt(x, z) + 0.15, z], [2.9 + 0.25 * i, 0.5, 1.45], c.yawDeg))
  stones.forEach(([x, z], i) => box('path', [x, groundAt(x, z) + 0.05, z], [1.9, 0.3, 1.4], 20 - 28 * i, Math.atan(moundSlope(z)) / RAD))
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
  const top = (roles: Role[]) => Math.max(...shapes.filter((s) => roles.includes(s.role)).map(shapeTop))
  return {
    cottage: top(['cottage', 'roof', 'chimney']) - cottageFrame().floor,
    tree: top(['trunk', 'crown']) - groundY,
    lamp: top(['post', 'lamp']) - groundAt(lamppost.x, lamppost.z),
    dome: domeHeightMm,
    island: groundY + centreHeightMm,
  }
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
  let d = !keep || keep('ground') ? (y - groundAt(x, z)) / Math.sqrt(1 + moundSlope(z) * moundSlope(z)) : Infinity
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
const water = find('pond', 'disc')

const onGable = (across: number, up: number, out: number): [number, number, number] => cottagePoint(across, up, cottage.halfLength + out)

export const anchors = {
  lamp: lamp.centre,
  window: onGable(cottage.window.across, cottage.window.sill + cottage.window.height / 2, 0.45),
  door: onGable(cottage.door.across, cottage.door.height * 0.45, 0.45),
  crown: crown.centre,
  crownTop: [crown.centre[0], crown.centre[1] + crown.radius, crown.centre[2]] as [number, number, number],
  pond: water.centre,
  hearth: onBox(walls, 0, 0, 0),
  sideWindow: cottagePoint(-cottage.halfWidth - 0.45, cottage.sideWindow.sill + cottage.sideWindow.height / 2, cottage.sideWindow.along),
  chimney: cottagePoint(cottage.chimney.across, cottage.chimney.top + 0.8, cottage.chimney.along),
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
  spot(onGable(cottage.window.across, cottage.window.sill + cottage.window.height / 2, 2 + CLEAR + 1.2), 2),
  spot(onGable(cottage.door.across, cottage.door.height * 0.6, 2 + CLEAR + 1.2), 2),
  spot([trunk.foot[0] - 7, groundAt(trunk.foot[0] - 7, trunk.foot[2] + 7) + 2.2 + CLEAR, trunk.foot[2] + 7], 2.2),
  ...shell(crown.centre, crown.radius, 2.5, [[-1, -0.35, 0.5], [0.4, -0.3, 1], [1, 0.1, 0.6]]),
]

export const emitters: Readonly<Record<string, readonly Emitter[]>> = { petal: canopy, leaf: canopy, ember: sparks }
