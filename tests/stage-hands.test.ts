import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { livePose } from '../src/app/framing'
import { LiveSession, type LiveSim } from '../src/app/session'
import { config } from '../src/config'
import { sampleSet } from '../src/core/sampler'
import { GlobeStage, hiddenOf, inSight } from '../src/scene/stage'
import { SETTLE_S } from '../src/scene/steps'
import { kitOf } from '../src/seasons'

/** The files of a season's list that a test has prepared: the page prepares them with a decoder that is not here. */
const prepared = vi.hoisted(() => new Map<string, unknown>())

vi.mock('../src/core/textures', async (original) => {
  const actual = await original<typeof import('../src/core/textures')>()
  return {
    ...actual,
    hasTexture: (path: string) => prepared.has(path) || actual.hasTexture(path),
    texture: (path: string) => prepared.get(path) ?? actual.texture(path),
  }
})

/** What a link, a picture or a draw costs the page's thread here: more than a hand takes of a frame, so each is its frame's last, as on a browser that draws with the processor. */
const COST_MS = 20
const FRAME_MS = 16

let clock = 0
let waiting: ((at: number) => void)[] = []

beforeEach(() => {
  clock = 1000
  waiting = []
  prepared.clear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.spyOn(performance, 'now').mockImplementation(() => clock)
  vi.stubGlobal('requestAnimationFrame', (go: (at: number) => void) => waiting.push(go))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const turns = async (): Promise<void> => {
  for (let i = 0; i < 80; i++) await Promise.resolve()
}

class StillSim implements LiveSim {
  step = 0
  advanceTo(step: number): void {
    this.step = Math.max(this.step, step)
  }
  reset(): void {
    this.step = 0
  }
}

type Target = THREE.WebGLRenderTarget

interface Call {
  what: 'link' | 'warm' | 'picture' | 'draw'
  of: { name: string }
  /** How many frames the page had drawn. */
  frame: number
  /** Whether the frame drawn last was of a shake or of the settling of its landing. */
  air: boolean
  into: Target | null
  /** A link: how many parts hung from the part while it was linked. */
  below?: number
  /** A draw: what else the draw drew, and how the part stood while it was drawn. */
  beside?: number
  culled?: boolean
  before?: unknown
  shadow?: boolean
}

/** What a draw draws of `scene` as three reads it: what is not hidden, hangs from nothing hidden and is on a layer of the camera. */
function drawnBy(scene: THREE.Object3D, camera: THREE.Camera): THREE.Object3D[] {
  const out: THREE.Object3D[] = []
  const walk = (o: THREE.Object3D): void => {
    if (!o.visible) return
    const d = o as THREE.Mesh & { isPoints?: boolean; isLine?: boolean }
    if ((d.isMesh || d.isPoints || d.isLine) && o.layers.test(camera.layers)) out.push(o)
    for (const c of o.children) walk(c)
  }
  walk(scene)
  return out
}

/** A season's set as the stage keeps it, with a part of each kind a hand takes: some a frame of the season draws, some it hides. */
function partsOf(season: string, warmed: (d: THREE.Object3D) => void, open = false) {
  const named = <T extends THREE.Object3D>(o: T, name: string, into?: THREE.Object3D): T => {
    o.name = `${season} ${name}`
    into?.add(o)
    return o
  }
  const map = (name: string): THREE.DataTexture => {
    const t = new THREE.DataTexture(new Uint8Array(4), 1, 1)
    t.name = `${season} ${name}`
    return t
  }
  const group = (name: string, into?: THREE.Object3D): THREE.Group => named(new THREE.Group(), name, into)
  const mesh = (name: string, into: THREE.Object3D, picture?: THREE.Texture): THREE.Mesh => named(new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial(picture ? { map: picture } : {})), name, into)

  const base = group('base')
  const pedestal = mesh('pedestal', base)
  const miniature = group('miniature')
  const townMap = map('town map')
  const town = mesh('town', miniature, townMap)
  town.castShadow = true
  const air = group('air', miniature)
  const sheets = mesh('sheets', air)
  const washMap = map('wash map')
  const wash = mesh('wash', air, washMap)
  wash.visible = false
  wash.castShadow = true
  wash.userData.warm = (): void => warmed(wash)
  const rim = mesh('rim', wash)
  const billows = group('billows', air)
  billows.visible = false
  const puffs = named(new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial()), 'puffs', billows)
  const arrival = group('arrival')
  const coming = mesh('coming', arrival)
  const lights = group('lights')
  const lamp = mesh('lamp', lights)
  const dressing = group('dressing')
  const cloth = mesh('cloth', dressing)
  const threads = named(new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial()), 'threads', dressing)
  threads.visible = false
  const blank = mesh('blank', dressing)
  blank.visible = false
  ;(blank as { material?: unknown }).material = undefined
  const glass = group('glass')
  const film = mesh('film', glass, map('film map'))
  const trailsMap = map('trails map')
  const trails = mesh('trails', glass, trailsMap)
  trails.visible = false
  const own = (): void => undefined
  trails.onBeforeRender = own
  trails.userData.warm = (): void => warmed(trails)
  const grid = new THREE.Data3DTexture(new Uint8Array(4), 1, 1, 1)
  grid.name = `${season} grid`
  if (open) for (const o of [wash, billows, threads, trails]) o.visible = true

  return {
    base,
    miniature,
    arrival,
    lights,
    dressing,
    glass,
    grid,
    /** What a frame of the season draws, and what it hides, in the order a hand comes to them. */
    seen: [pedestal, town, sheets, coming, lamp, cloth, film] as THREE.Object3D[],
    hidden: [wash, rim, puffs, threads, trails] as THREE.Object3D[],
    all: [pedestal, town, sheets, wash, rim, puffs, coming, lamp, cloth, threads, film, trails] as THREE.Object3D[],
    wash,
    rim,
    billows,
    puffs,
    threads,
    trails,
    blank,
    washMap,
    trailsMap,
    townMap,
    own,
  }
}

type Parts = ReturnType<typeof partsOf>

interface Inner {
  sets: Map<string, unknown>
  makings: Map<string, { steps: (() => void)[] }>
  globe: THREE.Group
  inside: THREE.Group
  floor: THREE.Group
  draw: { frame: () => void }
  shell: Record<'through' | 'shell' | 'bubble' | 'stamp', THREE.Mesh>
  hands: { all: Promise<void> }
  scratch: Map<string, Target>
  gfx: { renderer: { extensions: { has(name: string): boolean } } }
  make(season: string): Promise<void>
  give(name: string, parts: THREE.Object3D[], first: THREE.Texture[], go: () => boolean, owed: (d: THREE.Object3D) => boolean): Promise<void>
}

const GLASS = ['through', 'shell', 'bubble', 'stamp'] as const

/** The stage of a page that begins in `start`, on a renderer that writes down what a hand asks of it and does nothing. */
function pageOf(start: string, { samples = 4, linksAside = false } = {}) {
  const calls: Call[] = []
  const after: ((c: Call) => void)[] = []
  const links: (() => void)[] = []
  const hides: THREE.Object3D[] = []
  let bound: Target | null = null
  let frames = 0
  let air = false
  let drawing = false
  const count = { calls: 0, triangles: 0, points: 0, lines: 0 }
  const shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false }
  const note = (what: Call['what'], of: unknown, more: Partial<Call> = {}): void => {
    if (drawing) throw new Error(`a frame asked for a ${what}`)
    const c: Call = { what, of: of as { name: string }, frame: frames, air, into: bound, ...more }
    calls.push(c)
    clock += COST_MS
    for (const then of after) then(c)
  }
  const base: Record<string, unknown> = {
    capabilities: { getMaxAnisotropy: () => 1 },
    shadowMap,
    extensions: { has: (name: string) => linksAside && name === 'KHR_parallel_shader_compile' },
    info: { render: count },
    properties: { get: () => ({ uniforms: {} }) },
    autoClear: true,
    getClearAlpha: () => 0,
    getClearColor: (c: THREE.Color) => c,
    getRenderTarget: () => bound,
    setRenderTarget: (t: Target | null) => void (bound = t),
    compile: (o: THREE.Object3D) => note('link', o, { below: o.children.length }),
    compileAsync: (o: THREE.Object3D) => {
      note('link', o, { below: o.children.length })
      return new Promise<void>((resolve) => links.push(resolve))
    },
    initTexture: (t: THREE.Texture) => note('picture', t),
    render: (scene: THREE.Object3D, camera: THREE.Camera) => {
      count.calls++
      if (drawing) return
      const [d, ...beside] = drawnBy(scene, camera) as THREE.Mesh[]
      note('draw', d, { beside: beside.length, culled: d?.frustumCulled, before: d?.onBeforeRender, shadow: shadowMap.needsUpdate })
    },
  }
  const renderer = new Proxy(base, { get: (t, k: string) => (k in t ? t[k] : () => undefined) })
  const gl = { ALIASED_POINT_SIZE_RANGE: 1, getParameter: () => new Float32Array([1, 256]) }
  const n = 8
  const source = { count: n, step: 0, pos: new Float32Array(n * 3), prev: new Float32Array(n * 3), sizes: new Float32Array(n), kindOf: new Uint8Array(n), kinds: ['flake'], state: new Uint8Array(n), liquid: new Float64Array(8) }
  const listed: string[] = []
  const lists = new Map<string, { name: string; picture: boolean }[]>()
  const assets = {
    entries: (season: string) => {
      listed.push(season)
      return lists.get(season) ?? []
    },
  }
  const stage = new GlobeStage({ renderer, gl } as never, source as never, assets as never)
  const inner = stage as unknown as Inner
  inner.draw.frame = () => undefined
  for (const part of GLASS) {
    inner.shell[part].name = part
    inner.shell[part].traverse((o) => void (o.name ||= `${part}, below`))
  }

  const session = new LiveSession(new StillSim(), start)
  const target = new THREE.WebGLRenderTarget(64, 64, { type: THREE.HalfFloatType, samples })
  const failed: unknown[] = []

  /**
   * Makes `season` through the stage's own making, as the page does: before the page has drawn in one piece, after that
   * in the turn a frame brings. The set is built here and not by the season's kit, which needs its files. An `open` set
   * hides nothing.
   */
  const make = (season: string, open = false): Parts => {
    const parts = partsOf(season, (d) => note('warm', d), open)
    inner.makings.set(season, {
      steps: [
        () => {
          const { base, miniature, arrival, lights, dressing, glass } = parts
          inner.globe.add(base)
          inner.inside.add(miniature, arrival, lights, glass)
          inner.floor.add(dressing)
          const kit = Object.create(kitOf(season), { update: { value: undefined } }) as unknown
          inner.sets.set(season, { kit, objects: [base, miniature, arrival, lights, dressing, glass], lights, grid: parts.grid, materials: [], arrival: [], glass: [glass], shown: false })
        },
      ],
    })
    inner.make(season).catch((error: unknown) => failed.push(error))
    return parts
  }

  /** One frame of the page: the picture is drawn, then whoever waited for the frame has a turn, as in a browser. */
  const frame = async (dt = FRAME_MS / 1000, sampled = false): Promise<void> => {
    clock += FRAME_MS
    const at = clock
    frames++
    session.tick(dt)
    const moment = session.moment(0, 1)
    air = moment.beat !== null || moment.sinceLanding < SETTLE_S
    drawing = true
    try {
      stage.drawSample(target, livePose(1), sampled ? sampleSet(1)[0]! : null, moment, true)
    } finally {
      drawing = false
    }
    for (const o of hides) o.visible = false
    const left = bound
    const drew = count.calls
    for (const go of waiting.splice(0)) go(at)
    await turns()
    expect(bound, 'a hand leaves bound what the frame left bound').toBe(left)
    expect(count.calls, 'a hand leaves the count of what the frame drew').toBe(drew)
    expect(failed).toEqual([])
  }

  /** Frames at rest until every hand there is has come to its end: two first, the second of which begins the hand of a season made before the page drew. */
  const rest = async (): Promise<void> => {
    await frame()
    await frame()
    let done = false
    let error: unknown = null
    stage.settled().then(
      () => void (done = true),
      (e: unknown) => {
        error = e ?? new Error('a hand failed')
        done = true
      },
    )
    for (let i = 0; i < 900 && !done; i++) await frame()
    if (error) throw error
    expect(done, 'the hands come to an end').toBe(true)
  }

  /** Frames until `done`. A hand that never comes ends the test and not the run. */
  const until = async (done: () => boolean, dt?: number): Promise<number> => {
    let drawn = 0
    while (!done()) {
      expect(drawn, 'frames waited for what never came').toBeLessThan(900)
      await frame(dt)
      drawn++
    }
    return drawn
  }

  const of = (what: Call['what'], from = 0): string[] => calls.slice(from).filter((c) => c.what === what).map((c) => c.of?.name ?? 'nothing')

  return { stage, inner, session, target, calls, after, links, hides, listed, lists, make, frame, rest, until, of, waits: () => waiting.length, frames: () => frames }
}

describe('what a frame draws of a part', () => {
  it('is the part that is not hidden and hangs from nothing hidden, up to the top', () => {
    const top = new THREE.Group()
    const mid = new THREE.Group()
    const part = new THREE.Mesh()
    top.add(mid)
    mid.add(part)
    expect(inSight(part)).toBe(true)
    part.visible = false
    expect(inSight(part)).toBe(false)
    part.visible = true
    mid.visible = false
    expect(inSight(part)).toBe(false)
    mid.visible = true
    top.visible = false
    expect(inSight(part)).toBe(false)
    expect(inSight(top)).toBe(false)
  })

  it('is asked below the root of a set, whose own flag says only that the season is not on show now', () => {
    const root = new THREE.Group()
    const mid = new THREE.Group()
    const part = new THREE.Mesh()
    root.add(mid)
    mid.add(part)
    root.visible = false
    expect(inSight(part, root)).toBe(true)
    expect(inSight(mid, root)).toBe(true)
    expect(inSight(root, root)).toBe(true)
    mid.visible = false
    expect(inSight(part, root)).toBe(false)
    mid.visible = true
    part.visible = false
    expect(inSight(part, root)).toBe(false)
    expect(inSight(part, null)).toBe(false)
  })
})

describe('the name of the hand that takes what a season hides', () => {
  it('is no season, so no press waits for it and none finds it at work, and each season has its own', () => {
    const names = config.seasons.map(hiddenOf)
    for (const name of names) expect(config.seasons).not.toContain(name)
    expect(new Set(names).size).toBe(config.seasons.length)
  })
})

describe('a page that begins in spring: the hand of what the season and the glass hide', () => {
  it('takes them while the picture rests: each linked once with nothing hanging from it, its pictures taken, and drawn once, alone, into one pixel of a picture of the kind the page paints and of the kind the table mirrors', async () => {
    const p = pageOf('spring')
    const s = p.make('spring')
    const { bubble } = p.inner.shell
    const hidden = [...s.hidden, bubble]
    const camera = p.stage.camera.layers.mask
    await p.rest()

    expect(p.of('link')).toEqual(hidden.map((d) => d.name))
    expect(p.of('warm')).toEqual([s.wash.name, s.trails.name])
    const pictures = p.of('picture')
    for (const t of [s.washMap, s.trailsMap]) expect(pictures.filter((name) => name === t.name), t.name).toHaveLength(1)
    expect(p.of('draw')).toEqual(hidden.flatMap((d) => [d.name, d.name]))

    for (const c of p.calls) {
      expect(c.air, `${c.what} ${c.of.name} while the picture rests`).toBe(false)
      if (c.what === 'picture') continue
      expect([c.into?.width, c.into?.height], `${c.what} ${c.of.name} into one pixel`).toEqual([1, 1])
      expect(c.into?.texture.type).toBe(p.target.texture.type)
    }
    for (const c of p.calls.filter((c) => c.what === 'link')) expect(c.below, `${c.of.name} linked alone`).toBe(0)
    const draws = p.calls.filter((c) => c.what === 'draw')
    for (const [i, c] of draws.entries()) {
      const d = c.of as unknown as THREE.Mesh
      expect(c.beside, `${d.name} drawn alone`).toBe(0)
      expect(c.culled, `${d.name} not left out for where it stands`).toBe(false)
      expect(c.into?.samples, `${d.name}: the page's kind, then the kind the table mirrors`).toBe(i % 2 === 0 ? p.target.samples : 0)
      expect(c.shadow, `${d.name}: its shadow with the first draw alone`).toBe(i % 2 === 0 && d.castShadow)
    }
    expect(draws.find((c) => c.of === (s.trails as unknown))?.before, 'what a part does before a frame draws it is not done for this draw').not.toBe(s.own)

    // Nothing of it is left changed: what was hidden is hidden, on no layer but its own, with what it does before a draw.
    for (const d of hidden) expect(d.layers.mask, d.name).toBe(1)
    expect([s.wash.visible, s.billows.visible, s.puffs.visible, s.threads.visible, s.trails.visible, bubble.visible]).toEqual([false, false, true, false, false, false])
    expect(s.wash.children).toEqual([s.rim])
    expect(s.trails.onBeforeRender).toBe(s.own)
    expect((s.wash as THREE.Mesh).frustumCulled).toBe(true)
    expect(p.stage.camera.layers.mask).toBe(camera)

    // And it is done: the frames that follow begin no hand and ask for nothing.
    const all = p.inner.hands.all
    const made = p.calls.length
    for (let i = 0; i < 4; i++) await p.frame()
    expect(p.inner.hands.all).toBe(all)
    expect(p.calls).toHaveLength(made)
    expect(p.waits()).toBe(0)
  })

  it('takes nothing a frame has drawn: no part of the season that is in sight, no part of the glass that is, no picture that only they have, and nothing that has nothing to draw with', async () => {
    const p = pageOf('spring')
    const s = p.make('spring')
    await p.rest()
    const asked = new Set(p.calls.map((c) => c.of.name))
    for (const d of s.seen) expect(asked.has(d.name), d.name).toBe(false)
    for (const part of ['through', 'shell', 'stamp']) expect(asked.has(part), part).toBe(false)
    expect(asked.has(s.townMap.name)).toBe(false)
    expect(asked.has(s.blank.name)).toBe(false)
    expect(asked.has('nothing')).toBe(false)
  })

  it('draws each part once where the picture the page paints has no samples of its own: the table mirrors into the same kind', async () => {
    const p = pageOf('spring', { samples: 0 })
    const s = p.make('spring')
    await p.rest()
    expect(p.of('draw')).toEqual([...s.hidden, p.inner.shell.bubble].map((d) => d.name))
  })

  it('begins at the second frame that shows the season and works from the third: the page counts its first picture from its second frame', async () => {
    const p = pageOf('spring')
    const none = p.inner.hands.all
    const s = p.make('spring')
    await p.frame()
    expect(p.inner.hands.all, 'no hand at the first frame').toBe(none)
    expect(p.waits()).toBe(0)
    await p.frame()
    expect(p.inner.hands.all, 'a hand at the second frame').not.toBe(none)
    expect(p.waits(), 'it waits for the frame that comes').toBe(1)
    expect(p.calls).toHaveLength(0)
    await p.frame()
    expect(p.calls.map((c) => [c.what, c.of.name, c.frame])).toEqual([['link', s.wash.name, 3]])
  })

  it('is not begun on a page that captures, and is still owed when the page paints', async () => {
    const p = pageOf('spring')
    const none = p.inner.hands.all
    const s = p.make('spring')
    for (let i = 0; i < 3; i++) await p.frame(FRAME_MS / 1000, true)
    expect(p.inner.hands.all).toBe(none)
    expect(p.waits()).toBe(0)
    expect(p.calls).toHaveLength(0)
    await p.rest()
    expect(p.of('link')).toEqual([...s.hidden, p.inner.shell.bubble].map((d) => d.name))
    expect(p.calls.every((c) => c.frame > 3)).toBe(true)
  })
})

describe('a page that begins in winter with nothing hidden', () => {
  it('has a hand that asks for nothing: no frame to work in, no picture of one pixel, nothing of the renderer', async () => {
    const p = pageOf('winter')
    const none = p.inner.hands.all
    p.make('winter', true)
    await p.frame()
    await p.frame()
    expect(p.inner.hands.all, 'the hand began').not.toBe(none)
    expect(p.waits()).toBe(0)
    expect(p.inner.scratch.size).toBe(0)
    await p.rest()
    expect(p.calls).toHaveLength(0)
    expect(p.inner.scratch.size).toBe(0)
  })
})

describe('a page that paints no longer', () => {
  it('is given nothing more by the hand of what is hidden', async () => {
    const p = pageOf('spring')
    const s = p.make('spring')
    for (let i = 0; i < 3; i++) await p.frame()
    expect(p.of('link')).toEqual([s.wash.name])
    for (let i = 0; i < 6; i++) await p.frame(FRAME_MS / 1000, true)
    expect(p.calls).toHaveLength(1)
    expect(p.waits()).toBe(0)
  })

  it('gives nothing to a season whose own hand has its turn then, and does not ask for the list of its pictures', async () => {
    const p = pageOf('winter')
    p.make('winter')
    await p.rest()
    const before = p.calls.length
    p.make('summer')
    p.make('fall')
    await p.until(() => p.of('link', before).length >= 3)
    expect(p.listed).toEqual(['summer'])

    const made = p.calls.length
    let done = false
    void p.stage.settled().then(() => void (done = true))
    for (let i = 0; i < 6 && !done; i++) await p.frame(FRAME_MS / 1000, true)
    expect(done, 'every hand has had its turn').toBe(true)
    expect(p.calls).toHaveLength(made)
    expect(p.listed).toEqual(['summer'])
  })

  it('reads nothing of the sets or of the glass for the hand of what is hidden, where its turn comes then', async () => {
    const p = pageOf('winter')
    const w = p.make('winter')
    await p.rest()
    const before = p.calls.length
    const m = p.make('summer')
    const f = p.make('fall')
    await p.until(() => p.of('link', before).length >= 3)
    const all = p.inner.hands.all
    p.session.jump('summer')
    await p.until(() => p.calls.slice(before).some((c) => (f.all as unknown[]).includes(c.of)))
    expect(p.inner.hands.all, 'the hand of what summer hides waits behind the hand of fall').not.toBe(all)

    // Not the lights: a frame reads those of a set on show itself.
    const roots = [...[w, m].flatMap((s) => [s.base, s.miniature, s.arrival, s.dressing, s.glass]), ...GLASS.map((part) => p.inner.shell[part])]
    const read = roots.map((root) => vi.spyOn(root, 'traverse'))
    const made = p.calls.length
    let done = false
    void p.stage.settled().then(() => void (done = true))
    for (let i = 0; i < 6 && !done; i++) await p.frame(FRAME_MS / 1000, true)
    expect(done, 'every hand has had its turn').toBe(true)
    expect(p.calls).toHaveLength(made)
    for (const [i, asked] of read.entries()) expect(asked, roots[i]!.name).not.toHaveBeenCalled()
  })

  it('asks nothing of the renderer where the giving itself is reached then, which neither hand lets happen: both have asked for the picture the page paints before they give', async () => {
    const p = pageOf('winter')
    const w = p.make('winter')
    await p.rest()
    const made = p.calls.length
    await p.frame(FRAME_MS / 1000, true)
    const asked = vi.spyOn(p.inner.gfx.renderer.extensions, 'has')
    await p.inner.give('winter', [w.all[0]!], [], () => true, () => true)
    expect(asked).not.toHaveBeenCalled()
    expect(p.calls).toHaveLength(made)
    expect(p.waits()).toBe(0)
  })
})

describe('the four parts of the glass', () => {
  for (const part of GLASS) {
    it(`${part}: taken where the glass hides it while the picture rests, and the three in sight are not`, async () => {
      const p = pageOf('winter')
      const s = p.make('winter')
      p.hides.push(p.inner.shell[part])
      await p.rest()
      // With the part goes what hangs from it: the ring of the shell.
      const taken: string[] = []
      p.inner.shell[part].traverse((o) => void taken.push(o.name))
      expect(taken).toEqual(part === 'shell' ? ['shell', 'shell, below'] : [part])
      expect(p.of('link')).toEqual([...s.hidden.map((d) => d.name), ...taken])
      expect(p.of('draw').filter((name) => GLASS.some((other) => name.startsWith(other)))).toEqual(taken.flatMap((name) => [name, name]))
    })
  }

  it('none taken on a page that begins in winter, where a frame draws all four', async () => {
    const p = pageOf('winter')
    const s = p.make('winter')
    await p.rest()
    expect(p.of('link')).toEqual(s.hidden.map((d) => d.name))
  })
})

describe('what comes into sight while the hand works: a frame has drawn it, and the hand leaves it', () => {
  it('before its link: not linked, not drawn before its own draw, its pictures not taken, not drawn', async () => {
    const p = pageOf('spring')
    const s = p.make('spring')
    p.after.push((c) => {
      if (c.what === 'link' && c.of === (s.wash as unknown)) s.trails.visible = true
    })
    await p.rest()
    expect(p.calls.filter((c) => c.of === (s.trails as unknown) || c.of === (s.trailsMap as unknown))).toEqual([])
    expect(p.of('link')).toEqual([s.wash, s.rim, s.puffs, s.threads, p.inner.shell.bubble].map((d) => d.name))
  })

  it('after the links: what it draws before its own draw is not drawn here, its pictures are not taken, it is not drawn', async () => {
    const p = pageOf('spring')
    const s = p.make('spring')
    p.after.push((c) => {
      if (c.what === 'link' && c.of === (p.inner.shell.bubble as unknown)) s.trails.visible = true
    })
    await p.rest()
    expect(p.of('link')).toContain(s.trails.name)
    expect(p.of('warm')).toEqual([s.wash.name])
    expect(p.of('picture')).not.toContain(s.trailsMap.name)
    expect(p.of('draw')).not.toContain(s.trails.name)
  })

  it('after that: its pictures are not taken and it is not drawn', async () => {
    const p = pageOf('spring')
    const s = p.make('spring')
    p.after.push((c) => {
      if (c.what === 'warm' && c.of === (s.trails as unknown)) s.wash.visible = true
    })
    await p.rest()
    expect(p.of('warm')).toEqual([s.wash.name, s.trails.name])
    expect(p.of('picture')).not.toContain(s.washMap.name)
    expect(p.of('picture')).toContain(s.trailsMap.name)
    // The rim hangs from the wash: with the wash in sight it is in sight as well.
    expect(p.of('draw')).toEqual([s.puffs, s.threads, s.trails, p.inner.shell.bubble].flatMap((d) => [d.name, d.name]))
  })

  it('after the pictures: it is not drawn, and a part drawn into the first picture when it comes is not drawn into the second', async () => {
    const p = pageOf('spring')
    const s = p.make('spring')
    p.after.push((c) => {
      if (c.what === 'draw' && c.of === (s.wash as unknown) && c.into?.samples === 0) s.billows.visible = true
    })
    await p.until(() => p.calls.some((c) => c.what === 'draw' && c.of === (s.threads as unknown)))
    s.threads.visible = true
    await p.rest()
    expect(p.of('draw')).toEqual([s.wash.name, s.wash.name, s.rim.name, s.rim.name, s.threads.name, s.trails.name, s.trails.name, 'bubble', 'bubble'])
  })
})

describe('the hands, one after the other', () => {
  it('leaves a season no frame has shown alone, and gives a season made before the page drew its hand at the second frame that shows it', async () => {
    const p = pageOf('spring')
    const s = p.make('spring')
    const m = p.make('summer')
    await p.rest()
    expect(p.of('link')).toEqual([...s.hidden, p.inner.shell.bubble].map((d) => d.name))
    const before = p.calls.length
    const all = p.inner.hands.all

    p.session.jump('summer')
    await p.frame()
    expect(p.inner.hands.all).toBe(all)
    await p.frame()
    expect(p.inner.hands.all).not.toBe(all)
    await p.rest()
    // Summer's own, and nothing again of spring or of the glass: spring is off show, and what a hand has drawn no hand draws twice.
    expect(p.of('link', before)).toEqual(m.hidden.map((d) => d.name))
    expect(p.of('draw', before)).toEqual(m.hidden.flatMap((d) => [d.name, d.name]))
  })

  it('takes its turn behind a hand that is at work', async () => {
    const p = pageOf('spring')
    const s = p.make('spring')
    await p.frame()
    const m = p.make('summer')
    await turns()
    vi.advanceTimersByTime(60)
    await turns()
    await p.rest()
    const order = p.of('link')
    expect(order).toEqual([...m.all.map((d) => d.name), ...[...s.hidden, p.inner.shell.bubble].map((d) => d.name)])
    const last = p.calls.map((c) => (m.all as unknown[]).includes(c.of)).lastIndexOf(true)
    const first = p.calls.findIndex((c) => (s.hidden as unknown[]).includes(c.of))
    expect(first, 'nothing of what spring hides before the last of summer').toBeGreaterThan(last)
  })

  it('gives a season its own hand as it was: all of a season no frame has shown, hidden or not, with its light grid and the pictures of its list, and no hand more, then or once it is shown', async () => {
    const p = pageOf('winter')
    p.make('winter')
    await p.rest()
    const before = p.calls.length
    const none = p.inner.hands.all
    const picture = (name: string): THREE.Texture => Object.assign(new THREE.Texture(), { name })
    const [ofList, noPicture] = [picture('summer, a picture of its list'), picture('summer, a file of its list that is no picture')]
    prepared.set('summer/a', ofList)
    prepared.set('summer/b', noPicture)
    p.lists.set('summer', [
      { name: 'summer/a', picture: true },
      { name: 'summer/b', picture: false },
      { name: 'summer/not prepared', picture: true },
    ])
    const m = p.make('summer')
    await p.frame()
    const own = p.inner.hands.all
    expect(own, 'its own hand has its turn').not.toBe(none)
    await p.rest()
    expect(p.listed).toEqual(['summer'])
    expect(p.of('link', before)).toEqual(m.all.map((d) => d.name))
    expect(p.of('warm', before)).toEqual([m.wash.name, m.trails.name])
    expect(p.of('picture', before).slice(0, 2)).toEqual([m.grid.name, ofList.name])
    expect(p.of('picture', before)).not.toContain(noPicture.name)
    expect(p.of('draw', before)).toEqual(m.all.flatMap((d) => [d.name, d.name]))
    expect(p.calls.slice(before).every((c) => !c.air && (c.what === 'picture' || c.into?.width === 1))).toBe(true)
    expect(p.inner.hands.all, 'no hand of what is hidden for a season no frame has shown: its own gave all of it').toBe(own)

    const made = p.calls.length
    p.session.jump('summer')
    for (let i = 0; i < 6; i++) await p.frame()
    await p.rest()
    expect(p.calls).toHaveLength(made)
    expect(p.inner.hands.all).toBe(own)
  })

  it('gives nothing by the own hand of a season a frame has shown before its turn came, which does not so much as ask for the list of its pictures: the hand of what the season hides takes the rest', async () => {
    const p = pageOf('winter')
    p.make('winter')
    await p.rest()
    const before = p.calls.length
    const f = p.make('fall')
    const m = p.make('summer')
    await p.until(() => p.of('link', before).length >= 3)
    expect(p.listed).toEqual(['fall'])

    p.session.jump('summer')
    await p.rest()
    expect(p.listed).toEqual(['fall'])
    const since = p.calls.slice(before)
    for (const d of m.seen) expect(since.some((c) => c.of === (d as unknown)), d.name).toBe(false)
    // The bubble as well: the frames of winter drew it, and that is not written down; the frames of summer hide it.
    expect(p.of('link', before)).toEqual([...f.all, ...m.hidden, p.inner.shell.bubble].map((d) => d.name))
  })

  it('ends a season\'s own hand at the frame that shows the season, then takes what the season hides, behind the hands at work, and nothing of a season that is off show', async () => {
    const p = pageOf('spring')
    const s = p.make('spring')
    await p.rest()
    const before = p.calls.length
    const m = p.make('summer')
    const f = p.make('fall')
    await p.until(() => p.of('link', before).length >= 3)
    expect(p.of('link', before)).toEqual(m.all.slice(0, 3).map((d) => d.name))

    let settled = -1
    void p.stage.settled().then(() => void (settled = p.frames()))
    p.session.jump('summer')
    const shown = p.calls.length
    await p.rest()

    const since = p.calls.slice(shown)
    // Summer's own hand made no step more: the frame that showed the season made the rest itself.
    for (const d of m.seen) expect(since.some((c) => c.of === (d as unknown)), d.name).toBe(false)
    // Fall, which no frame has shown, whole and first; then what summer hides.
    const ofFall = since.filter((c) => (f.all as unknown[]).includes(c.of))
    const ofSummer = since.filter((c) => (m.hidden as unknown[]).includes(c.of))
    expect(ofFall.filter((c) => c.what === 'link').map((c) => c.of.name)).toEqual(f.all.map((d) => d.name))
    expect(ofSummer.filter((c) => c.what === 'draw').map((c) => c.of.name)).toEqual(m.hidden.flatMap((d) => [d.name, d.name]))
    expect(since.indexOf(ofSummer[0]!), 'what summer hides waits for the hand of fall').toBeGreaterThan(since.indexOf(ofFall.at(-1)!))
    // Spring is off show: what its frames drew is not asked for again, and what a hand drew of it and of the glass is not drawn twice.
    for (const d of [...s.seen, ...s.hidden, p.inner.shell.bubble]) expect(since.some((c) => c.of === (d as unknown)), d.name).toBe(false)
    // Whoever waits for the page to be made waits for that hand as well.
    expect(settled, 'the page says it is made').toBeGreaterThanOrEqual(since.at(-1)!.frame)
  })
})

describe('a press while the hand of what is hidden works', () => {
  it('waits for nothing of it, and the hand makes no step from the press until the shake has landed and its landing has settled', async () => {
    const p = pageOf('spring')
    const s = p.make('spring')
    p.make('summer')
    for (let i = 0; i < 4; i++) await p.frame()
    expect(p.of('link')).toEqual([s.wash.name, s.rim.name])

    const to = p.session.shake()
    expect(to).toBe('summer')
    expect(p.stage.expect(to!), 'the press is given nothing to wait for').toBeUndefined()
    const pressed = p.calls.length
    const shaken = await p.until(() => !p.session.busy, 0.05)
    expect(p.session.season).toBe('summer')
    expect(shaken).toBeGreaterThan(20)
    const settling = await p.until(() => p.session.moment(0, 1).sinceLanding + 0.05 >= SETTLE_S, 0.05)
    expect(settling).toBeGreaterThan(20)
    expect(p.calls, 'no step in the shake nor in its settling').toHaveLength(pressed)

    await p.rest()
    expect(p.calls.length).toBeGreaterThan(pressed)
    expect(p.calls.every((c) => !c.air)).toBe(true)
    // Spring is off show by then, and what it hid is still owed: the hand it began goes on with it.
    expect(p.of('draw').filter((name) => name === s.wash.name)).toHaveLength(2)
    expect(p.of('link')).toContain('bubble')
  })
})

describe('a browser that links aside', () => {
  it('is asked for every program first, and the hand goes on when they are linked', async () => {
    const p = pageOf('spring', { linksAside: true })
    const s = p.make('spring')
    const hidden = [...s.hidden, p.inner.shell.bubble]
    for (let i = 0; i < 40; i++) await p.frame()
    expect(p.calls.map((c) => c.what)).toEqual(hidden.map(() => 'link'))
    expect(p.links).toHaveLength(hidden.length)
    for (const linked of p.links) linked()
    await p.rest()
    expect(p.of('draw')).toEqual(hidden.flatMap((d) => [d.name, d.name]))
  })
})
