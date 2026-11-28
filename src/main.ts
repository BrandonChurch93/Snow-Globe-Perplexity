import { startApp } from './app/app'
import { ContextWatch } from './app/lost'
import { createOverlay } from './app/overlay'
import { config } from './config'
import { createShowcase, type Showcase } from './capture/showcase'
import { Assets } from './core/assets'
import { createGfx } from './core/gl'
import { meshLevelOf, setMeshLevel } from './core/models'
import { readParams } from './core/params'
import { isLevel, levelById, topLevel } from './core/quality'
import type { SdfGrid, Stage } from './core/stage'
import { SourceSwitch, type LoopParticles } from './film/loop'
import { httpStore, SimDriver } from './particles/driver'
import { ParticleEngine } from './particles/engine/engine'
import { Padded } from './particles/engine/live'
import { LoopPaths } from './particles/engine/loop'
import { LiveRunner, spawnEngineWorker } from './particles/engine/remote'
import type { Emitter } from './particles/engine/sdf'
import { createStage, MADE_ORDER } from './scene/createStage'

declare global {
  interface Window {
    showcase: Showcase
    liveSim?: LiveRunner
  }
}

/** The longest the app waits for the page's own first frame before it sets up: a page that is given no frames is not waited for. */
const PAGE_FRAME_MS = 100

const params = readParams(location.search)
const canvas = document.getElementById('view') as HTMLCanvasElement
const capture = params.mode === 'capture'
// The page paints a still of the season before any of this runs (index.html). On a load from the cache this script is at hand
// before the page's first frame, and setting up the graphics would hold that frame back: the page's frame goes first.
if (!capture && document.visibilityState === 'visible') {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => setTimeout(resolve, 0))
    setTimeout(resolve, PAGE_FRAME_MS)
  })
}
// A page that draws for a visitor answers a context the browser takes away (src/app/lost.ts) and does not ask the compiler
// what it said of a shader (src/core/gl.ts). A capture page is watched by its tool, which reads both.
const visitor = !capture
const context = visitor ? new ContextWatch(canvas) : null
const gfx = (() => {
  try {
    return createGfx(canvas, { deny: params.deny, preserve: capture, visitor })
  } catch (e) {
    const ui = document.getElementById('ui')
    if (!capture && ui) void import('./ui/cannot').then((m) => m.showCannot(ui))
    throw e
  }
})()
const assets = new Assets()
// The live page draws its first picture from what that picture needs and fetches the rest behind it (src/app/app.ts). Every other
// page waits for the whole set. `detail=first` holds any page at the first files: `npm run firstlook` measures what they cost with it.
assets.firstOnly = params.mode === 'live' || new URLSearchParams(location.search).get('detail') === 'first'
const ready = assets.init(params.assets, !capture).then(() => assets.loadGroup('shared'))
const named = isLevel(params.quality) ? levelById(params.quality) : null

/**
 * A stage that is told a quality level tells the models: the meshes of the web set have lighter lists of triangles for the
 * lower levels (src/core/models.ts). This holds on every page, so a picture the harness draws through the app's path at a
 * level draws what a visitor at that level gets. A page that is never told a level draws the full meshes.
 */
function levelled(stage: Stage): Stage {
  const set = stage.setQuality?.bind(stage)
  if (set)
    stage.setQuality = (q) => {
      set(q)
      setMeshLevel(meshLevelOf(q))
    }
  return stage
}

const colliderOf = (stage: Stage) => (season: string): SdfGrid => stage.collider(season)
const emittersOf = (stage: Stage): Record<string, Emitter[]> => Object.assign({}, ...config.seasons.map((s) => stage.emitters(s)))

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
  // The page keeps the canvas out of sight until the app has drawn its first picture (index.html). A capture page has no such
  // moment: its pictures are read as they are made, and a stage shot must find the canvas there.
  canvas.style.transition = 'none'
  canvas.style.opacity = '1'
  const fraction = named ? named.particleFraction : 1
  const sim = new ParticleEngine({ season: config.defaultSeason, fraction })
  const particles = new SourceSwitch(sim)
  const stage = levelled(createStage(gfx, particles, assets, MADE_ORDER))
  const collider = colliderOf(stage)
  const emitters = emittersOf(stage)
  sim.setCollider(collider, emitters)
  sim.reset()
  const loop = lazyLoop(() => LoopPaths.fromRest(config.defaultSeason, { fraction, collider, emitters }), false)
  document.body.style.overflow = 'auto'
  const store = params.simcache ? httpStore(new URL('__simcache', document.baseURI).href.replace(/\/$/, '')) : null
  const driver = new SimDriver(sim, store, __ENGINE_HASH__)
  const prepared = ready.then(() => Promise.all(config.seasons.map((s) => stage.prepare?.(s)))).then(() => undefined)
  const showcase = createShowcase({ gfx, stage, driver, assets, format: params.format, particles, loop, overlay: createOverlay(document.getElementById('ui')) }, prepared)
  stage.resize(gfx.canvas.width, gfx.canvas.height)
  if (params.diag) showcase.setDiagnostic(params.diag)
  window.showcase = showcase
} else {
  const level = named ?? topLevel
  const onWorker = params.mode === 'live' && new URLSearchParams(location.search).get('sim') !== 'main'
  const sim = new LiveRunner({ season: params.season, fraction: level.particleFraction, spawn: onWorker ? spawnEngineWorker : null })
  const particles = new SourceSwitch(sim.source)
  const stage = levelled(createStage(gfx, particles, assets))
  const collider = colliderOf(stage)
  const emitters = emittersOf(stage)
  sim.setCollider(collider, emitters)
  // A season's collider may read that season's models (spring's boulders come with its village), so the engine takes the
  // season the page opens on when the stage has prepared it, and a reset asked before then (a film's player resets the
  // engine as it starts) waits for it. The app asks for the same preparation and draws nothing before it.
  sim.hold()
  void ready
    .then(() => stage.prepare?.(params.season))
    .then(() => sim.release(params.season))
    .catch(() => undefined)
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
  if (params.diag) window.liveSim = sim
  startApp({ gfx, stage, sim, particles, loop, assets, params, ready, context })
}
