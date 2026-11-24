import { config, pictures } from '../config'
import { barSeconds, beatSeconds, type Grid } from './timeline'
import type { OpeningPlan } from './opening'

export interface JudgedEntry {
  id: string
  unit: string
  kind: 'key' | 'still' | 'change' | 'live' | 'film' | 'opening' | 'loop'
  format: string
  what: string
  season?: string
  state?: string
  camera?: string
  interface?: boolean
  shot?: string
  at?: 'swap' | 'landing'
  level?: string
  frame?: number
}

export interface LoopPlan {
  frameCount: number
  shake: { first: number; liftEnd: number; strokesEnd: number; landing: number }
}

export function loopPlan(fps: number = config.film.fps): LoopPlan {
  const c = config.deliver.cardLoop
  const first = Math.round(c.shakeStartSeconds * fps)
  const beat = beatSeconds * fps
  return {
    frameCount: Math.round(c.seconds * fps),
    shake: {
      first,
      liftEnd: first + Math.round(config.shake.liftBeats * beat),
      strokesEnd: first + Math.round((config.shake.liftBeats + config.shake.strokeBeats) * beat),
      landing: first + Math.round(barSeconds * fps),
    },
  }
}

export function judgedList(grid: Grid, opening: OpeningPlan): JudgedEntry[] {
  const out: JudgedEntry[] = []
  const hd = config.formats.hd.id
  const keyIds = new Set(config.keys.map((k) => k.id))
  for (const p of pictures) {
    out.push({ id: p.id, unit: p.unit, kind: keyIds.has(p.id) ? 'key' : 'still', format: p.format, season: p.season, state: p.state, camera: p.camera, ...(p.interface ? { interface: true } : {}), what: `${p.season} in the ${p.state} state from ${p.camera}${p.interface ? ', with the controls on' : ''}` })
  }
  const shakes = grid.spans.filter((s) => s.shot.kind === 'shake')
  for (const s of shakes) {
    out.push({ id: `change-${s.shot.id}-swap`, unit: 'change', kind: 'change', format: hd, camera: 'hero', shot: s.shot.id, at: 'swap', what: `the middle of the swap window of ${s.shot.id}` })
    out.push({ id: `change-${s.shot.id}-landing`, unit: 'change', kind: 'change', format: hd, camera: 'hero', shot: s.shot.id, at: 'landing', what: `the landing frame of ${s.shot.id}` })
  }
  const top = Object.keys(config.live.quality)[0]!
  for (const season of config.seasons) out.push({ id: `live-${season}`, unit: 'globe', kind: 'live', format: hd, season, state: 'rest', camera: 'hero', level: top, what: `${season} at rest through the app's own path at the ${top} level` })
  const fps = grid.fps
  const film = (id: string, frame: number, what: string) => out.push({ id, unit: 'film', kind: 'film', format: hd, frame, what })
  film('film-first', 0, 'frame 0')
  film('film-hook', Math.round(config.film.hookSeconds * fps), 'the frame at film.hookSeconds')
  film('film-reveal', Math.round(config.film.revealBySeconds * fps), 'the frame at film.revealBySeconds')
  for (const s of grid.spans) {
    if (s.shot.kind === 'hold') {
      film(`film-hold-${s.shot.id}`, Math.floor((s.first + s.last) / 2), `the middle of the hold ${s.shot.id}`)
      continue
    }
    const swap = grid.swaps.find((w) => w.shot === s.shot.id)!
    const landing = s.last + 1
    film(`film-${s.shot.id}-swap`, Math.round((swap.first + swap.last) / 2), `the middle of the swap window of ${s.shot.id}`)
    film(`film-${s.shot.id}-landing`, landing, `the landing of ${s.shot.id}`)
    film(`film-${s.shot.id}-landed`, landing + Math.round(config.states.landedSeconds * fps), `states.landedSeconds after the landing of ${s.shot.id}`)
  }
  film('film-last', grid.frameCount - 1, 'the last frame')
  const open = (id: string, frame: number, what: string) => out.push({ id, unit: 'film', kind: 'opening', format: hd, frame, what })
  open('opening-typing', Math.round((opening.typing.first + opening.typing.last) / 2), 'the middle of the typing')
  open('opening-reasoning', Math.round((opening.reasoning.open + opening.reasoning.choose) / 2), 'the reasoning level control open')
  open('opening-build', Math.round((opening.build.first + opening.build.last) / 2), 'the middle of the build screen')
  const lp = loopPlan(fps)
  const loop = (id: string, frame: number, what: string) => out.push({ id, unit: 'film', kind: 'loop', format: config.deliver.cardLoop.format, frame, what })
  loop('loop-first', 0, 'frame 0 of the loop')
  loop('loop-strokes', Math.round((lp.shake.liftEnd + lp.shake.strokesEnd) / 2), 'the middle of the strokes of the loop')
  loop('loop-landed', lp.shake.landing + Math.round(config.states.landedSeconds * fps), 'states.landedSeconds after the landing of the loop')
  loop('loop-three-quarters', Math.round(lp.frameCount * 0.75), 'three quarters of the way through the loop')
  return out
}
