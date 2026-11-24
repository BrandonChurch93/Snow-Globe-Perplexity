import { config, formatById, tierSamples, type FormatSpec } from '../config'
import { Accumulator } from '../core/accumulator'
import type { Assets } from '../core/assets'
import { finish, type Gfx } from '../core/gl'
import { sampleSet, type Sample } from '../core/sampler'
import type { Moment, Stage } from '../core/stage'
import { defaultGrid, filmTimeline, globePoseAt, lastLandingBefore, prerollSeconds, seasonAt, stateSeconds, stillTimeline, type Grid, type Timeline } from '../film/timeline'
import type { SimDriver } from '../particles/driver'
import { Post } from '../post/post'
import { poseById, type Pose } from '../scene/cameras'
import parts from '../../parts/PARTS.json'

export interface StillSpec {
  season: string
  state: string
  camera: string
  tier: string
  change?: { shot: string; at: 'swap' | 'landing' }
  interface?: boolean
  live?: string
}

export interface Showcase {
  ready: Promise<void>
  info(): {
    fps: number
    format: string
    tier: string
    assets: string
    engineHash: string
    seasonHashes: Record<string, string>
    standIns: { name: string; unit: string }[]
    counts: { triangles: number; drawCalls: number; particles: number }
    textureMb: number
    versions: Record<string, string>
  }
  setFormat(id: string): Promise<void>
  setAssets(id: string): Promise<void>
  setDiagnostic(view: string): void
  renderStill(spec: StillSpec): Promise<void>
  film(): { frameCount: number; shots: { id: string; first: number; last: number }[]; swaps: { shot: string; first: number; last: number }[]; landings: number[]; barLines: number[] }
  filmState(frameIndex: number): { camera: number[]; shot: string; season: string; globe: { heightMm: number; tiltDeg: number[] }; change: Record<string, number>; cover: number | null }
  renderFilmFrame(frameIndex: number, tier: string): Promise<void>
  opening(): { frameCount: number }
  renderOpeningFrame(frameIndex: number): Promise<void>
  loop(): { frameCount: number }
  renderLoopFrame(frameIndex: number, tier: string): Promise<void>
  dev: Dev
}

export interface Dev {
  caps(): Gfx['caps'] & { precision: string }
  timings(): { simMs: number; drawMs: number; samples: number; steps: number }
  parts(): { name: string; color: number }[]
  simulate(fromSeconds: number, seconds: number): Promise<{ ms: number; steps: number; floating: number }>
}

interface Register {
  parts: { name: string; unit: string; state: string }[]
}

const DEG = 180 / Math.PI

export interface Deps {
  gfx: Gfx
  stage: Stage
  driver: SimDriver
  assets: Assets
  format: string
}

export function createShowcase(deps: Deps, ready: Promise<void>): Showcase {
  const { gfx, stage, driver, assets } = deps
  const post = new Post(gfx)
  let format: FormatSpec = formatById(deps.format)
  let acc = new Accumulator(gfx, format.width, format.height)
  let tier = 'draft'
  let diag = ''
  let grid: Grid | null = null
  let filmTl: Timeline | null = null
  const stills = new Map<string, Timeline>()
  const timing = { simMs: 0, drawMs: 0, samples: 0, steps: 0 }
  const counts = { triangles: 0, drawCalls: 0, particles: 0 }
  const now = () => performance.now()

  const size = () => {
    gfx.renderer.setSize(format.width, format.height, false)
    gfx.canvas.style.width = `${format.width}px`
    gfx.canvas.style.height = `${format.height}px`
  }
  size()

  const getGrid = () => (grid ??= defaultGrid())
  const getFilm = () => (filmTl ??= filmTimeline(getGrid()))
  const stillTl = (season: string) => {
    let t = stills.get(season)
    if (!t) stills.set(season, (t = stillTimeline(season)))
    return t
  }

  async function picture(tl: Timeline, timeSec: number, shutterSec: number, pose: (t: number) => Pose, samples: number, salt: number, live: boolean): Promise<void> {
    const flat = diag !== ''
    const set: (Sample | null)[] = live || flat ? [null] : sampleSet(samples, salt, 'picture').sort((a, b) => a.t - b.t)
    const info = gfx.renderer.info
    info.reset()
    acc.begin()
    let done = 0
    for (const s of set) {
      const t = timeSec + (s && shutterSec > 0 ? s.t * shutterSec : 0)
      const t0 = now()
      const before = driver.replayed
      const mix = await driver.seek(tl, t)
      timing.steps += driver.replayed - before
      const t1 = now()
      timing.simMs += t1 - t0
      const at = seasonAt(tl, t)
      const moment: Moment = { ...at, sinceLanding: t - lastLandingBefore(tl, t), globe: globePoseAt(tl, t), mix, seed: salt * 0.618 + 1 }
      stage.drawSample(acc.sample, pose(t), s, moment, done === 0 || shutterSec > 0)
      acc.add()
      done++
      finish(gfx)
      timing.drawMs += now() - t1
      timing.samples++
    }
    post.seed = (salt * 0.37) % 1
    post.resolve(acc.result, flat)
    finish(gfx)
    counts.triangles = Math.round(info.render.triangles / Math.max(1, done))
    counts.drawCalls = Math.round(info.render.calls / Math.max(1, done))
    counts.particles = stage.particleCount()
  }

  const frameTime = (i: number) => prerollSeconds + i / config.film.fps
  const shutter = config.film.shutterDegrees / 360 / config.film.fps
  const spanAt = (i: number) => {
    const g = getGrid()
    const c = Math.max(0, Math.min(g.frameCount - 1, i))
    return g.spans.find((s) => c >= s.first && c <= s.last)!
  }
  const filmPose = (_t: number) => poseById('hero')

  const api: Showcase = {
    ready,
    info() {
      const reg = parts as Register
      return {
        fps: config.film.fps,
        format: format.id,
        tier,
        assets: assets.set,
        engineHash: __ENGINE_HASH__,
        seasonHashes: { ...assets.index.seasonHashes },
        standIns: reg.parts.filter((p) => p.state === 'stand-in').map((p) => ({ name: p.name, unit: p.unit })),
        counts: { ...counts },
        textureMb: Math.round((stage.textureBytes() / 1048576) * 10) / 10,
        versions: { ...__VERSIONS__ },
      }
    },
    async setFormat(id) {
      const next = formatById(id)
      if (next.id === format.id) return
      format = next
      acc.dispose()
      acc = new Accumulator(gfx, format.width, format.height)
      stage.resize(format.width, format.height)
      size()
    },
    async setAssets(id) {
      if (!(id in config.assetSets)) throw new Error(`no such asset set: ${id}`)
      await assets.init(id)
    },
    setDiagnostic(view) {
      diag = view === 'none' ? '' : view
      stage.setDiagnostic(diag)
    },
    async renderStill(spec) {
      await ready
      if (!config.seasons.includes(spec.season)) throw new Error(`no such season: ${spec.season}`)
      tier = spec.tier
      const samples = tierSamples(spec.tier)
      if (spec.change) {
        const g = getGrid()
        const span = g.spans.find((s) => s.shot.id === spec.change!.shot)
        if (!span || span.shot.kind !== 'shake') throw new Error(`no such shake: ${spec.change.shot}`)
        const swap = g.swaps.find((s) => s.shot === span.shot.id)!
        const i = spec.change.at === 'swap' ? Math.round((swap.first + swap.last) / 2) : span.last + 1
        await picture(getFilm(), frameTime(i), shutter, filmPose, samples, i + 1, false)
        return
      }
      const pose = poseById(spec.camera)
      await picture(stillTl(spec.season), stateSeconds(spec.state), 0, () => pose, samples, 0, !!spec.live)
    },
    film() {
      const g = getGrid()
      return {
        frameCount: g.frameCount,
        shots: g.spans.map((s) => ({ id: s.shot.id, first: s.first, last: s.last })),
        swaps: g.swaps.map((s) => ({ ...s })),
        landings: [...g.landings],
        barLines: [...g.barLines],
      }
    },
    filmState(i) {
      const tl = getFilm()
      const t = frameTime(i)
      const at = seasonAt(tl, t)
      const g = globePoseAt(tl, t)
      const p = filmPose(t)
      const change: Record<string, number> = {}
      for (const part of ['base', 'miniature', 'glass-dressing', 'surface-dressing', 'light', 'veil', 'particles']) change[part] = at.change
      return {
        camera: [p.position.x, p.position.y, p.position.z, p.aim.x, p.aim.y, p.aim.z, p.fovDeg],
        shot: spanAt(i).shot.id,
        season: at.season,
        globe: { heightMm: g.y, tiltDeg: [g.tiltX * DEG, g.tiltZ * DEG] },
        change,
        cover: null,
      }
    },
    async renderFilmFrame(i, t) {
      await ready
      tier = t
      await picture(getFilm(), frameTime(i), shutter, filmPose, tierSamples(t), i + 1, false)
    },
    opening() {
      return { frameCount: 0 }
    },
    async renderOpeningFrame() {
      throw new Error('the opening is not built yet')
    },
    loop() {
      return { frameCount: Math.round(config.deliver.cardLoop.seconds * config.film.fps) }
    },
    async renderLoopFrame(i, t) {
      await ready
      tier = t
      const n = Math.round(config.deliver.cardLoop.seconds * config.film.fps)
      const pose = poseById(config.deliver.cardLoop.camera)
      await picture(stillTl(config.defaultSeason), stateSeconds('rest'), 0, () => pose, tierSamples(t), 100000 + (((i % n) + n) % n), false)
    },
    dev: {
      caps: () => ({ ...gfx.caps, precision: acc.precision }),
      timings: () => ({ ...timing }),
      parts: () => stage.parts(),
      async simulate(fromSeconds, seconds) {
        const tl = stillTl(config.defaultSeason)
        await driver.seek(tl, fromSeconds)
        const sim = driver.sim
        const snap = sim.snapshot()
        const t0 = now()
        const steps = Math.round(seconds * config.sim.stepHz)
        sim.advanceTo(sim.step + steps, tl)
        const ms = now() - t0
        const floating = sim.floating()
        sim.restore(snap)
        return { ms, steps, floating }
      },
    },
  }
  return api
}
