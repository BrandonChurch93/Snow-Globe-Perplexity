import { config, formatById, tierSamples, type FormatSpec } from '../config'
import { Accumulator } from '../core/accumulator'
import type { Assets } from '../core/assets'
import { finish, type Gfx } from '../core/gl'
import { sampleSet, type Sample } from '../core/sampler'
import type { Moment, Stage } from '../core/stage'
import { barSeconds, beatSeconds, filmTimeline, globePoseAt, prerollSeconds, seasonAt, stateSeconds, stillTimeline, type Timeline } from '../film/timeline'
import type { SimDriver } from '../particles/driver'
import { Post } from '../post/post'
import { poseById, type Pose } from '../scene/cameras'
import { framingOf, type Framing } from '../scene/framing'
import { judgedList, loopPlan, type JudgedEntry } from '../film/judged'
import { partChange, SEASONAL_PARTS } from '../shake/change'
import { sampleSdf } from '../core/sdf'
import { INNER_R } from '../particles/engine/sdf'
import { openingPlan } from '../film/opening'
import { drawOpening } from '../film/openingStandIn'
import { cutList, filmCut, type Cut } from '../film/cut'
import { cameraKeys, cameraNumbers, filmPose, loopCamera, loopPose, MOVES, shotNotes, type ShotNote } from '../film/moves'
import { loopGlobe, type LoopParticles, type SourceSwitch } from '../film/loop'
import { loopMoment, timelineMoment } from '../film/moments'
import { flaggedStandIns } from '../core/standins'
import { levelById, stageQuality, topLevel } from '../core/quality'
import { livePose, roomUnder } from '../app/framing'
import { Painter } from '../app/painter'
import { Replay, scriptPlan, type ScriptFrame, type ScriptPlan } from '../app/replay'
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
  filmState(frameIndex: number): FilmState
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
  framing(camera: string): Framing
  pose(camera: string): number[]
  judged(): JudgedEntry[]
  testShake(): { frameCount: number; first: number; liftEnd: number; strokesEnd: number; landing: number; swap: { first: number; last: number } }
  testShakeState(frameIndex: number): FilmState
  loopState(frameIndex: number): FilmState
  loopPlan(): { frameCount: number; shake: { first: number; liftEnd: number; strokesEnd: number; landing: number } }
  openingPlan(): { frameCount: number; typing: { first: number; last: number }; reasoning: { first: number; open: number; choose: number; last: number }; send: number; build: { first: number; last: number }; steps: number[]; keyTaps: number[] }
  sanity(): { invalid: number; pixels: number }
  inside(): { inside: number; outside: number; total: number }
  simcache(what: 'film' | 'stills' | 'loop', budgetSeconds?: number, fromSeconds?: number): Promise<{ checkpoints: number; simulatedSeconds: number; ms: number; done: boolean; totalSeconds: number }>
  flagged(): string[]
  cut(): { list: Record<string, unknown>; shots: ShotNote[] }
  renderTestShakeFrame(frameIndex: number, tier: string): Promise<void>
  renderShakeMoment(shot: string, at: ShakeMoment, tier: string): Promise<void>
  appScript(name: string, ask?: AppFrameAsk): ScriptPlan
  renderAppFrame(name: string, frameIndex: number, level: string, ask?: AppFrameAsk): Promise<ScriptFrame & { camera: number[]; globe: { heightMm: number; tiltDeg: number[] }; level: string }>
  interfaceState(state: string, ask?: InterfaceAsk): Promise<InterfaceRecord>
}

export type ShakeMoment = 'swap' | 'landing' | 'landed' | 'settle'

export interface FilmState {
  camera: number[]
  shot: string
  season: string
  globe: { heightMm: number; tiltDeg: number[] }
  change: Record<string, number>
  cover: number | null
}

interface Register {
  parts: { name: string; unit: string; state: string }[]
}

const DEG = 180 / Math.PI

export interface InterfaceAsk {
  control?: string
  phase?: number
  season?: string
}

export interface InterfaceRecord {
  state: string
  control: string
  season: string
  target: string | null
  phase: number | null
  rect: number[] | null
  at: number[] | null
  focusVisible: boolean
  paused: number
  shown: boolean
}

export interface AppFrameAsk {
  from?: string
  to?: string
}

export interface Overlay {
  show(season: string, state: string): Promise<void>
  put(state: string, ask: InterfaceAsk): Promise<InterfaceRecord>
  hide(): void
  controlsPx(): number | null
}

export interface Deps {
  gfx: Gfx
  stage: Stage
  driver: SimDriver
  assets: Assets
  format: string
  particles: SourceSwitch
  loop: LoopParticles
  overlay: Overlay
}

type At = (t: number, seed: number) => Promise<Moment>

export function createShowcase(deps: Deps, ready: Promise<void>): Showcase {
  const { gfx, stage, driver, assets, particles, loop, overlay } = deps
  const post = new Post(gfx)
  const painter = new Painter(gfx, stage)
  const app = document.getElementById('app')
  const opening = document.getElementById('opening')
  let format: FormatSpec = formatById(deps.format)
  let acc = new Accumulator(gfx, format.width, format.height)
  let tier = 'draft'
  let diag = ''
  let lastSeason: string = config.defaultSeason
  let filmTl: Timeline | null = null
  const stills = new Map<string, Timeline>()
  const timing = { simMs: 0, drawMs: 0, samples: 0, steps: 0 }
  const counts = { triangles: 0, drawCalls: 0, particles: 0 }
  const now = () => performance.now()

  const size = () => {
    gfx.renderer.setSize(format.width, format.height, false)
    gfx.canvas.style.width = `${format.width}px`
    gfx.canvas.style.height = `${format.height}px`
    if (app) {
      app.style.width = `${format.width}px`
      app.style.height = `${format.height}px`
    }
  }
  size()

  const getGrid = (): Cut => filmCut()
  const getFilm = () => (filmTl ??= filmTimeline(getGrid()))
  const stillTl = (season: string) => {
    let t = stills.get(season)
    if (!t) stills.set(season, (t = stillTimeline(season)))
    return t
  }

  let replay: { key: string; run: Replay } | null = null
  const apart: Timeline = { id: 'replay', startSeason: config.defaultSeason, events: [] }
  const plain = () => {
    replay = null
    if (opening) opening.hidden = true
    overlay.hide()
  }

  const along = (tl: Timeline): At => async (t, seed) => {
    particles.use(null)
    const before = driver.replayed
    const mix = await driver.seek(tl, t)
    timing.steps += driver.replayed - before
    lastSeason = seasonAt(tl, t).season
    return timelineMoment(tl, t, mix, seed)
  }

  const around: At = async (t, seed) => {
    loop.setTime(t)
    particles.use(loop.source)
    lastSeason = config.defaultSeason
    return loopMoment(config.defaultSeason, t, seed)
  }

  const count = (done: number) => {
    const info = gfx.renderer.info
    counts.triangles = Math.round(info.render.triangles / Math.max(1, done))
    counts.drawCalls = Math.round(info.render.calls / Math.max(1, done))
    counts.particles = stage.particleCount()
  }

  async function picture(at: At, timeSec: number, shutterSec: number, pose: (t: number) => Pose, samples: number, salt: number): Promise<void> {
    plain()
    const flat = diag !== ''
    const set: (Sample | null)[] = flat ? [null] : sampleSet(samples, salt, 'picture').sort((a, b) => a.t - b.t)
    gfx.renderer.info.reset()
    acc.begin()
    let done = 0
    for (const s of set) {
      const t = timeSec + (s && shutterSec > 0 ? s.t * shutterSec : 0)
      const t0 = now()
      const moment = await at(t, salt * 0.618 + 1)
      const t1 = now()
      timing.simMs += t1 - t0
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
    count(done)
  }

  async function livePicture(at: At, timeSec: number, pose: Pose, level: string): Promise<void> {
    plain()
    const q = levelById(level)
    stage.setQuality?.(stageQuality(q))
    gfx.renderer.info.reset()
    const t0 = now()
    const moment = await at(timeSec, 1)
    const t1 = now()
    timing.simMs += t1 - t0
    painter.size(format.width, format.height)
    painter.flat = diag !== ''
    painter.paint(pose, moment)
    finish(gfx)
    timing.drawMs += now() - t1
    timing.samples++
    count(1)
    stage.setQuality?.(stageQuality(topLevel))
  }

  const frameTime = (i: number) => prerollSeconds + i / config.film.fps
  const shutter = config.film.shutterDegrees / 360 / config.film.fps
  const spanAt = (i: number) => {
    const g = getGrid()
    const c = Math.max(0, Math.min(g.frameCount - 1, i))
    return g.spans.find((s) => c >= s.first && c <= s.last)!
  }
  const filmCamera = (t: number) => filmPose(getGrid(), t - prerollSeconds)
  const hero = () => poseById('hero')
  const loopFrames = () => loopPlan().frameCount
  const wrapFrame = (i: number) => ((i % loopFrames()) + loopFrames()) % loopFrames()

  const stateOf = (tl: Timeline, t: number, shot: string, p: Pose): FilmState => {
    const at = seasonAt(tl, t)
    const g = globePoseAt(tl, t)
    const change: Record<string, number> = {}
    for (const part of SEASONAL_PARTS) change[part] = partChange(part, at.change)
    return {
      camera: cameraNumbers(p),
      shot,
      season: at.season,
      globe: { heightMm: g.y, tiltDeg: [g.tiltX * DEG, g.tiltZ * DEG] },
      change,
      cover: null,
    }
  }
  const fpsFilm = config.film.fps
  const perBeat = beatSeconds * fpsFilm

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
        await picture(along(getFilm()), frameTime(i), shutter, hero, samples, i + 1)
        return
      }
      const onScreen = (spec.interface || !!spec.live) && spec.camera === MOVES.wide
      let under = 0
      if (onScreen && spec.interface) {
        await overlay.show(spec.season, spec.state)
        under = roomUnder(format.height, overlay.controlsPx())
      }
      const pose = onScreen ? livePose(format.width / format.height, 0, 0, under) : poseById(spec.camera)
      if (spec.live) await livePicture(along(stillTl(spec.season)), stateSeconds(spec.state), pose, spec.live)
      else await picture(along(stillTl(spec.season)), stateSeconds(spec.state), 0, () => pose, samples, 0)
      if (spec.interface) await overlay.show(spec.season, spec.state)
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
      return stateOf(getFilm(), frameTime(i), spanAt(i).shot.id, filmCamera(frameTime(i)))
    },
    async renderFilmFrame(i, t) {
      await ready
      tier = t
      await picture(along(getFilm()), frameTime(i), shutter, filmCamera, tierSamples(t), i + 1)
    },
    opening() {
      return { frameCount: openingPlan().frameCount }
    },
    async renderOpeningFrame(i) {
      plain()
      if (!opening) throw new Error('the page has no #opening')
      drawOpening(opening, i)
      opening.hidden = false
    },
    loop() {
      return { frameCount: loopFrames() }
    },
    async renderLoopFrame(i, t) {
      await ready
      tier = t
      const w = wrapFrame(i)
      await picture(around, w / fpsFilm, shutter, loopPose, tierSamples(t), 100000 + w)
    },
    dev: {
      caps: () => ({ ...gfx.caps, precision: acc.precision }),
      timings: () => ({ ...timing }),
      parts: () => stage.parts(),
      framing: (camera) => framingOf(camera, format.width, format.height),
      pose: (camera) => cameraNumbers(poseById(camera)),
      flagged: () => flaggedStandIns(),
      cut: () => ({ list: cutList(getGrid(), cameraKeys(getGrid()), loopCamera()), shots: shotNotes(getGrid()) }),
      judged: () => judgedList(getGrid(), openingPlan()),
      testShake: () => ({
        frameCount: Math.round((barSeconds + config.states.restSeconds) * fpsFilm),
        first: 0,
        liftEnd: Math.round(config.shake.liftBeats * perBeat),
        strokesEnd: Math.round((config.shake.liftBeats + config.shake.strokeBeats) * perBeat),
        landing: Math.round(barSeconds * fpsFilm),
        swap: { first: Math.round(config.shake.swapWindow.fromBeat * perBeat), last: Math.round(config.shake.swapWindow.toBeat * perBeat) - 1 },
      }),
      testShakeState: (i) => stateOf(stillTl(config.lookLockUnit), i / fpsFilm, 'test', poseById('hero')),
      loopState: (i) => {
        const t = wrapFrame(i) / fpsFilm
        const g = loopGlobe(t)
        const change: Record<string, number> = {}
        for (const part of SEASONAL_PARTS) change[part] = partChange(part, 0)
        return { camera: cameraNumbers(loopPose(t)), shot: 'loop', season: config.defaultSeason, globe: { heightMm: g.y, tiltDeg: [g.tiltX * DEG, g.tiltZ * DEG] }, change, cover: null }
      },
      loopPlan: () => loopPlan(),
      openingPlan: () => openingPlan(),
      sanity: () => acc.invalid(),
      inside: () => {
        const sim = particles
        const grid = stage.collider ? stage.collider(lastSeason) : null
        let inside = 0
        let outside = 0
        const lim = (INNER_R + 0.05) * (INNER_R + 0.05)
        for (let i = 0; i < sim.count; i++) {
          const x = sim.pos[i * 3]!
          const y = sim.pos[i * 3 + 1]!
          const z = sim.pos[i * 3 + 2]!
          if (x * x + y * y + z * z > lim) outside++
          else if (grid && sampleSdf(grid, x, y, z) < -0.05) inside++
        }
        return { inside, outside, total: sim.count }
      },
      appScript: (name, ask = {}) => scriptPlan(name, ask.from, ask.to),
      async renderAppFrame(name, frameIndex, level, ask = {}) {
        await ready
        const plan = scriptPlan(name, ask.from, ask.to)
        const q = levelById(level)
        const key = [plan.name, plan.from, plan.to, format.id].join(':')
        const index = Math.max(0, Math.min(plan.frameCount - 1, Math.round(frameIndex)))
        const had = replay
        plain()
        particles.use(null)
        if (had && had.key === key && index >= had.run.frame) replay = had
        else {
          await driver.seek(apart, 1 / config.sim.stepHz)
          replay = { key, run: new Replay(driver.sim, plan, format.width / format.height) }
        }
        const run = replay.run
        run.advanceTo(index)
        lastSeason = run.session.season
        const pose = run.pose(roomUnder(format.height))
        const moment = run.moment()
        stage.setQuality?.(stageQuality(q))
        gfx.renderer.info.reset()
        painter.size(format.width, format.height)
        painter.flat = diag !== ''
        painter.paint(pose, moment)
        finish(gfx)
        count(1)
        stage.setQuality?.(stageQuality(topLevel))
        const g = moment.globe
        return { ...run.record(), camera: cameraNumbers(pose), globe: { heightMm: g.y, tiltDeg: [g.tiltX * DEG, g.tiltZ * DEG] }, level: q.id }
      },
      async interfaceState(state, ask = {}) {
        await ready
        return overlay.put(state, ask)
      },
      async simcache(what, budgetSeconds = Infinity, fromSeconds = 0) {
        replay = null
        const t0 = now()
        const every = config.sim.checkpointSeconds
        const longest = Math.max(...Object.keys(config.states).map((k) => stateSeconds(k.replace(/Seconds$/, ''))))
        const runs: { tl: Timeline; seconds: number }[] =
          what === 'film' ? [{ tl: getFilm(), seconds: frameTime(getGrid().frameCount) }] : what === 'stills' ? config.seasons.map((season) => ({ tl: stillTl(season), seconds: longest })) : []
        const totalSeconds = runs.reduce((n, r) => n + r.seconds, 0)
        let checkpoints = 0
        let reached = 0
        let base = 0
        particles.use(null)
        for (const run of runs) {
          for (let t = every; t < run.seconds + every; t += every) {
            const to = Math.min(t, run.seconds)
            if (base + to <= fromSeconds) continue
            if (now() - t0 > budgetSeconds * 1000) return { checkpoints, simulatedSeconds: reached, ms: now() - t0, done: false, totalSeconds }
            await driver.seek(run.tl, to)
            checkpoints++
            reached = base + to
          }
          base += run.seconds
        }
        return { checkpoints, simulatedSeconds: totalSeconds, ms: now() - t0, done: true, totalSeconds }
      },
      async renderTestShakeFrame(i, t) {
        await ready
        tier = t
        await picture(along(stillTl(config.lookLockUnit)), i / fpsFilm, shutter, hero, tierSamples(t), 200000 + i)
      },
      async renderShakeMoment(shot, at, t) {
        await ready
        tier = t
        const w = config.shake.swapWindow
        const offset = (bar: number) =>
          at === 'swap' ? ((w.fromBeat + w.toBeat) / 2) * (bar / config.film.beatsPerBar) : at === 'landing' ? bar : at === 'landed' ? bar + config.states.landedSeconds : bar + config.shake.settleCheckSeconds
        if (shot === 'test') {
          const o = offset(barSeconds)
          await picture(along(stillTl(config.lookLockUnit)), o, shutter, hero, tierSamples(t), 300000 + Math.round(o * fpsFilm))
          return
        }
        const span = getGrid().spans.find((s) => s.shot.id === shot)
        if (!span || span.shot.kind !== 'shake') throw new Error(`no such shake: ${shot}`)
        const i = span.first + Math.round(offset(span.seconds) * fpsFilm)
        await picture(along(getFilm()), frameTime(i), shutter, hero, tierSamples(t), i + 1)
      },
      async simulate(fromSeconds, seconds) {
        replay = null
        const tl = stillTl(config.defaultSeason)
        particles.use(null)
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
