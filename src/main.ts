import * as THREE from 'three'
import { config } from './config'
import { createShowcase, type Showcase } from './capture/showcase'
import { Assets } from './core/assets'
import { createGfx } from './core/gl'
import { readParams } from './core/params'
import { barSeconds, defaultGrid, filmTimeline, globePoseAt, lastLandingBefore, prerollSeconds, seasonAt, type Timeline } from './film/timeline'
import { httpStore, SimDriver } from './particles/driver'
import { SpikeSim } from './particles/spikeSim'
import { Post } from './post/post'
import { poseOf } from './scene/cameras'
import { SpikeStage } from './scene/spike'
import { makeShake } from './shake/table'

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
const format = capture ? params.format : config.formats.hd.id
const stage = new SpikeStage(gfx, sim, 16, 16)
const store = capture && params.simcache ? httpStore(new URL('__simcache', document.baseURI).href.replace(/\/$/, '')) : null
const driver = new SimDriver(sim, store, __ENGINE_HASH__)
const ready = assets.init(params.assets).then(() => assets.loadGroup('shared'))

if (capture) {
  document.body.style.overflow = 'auto'
  const showcase = createShowcase({ gfx, stage, driver, assets, format }, ready)
  stage.resize(gfx.canvas.width, gfx.canvas.height)
  if (params.diag) showcase.setDiagnostic(params.diag)
  window.showcase = showcase
} else {
  void ready.then(() => play())
}

function play(): void {
  const post = new Post(gfx)
  const hz = config.sim.stepHz
  const film = params.mode === 'autopilot'
  const loop = params.mode === 'loop'
  const grid = defaultGrid()
  const tl: Timeline = film ? filmTimeline(grid) : { id: 'live', startSeason: params.season, events: [] }
  let target: THREE.WebGLRenderTarget | null = null
  let yaw = config.cameras.hero.yawDeg
  let pitch = config.cameras.hero.pitchDeg
  let clock = 0
  let last = 0
  let dragging = false
  let moved = 0
  let px = 0
  let py = 0
  let shakes = 0
  const L = config.live

  const shake = () => {
    if (film || loop) return
    const busy = tl.events.some((e) => clock < e.startSec + barSeconds)
    if (busy) return
    const from = seasonAt(tl, clock).season
    const to = config.seasons[(config.seasons.indexOf(from) + 1) % config.seasons.length]!
    tl.events.push({ id: `live-${shakes}`, startSec: clock + 1 / hz, from, to, path: makeShake(`live-${shakes++}`) })
  }

  if (!film) {
    canvas.style.touchAction = 'none'
    canvas.addEventListener('pointerdown', (e) => {
      dragging = true
      moved = 0
      px = e.clientX
      py = e.clientY
      canvas.setPointerCapture(e.pointerId)
    })
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return
      const dx = e.clientX - px
      const dy = e.clientY - py
      px = e.clientX
      py = e.clientY
      moved += Math.abs(dx) + Math.abs(dy)
      yaw = Math.max(-L.orbitYawDeg, Math.min(L.orbitYawDeg, yaw - dx * 0.25))
      pitch = Math.max(L.orbitPitchMinDeg, Math.min(L.orbitPitchMaxDeg, pitch + dy * 0.18))
    })
    const up = () => {
      if (dragging && moved < 6) shake()
      dragging = false
    }
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', () => (dragging = false))
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        shake()
      }
    })
    if (!loop) tl.events.push({ id: 'arrive', startSec: 0, from: params.season, to: params.season, path: makeShake('arrive') })
  } else {
    clock = prerollSeconds
    sim.reset()
  }

  const fit = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
    const w = Math.max(2, Math.round(window.innerWidth * ratio))
    const h = Math.max(2, Math.round(window.innerHeight * ratio))
    if (target && target.width === w && target.height === h) return
    gfx.renderer.setSize(w, h, false)
    canvas.style.width = '100vw'
    canvas.style.height = '100vh'
    canvas.style.display = 'block'
    target?.dispose()
    target = new THREE.WebGLRenderTarget(w, h, {
      type: gfx.caps.half ? THREE.HalfFloatType : THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    })
    stage.resize(w, h)
  }
  window.addEventListener('resize', fit)
  fit()

  const tick = (ms: number) => {
    requestAnimationFrame(tick)
    const dt = Math.min(0.1, last ? (ms - last) / 1000 : 0)
    last = ms
    clock += dt
    if (film && clock > prerollSeconds + grid.frameCount / config.film.fps) {
      clock = prerollSeconds
      sim.reset()
    }
    const want = Math.ceil(clock * hz)
    sim.advanceTo(want, tl)
    const aspect = target!.width / target!.height
    const wide = aspect >= 1
    const hero = config.cameras.hero
    const pose = poseOf({ ...hero, yawDeg: yaw, pitchDeg: pitch, distanceMm: wide ? hero.distanceMm : hero.distanceMm / Math.max(0.45, aspect) }, { apertureMm: 0, focusShiftMm: 0 })
    const at = seasonAt(tl, clock)
    stage.drawSample(target!, pose, null, { ...at, sinceLanding: clock - lastLandingBefore(tl, clock), globe: globePoseAt(tl, clock), mix: 1, seed: (clock * 60) % 97 }, true)
    post.resolve(target!.texture)
  }
  requestAnimationFrame(tick)
}
