import raw from '../config/showcase.json'
import { configProblems } from './configCheck'

export type Config = typeof raw
export interface CameraSpec {
  fovDeg: number
  distanceMm: number
  yawDeg: number
  pitchDeg: number
  aimHeightMm: number
}
export interface FormatSpec {
  id: string
  width: number
  height: number
}
export interface HoldShot {
  id: string
  kind: 'hold'
  season: string
  bars: number
}
export interface ShakeShot {
  id: string
  kind: 'shake'
  from: string
  to: string
  bars: number
}
export type Shot = HoldShot | ShakeShot
export interface ParticleKind {
  kind: string
  count: number
}
export interface PictureSpec {
  id: string
  unit: string
  season: string
  state: string
  camera: string
  format: string
  image?: string
  interface?: boolean
  settled?: string[]
}

const present: readonly string[] = typeof __APPROVED_PRESENT__ === 'undefined' ? raw.keys.map((k) => k.image) : __APPROVED_PRESENT__
const problems = configProblems(raw, present)
if (problems.length) throw new Error(`config/showcase.json is not valid:\n- ${problems.join('\n- ')}`)

export const config: Config = raw
export const shots = raw.film.shots as Shot[]
export const cameras = raw.cameras as Record<string, CameraSpec>
export const formats: FormatSpec[] = Object.values(raw.formats)
export interface TierMotion {
  spacingPx: number
  maxSamplesPerFrame: number
  /** The travel, in px a shutter, from which a frame is drawn with even sample times (film/motion.ts, `evenSet`). */
  evenFromPx: number
  /** The travel, in px a shutter, under which a sample is not spread at all (film/motion.ts, `spreadReach`). */
  spreadFromPx: number
  /** The travel, in px a shutter, from which the spread of a sample has its full reach; it grows from none at `spreadFromPx`. */
  spreadFullPx: number
}
export const tiers = raw.tiers as Record<string, { samplesPerFrame: number; motion?: TierMotion }>
export const pictures: PictureSpec[] = [...raw.keys, ...raw.stills]

export function formatById(id: string): FormatSpec {
  const f = formats.find((x) => x.id === id)
  if (!f) throw new Error(`no such format: ${id}`)
  return f
}

/** A table's own entry. A name every object carries (`constructor`, `toString`) is in none of the tables. */
const own = <T>(table: Record<string, T>, id: string): T | undefined => (Object.hasOwn(table, id) ? table[id] : undefined)

export function cameraById(id: string): CameraSpec {
  const c = own(cameras, id)
  if (!c) throw new Error(`no such camera: ${id}`)
  return c
}

const COUNTED_TIER = /^(samples|final)-([1-9]\d{0,2})$/

export function tierSamples(id: string): number {
  const t = own(tiers, id)
  if (t) return t.samplesPerFrame
  const counted = COUNTED_TIER.exec(id)
  if (!counted) throw new Error(`no such tier: ${id}`)
  return Number(counted[2])
}

/** The tier's own motion rule, or none for a tier of a fixed count and for a counted tier, whose count is asked for. */
export const tierMotion = (id: string): TierMotion | undefined => own(tiers, id)?.motion

/**
 * The travel from which a frame of this tier is drawn with even sample times, or none. The final tier has it, and so has
 * `final-N`: the final tier's picture with a count that was asked for, which is how the masters draw a frame whose count
 * they have read from the page beforehand. `samples-N` is N samples and nothing else.
 */
export const tierEvenFromPx = (id: string): number | undefined => (/^final-/.test(id) && COUNTED_TIER.test(id) ? tiers.final?.motion?.evenFromPx : own(tiers, id)?.motion?.evenFromPx)

/** The motion rule a tier draws a travelling frame by: the final tier's for `final` and `final-N`, a tier's own otherwise, or none. */
export const tierTravelRule = (id: string): TierMotion | undefined => (/^final-/.test(id) && COUNTED_TIER.test(id) ? tiers.final?.motion : tiers[id]?.motion)

export function particleKinds(season: string): ParticleKind[] {
  const list = own(raw.particles as unknown as Record<string, ParticleKind[]>, season)
  if (!Array.isArray(list)) throw new Error(`no particles for season: ${season}`)
  return list
}

export function seasonIndex(season: string): number {
  const i = raw.seasons.indexOf(season)
  if (i < 0) throw new Error(`no such season: ${season}`)
  return i
}
