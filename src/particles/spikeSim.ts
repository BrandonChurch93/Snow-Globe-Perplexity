import { config, particleKinds } from '../config'
import { Rng, stream, streamSeed, hash2, unit } from '../core/rng'
import { barSeconds, globePoseAt, type Timeline } from '../film/timeline'

const G = config.globe
export const INNER_R = G.sphereDiameterMm / 2 - G.glassThicknessMm
export const CENTRE_Y = G.baseHeightMm - G.collarDepthMm + G.sphereDiameterMm / 2
export const GROUND_Y = G.islandLevelMm - CENTRE_Y
export const DT = 1 / config.sim.stepHz

export const SHAPES = {
  box: { cx: -15, cy: GROUND_Y + 10, cz: 2, hx: 12, hy: 10, hz: 10 },
  cone: { cx: 17, cz: -3, r: 13, h: 44 },
  ball: { cx: 3, cy: GROUND_Y + 5, cz: 22, r: 5 },
}

const NOISE_N = 16
const NOISE_SCALE = NOISE_N / (2 * INNER_R)

export interface SimSnapshot {
  step: number
  pos: Float32Array
  prev: Float32Array
  vel: Float32Array
  state: Uint8Array
  liquid: Float64Array
}

export class SpikeSim {
  readonly count: number
  readonly kindOf: Uint8Array
  readonly sizes: Float32Array
  pos: Float32Array
  prev: Float32Array
  vel: Float32Array
  state: Uint8Array
  liquid = new Float64Array(8)
  step = 0
  private readonly noise: Float32Array
  private readonly thresh: Float32Array
  private readonly sink: Float32Array
  private readonly seed: number

  constructor(readonly season: string, fraction = 1) {
    const kinds = particleKinds(season)
    this.count = kinds.reduce((n, k) => n + Math.max(1, Math.round(k.count * fraction)), 0)
    const n = this.count
    this.pos = new Float32Array(n * 3)
    this.prev = new Float32Array(n * 3)
    this.vel = new Float32Array(n * 3)
    this.state = new Uint8Array(n)
    this.kindOf = new Uint8Array(n)
    this.sizes = new Float32Array(n)
    this.thresh = new Float32Array(n)
    this.sink = new Float32Array(n)
    this.seed = streamSeed(`sim:${season}`)
    const rng = stream(`sim:${season}:setup`)
    let i = 0
    kinds.forEach((k, ki) => {
      const c = Math.max(1, Math.round(k.count * fraction))
      for (let j = 0; j < c; j++, i++) {
        this.kindOf[i] = ki
        this.sizes[i] = ki === 0 ? rng.range(0.35, 1.1) : rng.range(0.2, 0.5)
        this.thresh[i] = rng.range(6, 60)
        this.sink[i] = ki === 0 ? rng.range(3, 9) : rng.range(5, 14)
      }
    })
    const nr = stream('sim:noise')
    this.noise = new Float32Array(NOISE_N * NOISE_N * NOISE_N * 3)
    for (let q = 0; q < this.noise.length; q++) this.noise[q] = nr.range(-1, 1)
    this.reset()
  }

  reset(): void {
    const rng = new Rng(this.seed)
    const n = this.count
    const groundR = Math.sqrt(INNER_R * INNER_R - GROUND_Y * GROUND_Y) - 1
    for (let i = 0; i < n; i++) {
      const a = rng.next() * Math.PI * 2
      const r = Math.sqrt(rng.next()) * groundR
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      let y = GROUND_Y + rng.next() * 0.6
      const b = SHAPES.box
      if (Math.abs(x - b.cx) < b.hx && Math.abs(z - b.cz) < b.hz) y = b.cy + b.hy + rng.next() * 0.6
      this.pos[i * 3] = x
      this.pos[i * 3 + 1] = y
      this.pos[i * 3 + 2] = z
      this.state[i] = 1
    }
    this.prev.set(this.pos)
    this.vel.fill(0)
    this.liquid.fill(0)
    this.step = 0
  }

  snapshot(): SimSnapshot {
    return { step: this.step, pos: this.pos.slice(), prev: this.prev.slice(), vel: this.vel.slice(), state: this.state.slice(), liquid: this.liquid.slice() }
  }

  restore(s: SimSnapshot): void {
    this.step = s.step
    this.pos.set(s.pos)
    this.prev.set(s.prev)
    this.vel.set(s.vel)
    this.state.set(s.state)
    this.liquid.set(s.liquid)
  }

  advanceTo(targetStep: number, tl: Timeline): void {
    while (this.step < targetStep) this.stepOnce(tl)
  }

  private stepOnce(tl: Timeline): void {
    const t = this.step * DT
    const p0 = globePoseAt(tl, t - DT)
    const p1 = globePoseAt(tl, t)
    const p2 = globePoseAt(tl, t + DT)
    const ax = (p2.x - 2 * p1.x + p0.x) / (DT * DT)
    const ay = (p2.y - 2 * p1.y + p0.y) / (DT * DT)
    const az = (p2.z - 2 * p1.z + p0.z) / (DT * DT)
    const wz = (p2.tiltZ - p0.tiltZ) / (2 * DT)
    const amag = Math.sqrt(ax * ax + ay * ay + az * az)
    const L = this.liquid
    const spin = Math.exp(-DT / (config.shake.spinDownSeconds / 3))
    const sloshDecay = Math.exp(-DT / 0.35)
    const turbDecay = Math.exp(-DT / 2.2)
    L[0] = L[0]! * spin + wz * 0.2 * DT
    L[1] = L[1]! * spin + (amag * 0.00016 + Math.abs(wz) * 0.6) * DT
    L[2] = L[2]! * spin
    L[3] = L[3]! * sloshDecay - ax * 0.06 * DT
    L[4] = L[4]! * sloshDecay - ay * 0.06 * DT
    L[5] = L[5]! * sloshDecay - az * 0.06 * DT
    L[6] = Math.min(260, L[6]! * turbDecay + amag * 0.05 * DT)
    L[7] = L[7]! + DT * (0.4 + L[6]! * 0.02)
    const wx = L[0]!
    const wy = L[1]!
    const wzz = L[2]!
    const sx = L[3]!
    const sy = L[4]!
    const sz = L[5]!
    const turb = L[6]! + 1.5
    const drift = L[7]!
    const stir = Math.sqrt(sx * sx + sy * sy + sz * sz) + turb * 0.8 + Math.sqrt(wx * wx + wy * wy + wzz * wzz) * 30
    const n = this.count
    const pos = this.pos
    const vel = this.vel
    const state = this.state
    const noise = this.noise
    const R = INNER_R - 0.4
    const R2 = R * R
    const invR2 = 1 / (INNER_R * INNER_R)
    const k = 1 - Math.exp(-DT / 0.05)
    const b = SHAPES.box
    const ball = SHAPES.ball
    this.prev.set(pos)
    for (let i = 0; i < n; i++) {
      const o = i * 3
      if (state[i] === 1) {
        if (stir < this.thresh[i]!) continue
        state[i] = 0
        vel[o + 1] = stir * 0.5 * unit(hash2(i, this.step))
      }
      let x = pos[o]!
      let y = pos[o + 1]!
      let z = pos[o + 2]!
      const r2 = x * x + y * y + z * z
      const wall = 1 - r2 * invR2
      let ux = wy * z - wzz * y
      let uy = wzz * x - wx * z
      let uz = wx * y - wy * x
      const hill = 1.5 * (1 - 2 * r2 * invR2)
      const dotps = (x * sx + y * sy + z * sz) * 1.5 * invR2
      ux += sx * hill + x * dotps
      uy += sy * hill + y * dotps
      uz += sz * hill + z * dotps
      const fx = (x + INNER_R) * NOISE_SCALE + drift
      const fy = (y + INNER_R) * NOISE_SCALE + drift * 0.7
      const fz = (z + INNER_R) * NOISE_SCALE - drift * 0.4
      const ix = Math.floor(fx)
      const iy = Math.floor(fy)
      const iz = Math.floor(fz)
      const tx = fx - ix
      const ty = fy - iy
      const tz = fz - iz
      const x0 = ix & 15
      const x1 = (ix + 1) & 15
      const y0 = (iy & 15) << 4
      const y1 = ((iy + 1) & 15) << 4
      const z0 = (iz & 15) << 8
      const z1 = ((iz + 1) & 15) << 8
      const c000 = (x0 + y0 + z0) * 3
      const c100 = (x1 + y0 + z0) * 3
      const c010 = (x0 + y1 + z0) * 3
      const c110 = (x1 + y1 + z0) * 3
      const c001 = (x0 + y0 + z1) * 3
      const c101 = (x1 + y0 + z1) * 3
      const c011 = (x0 + y1 + z1) * 3
      const c111 = (x1 + y1 + z1) * 3
      const w000 = (1 - tx) * (1 - ty) * (1 - tz)
      const w100 = tx * (1 - ty) * (1 - tz)
      const w010 = (1 - tx) * ty * (1 - tz)
      const w110 = tx * ty * (1 - tz)
      const w001 = (1 - tx) * (1 - ty) * tz
      const w101 = tx * (1 - ty) * tz
      const w011 = (1 - tx) * ty * tz
      const w111 = tx * ty * tz
      const tw = turb * (wall > 0 ? wall : 0)
      ux += tw * (noise[c000]! * w000 + noise[c100]! * w100 + noise[c010]! * w010 + noise[c110]! * w110 + noise[c001]! * w001 + noise[c101]! * w101 + noise[c011]! * w011 + noise[c111]! * w111)
      uy += tw * (noise[c000 + 1]! * w000 + noise[c100 + 1]! * w100 + noise[c010 + 1]! * w010 + noise[c110 + 1]! * w110 + noise[c001 + 1]! * w001 + noise[c101 + 1]! * w101 + noise[c011 + 1]! * w011 + noise[c111 + 1]! * w111)
      uz += tw * (noise[c000 + 2]! * w000 + noise[c100 + 2]! * w100 + noise[c010 + 2]! * w010 + noise[c110 + 2]! * w110 + noise[c001 + 2]! * w001 + noise[c101 + 2]! * w101 + noise[c011 + 2]! * w011 + noise[c111 + 2]! * w111)
      uy -= this.sink[i]!
      let vx = vel[o]! + (ux - vel[o]!) * k
      let vy = vel[o + 1]! + (uy - vel[o + 1]!) * k
      let vz = vel[o + 2]! + (uz - vel[o + 2]!) * k
      x += vx * DT
      y += vy * DT
      z += vz * DT
      const q2 = x * x + y * y + z * z
      if (q2 > R2) {
        const q = Math.sqrt(q2)
        const s = R / q
        const nx = x / q
        const ny = y / q
        const nz = z / q
        const vn = vx * nx + vy * ny + vz * nz
        if (vn > 0) {
          vx -= vn * nx
          vy -= vn * ny
          vz -= vn * nz
        }
        x *= s
        y *= s
        z *= s
      }
      let rest = false
      if (y < GROUND_Y) {
        y = GROUND_Y
        rest = vy <= 0
      } else if (Math.abs(x - b.cx) < b.hx && Math.abs(z - b.cz) < b.hz && y < b.cy + b.hy) {
        y = b.cy + b.hy
        rest = vy <= 0
      } else {
        const dx = x - ball.cx
        const dy = y - ball.cy
        const dz = z - ball.cz
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 < ball.r * ball.r) {
          const d = Math.sqrt(d2) || 1
          x = ball.cx + (dx / d) * ball.r
          y = ball.cy + (dy / d) * ball.r
          z = ball.cz + (dz / d) * ball.r
          rest = dy > ball.r * 0.5 * d && vy <= 0
        }
      }
      if (rest && stir < this.thresh[i]! * 0.6) {
        state[i] = 1
        vx = 0
        vy = 0
        vz = 0
      } else if (rest) {
        vy = 0
      }
      pos[o] = x
      pos[o + 1] = y
      pos[o + 2] = z
      vel[o] = vx
      vel[o + 1] = vy
      vel[o + 2] = vz
    }
    this.step++
  }

  floating(): number {
    let c = 0
    for (let i = 0; i < this.count; i++) if (this.state[i] === 0) c++
    return c
  }
}

export const shakeSteps = Math.round(barSeconds * config.sim.stepHz)
