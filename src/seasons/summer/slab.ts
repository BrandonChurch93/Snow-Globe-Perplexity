import * as THREE from 'three'
import { ROOM_RIG } from '../../scene/lighting'
import type { KitMoment } from '../kit'
import * as arrivalPart from './arrival'
import { sandMaterial } from './base'
import * as glassPart from './glass'
import { rig } from './rig'

const PART = 'surface-dressing-summer'

// Where the sand lies on the slab, in mm from the globe's axis (x to the right of the hero camera, z toward it), measured
// from the approved image: one low heap under the stream, three tenths of the base's height where it leans on the foot.
// To the right it falls to nothing over a long run; toward the camera it stands at the angle sand lies at, and that face
// is in its own shade. Round it lies an apron a grain or two deep that thins out into single grains, and a low bank
// along the foot. Everywhere else the table is bare.
const HEAP = {
  cone: { x: 59.3, z: 17.2, mm: 10.2, tip: 0.25, foot: 0.2, round: [[-180, 1.3], [-18, 1.5], [14, 1.6], [150, 1.5], [180, 1.3]], reach: [[-180, 20], [-90, 22], [-50, 27], [-20, 28], [12, 31], [40, 28], [90, 29], [125, 29], [155, 26], [180, 20]] },
  apron: { mm: 2.0, from: 0.6, lean: 2.5, extra: [[-180, 6], [-90, 6], [-30, 30], [0, 34], [25, 30], [50, 12], [90, 6], [130, 5], [180, 6]], patch: [-0.6, 0.3, 0.5] },
  bank: { mm: [[-180, 0], [-10, 0], [15, 2.0], [40, 5.0], [62, 7.5], [85, 7.5], [105, 3.0], [135, 0], [180, 0]], r: 58, w: 14 },
  skirt: { at: [90, -40], mm: [24, 26], high: 0.7, patch: [0.05, 0.5] },
  lumps: [0.06, 0.22, 0.8],
  sprinkle: { at: [-63.8, -47.6], lit: [-0.918, -0.396], run: [-12, -2, 22, 78], rise: [0, 0.6], core: [0.95, 1.1], veil: [0.5, 6.5] },
  cover: [0.02, 3.0],
  ragged: { mm: [1.7, 4.3], most: 0.55 },
  spread: { looseMm: 0.25, onHeap: 0.1, thickMm: 1.6 },
  proud: { thin: 0.1, flank: 0.25, low: [1.5, 3.5], high: [2.5, 6.0] },
  strewn: { from: 0.8, side: [-5, 20, 0.25], drift: 0.25 },
}
// The light on the sand. The stage's lit material is made for the stone of the base; this takes its paint (every grain's
// own colour and tilt) and the stage's key, sky and card, and lights the sand as dry sand is lit by a low sun from behind.
export const SAND_LIT = { tilt: 0.25, ramp: [0.02, 0.26], gain: [0.45, 1.4], sun: 4.3, back: 1.0, sky: [3.6, 5.2, 8.0], card: 0.05, knee: 1.8, high: 3.2, pale: 0.75, tint: [1.0, 0.98, 0.93], thin: [0.5, 0.3, 4.0], lone: [1.0, 0.92, 0.84], speck: 1.8, finer: 1.6, rows: 1080, pit: [0.8, 0.33], pitTint: [1.0, 0.75, 0.5], warm: [0.22, 0.45], lean: [0.15, 0.45], tone: [0.6, 1.25], fade: 0.14, fill: [0.5, 1.0], soft: [0.8, 0.05], cast: [0.3, 0.1, 34], turned: { by: 0.6, low: 0.4, w: [0.6, 0.3], mm: 60, blur: 2.5 }, shade: [1.2, 0.93, 0.74], shadeTo: 0.25, ragged: [0.75, 0.5, 5.3], blur: [1.5, 2.5], unsharp: [0.75, 1.25], small: [0.5, 0.6], crest: { mm: [7.0, 9.5], tint: [0.88, 0.72, 0.6] } }
export const SPRINKLE = { softMm: 5.0 } as const
export const SLAB = { liftMm: 0.5, footMm: 52.4, repose: 0.62, stepMm: 0.5, skin: 2, bare: 0.0019, x: [-150, 142], z: [-232, 216], heap: { x: [-8, 132], z: [-78, 74] } } as const

const hash = (x: number, y: number, s: number): number => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
function noise(x: number, y: number, s: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash(xi, yi, s)
  const b = hash(xi + 1, yi, s)
  const c = hash(xi, yi + 1, s)
  const d = hash(xi + 1, yi + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const ease = (t: number): number => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

// A length that is given for some bearings from the top of the heap (0 toward the camera, 90 to the right), at any bearing.
const toward = (K: readonly number[][], deg: number): number => {
  for (let i = 0; i + 1 < K.length; i++) if (deg <= K[i + 1]![0]!) return K[i]![1]! + (K[i + 1]![1]! - K[i]![1]!) * ease((deg - K[i]![0]!) / (K[i + 1]![0]! - K[i]![0]!))
  return K[K.length - 1]![1]!
}
const bearing = (x: number, z: number): number => (Math.atan2(x - HEAP.cone.x, z - HEAP.cone.z) * 180) / Math.PI

// How far out from the top of the heap a place lies, as a share of the heap's reach that way: 1 on its edge.
const coneOut = (x: number, z: number): number => Math.hypot(x - HEAP.cone.x, z - HEAP.cone.z) / toward(HEAP.cone.reach, bearing(x, z))

// The heap under the stream: one low rounded cone with its top against the foot, where the stream lands, that falls to
// nothing over a long run and ends in a foot that thins out.
const cone = (x: number, z: number): number => {
  const C = HEAP.cone
  const t = Math.min(1, coneOut(x, z))
  const c = 1 - ((Math.hypot(t, C.tip) - C.tip) / (Math.hypot(1, C.tip) - C.tip)) ** toward(C.round, bearing(x, z))
  return (C.mm * (c < 2 * C.foot ? (c * c) / (4 * C.foot) : c - C.foot)) / (1 - C.foot)
}

// The sand that lies up against the foot of the stone from the front round to the right, so that no bare table shows under its belly.
const bank = (x: number, z: number): number => {
  const B = HEAP.bank
  const az = (Math.atan2(x, z) * 180) / Math.PI
  const out = Math.max(Math.hypot(x, z) - B.r, 0) / B.w
  return toward(B.mm, az) * Math.exp(-out * out)
}

// The thin sand round the heap: a grain or two deep at the heap's foot, thinner with every millimetre out, and the
// farther out the more of it is bare table between patches.
const apron = (x: number, z: number): number => {
  const A = HEAP.apron
  const deg = bearing(x, z)
  const reach = toward(HEAP.cone.reach, deg)
  const out = Math.min(1, Math.max(0, (Math.hypot(x - HEAP.cone.x, z - HEAP.cone.z) - A.from * reach) / ((1 - A.from) * reach + toward(A.extra, deg))))
  const patch = 0.6 * noise(x / 13 + 1.3, z / 17 + 7.1, 41) + 0.4 * noise(x / 4.3 + 5.9, z / 6.1 + 2.7, 43)
  return A.mm * (1 - out ** A.lean) * ease((patch - A.patch[0]! - (A.patch[1]! - A.patch[0]!) * out) / A.patch[2]!)
}

// The sand that the stream's grains have thrown behind the heap, to the right: a skirt less than a grain deep, in patches.
const skirt = (x: number, z: number): number => {
  const K = HEAP.skirt
  const patch = 0.55 * noise(x / 11 + 4.1, z / 15 + 2.3, 71) + 0.45 * noise(x / 3.7 + 9.3, z / 5.3 + 6.7, 73)
  return K.high * Math.exp(-(((x - K.at[0]!) / K.mm[0]!) ** 2) - ((z - K.at[1]!) / K.mm[1]!) ** 2) * ease((patch - K.patch[0]!) / K.patch[1]!)
}

// How high the sand lies at a place: the heap, the bank and the apron, with their lumps. It thins out to nothing; nowhere does it end in a step.
export function sandHeight(x: number, z: number): number {
  const mid = noise(x / 7.3 + 1.7, z / 7.3 + 9.2, 13)
  const fine = noise(x / 2.1 + 5.3, z / 2.1 + 2.9, 17)
  const grit = noise(x / 1.1 + 4.7, z / 1.1 + 1.3, 31)
  const heap = Math.hypot(cone(x, z), Math.max(bank(x, z) * (0.8 + 0.4 * mid), apron(x, z), skirt(x, z)))
  const L = HEAP.lumps
  return Math.max(0, heap + (grit - 0.5) * L[0]! * Math.min(1, heap / 1.5) + (fine - 0.5) * L[1]! * Math.min(1, heap / 2.5) + (mid - 0.5) * L[2]! * Math.min(1, heap / 4))
}

// How much of the table the sand covers at a height: whole from a little over a millimetre, single grains below.
const coverAt = (h: number): number => ease((h - HEAP.cover[0]!) / (HEAP.cover[1]! - HEAP.cover[0]!))

// How much of it the skin shows there: where the sand thins out its edge is ragged, patches of whole sand and patches
// of single grains, so the slab ends in no line.
const keepAt = (x: number, z: number, h: number): number => {
  const c = coverAt(h)
  const R = HEAP.ragged
  const n = 0.55 * noise(x / R.mm[0]! + 3.1, z / R.mm[0]! + 8.7, 59) + 0.45 * noise(x / R.mm[1]! + 6.3, z / R.mm[1]! + 1.9, 61)
  return Math.min(1, Math.max(0, c + (2 * n - 1) * R.most * 4 * c * (1 - c)))
}

// How deep the sand lies at a place, as the skin's own tone reads it: 0 where a grain lies alone on the table.
export function sandDeep(x: number, z: number): number {
  return ease((sandHeight(x, z) - SAND_LIT.thin[1]!) / (SAND_LIT.thin[2]! - SAND_LIT.thin[1]!))
}

// How many of the landing's loose grains come to lie at a place: on the thin sand and a little way out from its edge.
export function sandSpread(x: number, z: number): number {
  const h = sandHeight(x, z)
  return 0.2 * Math.min(1, h / HEAP.spread.looseMm) * (HEAP.spread.onHeap + (1 - HEAP.spread.onHeap) / (1 + (h / HEAP.spread.thickMm) ** 2))
}

// The grains sprinkled beside the foot on the left: how thick they lie at a place, most along the edge of the base's
// shadow, less with every millimetre into the light and with the distance from the base.
export function sandSprinkle(x: number, z: number): number {
  const S = HEAP.sprinkle
  const ease = (a: number, b: number, v: number): number => {
    const c = Math.min(1, Math.max(0, (v - a) / (b - a)))
    return c * c * (3 - 2 * c)
  }
  const d = (x - S.at[0]!) * S.lit[0]! + (z - S.at[1]!) * S.lit[1]!
  const s = (x - S.at[0]!) * S.lit[1]! - (z - S.at[1]!) * S.lit[0]!
  const along = ease(S.run[0]!, S.run[1]!, s) * (1 - ease(S.run[2]!, S.run[3]!, s)) ** 1.3
  const in_ = Math.max(d, 0)
  const across = ease(S.rise[0]!, S.rise[1]!, d) * (S.core[0]! * Math.exp(-in_ / S.core[1]!) + S.veil[0]! * Math.exp(-in_ / S.veil[1]!))
  return Math.min(1, along * across * (0.6 + 0.8 * noise(x / 5.1 + 3.3, z / 5.1 + 8.8, 37)))
}

// How thick the sprinkle's core lies along the edge of the base's shadow: whole from the edge on, and thinning out over
// a few millimetres into the shadow.
export function sandSprinkleRun(x: number, z: number): number {
  const S = HEAP.sprinkle
  const ease = (a: number, b: number, v: number): number => {
    const c = Math.min(1, Math.max(0, (v - a) / (b - a)))
    return c * c * (3 - 2 * c)
  }
  const d = (x - S.at[0]!) * S.lit[0]! + (z - S.at[1]!) * S.lit[1]!
  const s = (x - S.at[0]!) * S.lit[1]! - (z - S.at[1]!) * S.lit[0]!
  return ease(-SPRINKLE.softMm, 0, d) * ease(S.run[0]!, S.run[1]!, s) * (1 - ease(S.run[2]!, S.run[3]!, s)) ** 1.3 * (0.55 + 0.45 * noise(x / 5.1 + 3.3, z / 5.1 + 8.8, 37))
}

// The place on the table that lies `s` mm along the edge of the base's shadow and `d` mm into the light from it.
export function sandSprinkleAt(s: number, d: number): [number, number] {
  const S = HEAP.sprinkle
  return [S.at[0]! + s * S.lit[1]! + d * S.lit[0]!, S.at[1]! - s * S.lit[0]! + d * S.lit[1]!]
}

// The grains that stand proud of the heap's skin: most on its crest and upper flank and where it thins out, so that
// no outline of the heap, from any side, is the skin's.
export function sandProud(x: number, z: number): number {
  const h = sandHeight(x, z)
  const c = coverAt(h)
  if (c <= 0) return 0
  const P = HEAP.proud
  return Math.min(1, Math.max(P.flank * ease((h - P.low[0]!) / (P.low[1]! - P.low[0]!)), ease((h - P.high[0]!) / (P.high[1]! - P.high[0]!))) + P.thin * 4 * c * (1 - c))
}

// The single grains strewn round the heap: thick where it thins out, fewer with every millimetre beyond (`reach` is the
// way over which they thin, as a share of the heap's length), most to the right, where the stream's grains bounce off
// the heap, and in drifts.
export function sandStrewn(x: number, z: number, reach: number): number {
  const c = coverAt(sandHeight(x, z))
  if (c >= 1) return 0
  const T = HEAP.strewn
  const side = T.side[2]! + (1 - T.side[2]!) * ease((x - HEAP.cone.x - T.side[0]!) / (T.side[1]! - T.side[0]!))
  const drift = T.drift + (1 - T.drift) * ease((0.6 * noise(x / 9 + 1.3, z / 19 + 7.1, 47) + 0.4 * noise(x / 3.5 + 5.9, z / 8 + 2.7, 53) - 0.3) / 0.4)
  return (1 - c) * side * drift * Math.exp(-Math.max(coneOut(x, z) - T.from, 0) / reach)
}

const keyDir = (): [number, number, number] => {
  const d = [rig.key.from[0] - ROOM_RIG.targetMm[0], rig.key.from[1] - ROOM_RIG.targetMm[1], rig.key.from[2] - ROOM_RIG.targetMm[2]] as const
  const l = Math.hypot(d[0], d[1], d[2])
  return [d[0] / l, d[1] / l, d[2] / l]
}

// The sun a slope of sand takes by the angle the key meets it at (the shader's sandFace).
const faceOf = (nl: number): number => ease((nl - SAND_LIT.ramp[0]!) / (SAND_LIT.ramp[1]! - SAND_LIT.ramp[0]!)) * (SAND_LIT.gain[0]! + SAND_LIT.gain[1]! * Math.min(1, Math.max(0, nl)))

interface Field {
  nx: number
  nz: number
  h: Float32Array
  cast: Float32Array
  lit: Float32Array
}
let made: Field | undefined

// The heap on a grid: its height, the shade its own lumps and crest throw along the key, and the sun each place takes.
// The shade is thrown as by a sun lower than the room's, so the near face lies in it from the crest to the floor and a
// little way out on the floor, where it ends softly and not in a line.
function field(): Field {
  if (made) return made
  const step = SLAB.stepMm
  const [x0, x1] = SLAB.heap.x
  const [z0, z1] = SLAB.heap.z
  const nx = Math.round((x1 - x0) / step) + 1
  const nz = Math.round((z1 - z0) / step) + 1
  const h = new Float32Array(nx * nz)
  // Under the foot the sand does not stop at a wall: it runs down from where it leant on the base at its angle of repose,
  // so when the globe is lifted clear the heap has a slumped inner face and a whole footprint, not a notch.
  const under = (x: number, z: number): number => {
    const r = Math.hypot(x, z)
    if (r >= SLAB.footMm) return sandHeight(x, z)
    if (r < 1) return 0
    const k = SLAB.footMm / r
    const gone = SLAB.footMm - r
    return Math.max(0, sandHeight(x * k, z * k) - SLAB.repose * gone * (0.8 + 0.4 * noise(x / 3.1 + 2.3, z / 3.1 + 6.1, 19)) - 0.02 * gone * gone)
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h[j * nx + i] = under(x0 + i * step, z0 + j * step)
  const at = (i: number, j: number): number => h[Math.min(Math.max(j, 0), nz - 1) * nx + Math.min(Math.max(i, 0), nx - 1)]!
  const soft = (u: number, v: number): number => {
    const i = Math.floor(u)
    const j = Math.floor(v)
    const fu = u - i
    const fv = v - j
    return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv
  }
  const key = keyDir()
  const plan = Math.hypot(key[0], key[2])
  const cast = new Float32Array(nx * nz).fill(1)
  const near = new Float32Array(nx * nz).fill(1)
  const face = new Float32Array(nx * nz)
  const lit = new Float32Array(nx * nz)
  const C = SAND_LIT.cast
  // The heap's shade is cast twice: along the key as it stands, which leaves lit sand as lit as it was, and from
  // further behind and lower, which lays the heap's near face in one soft shade.
  const T = SAND_LIT.turned
  const way = [key[0] / plan, key[2] / plan] as const
  const behind = [way[0] * (1 - T.by), way[1] * (1 - T.by) - T.by] as const
  const turned = [behind[0] / Math.hypot(behind[0], behind[1]), behind[1] / Math.hypot(behind[0], behind[1])] as const
  // Most of a ray runs over ground too low to shade the place it starts from. For each cell `over` holds the highest
  // ground a stretch of eight steps begun over it can pass, and a stretch that cannot lower the answer is not walked.
  // The steps that are walked are the same ones, so the field is the same to the last bit, from a fraction of the samples.
  const STRETCH = 8
  const over = (dir: readonly [number, number]): Float32Array => {
    const span = (k: number): [number, number] => [Math.floor(Math.min(0, k * (STRETCH - 1))) - 1, Math.ceil(Math.max(0, k * (STRETCH - 1))) + 2]
    const [ax, bx] = span(dir[0])
    const [az, bz] = span(dir[1])
    const along = new Float32Array(nx * nz)
    const top = new Float32Array(nx * nz)
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      let most = -Infinity
      for (let d = ax; d <= bx; d++) most = Math.max(most, at(i + d, j))
      along[j * nx + i] = most
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      let most = -Infinity
      for (let d = az; d <= bz; d++) most = Math.max(most, along[Math.min(Math.max(j + d, 0), nz - 1) * nx + i]!)
      top[j * nx + i] = most
    }
    return top
  }
  const march = (i: number, j: number, dir: readonly [number, number], top: Float32Array, rise: number, reach: number, edge: number, w0: number, w1: number): number => {
    const here = h[j * nx + i]!
    let least = 1
    for (let s = step, k = 0; s < reach && least > 0; s += step, k++) {
      if (k % STRETCH === 0) {
        const far = s + (STRETCH - 1) * step
        const most = top[Math.min(Math.max(Math.floor(j + (dir[1] * s) / step), 0), nz - 1) * nx + Math.min(Math.max(Math.floor(i + (dir[0] * s) / step), 0), nx - 1)]! - here
        if (Math.min(edge - (most - rise * s) / (w0 + w1 * s), edge - (most - rise * far) / (w0 + w1 * far)) > least + 1e-6) {
          s += (STRETCH - 1) * step
          k += STRETCH - 1
          continue
        }
      }
      least = Math.min(least, edge - (soft(i + (dir[0] * s) / step, j + (dir[1] * s) / step) - here - rise * s) / (w0 + w1 * s))
    }
    return Math.max(least, 0)
  }
  const overWay = over(way)
  const overTurned = over(turned)
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const o = j * nx + i
      cast[o] = march(i, j, way, overWay, key[1] / plan, C[2]!, 0.5, C[0]!, C[1]!)
      const low = T.low * (SAND_LIT.ragged[0]! + SAND_LIT.ragged[1]! * noise((x0 + i * step) / SAND_LIT.ragged[2]! + 1.7, (z0 + j * step) / SAND_LIT.ragged[2]! + 4.1, 23)) * (key[1] / plan)
      near[o] = march(i, j, turned, overTurned, low, T.mm, 1, T.w[0]!, T.w[1]!)
      const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * step)
      const gz = (at(i, j + 1) - at(i, j - 1)) / (2 * step)
      face[o] = faceOf((key[1] - gx * key[0] - gz * key[2]) / Math.hypot(gx, 1, gz))
    }
  }
  // The edge of that shade is not a line: the skin takes it over a grain or two, and a grain that stands proud takes the
  // sun a little before the skin under it does.
  const blurred = (a: Float32Array, cells: number): Float32Array => {
    const reach = Math.ceil(cells * 2.5)
    const w: number[] = []
    for (let k = -reach; k <= reach; k++) w.push(Math.exp(-0.5 * (k / cells) ** 2))
    const sum = w.reduce((p, c) => p + c, 0)
    const mid = new Float32Array(nx * nz)
    const out = new Float32Array(nx * nz)
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      let v = 0
      for (let k = -reach; k <= reach; k++) v += w[k + reach]! * a[j * nx + Math.min(Math.max(i + k, 0), nx - 1)]!
      mid[j * nx + i] = v / sum
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      let v = 0
      for (let k = -reach; k <= reach; k++) v += w[k + reach]! * mid[Math.min(Math.max(j + k, 0), nz - 1) * nx + i]!
      out[j * nx + i] = v / sum
    }
    return out
  }
  const wide = blurred(near, T.blur)
  for (let o = 0; o < cast.length; o++) {
    cast[o] = Math.min(cast[o]!, wide[o]!)
    lit[o] = face[o]! * cast[o]!
  }
  made = { nx, nz, h, cast: blurred(cast, SAND_LIT.blur[0]!), lit: blurred(lit, SAND_LIT.blur[1]!) }
  return made
}

// The sun a grain that lies at a place takes, as the skin under it does.
export function sandLitAt(x: number, z: number): number {
  const F = field()
  const u = (x - SLAB.heap.x[0]) / SLAB.stepMm
  const v = (z - SLAB.heap.z[0]) / SLAB.stepMm
  if (u < 0 || v < 0 || u > F.nx - 1 || v > F.nz - 1) return faceOf(keyDir()[1])
  const i = Math.min(Math.floor(u), F.nx - 2)
  const j = Math.min(Math.floor(v), F.nz - 2)
  const fu = u - i
  const fv = v - j
  const o = j * F.nx + i
  return (F.lit[o]! * (1 - fu) + F.lit[o + 1]! * fu) * (1 - fv) + (F.lit[o + F.nx]! * (1 - fu) + F.lit[o + F.nx + 1]! * fu) * fv
}

// The skin is drawn from every second node of the field, each with the slope the fine field has there. A cell none of
// whose corners has cover enough for one grain, whole or growing (slabGrain draws none under 0.002), is not drawn.
function heapGeometry(): THREE.BufferGeometry {
  const F = field()
  const step = SLAB.stepMm
  const { nx, nz, h } = F
  const at = (i: number, j: number): number => h[Math.min(Math.max(j, 0), nz - 1) * nx + Math.min(Math.max(i, 0), nx - 1)]!
  const slot = new Int32Array(nx * nz).fill(-1)
  const position: number[] = []
  const normal: number[] = []
  const color: number[] = []
  const slab: number[] = []
  const index: number[] = []
  const vertex = (i: number, j: number): number => {
    const o = j * nx + i
    if (slot[o]! >= 0) return slot[o]!
    const x = SLAB.heap.x[0] + i * step
    const z = SLAB.heap.z[0] + j * step
    const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * step)
    const gz = (at(i, j + 1) - at(i, j - 1)) / (2 * step)
    const l = Math.hypot(gx, 1, gz)
    position.push(x, SLAB.liftMm + h[o]!, z)
    normal.push(-gx / l, 1 / l, -gz / l)
    const shade = 0.7 + 0.3 * Math.min(1, Math.max(0, (Math.hypot(x, z) - 55.5) / 13))
    color.push(1, shade, 0)
    slab.push(keepAt(x, z, h[o]!), shade, F.cast[o]!)
    slot[o] = position.length / 3 - 1
    return slot[o]!
  }
  const m = SLAB.skin
  const shows = (i: number, j: number): boolean => {
    const o = j * nx + i
    return Math.max(coverAt(h[o]!), keepAt(SLAB.heap.x[0] + i * step, SLAB.heap.z[0] + j * step, h[o]!)) >= SLAB.bare
  }
  for (let j = 0; j + m < nz; j += m) {
    for (let i = 0; i + m < nx; i += m) {
      if (!shows(i, j) && !shows(i + m, j) && !shows(i, j + m) && !shows(i + m, j + m)) continue
      const a = vertex(i, j)
      const b = vertex(i + m, j)
      const c = vertex(i, j + m)
      const d = vertex(i + m, j + m)
      index.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  const count = position.length / 3
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
  g.setAttribute('aSlab', new THREE.Float32BufferAttribute(slab, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}

const f = (v: number): string => v.toFixed(3)

// What the skin and the single grains (arrival.ts) share. The shade of the stone: the base's own outline (radius at
// height, assets-src/base-summer/profile.mjs) thrown along the key, with an edge that widens with the way the light has
// still to go. The sun a slope of sand takes: grains shade one another at grazing light, so it leaves the sand well
// before the slope turns from it. And the sand's tone: sun and sky on its paint, paler the brighter, nothing burnt to white.
export const SAND_GLSL = `
float sandStone(float h) {
  float low = max(11.2 - h, 0.0);
  return 60.3 - 0.00505 * low * low * low - 0.134 * pow(max(min(h, 30.5) - 11.2, 1e-6), 1.35) - 0.0143 * pow(max(h - 30.5, 1e-6), 2.49);
}
float sandBaseShade(vec3 p, vec3 key) {
  vec2 l = key.xz;
  float a = dot(l, l);
  if (a < 1e-6) return 1.0;
  float up = abs(key.y);
  float y = abs(p.y);
  float mid = -dot(p.xz, l) / a;
  float span = sqrt(max(3636.1 - dot(p.xz, p.xz) + mid * mid * a, 0.0) / a);
  float top = max(41.3 - y, 0.0) / max(up, 1e-3);
  float lo = clamp(mid - span, 0.0, top);
  float hi = clamp(mid + span, 0.0, top);
  float least = 1e3;
  for (int k = 0; k < 10; k++) {
    float s = mix(lo, hi, float(k) / 9.0);
    least = min(least, (length(p.xz + l * s) - sandStone(y + up * s)) / (${f(SAND_LIT.soft[0]!)} + ${f(SAND_LIT.soft[1]!)} * s));
  }
  return smoothstep(-1.0, 1.0, least);
}
float sandFace(float nl) {
  return smoothstep(${f(SAND_LIT.ramp[0]!)}, ${f(SAND_LIT.ramp[1]!)}, nl) * (${f(SAND_LIT.gain[0]!)} + ${f(SAND_LIT.gain[1]!)} * clamp(nl, 0.0, 1.0));
}
vec3 sandTone(vec3 paint, vec3 sun, vec3 sky) {
  vec3 c = paint * RECIPROCAL_PI * (sun * ${f(SAND_LIT.sun)} + sky * vec3(${SAND_LIT.sky.map(f).join(', ')}));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(c, vec3(l), ${f(SAND_LIT.pale)} * smoothstep(${f(SAND_LIT.knee * 0.5)}, ${f(SAND_LIT.high)}, l));
}
vec3 sandShade(float sun) {
  return mix(vec3(${SAND_LIT.shade.map(f).join(', ')}), vec3(1.0), clamp(sun * ${f(1 / SAND_LIT.shadeTo)}, 0.0, 1.0));
}
vec3 sandCrest(float y) {
  return mix(vec3(1.0), vec3(${SAND_LIT.crest.tint.map(f).join(', ')}), smoothstep(${f(SAND_LIT.crest.mm[0]!)}, ${f(SAND_LIT.crest.mm[1]!)}, y));
}
vec3 sandKnee(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return c * (min(l, ${f(SAND_LIT.knee)}) + ${f(SAND_LIT.high - SAND_LIT.knee)} * (1.0 - exp(-max(l - ${f(SAND_LIT.knee)}, 0.0) / ${f(SAND_LIT.high - SAND_LIT.knee)}))) / max(l, 1e-4);
}
`

const SLAB_PARS = `
varying vec3 vSlab;
uniform vec4 uSlabLens;
uniform vec2 uSlabFocus;
uniform float uSlabPx;
uniform float uSandDown;
uniform vec2 uSandFoot;
${SAND_GLSL}
vec4 slabCell(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)) + 32768);
  q = q * 1664525u + 1013904223u;
  q.x += q.y * 374761393u;
  q.x ^= q.x >> 15u;
  q.x *= 668265263u;
  q.x ^= q.x >> 13u;
  q.x *= 1274126177u;
  q.x ^= q.x >> 16u;
  return vec4(float(q.x & 255u), float((q.x >> 8u) & 255u), float((q.x >> 16u) & 255u), float(q.x >> 24u)) / 255.0;
}
// One layer of grains, a grain to a cell, there where the sand's cover reaches the cell's own number. x: the light on
// the grain, more on the side that faces the sun and less on the other, y: how much of the place it covers, z: how much
// of that light is the warmer light of a tan grain among the pale ones; x and z are times y.
vec3 slabGrain(vec2 at, float seed, float keep, vec3 lean) {
  vec2 cell = floor(at);
  vec4 h = slabCell(cell + seed);
  float size = mix(0.6, 1.0, h.z) * mix(${f(SAND_LIT.small[0]!)}, 1.0, smoothstep(0.0, ${f(SAND_LIT.small[1]!)}, keep));
  vec2 off = at - cell - 0.5 - (1.0 - size) * (h.xy - 0.5);
  float cover = (1.0 - smoothstep(0.45, 1.0, 2.0 * length(off) / size)) * step(h.w * 0.996 + 0.002, keep);
  float light = mix(${f(SAND_LIT.tone[0]!)}, ${f(SAND_LIT.tone[1]!)}, fract(h.z * 7.0 + h.w * 3.0)) * (1.0 + lean.z * clamp(2.0 * dot(off, lean.xy) / size, -1.0, 1.0));
  return vec3(light, 1.0, light * h.x * h.x) * cover;
}
// The grain of the sand, in two layers that do not share a grid: the larger grains, and finer ones between them.
vec3 slabGrit(vec2 at, float keep, vec3 lean) {
  vec3 a = slabGrain(at, 7.0, keep, lean);
  vec3 b = slabGrain(mat2(0.8, 0.6, -0.6, 0.8) * at * ${f(SAND_LIT.finer)} + 17.3, 67.0, keep, vec3(mat2(0.8, 0.6, -0.6, 0.8) * lean.xy, lean.z));
  return a + b * (1.0 - a.y);
}
`

const SLAB_LIGHT = `
float slabAlpha = 1.0;
#ifdef STAGE_LIGHT_DONE
{
  vec3 slabN = normalize(mix(nonPerturbedNormal, normal, ${f(SAND_LIT.tilt)}));
  vec3 slabUp = inverseTransformDirection(nonPerturbedNormal, viewMatrix);
  // While the globe stands the stone's shade is its outline, thrown; while it is in the air, the stage's own shadow.
  float slabStone = mix(stageKeyS, sandBaseShade(vStageWorld - vec3(uSandFoot.x, 0.0, uSandFoot.y), uRigKeyDir), uSandDown);
  float slabSun = sandFace(dot(slabN, stageKeyL)) * vSlab.z * slabStone;
  float slabBack = clamp(dot(-geometryViewDir, stageKeyL) * 0.5 + 0.5, 0.0, 1.0);
  vec3 slabSky = (mix(uRigGround, uRigSky, 0.5 + 0.5 * slabUp.y) + uRigCardCol * (${f(SAND_LIT.card)} * clamp(dot(slabN, normalize(mat3(viewMatrix) * uRigCardDir)) * 0.5 + 0.5, 0.0, 1.0))) * vSlab.y * sandShade(slabSun);
  // Where the sand thins out, and where the skin turns from the eye, it is single grains with the table between them;
  // and a grain that lies alone is darker and more of its own colour than sand that lies deep, which is lit by its neighbours too.
  float slabKeep = vSlab.x * smoothstep(0.0, ${f(SAND_LIT.fade)}, dot(normalize(nonPerturbedNormal), geometryViewDir));
  // A grain that lies alone and out of focus is not painted. Paint cannot be blurred as the lens blurs a grain: it is
  // drawn again from each of the lens's points, a row of beads. The grains of arrival.ts lie there, each one soft disc.
  float slabFar = max(-(viewMatrix * vec4(vStageWorld, 1.0)).z, 1.0);
  float slabBlur = uSlabFocus.x * abs(slabFar * uSlabFocus.y - 1.0) * uSlabPx / slabFar * ${f(SAND_LIT.rows / 2)} / min(uSlabLens.x, uSlabLens.y);
  slabKeep *= 1.0 - smoothstep(${f(SAND_LIT.unsharp[0]!)}, ${f(SAND_LIT.unsharp[1]!)}, slabBlur) * (1.0 - smoothstep(${f(SAND_LIT.fill[0]!)}, ${f(SAND_LIT.fill[1]!)}, slabKeep));
  float slabDeep = smoothstep(${f(SAND_LIT.thin[1]!)}, ${f(SAND_LIT.thin[2]!)}, vStageWorld.y - ${f(SLAB.liftMm)});
  vec3 slabC = sandTone(diffuseColor.rgb * vec3(${SAND_LIT.tint.map(f).join(', ')}) * sandCrest(vStageWorld.y) * mix(vec3(${SAND_LIT.lone.map(f).join(', ')}) * ${f(SAND_LIT.thin[0]!)}, vec3(1.0), max(slabDeep, 1.0 - clamp(slabSun, 0.0, 1.0))), stageKeyC * (slabSun * (1.0 + ${f(SAND_LIT.back)} * slabBack * slabBack)), slabSky);
  // The lens parts red from blue toward the frame's edge (post.ts), and a grain a pixel wide would come out of it as a
  // red, a green and a blue one. The grain of the sand is laid for each of the three as arrival.ts lays its grains: on the
  // pixels the post reads them from, with its weights.
  vec2 slabFoot = max(abs(dFdx(vStageWorld.xz)) + abs(dFdy(vStageWorld.xz)), vec2(0.02));
  vec2 slabStep = exp2(ceil(log2(slabFoot * (${f(SAND_LIT.speck)} * min(uSlabLens.x, uSlabLens.y) / ${f(SAND_LIT.rows / 2)}))));
  vec2 slabAt = vStageWorld.xz / slabStep;
  vec2 slabToSun = uRigKeyDir.xz * slabStep;
  float slabLit = clamp(slabSun, 0.0, 1.0);
  vec3 slabLean = vec3((dot(slabToSun, slabToSun) > 0.0 ? normalize(slabToSun) : vec2(1.0, 0.0)), mix(${f(SAND_LIT.lean[0]!)}, ${f(SAND_LIT.lean[1]!)}, slabLit));
  vec2 slabQ = gl_FragCoord.xy - uSlabLens.xy;
  float slabR = dot(slabQ, slabQ) / dot(uSlabLens.xy, uSlabLens.xy);
  vec2 slabPx = slabQ / max(length(slabQ), 1e-4) * (uSlabLens.z * pow(max(slabR, 1e-12), 0.5 * uSlabLens.w));
  vec2 slabX = dFdx(vStageWorld.xz) / slabStep;
  vec2 slabY = dFdy(vStageWorld.xz) / slabStep;
  vec2 slabLowR = floor(slabPx);
  vec2 slabFarR = slabPx - slabLowR;
  vec2 slabLowB = floor(-slabPx);
  vec2 slabFarB = -slabPx - slabLowB;
  vec3 slabGr = vec3(0.0);
  vec3 slabGg = vec3(0.0);
  vec3 slabGb = vec3(0.0);
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 k = vec2(float(i), float(j));
      vec2 wR = mix(1.0 - slabFarR, slabFarR, k);
      vec2 wB = mix(1.0 - slabFarB, slabFarB, k);
      vec2 oR = slabLowR + k;
      vec2 oB = slabLowB + k;
      slabGr += wR.x * wR.y * slabGrit(slabAt - slabX * oR.x - slabY * oR.y, slabKeep, slabLean);
      slabGb += wB.x * wB.y * slabGrit(slabAt - slabX * oB.x - slabY * oB.y, slabKeep, slabLean);
    }
  }
  vec2 slabSide = slabFarR * (1.0 - slabFarR);
  vec2 slabMid = 1.0 - 2.0 * slabSide;
  for (int j = -1; j < 2; j++) {
    for (int i = -1; i < 2; i++) {
      float w = (i == 0 ? slabMid.x : slabSide.x) * (j == 0 ? slabMid.y : slabSide.y);
      slabGg += w * slabGrit(slabAt + slabX * float(i) + slabY * float(j), slabKeep, slabLean);
    }
  }
  // Between the grains lies the pit each one shades, and where the sand thins out, the table.
  float slabFill = smoothstep(${f(SAND_LIT.fill[0]!)}, ${f(SAND_LIT.fill[1]!)}, slabKeep);
  float slabPit = slabFill * mix(${f(SAND_LIT.pit[0]!)}, ${f(SAND_LIT.pit[1]!)}, slabLit);
  vec3 slabCover = vec3(slabGr.y, slabGg.y, slabGb.y);
  vec3 slabGrain = vec3(slabGr.x, slabGg.x - ${f(SAND_LIT.warm[0]!)} * slabGg.z, slabGb.x - ${f(SAND_LIT.warm[1]!)} * slabGb.z) + slabPit * vec3(${SAND_LIT.pitTint.map(f).join(', ')}) * (1.0 - slabCover);
  slabCover += slabFill * (1.0 - slabCover);
  if (max(slabCover.r, max(slabCover.g, slabCover.b)) <= 0.0) discard;
  slabGrain /= max(slabCover, vec3(1e-4));
  outgoingLight = vec3(sandKnee(slabC * slabGrain.r).r, sandKnee(slabC * slabGrain.g).g, sandKnee(slabC * slabGrain.b).b) * slabCover;
  slabAlpha = slabCover.g;
}
#endif
diffuseColor.a = slabAlpha;
`

// While the heap grows (arrival.ts) it is as high as it has grown, and covers the table only where that height covers it.
// Where the heap leant on the foot it stands, as the foot leaves, as the cast of the foot's edge. It does not stand long:
// within the second the sand slides down into the print at its angle of repose, and the print is closed.
const SLUMP = { from: 0.33, seconds: 1.0, steep: 5.0 } as const
const SLAB_RISE = `
float slabStood = uSandLift < 0.0 ? 0.0 : 1.0 - smoothstep(${f(SLUMP.from)}, ${f(SLUMP.from + SLUMP.seconds)}, uSandLift);
float slabCut = ${f(SLUMP.steep)} * slabStood * slabStood * slabStood * max(${f(SLAB.footMm)} - length(position.xz), 0.0);
float slabTall = max(position.y - ${f(SLAB.liftMm)} - slabCut, 0.0);
transformed.y = ${f(SLAB.liftMm)} + slabTall;
float slabGrown = clamp((slabTall * uSandGrow - ${f(HEAP.cover[0]!)}) / ${f(HEAP.cover[1]! - HEAP.cover[0]!)}, 0.0, 1.0);
vSlab = vec3(mix(slabGrown * slabGrown * (3.0 - 2.0 * slabGrown), aSlab.x, step(1.0, uSandGrow) * step(slabCut, 0.0)), aSlab.yz);
`

// The heap is the stage's sand (base.ts) with the light and the edge of this file put in place of its own.
function slabSand(): THREE.Material {
  const m = sandMaterial(PART, 'surface-dressing', `${PART}-sand`)
  m.transparent = true
  m.blending = THREE.CustomBlending
  m.blendEquation = THREE.AddEquation
  m.blendSrc = THREE.OneFactor
  m.blendDst = THREE.OneMinusSrcAlphaFactor
  m.blendSrcAlpha = THREE.ZeroFactor
  m.blendDstAlpha = THREE.OneFactor
  const inner = m.onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    inner.call(m, shader, renderer)
    shader.uniforms.uSlabLens = arrivalPart.grainLens
    shader.uniforms.uSlabFocus = arrivalPart.grainFocus
    shader.uniforms.uSlabPx = arrivalPart.grainPx
    shader.uniforms.uSandDown = arrivalPart.sandDown
    shader.uniforms.uSandGrow = arrivalPart.sandGrow
    shader.uniforms.uSandLift = arrivalPart.sandLift
    shader.uniforms.uSandFoot = arrivalPart.sandFoot
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aSlab;\nvarying vec3 vSlab;\nuniform float uSandGrow;\nuniform float uSandLift;').replace('#include <begin_vertex>', `#include <begin_vertex>\n${SLAB_RISE}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SLAB_PARS}`)
      .replace('#include <opaque_fragment>', `${SLAB_LIGHT}\n#include <opaque_fragment>`)
  }
  return m
}

export async function prepare(): Promise<void> {}

const heaps: THREE.Mesh[] = []

export function dressing(): THREE.Object3D {
  const group = new THREE.Group()
  const pool = (glassPart as { surfacePool?: () => THREE.Object3D }).surfacePool?.()
  if (pool) group.add(pool)
  const sand = new THREE.Mesh(heapGeometry(), slabSand())
  sand.castShadow = true
  sand.receiveShadow = true
  sand.renderOrder = 3
  heaps.push(sand)
  const loose = arrivalPart.grains()
  loose.renderOrder = 4
  group.add(sand, loose)
  return group
}

export function update(moment: KitMoment): void {
  const grown = arrivalPart.sandGrown(moment)
  for (const heap of heaps) {
    heap.visible = grown > 0
    heap.scale.y = Math.max(grown, 1e-3)
    heap.position.y = SLAB.liftMm * (1 - grown)
    heap.updateMatrix()
  }
}
