import { config, formatById } from '../config'
import type { Assets } from '../core/assets'
import type { AppBridge, AppState, SoundEngine } from '../core/bridge'
import type { Gfx } from '../core/gl'
import type { Params } from '../core/params'
import { loadDetail } from '../core/textures'
import { Governor, levels, stageQuality } from '../core/quality'
import type { Moment, Stage } from '../core/stage'
import type { LoopParticles, SourceSwitch } from '../film/loop'
import { drawOpening } from '../film/openingStandIn'
import { barSeconds } from '../film/timeline'
import type { Pose } from '../scene/cameras'
import { FRAME, controlsPx, framingOfRig, livePose, liveRig, roomUnder } from './framing'
import { Drag, Look, MotionShake, stirAxis, type Stir } from './gestures'
import { audioBase, audioIndex, audioShips, loadAudio, loadInterface, loadProbe } from './mounts'
import { Painter } from './painter'
import { Autopilot, LoopPlayer } from './players'
import { createProbe } from './probe'
import { LiveSession, SeasonLoader, type LiveSim } from './session'

export interface AppDeps {
  gfx: Gfx
  stage: Stage
  sim: LiveSim
  particles: SourceSwitch
  loop: LoopParticles
  assets: Assets
  params: Params
  ready: Promise<void>
}

type Playing = AppState['playing']

const SOUND_ON_AT_START = true
const STEP_BUDGET_MS = (0.7 * 1000) / Math.min(...levels.map((l) => l.minFps))
const STEP_SHARE = 0.4
const SKIP_BUDGET_MS = 14
const FILMS: Playing[] = ['film-a', 'film-b']
const MEASURE_EVERY = 20
const CONTROL = 'button, a[href], input, select, textarea, summary, [role="button"], [contenteditable=""], [contenteditable="true"]'

export function startApp(d: AppDeps): AppBridge {
  const { gfx, stage, sim, params } = d
  const doc = document.documentElement
  doc.dataset.audio = 'none'
  const canvas = gfx.canvas
  const app = document.getElementById('app') ?? document.body
  const ui = document.getElementById('ui')
  const opening = document.getElementById('opening')
  const painter = new Painter(gfx, stage)
  const governor = new Governor(params.quality)
  const look = new Look()
  const drag = new Drag(look)
  const motion = new MotionShake()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
  const screen = formatById(params.format)
  const probing = params.mode === 'probe'
  const fns = new Set<(s: AppState) => void>()
  const now = (): number => performance.now()
  let markFirst: () => void = () => undefined
  const afterFirstPicture = new Promise<void>((resolve) => (markFirst = resolve))

  let playing: Playing = params.mode === 'autopilot' ? (params.which === 'a' ? 'film-a' : 'film-b') : params.mode === 'loop' ? 'loop' : 'live'

  // Loading. With `assets.firstOnly` (the live page) the first picture is drawn from what it needs: the models, the small pictures
  // and the `.first.` file of every large one. The whole pictures follow as soon as it is drawn, then the other seasons, one at a
  // time, with their whole pictures at once. A season the visitor asks for before its turn starts at once, from its first files.
  const progressive = d.assets.firstOnly
  const detail = (): Promise<void> => loadDetail(d.assets).catch(() => undefined)
  const loader = new SeasonLoader(
    params.season,
    (season, asked) =>
      d.ready.then(() => {
        d.assets.firstOnly = progressive && asked
        return d.stage.prepare?.(season) ?? d.assets.loadGroup(season)
      }),
    () => void (ready && detail()),
    progressive ? afterFirstPicture.then(detail) : Promise.resolve(),
  )
  if (progressive) void afterFirstPicture.then(() => (doc.dataset.detail = 'loading')).then(() => loader.all).then(detail).then(() => (doc.dataset.detail = 'ready'))
  let session = new LiveSession(sim, params.season, loader.ready)
  let autopilot: Autopilot | null = null
  let looping: LoopPlayer | null = null
  let ready = false
  let diagnostic = ''
  let engine: SoundEngine | null = null
  let soundAvailable = audioShips
  let soundOn = SOUND_ON_AT_START
  let track: HTMLAudioElement | null = null
  let sent = ''
  let last: number | null = null
  let count = 0
  let drawn = 0
  let openingFrame = -1
  let restarts = 0
  let box = ''
  let pointer = -1
  let asked = false
  let onFrame: ((seconds: number) => void) | null = null
  let told = params.season
  let stepMs = 0
  let budget = STEP_BUDGET_MS
  let bar: number | null = null
  let room = -1
  let roomFor = ''

  const state = (): AppState => ({
    ready,
    season: session.season,
    target: session.target,
    busy: playing === 'live' && session.busy,
    quality: governor.level.id,
    auto: governor.auto,
    soundAvailable,
    soundOn: soundAvailable && soundOn,
    reducedMotion: session.reduced,
    diagnostic,
    state: playing === 'live' ? session.stateName : '',
    playing,
  })

  const tell = (): void => {
    const s = state()
    const key = JSON.stringify(s)
    if (key === sent) return
    sent = key
    for (const fn of [...fns]) fn(s)
  }

  const applyLevel = (): void => {
    stage.setQuality?.(stageQuality(governor.level))
    governor.rest()
  }

  const fit = (): void => {
    const w = app.clientWidth || window.innerWidth
    const h = app.clientHeight || window.innerHeight
    let cw = w
    let ch = h
    let ratio = Math.min(window.devicePixelRatio || 1, governor.level.pixelRatioCap)
    if (playing !== 'live') {
      const aspect = screen.width / screen.height
      cw = Math.min(w, h * aspect)
      ch = cw / aspect
      ratio = Math.min(ratio, screen.width / cw)
    }
    const next = `${cw}:${ch}:${w}:${h}`
    if (next !== box) {
      box = next
      for (const el of [canvas, opening]) {
        if (!el) continue
        el.style.position = 'absolute'
        el.style.inset = 'auto'
        el.style.left = `${(w - cw) / 2}px`
        el.style.top = `${(h - ch) / 2}px`
        el.style.width = `${cw}px`
        el.style.height = `${ch}px`
      }
    }
    if (painter.size(cw * ratio, ch * ratio)) governor.rest()
  }

  const under = (dt: number): number => {
    if (playing !== 'live') return 0
    const h = app.clientHeight || window.innerHeight
    if (count % MEASURE_EVERY === 0 && ui?.dataset.interface === 'shown' && !session.busy) bar = controlsPx(ui, app) ?? bar
    const want = roomUnder(h, bar, app.clientWidth || window.innerWidth)
    const size = `${app.clientWidth}:${h}`
    if (room < 0 || size !== roomFor) room = want
    else if (!session.busy) room += (want - room) * (1 - Math.exp(-dt * FRAME.easeRate))
    roomFor = size
    return room
  }

  const muted = (): boolean => !soundOn || playing !== 'live'

  const unlock = (): void => {
    const active = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
    if (active && !active.hasBeenActive) return
    if (engine?.available()) void engine.unlock()
    if (track && track.paused && soundOn && FILMS.includes(playing)) startTrack()
  }

  const startTrack = (): void => {
    if (!track || !autopilot) return
    const t = Math.max(0, autopilot.seconds + (playing === 'film-a' ? autopilot.lead : 0))
    try {
      track.currentTime = t
    } catch {
      return
    }
    track.muted = !soundOn
    void track.play().catch(() => undefined)
  }

  const stopTrack = (): void => {
    track?.pause()
    track = null
  }

  const filmSound = (): void => {
    stopTrack()
    const entry = audioIndex && (audioIndex.loops[playing] ?? audioIndex.sprites[playing])
    if (!entry || !FILMS.includes(playing) || params.shot) return
    track = new Audio(audioBase() + entry.file)
    track.preload = 'auto'
    void afterFirstPicture.then(startTrack)
  }

  const start = (what: Playing): void => {
    playing = what
    autopilot = null
    looping = null
    d.particles.use(null)
    if (opening) opening.hidden = true
    openingFrame = -1
    look.yaw = 0
    look.pitch = 0
    box = ''
    room = -1
    if (what === 'live') {
      const season = session.season
      sim.reset()
      session = new LiveSession(sim, season, loader.ready)
      session.reduced = reduce.matches
    } else if (what === 'loop') looping = new LoopPlayer(d.particles, d.loop, session.season)
    else autopilot = new Autopilot(sim, what === 'film-a', params.shot)
    restarts = autopilot?.restarts ?? 0
    engine?.setMuted(muted())
    filmSound()
    governor.rest()
  }

  const shake = (to: string | null): boolean => {
    if (playing !== 'live' || !ready) return false
    const season = to === null ? session.shake() : session.goTo(to)
    if (!season) return false
    if (!loader.ready(season)) void loader.want(season).catch(() => undefined)
    told = season
    if (session.reduced) engine?.setSeason(season)
    else engine?.shake(season, barSeconds)
    tell()
    return true
  }

  const stir = (s: Stir | null): void => {
    if (!s || playing !== 'live') return
    const aspect = painter.width / Math.max(1, painter.height)
    sim.stir?.(...stirAxis(s, liveRig(aspect, look.yaw, look.pitch).yawDeg))
    if (s.begins) engine?.stir(s.force)
  }

  const onMotion = (e: DeviceMotionEvent): void => {
    const own = e.acceleration
    const all = e.accelerationIncludingGravity
    const a = own && own.x !== null ? own : all
    if (!a || a.x === null) return
    if (motion.feed(a.x ?? 0, a.y ?? 0, a.z ?? 0, e.timeStamp / 1000, a !== own)) shake(null)
  }

  const askMotion = (): void => {
    if (asked) return
    asked = true
    const source = (window as Window & { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent
    if (!source || typeof source.requestPermission !== 'function') return
    source
      .requestPermission()
      .then((answer) => {
        if (answer === 'granted') window.addEventListener('devicemotion', onMotion)
      })
      .catch(() => undefined)
  }

  const bridge: AppBridge = {
    state,
    subscribe(fn) {
      fns.add(fn)
      return () => {
        fns.delete(fn)
      }
    },
    shake() {
      if (shake(null)) engine?.tick()
    },
    goTo(season) {
      if (shake(season)) engine?.tick()
    },
    setSound(on) {
      soundOn = on
      if (engine?.available()) {
        void engine.unlock()
        engine.setMuted(muted())
        if (on) engine.chime()
        else engine.tick()
      }
      if (track) {
        track.muted = !on
        if (on && track.paused) startTrack()
      }
      tell()
    },
    setQuality(level) {
      governor.fix(level)
      applyLevel()
      engine?.tick()
      tell()
    },
    setSeason(season) {
      if (!config.seasons.includes(season)) return
      session.jump(season)
      if (looping) looping = new LoopPlayer(d.particles, d.loop, season)
      told = season
      engine?.setSeason(season, true)
      engine?.tick()
      tell()
    },
    setState(name) {
      if (playing !== 'live') return
      session.setState(name)
      engine?.tick()
      tell()
    },
    setDiagnostic(view) {
      diagnostic = view === 'none' ? '' : view
      stage.setDiagnostic(diagnostic)
      painter.flat = diagnostic !== ''
      engine?.tick()
      tell()
    },
    play(what) {
      const go = (): void => {
        start(what)
        engine?.tick()
        tell()
      }
      if (FILMS.includes(what) && !config.seasons.every(loader.ready)) void loader.all.then(go)
      else go()
    },
    activity: () => undefined,
  }

  const frame = (ms: number): void => {
    requestAnimationFrame(frame)
    const dt = last === null ? 0 : Math.max(0, (ms - last) / 1000)
    last = ms
    fit()
    const seed = 1 + (count++ % 600) * 0.618
    let pose: Pose
    let moment: Moment
    if (autopilot) {
      const f = autopilot.frame(dt, seed)
      if (autopilot.restarts !== restarts) {
        restarts = autopilot.restarts
        if (track) startTrack()
      }
      if (opening) {
        if (f.opening === null) opening.hidden = true
        else if (f.opening !== openingFrame) {
          drawOpening(opening, f.opening)
          opening.hidden = false
        }
      }
      openingFrame = f.opening ?? -1
      pose = f.pose
      moment = f.moment
    } else if (looping) {
      const f = looping.frame(dt, seed)
      pose = f.pose
      moment = f.moment
    } else {
      const t0 = now()
      const wasBusy = session.busy
      const wasShaking = session.shaking !== null
      let mix = 1
      budget = Math.max(STEP_BUDGET_MS, STEP_SHARE * (dt * 1000 - stepMs))
      if (session.skipping) session.skip(() => now() - t0, SKIP_BUDGET_MS)
      else mix = session.tick(dt, () => now() - t0 > budget)
      stepMs = now() - t0
      look.tick(dt)
      if (session.shaking?.holdBeats) engine?.shake(told, Number.POSITIVE_INFINITY)
      if (wasShaking && !session.shaking) engine?.setSeason((told = session.season))
      if (wasBusy && !session.busy) {
        governor.rest()
        if (told !== session.season) engine?.setSeason((told = session.season))
      }
      moment = session.moment(mix, seed)
      pose = livePose(painter.width / Math.max(1, painter.height), look.yaw, look.pitch, under(dt), moment)
    }
    painter.paint(pose, moment)
    drawn++
    if (drawn === 2) {
      ready = true
      doc.dataset.firstPicture = '1'
      markFirst()
      governor.rest()
    } else if (ready && dt > 0) {
      onFrame?.(dt)
      if (!session.skipping && governor.frame(dt)) applyLevel()
    }
    tell()
  }

  canvas.style.touchAction = 'none'
  canvas.addEventListener('pointerdown', (e) => {
    if (playing !== 'live' || !e.isPrimary || e.button !== 0) return
    pointer = e.pointerId
    canvas.setPointerCapture(e.pointerId)
    drag.down(e.clientX, e.clientY, e.timeStamp / 1000, Math.min(app.clientWidth, app.clientHeight))
  })
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer) return
    const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : []
    for (const c of events.length ? events : [e]) stir(drag.move(c.clientX, c.clientY, c.timeStamp / 1000))
  })
  const release = (e: PointerEvent): void => {
    if (e.pointerId !== pointer) return
    pointer = -1
    drag.up()
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)
  canvas.addEventListener('lostpointercapture', release)

  window.addEventListener('keydown', (e) => {
    unlock()
    if (e.defaultPrevented || e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey) return
    const t = e.target
    if (t instanceof Element && t.closest(CONTROL)) return
    e.preventDefault()
    if (!e.repeat) shake(null)
  })
  const gesture = (): void => {
    unlock()
    askMotion()
  }
  window.addEventListener('pointerdown', (e) => e.pointerType === 'mouse' && unlock(), { capture: true, passive: true })
  window.addEventListener('pointerup', gesture, { capture: true, passive: true })
  window.addEventListener('touchend', gesture, { capture: true, passive: true })
  window.addEventListener('click', gesture, { capture: true, passive: true })

  const source = (window as Window & { DeviceMotionEvent?: { requestPermission?: unknown } }).DeviceMotionEvent
  if (source && typeof source.requestPermission !== 'function') window.addEventListener('devicemotion', onMotion)

  const still = (): void => {
    session.reduced = reduce.matches
    tell()
  }
  reduce.addEventListener('change', still)
  session.reduced = reduce.matches

  if (params.diag) bridge.setDiagnostic(params.diag)
  if (playing !== 'live') start(playing)
  applyLevel()

  void Promise.all([d.ready, (FILMS.includes(playing) ? loader.all : loader.first).catch(() => undefined)]).then(() => requestAnimationFrame(frame))

  void afterFirstPicture.then(async () => {
    if (probing) {
      const [m, card] = await Promise.all([loadProbe(), import('../core/maths')])
      if (m && ui) {
        m.mountProbe(
          ui,
          createProbe({
            setLevel(id) {
              governor.fix(id)
              applyLevel()
              tell()
            },
            shake: () => void shake(null),
            onFrame: (fn) => (onFrame = fn),
            graphics: () => gfx.caps.renderer,
            maths: () => card.mathsReport(gfx),
            glass: () => card.glassReport(gfx, framingOfRig(liveRig(painter.width / Math.max(1, painter.height), look.yaw, look.pitch, under(0)), painter.width, painter.height).globe),
          }),
        )
      }
    } else {
      const m = await loadInterface()
      if (m && ui) m.mountInterface(ui, bridge)
    }
    if (!audioShips || probing) return
    const audio = await loadAudio()
    if (!audio) {
      soundAvailable = false
      tell()
      return
    }
    engine = audio.createSoundEngine({ index: audioIndex, baseUrl: audioBase(), afterFirstPicture, seasons: [...config.seasons] })
    soundAvailable = engine.available()
    engine.setSeason((told = session.target ?? session.season), true)
    engine.setMuted(muted())
    tell()
  })

  return bridge
}
