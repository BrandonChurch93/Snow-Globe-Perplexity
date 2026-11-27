import { config, formats, shots } from '../config'
import { VIEWS } from '../diagnostics/views'

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
  const asked = (MODES as string[]).includes(q.get('mode') ?? '') ? (q.get('mode') as Mode) : 'live'
  const season = q.get('season') ?? ''
  const num = (k: string, d: number) => {
    const v = Number(q.get(k))
    return q.has(k) && Number.isFinite(v) ? v : d
  }
  // A capture page draws for a tool, and a tool never gets a format it did not name: where the config does not name the
  // format the page is the live page at hd, which hands out no capture interface (src/main.ts). A visitor has the globe.
  const named = q.get('format') ?? config.formats.hd.id
  const known = formats.some((f) => f.id === named)
  const mode: Mode = asked === 'capture' && !known ? 'live' : asked
  const assets = q.get('assets') ?? (mode === 'capture' ? 'full' : 'web')
  // A name the app does not know is no name: an unknown shot would play the whole film without its sound, and an
  // unknown view would flatten the picture.
  const shot = q.get('shot') ?? ''
  const diag = q.get('diag') ?? ''
  return {
    mode,
    season: config.seasons.includes(season) ? season : config.defaultSeason,
    format: known ? named : config.formats.hd.id,
    tier: q.get('tier') ?? 'draft',
    assets: Object.hasOwn(config.assetSets, assets) ? assets : 'web',
    quality: q.get('quality') ?? config.live.defaultQuality,
    frame: num('frame', 0),
    first: num('first', 0),
    last: num('last', -1),
    shot: shots.some((s) => s.id === shot) ? shot : '',
    diag: diag === 'none' || (VIEWS as readonly string[]).includes(diag) ? diag : '',
    which: q.get('which') ?? 'b',
    deny: (q.get('noext') ?? '').split(',').filter(Boolean),
    simcache: q.get('simcache') === '1',
  }
}
