import { config } from '../config'
import { stream } from '../core/rng'
import type { GlobePose } from '../shake/table'

const G = config.globe
const HZ = config.sim.stepHz
const DT = 1 / HZ
const TAU = Math.PI * 2

export const LIQUID_R = G.sphereDiameterMm / 2 - G.glassThicknessMm
export const LIQUID_PIVOT_MM = G.baseHeightMm - G.collarDepthMm + G.sphereDiameterMm / 2
export const LIQUID_LENGTH = 19
export const LIQUID_TURN = 0
export const LIQUID_SLOSH = 3
export const LIQUID_TURBULENCE = 6
export const LIQUID_PHASE = 7
export const LIQUID_PHASE_B = 8
export const LIQUID_HAND = 9
export const LIQUID_BUBBLE = 10
export const LIQUID_MIX = 12
export const LIQUID_ROLL = 15
export const LIQUID_SWIRL = 16
export const LIQUID_FOLD = 17
export const TURBULENCE_MAX = 260
export const NOISE_N = 24
export const NOISE_RMS = 0.33
export const SOLID_REACH_MM = 9
export const MIX_STEPS = 4

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
const SWIRL_GAIN = 0.8
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
const TURB_EPS = 0.2
const SLAM = 8
const SLAM_KNEE = 45
const OVERTURN = 1.4
const OVERTURN_KNEE = 40
const ROLL_WAKES = 0.3
const ROLL_WOKEN = 0.9

export const ROLL_MAX = 15
const EDDY_GAIN = 3
const EDDY_MAX = 450
const EDDY_FROM = 85
const EDDY_FULL = 170
const ROLL_BODY = 0.1
const ROLL_BODY_LEAN = 0.5
export const ROLL_EDGE = 0.5
const ARM_PACE = 0.84
const ARM_START = TAU - 0.45
const ROLL_SECONDS = config.shake.spinDownSeconds * 0.6
const ROLL_FROM_STORM = 0.22
const ROLL_DRAIN = 2
const ROLL_EPS = 0.01
const ROLL_TILT = 0.85
export const ROLL_AXIS: readonly [number, number, number] = [0, Math.sin(ROLL_TILT), Math.cos(ROLL_TILT)]
export const ROLL_CENTRE: readonly [number, number, number] = [-16, 10, 0]
export const ROLL_FLOOR_MM = G.islandLevelMm - (G.baseHeightMm - G.collarDepthMm + G.sphereDiameterMm / 2) + 2.5
export const ROLL_FLOOR_SLOPE = -0.1625
export const ROLL_RISE_MM = 30
export const ROLL_SLAB_MM = 14
export const FOLD_MAX = 220
const FOLD_SECONDS = 0.3
const FOLD_FROM_STORM = 20
const FOLD_DRAIN = 560
const FOLD_PACE = 0.3
const FOLD_START = -0.6
const FOLD_EPS = 0.5
const ROLL_OFF = Math.hypot(ROLL_CENTRE[0], ROLL_CENTRE[1], ROLL_CENTRE[2])
export const ROLL_FREE = LIQUID_R * LIQUID_R - ROLL_OFF * ROLL_OFF
const ROLL_CREST = Math.min(1, Math.pow(1 / (5 * ROLL_EDGE), 0.25))
const ROLL_REACH = ((LIQUID_R * LIQUID_R) / (LIQUID_R - ROLL_OFF)) * ROLL_CREST * (1 - ROLL_EDGE * Math.pow(ROLL_CREST, 4)) + (LIQUID_R * LIQUID_R * (0.5 - ROLL_EDGE / 6) * 1.5) / ROLL_RISE_MM

export const AMBIENT_MAX = 1.5 * AMBIENT_FLOW * 1.2 + AMBIENT_TURN * 1.2 * LIQUID_R

const INV_R2 = 1 / (LIQUID_R * LIQUID_R)
const INV_REACH = 1 / SOLID_REACH_MM
const CELL = (2 * LIQUID_R) / (NOISE_N - 1)
const INV_CELL = 1 / CELL
const NOISE_LEN = NOISE_N * NOISE_N * NOISE_N * 3

interface Constants {
  fields: Float32Array[]
  pots: Float32Array[]
  axis: [number, number, number]
  hand: number
}

let constants: Constants | null = null

function build(): Constants {
  const rng = stream('liquid:noise')
  const fields: Float32Array[] = []
  const pots: Float32Array[] = []
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
    const pot = new Float32Array(NOISE_LEN)
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
          pot[o] = mask * px
          pot[o + 1] = mask * py
          pot[o + 2] = mask * pz
          if (r2 <= LIQUID_R * LIQUID_R) {
            sum += ux * ux + uy * uy + uz * uz
            count++
          }
        }
      }
    }
    const scale = NOISE_RMS / Math.sqrt(sum / count)
    for (let q = 0; q < NOISE_LEN; q++) {
      field[q] = field[q]! * scale
      pot[q] = pot[q]! * scale
    }
    fields.push(field)
    pots.push(pot)
  }
  const lean = stream('liquid:axis')
  const tip = lean.range(0.09, 0.15)
  const about = lean.next() * TAU
  const ax = tip * Math.cos(about)
  const az = tip * Math.sin(about)
  const len = Math.sqrt(ax * ax + 1 + az * az)
  return { fields, pots, axis: [ax / len, 1 / len, az / len], hand: lean.sign() }
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
  readonly pot = new Float32Array(NOISE_LEN)
  readonly motion: LiquidMotion = { ax: 0, ay: 0, az: 0, gx: 0, gy: -1, gz: 0 }
  noise = false
  maxSpeed = 0
  private readonly mixed = new Float64Array(3)
  private readonly work = new Float64Array(6)
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
    return L[0] === 0 && L[1] === 0 && L[2] === 0 && L[3] === 0 && L[4] === 0 && L[5] === 0 && L[6] === 0 && L[15] === 0
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

    const fed = TURB_FROM_SLOSH * s0 * (1 - keep) + TURB_FROM_REVERSAL * SLOSH_GAIN * Math.max(0, against) * DT + TURB_FROM_TURN * shed
    let turb = L[6]! * Math.exp(-DT / TURB_SECONDS) + fed
    if (turb > TURBULENCE_MAX) turb = TURBULENCE_MAX
    let roll = L[15]! * Math.exp(-DT / ROLL_SECONDS) + ROLL_FROM_STORM * fed - ROLL_DRAIN * DT
    if (roll > ROLL_MAX) roll = ROLL_MAX
    if (roll > L[15]!) {
      const woke = (turb / TURBULENCE_MAX - ROLL_WAKES) / (ROLL_WOKEN - ROLL_WAKES)
      const top = woke <= 0 ? 0 : woke >= 1 ? ROLL_MAX : ROLL_MAX * woke
      if (roll > top) roll = top > L[15]! ? top : L[15]!
    }
    let swirl = (L[15]! > 0 ? L[16]! : ARM_START) + roll * ARM_PACE * DT
    if (swirl >= TAU) swirl -= TAU
    if (roll <= 0) {
      roll = 0
      swirl = 0
    }
    let fa = L[17]!
    let fb = L[18]!
    const was = Math.sqrt(fa * fa + fb * fb)
    let fold = was * Math.exp(-DT / FOLD_SECONDS) + FOLD_FROM_STORM * fed - FOLD_DRAIN * DT
    const most = (FOLD_MAX * roll) / ROLL_MAX
    if (fold > most) fold = most
    if (fold <= 0) {
      fa = 0
      fb = 0
    } else if (was === 0) {
      fa = fold * Math.cos(FOLD_START)
      fb = fold * Math.sin(FOLD_START)
    } else {
      const by = -FOLD_PACE * roll * DT
      const cs = (Math.cos(by) * fold) / was
      const sn = (Math.sin(by) * fold) / was
      const na = fa * cs - fb * sn
      fb = fa * sn + fb * cs
      fa = na
    }

    const still = ax === 0 && ay === 0 && az === 0 && dda === 0 && ddb === 0 && !stirred
    if (still) {
      if (wx * wx + wy * wy + wz * wz < 1e-10) wx = wy = wz = 0
      if (sx * sx + sy * sy + sz * sz < 1e-8) sx = sy = sz = 0
      if (turb < TURB_EPS) turb = 0
      if (Math.abs(hand) < 1e-5) hand = 0
      if (roll < ROLL_EPS) {
        roll = 0
        swirl = 0
      }
      if (fa * fa + fb * fb < FOLD_EPS * FOLD_EPS) fa = fb = 0
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
    L[15] = roll
    L[16] = swirl
    L[17] = fa
    L[18] = fb
    if (Math.round(time * HZ) % MIX_STEPS === 0) {
      if (turb > TURB_EPS) {
        const sp = Math.sin(L[7]!)
        const all = turb * (1 + (EDDY_GAIN * turb) / TURBULENCE_MAX)
        const cap = all > EDDY_MAX ? EDDY_MAX : all
        const lv = (turb - EDDY_FROM) / (EDDY_FULL - EDDY_FROM)
        const lw = lv <= 0 ? 0 : lv >= 1 ? 1 : lv * lv * (3 - 2 * lv)
        const loud = cap * lw
        L[12] = loud * Math.cos(L[7]!)
        L[13] = loud * sp * Math.cos(L[8]!)
        L[14] = loud * sp * Math.sin(L[8]!)
      } else {
        L[12] = 0
        L[13] = 0
        L[14] = 0
      }
    }
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
    const own = 1 - L[15]! / ROLL_MAX
    const slosh = Math.sqrt(L[3]! * L[3]! + L[4]! * L[4]! + L[5]! * L[5]!)
    const slam = SLAM / (1 + slosh / SLAM_KNEE)
    const over = (OVERTURN * slam * own * slosh) / ((slosh + OVERTURN_KNEE) * LIQUID_R)
    c[0] = L[0]! * own + AMBIENT_TURN * 0.3 * s1 - over * L[5]!
    c[1] = L[1]! * own + AMBIENT_TURN * Math.cos(th + 1.1) + ROLL_BODY * L[15]!
    c[2] = L[2]! * own + AMBIENT_TURN * 0.3 * c2 + ROLL_BODY_LEAN * ROLL_BODY * L[15]! * ROLL_AXIS[2] + over * L[3]!
    c[3] = slam * L[3]! + 1.5 * AMBIENT_FLOW * c1 + L[17]!
    c[4] = slam * L[4]! + 1.5 * AMBIENT_FLOW * 0.5 * s2 + (L[6]! * L[6]!) / TURBULENCE_MAX + L[18]! * ROLL_AXIS[2]
    c[5] = slam * L[5]! + 1.5 * AMBIENT_FLOW * s1 - L[18]! * ROLL_AXIS[1]
    const turb = L[6]!
    c[6] = turb
    c[7] = L[15]!
    const wa = L[12]!
    const wb = L[13]!
    const wc = L[14]!
    const held = this.mixed
    this.noise = wa !== 0 || wb !== 0 || wc !== 0
    if (this.noise && (wa !== held[0] || wb !== held[1] || wc !== held[2])) {
      const [fa, fb, fc] = this.k.fields as [Float32Array, Float32Array, Float32Array]
      const [pa, pb, pc] = this.k.pots as [Float32Array, Float32Array, Float32Array]
      const g = this.grid
      const p = this.pot
      for (let q = 0; q < NOISE_LEN; q++) {
        g[q] = wa * fa[q]! + wb * fb[q]! + wc * fc[q]!
        p[q] = wa * pa[q]! + wb * pb[q]! + wc * pc[q]!
      }
      held[0] = wa
      held[1] = wb
      held[2] = wc
    }
    const w = Math.sqrt(c[0]! * c[0]! + c[1]! * c[1]! + c[2]! * c[2]!)
    const h = Math.sqrt(c[3]! * c[3]! + c[4]! * c[4]! + c[5]! * c[5]!)
    const mix = Math.sqrt(wa * wa + wb * wb + wc * wc)
    const loud = mix > turb ? mix : turb
    this.maxSpeed = w * LIQUID_R + h * 1.05 + loud * 1.6 + c[7]! * ROLL_REACH
  }

  potentialAt(x: number, y: number, z: number, ring: number, out: Float64Array | number[]): void {
    const c = this.coef
    const r2 = x * x + y * y + z * z
    const turn = -0.5 * (r2 - LIQUID_R * LIQUID_R)
    const q = r2 * INV_R2
    const hill = 0.5 * (1 - (q > 1 ? 1 : q))
    let ax = turn * c[0]! + hill * (c[4]! * z - c[5]! * y)
    let ay = -0.5 * (x * x + z * z - ring) * c[1]! + hill * (c[5]! * x - c[3]! * z)
    let az = turn * c[2]! + hill * (c[3]! * y - c[4]! * x)
    if (this.noise) {
      const g = this.pot
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
      const dy = NOISE_N * 3
      const dz = NOISE_N * NOISE_N * 3
      const w00 = (1 - ty) * (1 - tz)
      const w10 = ty * (1 - tz)
      const w01 = (1 - ty) * tz
      const w11 = ty * tz
      const sx = 1 - tx
      const at = (j: number): number =>
        (g[o + j]! * sx + g[o + 3 + j]! * tx) * w00 +
        (g[o + dy + j]! * sx + g[o + dy + 3 + j]! * tx) * w10 +
        (g[o + dz + j]! * sx + g[o + dz + 3 + j]! * tx) * w01 +
        (g[o + dz + dy + j]! * sx + g[o + dz + dy + 3 + j]! * tx) * w11
      ax += at(0)
      ay += at(1)
      az += at(2)
    }
    out[0] = ax
    out[1] = ay
    out[2] = az
  }

  flowAt(x: number, y: number, z: number, d: number, gx: number, gy: number, gz: number, ring: number, out: Float64Array | number[]): number {
    const w = this.work
    this.velocityAt(x, y, z, w)
    const ux = w[0]!
    const uy = w[1]!
    const uz = w[2]!
    const open = ux * ux + uy * uy + uz * uz
    if (d >= SOLID_REACH_MM) {
      out[0] = ux
      out[1] = uy
      out[2] = uz
      return open
    }
    this.potentialAt(x, y, z, ring, w)
    const s = d <= 0 ? 1 : 1 - d * INV_REACH
    const m = 1 - s * s
    const dm = 2 * s * INV_REACH
    let fx = m * ux + dm * (gy * w[2]! - gz * w[1]!)
    let fy = m * uy + dm * (gz * w[0]! - gx * w[2]!)
    let fz = m * uz + dm * (gx * w[1]! - gy * w[0]!)
    const away = ux * gx + uy * gy + uz * gz
    if (away > 0) {
      const rise = ((1 - m) * away) / (gx * gx + gy * gy + gz * gz)
      fx += gx * rise
      fy += gy * rise
      fz += gz * rise
    }
    out[0] = fx
    out[1] = fy
    out[2] = fz
    return open
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
      const qc = q > 1 ? 1 : q
      const q4 = qc * qc * qc * qc
      const radial = (nx * x + ny * y + nz * z) * INV_R2 * q4 * q4
      ux += nx - x * radial
      uy += ny - y * radial
      uz += nz - z * radial
    }
    const roll = c[7]!
    if (roll !== 0) {
      const dx = x - ROLL_CENTRE[0]
      const dy = y - ROLL_CENTRE[1]
      const dz = z - ROLL_CENTRE[2]
      const dc = dx * ROLL_CENTRE[0] + dy * ROLL_CENTRE[1] + dz * ROLL_CENTRE[2]
      const s = Math.sqrt(dc * dc + ROLL_FREE * (dx * dx + dy * dy + dz * dz))
      if (s > 1e-6) {
        let lam = (dc + s) / ROLL_FREE
        if (lam > 1) lam = 1
        const l2 = lam * lam
        const t = (y - ROLL_FLOOR_MM - ROLL_FLOOR_SLOPE * z) / ROLL_RISE_MM
        const h = t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)
        const dh = t <= 0 || t >= 1 ? 0 : (6 * t * (1 - t)) / ROLL_RISE_MM
        const k = roll * LIQUID_R * LIQUID_R
        const nx = dx + lam * ROLL_CENTRE[0]
        const ny = dy + lam * ROLL_CENTRE[1]
        const nz = dz + lam * ROLL_CENTRE[2]
        const off = nx * ROLL_AXIS[0] + ny * ROLL_AXIS[1] + nz * ROLL_AXIS[2]
        const disc = (ROLL_SLAB_MM * ROLL_SLAB_MM) / (ROLL_SLAB_MM * ROLL_SLAB_MM + off * off)
        const rate = (k * disc * h * lam * (1 - ROLL_EDGE * l2 * l2)) / s
        const along = k * disc * dh * ((1 - l2) / 2 - (ROLL_EDGE * (1 - l2 * l2 * l2)) / 6)
        ux += rate * (ROLL_AXIS[1] * nz - ROLL_AXIS[2] * ny) + along * (ROLL_AXIS[2] + ROLL_FLOOR_SLOPE * ROLL_AXIS[1])
        uy += rate * (ROLL_AXIS[2] * nx - ROLL_AXIS[0] * nz) - along * ROLL_FLOOR_SLOPE * ROLL_AXIS[0]
        uz += rate * (ROLL_AXIS[0] * ny - ROLL_AXIS[1] * nx) - along * ROLL_AXIS[0]
      }
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
