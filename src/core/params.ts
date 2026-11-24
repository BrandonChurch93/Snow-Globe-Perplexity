import { config, formatById } from '../config'

export type Mode = 'live' | 'autopilot' | 'loop' | 'capture' | 'probe'
const MODES: Mode[] = ['live', 'autopilot', 'loop', 'capture', 'probe']

export interface Params {
  mode: Mode
  season: string
  format: string
  tier: string
  assets: string
  quality: string
  frame: number
  first: number
  last: number
  shot: string
  diag: string
  which: string
  deny: string[]
  simcache: boolean
}

export function readParams(search: string): Params {
  const q = new URLSearchParams(search)
  const mode = (MODES as string[]).includes(q.get('mode') ?? '') ? (q.get('mode') as Mode) : 'live'
  const season = q.get('season') ?? ''
  const num = (k: string, d: number) => {
    const v = Number(q.get(k))
    return q.has(k) && Number.isFinite(v) ? v : d
  }
  const format = q.get('format') ?? config.formats.hd.id
  formatById(format)
  const assets = q.get('assets') ?? (mode === 'capture' ? 'full' : 'web')
  return {
    mode,
    season: config.seasons.includes(season) ? season : config.defaultSeason,
    format,
    tier: q.get('tier') ?? 'draft',
    assets: assets in config.assetSets ? assets : 'web',
    quality: q.get('quality') ?? config.live.defaultQuality,
    frame: num('frame', 0),
    first: num('first', 0),
    last: num('last', -1),
    shot: q.get('shot') ?? '',
    diag: q.get('diag') ?? '',
    which: q.get('which') ?? 'b',
    deny: (q.get('noext') ?? '').split(',').filter(Boolean),
    simcache: q.get('simcache') === '1',
  }
}
