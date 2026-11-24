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
export const tiers = raw.tiers as Record<string, { samplesPerFrame: number }>
export const pictures: PictureSpec[] = [...raw.keys, ...raw.stills]

export function formatById(id: string): FormatSpec {
  const f = formats.find((x) => x.id === id)
  if (!f) throw new Error(`no such format: ${id}`)
  return f
}

export function cameraById(id: string): CameraSpec {
  const c = cameras[id]
  if (!c) throw new Error(`no such camera: ${id}`)
  return c
}

export function tierSamples(id: string): number {
  const t = tiers[id]
  if (!t) throw new Error(`no such tier: ${id}`)
  return t.samplesPerFrame
}

export function particleKinds(season: string): ParticleKind[] {
  const list = (raw.particles as unknown as Record<string, ParticleKind[]>)[season]
  if (!Array.isArray(list)) throw new Error(`no particles for season: ${season}`)
  return list
}

export function seasonIndex(season: string): number {
  const i = raw.seasons.indexOf(season)
  if (i < 0) throw new Error(`no such season: ${season}`)
  return i
}
