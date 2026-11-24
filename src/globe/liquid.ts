import { config } from '../config'
import { stream } from '../core/rng'
import type { GlobePose } from '../shake/table'

const G = config.globe
const DT = 1 / config.sim.stepHz
const TAU = Math.PI * 2

export const LIQUID_R = G.sphereDiameterMm / 2 - G.glassThicknessMm
export const LIQUID_PIVOT_MM = G.baseHeightMm - G.collarDepthMm + G.sphereDiameterMm / 2
export const LIQUID_LENGTH = 12
export const LIQUID_TURN = 0
export const LIQUID_SLOSH = 3
export const LIQUID_TURBULENCE = 6
export const LIQUID_PHASE = 7
export const LIQUID_PHASE_B = 8
export const LIQUID_HAND = 9
export const LIQUID_BUBBLE = 10
export const TURBULENCE_MAX = 260
export const NOISE_N = 24
export const NOISE_RMS = 0.33

const GRAVITY_MM = 9810
const LAG = 0.35
const LAG_UPRIGHT = 0.9
const TURN_LEVEL_SECONDS = config.shake.spinDownSeconds / 7
const TURN_UPRIGHT_SECONDS = config.shake.spinDownSeconds / 2.6
const TURN_QUADRATIC = 0.1
const SLOSH_GAIN = 0.3
const SLOSH_SECONDS = 0.22
const SLOSH_LENGTH_MM = 30
const TURB_SECONDS = config.shake.spinDownSeconds * 0.4
const TURB_FROM_SLOSH = 0.85
const TURB_FROM_REVERSAL = 0.16
const TURB_FROM_TURN = 0.22
const SWIRL_GAIN = 0.4
const HAND_SECONDS = 1.6
const HAND_KNEE = 18
const HAND_ORBIT = 1.4
const HAND_LEAN = 1
const HAND_BIAS = 0.03
const PHASE_RATE = 0.012
const PHASE_RATE_B = 0.0074
const BUBBLE_SECONDS = 0.12
const AMBIENT_FLOW = 0.45
const AMBIENT_TURN = 0.008
const TURB_EPS = 1e-3

export const AMBIENT_MAX = 1.5 * AMBIENT_FLOW * 1.2 + AMBIENT_TURN * 1.2 * LIQUID_R

const INV_R2 = 1 / (LIQUID_R * LIQUID_R)
const CELL = (2 * LIQUID_R) / (NOISE_N - 1)
const INV_CELL = 1 / CELL
const NOISE_LEN = NOISE_N * NOISE_N * NOISE_N * 3

interface Constants {
  fields: Float32Array[]
  axis: [number, number, number]
  hand: number
}

let constants: Constants | null = null

function build(): Constants {
  const rng = stream('liquid:noise')
  const fields: Float32Array[] = []
  for (let f = 0; f < 3; f++) {
    const modes: number[] = []
    for (let m = 0; m < 9; m++) {
      const lambda = 30 + 62 * Math.pow(rng.next(), 1.4)
      const k = TAU / lambda
      const cz = rng.range(-1, 1)
      const az = rng.next() * TAU
      const sr = Math.sqrt(1 - cz * cz)
      const amp = Math.pow(lambda, 4 / 3)
      modes.push(k * sr * Math.cos(az), k * sr * Math.sin(az), k * cz, amp * rng.gauss(), amp * rng.gauss(), amp * rng.gauss(), rng.next() * TAU)
    }
    const field = new Float32Array(NOISE_LEN)
    let sum = 0
    let count = 0
    for (let kz = 0; kz < NOISE_N; kz++) {
      for (let jy = 0; jy < NOISE_N; jy++) {
        for (let ix = 0; ix < NOISE_N; ix++) {
          const x = -LIQUID_R + ix * CELL
          const y = -LIQUID_R + jy * CELL
          const z = -LIQUID_R + kz * CELL
          let px = 0
          let py = 0
          let pz = 0
          let cx = 0
          let cy = 0
          let czz = 0
          for (let m = 0; m < modes.length; m += 7) {
            const kx = modes[m]!
            const ky = modes[m + 1]!
            const kzz = modes[m + 2]!
            const ax = modes[m + 3]!
            const ay = modes[m + 4]!
            const azz = modes[m + 5]!
            const ph = kx * x + ky * y + kzz * z + modes[m + 6]!
            const c = Math.cos(ph)
            const s = Math.sin(ph)
            px += ax * c
            py += ay * c
            pz += azz * c
            cx -= (ky * azz - kzz * ay) * s
            cy -= (kzz * ax - kx * azz) * s
            czz -= (kx * ay - ky * ax) * s
          }
          const r2 = x * x + y * y + z * z
          const mask = 1 - r2 * INV_R2
          const gx = -2 * x * INV_R2
          const gy = -2 * y * INV_R2
          const gz = -2 * z * INV_R2
          const ux = mask * cx + (gy * pz - gz * py)
          const uy = mask * cy + (gz * px - gx * pz)
          const uz = mask * czz + (gx * py - gy * px)
          const o = (ix + NOISE_N * (jy + NOISE_N * kz)) * 3
          field[o] = ux
          field[o + 1] = uy
          field[o + 2] = uz
          if (r2 <= LIQUID_R * LIQUID_R) {
            sum += ux * ux + uy * uy + uz * uz
            count++
          }
        }
      }
    }
    const scale = NOISE_RMS / Math.sqrt(sum / count)
    for (let q = 0; q < NOISE_LEN; q++) field[q] = field[q]! * scale
    fields.push(field)
  }
  const lean = stream('liquid:axis')
  const tip = lean.range(0.09, 0.15)
  const about = lean.next() * TAU
  const ax = tip * Math.cos(about)
  const az = tip * Math.sin(about)
  const len = Math.sqrt(ax * ax + 1 + az * az)
  return { fields, axis: [ax / len, 1 / len, az / len], hand: lean.sign() }
}

export interface LiquidMotion {
  ax: number
  ay: number
  az: number
  gx: number
  gy: number
  gz: number
}

function centreOf(p: GlobePose, out: Float64Array, o: number): void {
  const sb = Math.sin(p.tiltZ)
  const cb = Math.cos(p.tiltZ)
  out[o] = p.x - LIQUID_PIVOT_MM * sb
  out[o + 1] = p.y + LIQUID_PIVOT_MM * cb * Math.cos(p.tiltX)
  out[o + 2] = p.z + LIQUID_PIVOT_MM * cb * Math.sin(p.tiltX)
}

export class Liquid {
  readonly state = new Float64Array(LIQUID_LENGTH)
  readonly coef = new Float64Array(8)
  readonly grid = new Float32Array(NOISE_LEN)
  readonly motion: LiquidMotion = { ax: 0, ay: 0, az: 0, gx: 0, gy: -1, gz: 0 }
  noise = false
  maxSpeed = 0
  private readonly pending = new Float64Array(3)
  private readonly scratch = new Float64Array(9)
  private readonly k: Constants

  constructor() {
    if (!constants) constants = build()
    this.k = constants
    this.prepare(0)
  }

  get axis(): readonly [number, number, number] {
    return this.k.axis
  }

  reset(): void {
    this.state.fill(0)
    this.pending.fill(0)
    this.motion.ax = 0
    this.motion.ay = 0
    this.motion.az = 0
    this.motion.gx = 0
    this.motion.gy = -1
    this.motion.gz = 0
    this.prepare(0)
  }

  stir(x: number, y: number, z: number): void {
    this.pending[0] = this.pending[0]! + x
    this.pending[1] = this.pending[1]! + y
    this.pending[2] = this.pending[2]! + z
  }

  get atRest(): boolean {
    const L = this.state
    return L[0] === 0 && L[1] === 0 && L[2] === 0 && L[3] === 0 && L[4] === 0 && L[5] === 0 && L[6] === 0
  }

  step(p0: GlobePose, p1: GlobePose, p2: GlobePose, time: number): void {
    const L = this.state
    const c = this.scratch
    centreOf(p0, c, 0)
    centreOf(p1, c, 3)
    centreOf(p2, c, 6)
    const inv = 1 / (DT * DT)
    const wxA = (c[6]! - 2 * c[3]! + c[0]!) * inv
    const wyA = (c[7]! - 2 * c[4]! + c[1]!) * inv
    const wzA = (c[8]! - 2 * c[5]! + c[2]!) * inv
    const sa = Math.sin(p1.tiltX)
    const ca = Math.cos(p1.tiltX)
    const sb = Math.sin(p1.tiltZ)
    const cb = Math.cos(p1.tiltZ)
    const ry = wyA * ca + wzA * sa
    const rz = -wyA * sa + wzA * ca
    const ax = wxA * cb + ry * sb
    const ay = -wxA * sb + ry * cb
    const az = rz
    const m = this.motion
    m.ax = ax
    m.ay = ay
    m.az = az
    m.gx = -ca * sb
    m.gy = -ca * cb
    m.gz = sa
    const dda = (p2.tiltX - 2 * p1.tiltX + p0.tiltX) * inv
    const ddb = (p2.tiltZ - 2 * p1.tiltZ + p0.tiltZ) * inv
    const pend = this.pending
    let wx = L[0]! - LAG * dda * cb * DT + pend[0]!
    let wy = L[1]! + LAG_UPRIGHT * dda * sb * DT + pend[1]!
    let wz = L[2]! - LAG * ddb * DT + pend[2]!
    const stirred = pend[0] !== 0 || pend[1] !== 0 || pend[2] !== 0
    pend[0] = 0
    pend[1] = 0
    pend[2] = 0

    const sx0 = L[3]!
    const sy0 = L[4]!
    const sz0 = L[5]!
    const s0 = Math.sqrt(sx0 * sx0 + sy0 * sy0 + sz0 * sz0)
    const keep = Math.exp(-DT / SLOSH_SECONDS) / (1 + (s0 * DT) / SLOSH_LENGTH_MM)
    let sx = sx0 * keep - SLOSH_GAIN * ax * DT
    let sy = sy0 * keep - SLOSH_GAIN * ay * DT
    let sz = sz0 * keep - SLOSH_GAIN * az * DT
    const against = (sx0 * ax + sy0 * ay + sz0 * az) / (s0 + 1)
    const level = Math.sqrt(ax * ax + az * az)

    const sh = Math.sqrt(sx0 * sx0 + sz0 * sz0)
    const orbit = -(sz0 * ax - sx0 * az) / (sh + 5)
    const lean = (ax * az) / (level + 1)
    let hand = L[9]! * Math.exp(-DT / HAND_SECONDS) + (HAND_ORBIT * orbit + HAND_LEAN * lean + HAND_BIAS * this.k.hand * level) * DT
    const side = hand / Math.sqrt(hand * hand + HAND_KNEE * HAND_KNEE)

    const n = this.k.axis
    let par = wx * n[0] + wy * n[1] + wz * n[2]
    let ex = wx - par * n[0]
    let ey = wy - par * n[1]
    let ez = wz - par * n[2]
    par += (side * SWIRL_GAIN * sh * DT) / (LIQUID_R * SLOSH_SECONDS)
    const before = Math.abs(par)
    par *= Math.exp(-DT / TURN_UPRIGHT_SECONDS) / (1 + Math.abs(par) * TURN_QUADRATIC * DT)
    const shed = (before - Math.abs(par)) * LIQUID_R
    const fade = Math.exp(-DT / TURN_LEVEL_SECONDS)
    ex *= fade
    ey *= fade
    ez *= fade
    wx = par * n[0] + ex
    wy = par * n[1] + ey
    wz = par * n[2] + ez

    let turb = L[6]! * Math.exp(-DT / TURB_SECONDS) + TURB_FROM_SLOSH * s0 * (1 - keep) + TURB_FROM_REVERSAL * SLOSH_GAIN * Math.max(0, against) * DT + TURB_FROM_TURN * shed
    if (turb > TURBULENCE_MAX) turb = TURBULENCE_MAX

    const still = ax === 0 && ay === 0 && az === 0 && dda === 0 && ddb === 0 && !stirred
    if (still) {
      if (wx * wx + wy * wy + wz * wz < 1e-10) wx = wy = wz = 0
      if (sx * sx + sy * sy + sz * sz < 1e-8) sx = sy = sz = 0
      if (turb < 1e-4) turb = 0
      if (Math.abs(hand) < 1e-5) hand = 0
    }

    let bx = L[10]!
    let bz = L[11]!
    const ux = -GRAVITY_MM * m.gx + ax
    const uy = -GRAVITY_MM * m.gy + ay
    const uz = -GRAVITY_MM * m.gz + az
    const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1
    const follow = 1 - Math.exp(-DT / BUBBLE_SECONDS)
    bx += (ux / ul - bx) * follow
    bz += (uz / ul - bz) * follow
    if (still && bx * bx + bz * bz < 1e-12) bx = bz = 0

    L[0] = wx
    L[1] = wy
    L[2] = wz
    L[3] = sx
    L[4] = sy
    L[5] = sz
    L[6] = turb
    L[7] = (L[7]! + turb * PHASE_RATE * DT) % TAU
    L[8] = (L[8]! + turb * PHASE_RATE_B * DT) % TAU
    L[9] = hand
    L[10] = bx
    L[11] = bz
    this.prepare(time)
  }

  prepare(time: number): void {
    const L = this.state
    const c = this.coef
    const th = (TAU * time) / config.scene.ambientPeriodSeconds
    const s1 = Math.sin(th)
    const c1 = Math.cos(th)
    const s2 = Math.sin(2 * th)
    const c2 = Math.cos(2 * th)
    c[0] = L[0]! + AMBIENT_TURN * 0.3 * s1
    c[1] = L[1]! + AMBIENT_TURN * Math.cos(th + 1.1)
    c[2] = L[2]! + AMBIENT_TURN * 0.3 * c2
    c[3] = 1.5 * (L[3]! + AMBIENT_FLOW * c1)
    c[4] = 1.5 * (L[4]! + AMBIENT_FLOW * 0.5 * s2)
    c[5] = 1.5 * (L[5]! + AMBIENT_FLOW * s1)
    const turb = L[6]!
    c[6] = turb
    this.noise = turb > TURB_EPS
    if (this.noise) {
      const sa = Math.sin(L[7]!)
      const wa = turb * Math.cos(L[7]!)
      const wb = turb * sa * Math.cos(L[8]!)
      const wc = turb * sa * Math.sin(L[8]!)
      const [fa, fb, fc] = this.k.fields as [Float32Array, Float32Array, Float32Array]
      const g = this.grid
      for (let q = 0; q < NOISE_LEN; q++) g[q] = wa * fa[q]! + wb * fb[q]! + wc * fc[q]!
    }
    const w = Math.sqrt(c[0]! * c[0]! + c[1]! * c[1]! + c[2]! * c[2]!)
    const h = Math.sqrt(c[3]! * c[3]! + c[4]! * c[4]! + c[5]! * c[5]!)
    this.maxSpeed = w * LIQUID_R + h * 1.05 + turb * 1.6
  }

  velocityAt(x: number, y: number, z: number, out: Float64Array | number[]): void {
    const c = this.coef
    const wx = c[0]!
    const wy = c[1]!
    const wz = c[2]!
    const hx = c[3]!
    const hy = c[4]!
    const hz = c[5]!
    const q = (x * x + y * y + z * z) * INV_R2
    const hill = 1 - 2 * q
    const dot = (x * hx + y * hy + z * hz) * INV_R2
    let ux = wy * z - wz * y + hx * hill + x * dot
    let uy = wz * x - wx * z + hy * hill + y * dot
    let uz = wx * y - wy * x + hz * hill + z * dot
    if (this.noise) {
      const g = this.grid
      const top = NOISE_N - 1.0001
      let fx = (x + LIQUID_R) * INV_CELL
      let fy = (y + LIQUID_R) * INV_CELL
      let fz = (z + LIQUID_R) * INV_CELL
      fx = fx < 0 ? 0 : fx > top ? top : fx
      fy = fy < 0 ? 0 : fy > top ? top : fy
      fz = fz < 0 ? 0 : fz > top ? top : fz
      const ix = fx | 0
      const iy = fy | 0
      const iz = fz | 0
      const tx = fx - ix
      const ty = fy - iy
      const tz = fz - iz
      const o = (ix + NOISE_N * (iy + NOISE_N * iz)) * 3
      const dx = 3
      const dy = NOISE_N * 3
      const dz = NOISE_N * NOISE_N * 3
      const w00 = (1 - ty) * (1 - tz)
      const w10 = ty * (1 - tz)
      const w01 = (1 - ty) * tz
      const w11 = ty * tz
      const sx = 1 - tx
      const a00 = sx * w00
      const b00 = tx * w00
      const a10 = sx * w10
      const b10 = tx * w10
      const a01 = sx * w01
      const b01 = tx * w01
      const a11 = sx * w11
      const b11 = tx * w11
      const o1 = o + dx
      const o2 = o + dy
      const o3 = o2 + dx
      const o4 = o + dz
      const o5 = o4 + dx
      const o6 = o4 + dy
      const o7 = o6 + dx
      const nx = g[o]! * a00 + g[o1]! * b00 + g[o2]! * a10 + g[o3]! * b10 + g[o4]! * a01 + g[o5]! * b01 + g[o6]! * a11 + g[o7]! * b11
      const ny = g[o + 1]! * a00 + g[o1 + 1]! * b00 + g[o2 + 1]! * a10 + g[o3 + 1]! * b10 + g[o4 + 1]! * a01 + g[o5 + 1]! * b01 + g[o6 + 1]! * a11 + g[o7 + 1]! * b11
      const nz = g[o + 2]! * a00 + g[o1 + 2]! * b00 + g[o2 + 2]! * a10 + g[o3 + 2]! * b10 + g[o4 + 2]! * a01 + g[o5 + 2]! * b01 + g[o6 + 2]! * a11 + g[o7 + 2]! * b11
      const radial = (nx * x + ny * y + nz * z) * INV_R2
      ux += nx - x * radial
      uy += ny - y * radial
      uz += nz - z * radial
    }
    out[0] = ux
    out[1] = uy
    out[2] = uz
  }
}

export function liquidTurbulence(state: ArrayLike<number>): number {
  const t = state[LIQUID_TURBULENCE]! / TURBULENCE_MAX
  return t < 0 ? 0 : t > 1 ? 1 : t
}
