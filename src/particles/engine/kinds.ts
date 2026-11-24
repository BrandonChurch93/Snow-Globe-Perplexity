import { config, particleKinds } from '../../config'

export type Mode = 'drift' | 'steer' | 'cycle'
export type Rest = 'never' | 'lies' | 'snags'

export interface Behaviour {
  mode: Mode
  sinkMmS: [number, number]
  settleMmS: [number, number]
  floats: number
  followSeconds: number
  swayMmS: number
  crossMmS: number
  dip: number
  turnRadS: [number, number]
  spinPerMm: number
  rest: Rest
  slope: number
  restSpeedMmS: number
  gripPerSecond: number
  liftMmS: [number, number]
  kick: number
  layerMm: [number, number]
  renew: number
  dwellSeconds: [number, number]
  sizeMm: [number, number]
  sizeSkew: number
  cruiseMmS: number
  reachMm: number
  clearanceMm: number
  lifeSeconds: [number, number]
  orbit: boolean
}

const base: Behaviour = {
  mode: 'drift',
  sinkMmS: [0, 0],
  settleMmS: [0, 0],
  floats: 0,
  followSeconds: 0.04,
  swayMmS: 0,
  crossMmS: 0,
  dip: 0,
  turnRadS: [0.3, 0.8],
  spinPerMm: 0.05,
  rest: 'never',
  slope: 2,
  restSpeedMmS: 0,
  gripPerSecond: 0,
  liftMmS: [0, 0],
  kick: 0,
  layerMm: [0.1, 0.4],
  renew: 0,
  dwellSeconds: [0, 0],
  sizeMm: [0.3, 0.6],
  sizeSkew: 1,
  cruiseMmS: 0,
  reachMm: 0,
  clearanceMm: 0,
  lifeSeconds: [1, 1],
  orbit: false,
}

export const BEHAVIOUR: Record<string, Behaviour> = {
  flake: { ...base, sinkMmS: [9, 18], settleMmS: [30, 60], followSeconds: 0.045, swayMmS: 2.2, crossMmS: 1.6, dip: 0.15, turnRadS: [0.5, 1.4], spinPerMm: 0.05, rest: 'lies', slope: 0.5, restSpeedMmS: 16, gripPerSecond: 9, liftMmS: [40, 140], kick: 0.55, layerMm: [0.12, 1.5], renew: 0.05, dwellSeconds: [3, 20], sizeMm: [0.45, 1.5], sizeSkew: 2.2 },
  glitter: { ...base, sinkMmS: [9, 18], settleMmS: [30, 60], followSeconds: 0.03, swayMmS: 0.8, crossMmS: 0.6, dip: 0.3, turnRadS: [2.2, 4.5], spinPerMm: 0.12, rest: 'lies', slope: 0.6, restSpeedMmS: 16, gripPerSecond: 10, liftMmS: [45, 150], kick: 0.6, layerMm: [0.05, 0.5], renew: 0.06, dwellSeconds: [3, 20], sizeMm: [0.22, 0.55], sizeSkew: 1.5 },
  petal: { ...base, sinkMmS: [12, 21], settleMmS: [30, 55], followSeconds: 0.07, swayMmS: 9, crossMmS: 2.5, dip: 0.6, turnRadS: [1.7, 2.6], spinPerMm: 0.04, rest: 'lies', slope: 0.78, restSpeedMmS: 14, gripPerSecond: 5, liftMmS: [45, 150], kick: 0.5, layerMm: [0.08, 0.6], renew: 0.02, dwellSeconds: [5, 22], sizeMm: [2, 3.4], sizeSkew: 1.3 },
  mote: { ...base, sinkMmS: [-0.15, 0.2], followSeconds: 0.02, swayMmS: 0.35, crossMmS: 0.3, turnRadS: [0.15, 0.5], spinPerMm: 0.02, sizeMm: [0.1, 0.38], sizeSkew: 2 },
  seed: { ...base, sinkMmS: [-0.1, 0.5], settleMmS: [12, 26], floats: 0.12, followSeconds: 0.035, swayMmS: 0.6, crossMmS: 0.5, dip: 0.2, turnRadS: [0.2, 0.6], spinPerMm: 0.03, rest: 'snags', slope: -2, restSpeedMmS: 60, gripPerSecond: 14, liftMmS: [18, 110], kick: 0.45, layerMm: [0.3, 1.2], sizeMm: [0.5, 1.1], sizeSkew: 1.2 },
  firefly: { ...base, mode: 'steer', followSeconds: 0.12, turnRadS: [0.6, 1.3], sizeMm: [0.7, 1], cruiseMmS: 16, reachMm: 9, clearanceMm: 5 },
  leaf: { ...base, sinkMmS: [16, 26], settleMmS: [35, 65], followSeconds: 0.08, swayMmS: 13, crossMmS: 6, dip: 0.5, turnRadS: [3.5, 5.5], spinPerMm: 0.05, rest: 'lies', slope: 0.72, restSpeedMmS: 18, gripPerSecond: 5, liftMmS: [50, 160], kick: 0.5, layerMm: [0.15, 1], renew: 0.02, dwellSeconds: [6, 24], sizeMm: [2.6, 4.4], sizeSkew: 1.3 },
  ember: { ...base, mode: 'cycle', sinkMmS: [-13, -7], followSeconds: 0.05, swayMmS: 5, crossMmS: 3.5, turnRadS: [3, 6], sizeMm: [0.3, 0.75], sizeSkew: 1.6, lifeSeconds: [2.4, 5] },
  bat: { ...base, mode: 'steer', followSeconds: 0.25, turnRadS: [7, 10], sizeMm: [5, 7], cruiseMmS: 55, reachMm: 24, clearanceMm: 7, orbit: true },
}

export const SEASONS: readonly string[] = config.seasons
export const NONE = 255

const names: string[] = []
for (const season of SEASONS) for (const k of particleKinds(season)) if (!names.includes(k.kind)) names.push(k.kind)
for (const name of names) if (!BEHAVIOUR[name]) throw new Error(`no behaviour for the particle kind: ${name}`)

export const KINDS: readonly string[] = names
export const POOL = Math.max(...SEASONS.map((s) => particleKinds(s).reduce((n, k) => n + k.count, 0)))

function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b]
  return a
}

function stride(pool: number): number {
  let a = Math.max(1, Math.round(pool * 0.6180339887))
  while (gcd(a, pool) !== 1) a++
  return a
}

const STRIDE = stride(POOL)

export const slotOf = (index: number): number => (index * STRIDE) % POOL

export const KIND_IN: readonly Uint8Array[] = SEASONS.map((season) => {
  const out = new Uint8Array(POOL).fill(NONE)
  const bounds: { upTo: number; id: number }[] = []
  let total = 0
  for (const k of particleKinds(season)) {
    total += k.count
    bounds.push({ upTo: total, id: names.indexOf(k.kind) })
  }
  for (let i = 0; i < POOL; i++) {
    const slot = slotOf(i)
    for (const b of bounds) {
      if (slot < b.upTo) {
        out[i] = b.id
        break
      }
    }
  }
  return out
})

export function countsIn(season: string, upTo: number = POOL): Record<string, number> {
  const table = KIND_IN[SEASONS.indexOf(season)]
  if (!table) throw new Error(`no such season: ${season}`)
  const out: Record<string, number> = {}
  for (const k of particleKinds(season)) out[k.kind] = 0
  for (let i = 0; i < upTo; i++) {
    const id = table[i]!
    if (id !== NONE) out[names[id]!] = (out[names[id]!] ?? 0) + 1
  }
  return out
}
