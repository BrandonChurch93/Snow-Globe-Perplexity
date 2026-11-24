import { startApp } from './app/app'
import { createOverlay } from './app/overlay'
import { config } from './config'
import { createShowcase, type Showcase } from './capture/showcase'
import { Assets } from './core/assets'
import { createGfx } from './core/gl'
import { readParams } from './core/params'
import { isLevel, levelById, topLevel } from './core/quality'
import type { SdfGrid, Stage } from './core/stage'
import { SourceSwitch, type LoopParticles } from './film/loop'
import { httpStore, SimDriver } from './particles/driver'
import { ParticleEngine } from './particles/engine/engine'
import { LiveEngine, Padded } from './particles/engine/live'
import { LoopPaths } from './particles/engine/loop'
import { blockoutSdf, type Emitter } from './particles/engine/sdf'
import { createStage } from './scene/createStage'

declare global {
  interface Window {
    showcase: Showcase
  }
}

const params = readParams(location.search)
const canvas = document.getElementById('view') as HTMLCanvasElement
const capture = params.mode === 'capture'
const gfx = createGfx(canvas, { deny: params.deny, preserve: capture })
const assets = new Assets()
const ready = assets.init(params.assets).then(() => assets.loadGroup('shared'))
const named = isLevel(params.quality) ? levelById(params.quality) : null

const colliderOf = (stage: Stage) => (season: string): SdfGrid => stage.collider?.(season) ?? blockoutSdf()
const emittersOf = (stage: Stage): Record<string, Emitter[]> => Object.assign({}, ...config.seasons.map((s) => stage.emitters?.(s) ?? {}))

function lazyLoop(make: () => LoopPaths, pad: boolean): LoopParticles {
  let paths: LoopPaths | null = null
  const get = (): LoopPaths => (paths ??= make())
  const view = pad ? new Padded(get) : null
  return {
    get source() {
      return view ?? get()
    },
    setTime(seconds: number): void {
      get().setTime(seconds)
      view?.touch()
    },
  }
}

if (capture) {
  const fraction = named ? named.particleFraction : 1
  const sim = new ParticleEngine({ season: config.defaultSeason, fraction })
  const particles = new SourceSwitch(sim)
  const stage = createStage(gfx, particles, 16, 16)
  const collider = colliderOf(stage)
  const emitters = emittersOf(stage)
  sim.setCollider(collider, emitters)
  sim.reset()
  const loop = lazyLoop(() => LoopPaths.fromRest(config.defaultSeason, { fraction, collider, emitters }), false)
  document.body.style.overflow = 'auto'
  const store = params.simcache ? httpStore(new URL('__simcache', document.baseURI).href.replace(/\/$/, '')) : null
  const driver = new SimDriver(sim, store, __ENGINE_HASH__)
  const showcase = createShowcase({ gfx, stage, driver, assets, format: params.format, particles, loop, overlay: createOverlay(document.getElementById('ui')) }, ready)
  stage.resize(gfx.canvas.width, gfx.canvas.height)
  if (params.diag) showcase.setDiagnostic(params.diag)
  window.showcase = showcase
} else {
  const level = named ?? topLevel
  const sim = new LiveEngine({ season: params.season, fraction: level.particleFraction })
  const particles = new SourceSwitch(sim.source)
  const stage = createStage(gfx, particles, 16, 16)
  const collider = colliderOf(stage)
  const emitters = emittersOf(stage)
  sim.setCollider(collider, emitters)
  sim.reset(params.season)
  const setQuality = stage.setQuality?.bind(stage)
  if (setQuality) {
    stage.setQuality = (q) => {
      setQuality(q)
      sim.setFraction(q.particleFraction)
    }
  }
  const loop = lazyLoop(() => {
    const rest = new ParticleEngine({ season: config.defaultSeason, fraction: sim.active / sim.source.count, collider, emitters })
    rest.reset()
    return new LoopPaths(rest)
  }, true)
  startApp({ gfx, stage, sim, particles, loop, assets, params, ready })
}
