import { startApp } from './app/app'
import { createOverlay } from './app/overlay'
import { config } from './config'
import { createShowcase, type Showcase } from './capture/showcase'
import { Assets } from './core/assets'
import { createGfx } from './core/gl'
import { readParams } from './core/params'
import { SourceSwitch, standInLoop } from './film/loop'
import { httpStore, SimDriver } from './particles/driver'
import { GROUND_Y, INNER_R, SpikeSim } from './particles/spikeSim'
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
const sim = new SpikeSim(config.defaultSeason, 1)
const particles = new SourceSwitch(sim)
const loop = standInLoop(sim, INNER_R, GROUND_Y)
const stage = createStage(gfx, particles, 16, 16)
const ready = assets.init(params.assets).then(() => assets.loadGroup('shared'))

if (capture) {
  document.body.style.overflow = 'auto'
  const store = params.simcache ? httpStore(new URL('__simcache', document.baseURI).href.replace(/\/$/, '')) : null
  const driver = new SimDriver(sim, store, __ENGINE_HASH__)
  const showcase = createShowcase({ gfx, stage, driver, assets, format: params.format, particles, loop, overlay: createOverlay(document.getElementById('ui')) }, ready)
  stage.resize(gfx.canvas.width, gfx.canvas.height)
  if (params.diag) showcase.setDiagnostic(params.diag)
  window.showcase = showcase
} else {
  startApp({ gfx, stage, sim, particles, loop, assets, params, ready })
}
