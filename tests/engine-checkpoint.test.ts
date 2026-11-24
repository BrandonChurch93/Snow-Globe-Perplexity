import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import type { ParticleSource } from '../src/core/stage'
import { SourceSwitch } from '../src/film/loop'
import { barSeconds, beatSeconds, filmTimeline, stateSeconds, stillTimeline, type Timeline } from '../src/film/timeline'
import { SimDriver, type SimStore } from '../src/particles/driver'
import { COVER_N, packSnapshot, ParticleEngine, STATE_HIDDEN, STATE_LIQUID, STATE_REST, unpackSnapshot } from '../src/particles/engine/engine'
import { BEHAVIOUR, KINDS } from '../src/particles/engine/kinds'
import { LoopPaths } from '../src/particles/engine/loop'
import { buildCollider, emitters as layoutEmitters } from '../src/scene/layout'

const HZ = config.sim.stepHz
const DT = 1 / HZ
const EVERY = Math.round(config.sim.checkpointSeconds * HZ)
const steps = (seconds: number): number => Math.round(seconds * HZ)
const collider = buildCollider()
const emitters = Object.fromEntries(Object.entries(layoutEmitters).map(([kind, list]) => [kind, list.map((e) => ({ ...e }))]))
const FRACTION = 0.02

type Bag = Record<string, unknown>
type Counts = (i: number) => boolean

const GIVEN = ['collider', 'emitters', 'grids', 'starts', 'kinds', 'timeline', 'grid']
const WORK = ['g', 'u', 'q', 'w', 'heap', 'work', 'scratch', 'k']

function differs(a: ArrayLike<number>, b: ArrayLike<number>, counts?: Counts): number {
  if (a.length !== b.length) return a.length
  for (let i = 0; i < a.length; i++) if ((!counts || counts(i)) && !Object.is(a[i], b[i])) return i
  return -1
}

function sameBag(name: string, a: Bag, b: Bag, counts: Record<string, Counts>, skip: (key: string) => boolean): void {
  const keys = Object.keys(a).sort()
  expect(Object.keys(b).sort(), `${name}: the same fields`).toEqual(keys)
  for (const key of keys) {
    if (GIVEN.includes(key) || WORK.includes(key) || skip(key)) continue
    const v = a[key]
    const w = b[key]
    if (ArrayBuffer.isView(v) || Array.isArray(v)) {
      const at = differs(v as unknown as ArrayLike<number>, w as ArrayLike<number>, counts[key])
      expect(at, `${name}.${key} differs at ${at}: ${(v as unknown as ArrayLike<number>)[at]} against ${(w as ArrayLike<number>)[at]}`).toBe(-1)
    } else if (v !== null && typeof v === 'object') sameBag(`${name}.${key}`, v as Bag, w as Bag, {}, () => false)
    else {
      expect(['number', 'string', 'boolean'], `${name}.${key} is neither state nor named as given or as work`).toContain(typeof v)
      expect(Object.is(v, w), `${name}.${key}: ${String(v)} against ${String(w)}`).toBe(true)
    }
  }
}

function sameEngine(a: ParticleEngine, b: ParticleEngine): void {
  expect(a.pos.length).toBe(b.pos.length)
  expect(a.cover.n).toBe(b.cover.n)
  const x = a as unknown as Bag
  const y = b as unknown as Bag
  const state = a.state
  const kindOf = a.kindOf
  const feel = x.feel as Float32Array
  const afloat: Counts = (i) => state[i] === STATE_LIQUID
  const shown: Counts = (i) => state[i] !== STATE_HIDDEN
  const noisy = (x.model as Bag).noise === true
  sameBag(
    'engine',
    x,
    y,
    {
      base: afloat,
      feel: (j) => afloat(j >> 2) && ((j & 3) === 0 || !Number.isNaN(feel[j & ~3]!)),
      home: (j) => shown(Math.floor(j / 3)) && BEHAVIOUR[KINDS[kindOf[Math.floor(j / 3)]!]!]!.mode === 'steer',
      sink: shown,
      lift: shown,
      layer: shown,
      turnRate: shown,
      life: shown,
      renews: shown,
    },
    (key) => key === 'model' || ((key === 'swapTo' || key === 'change') && x.window !== 1),
  )
  sameBag('liquid', x.model as Bag, y.model as Bag, {}, (key) => !noisy && (key === 'grid' || key === 'pot' || key === 'mixed'))
}

function sameLoop(a: LoopPaths, b: LoopPaths): void {
  expect(a.cover.n).toBe(COVER_N)
  expect(b.cover.n).toBe(COVER_N)
  sameBag('loop', a as unknown as Bag, b as unknown as Bag, {}, () => false)
}

const engine = (season: string): ParticleEngine => new ParticleEngine({ season, fraction: FRACTION, collider, emitters })

function memory(): SimStore & { readonly held: Map<string, ArrayBuffer> } {
  const held = new Map<string, ArrayBuffer>()
  return {
    held,
    async list(key) {
      return [...held.keys()].filter((k) => k.startsWith(`${key}/`)).map((k) => Number(k.slice(key.length + 1)))
    },
    async get(key, step) {
      return held.get(`${key}/${step}`)?.slice(0) ?? null
    },
    async put(key, step, data) {
      held.set(`${key}/${step}`, data.slice(0))
    },
  }
}

describe('checkpoints', () => {
  const film = filmTimeline()
  const swap = film.events.find((e) => e.from !== e.to)!
  const window = config.shake.swapWindow
  const end = steps(swap.startSec + barSeconds + 1.2)
  const inside = [
    steps(barSeconds * 0.6),
    steps(barSeconds + 0.3),
    steps(swap.startSec + (window.fromBeat + 0.5 * (window.toBeat - window.fromBeat)) * beatSeconds),
    steps(swap.startSec + window.toBeat * beatSeconds) - 1,
    steps(swap.startSec + barSeconds + 0.3) + 1,
  ]

  it('the film: restored from any checkpoint and stepped on, every state array and scalar is the one a run stepped from zero holds', () => {
    const whole = engine(film.startSeason)
    whole.advanceTo(end, film)
    expect(whole.seasonNow).toBe(swap.to)
    expect(whole.floating()).toBeGreaterThan(0)

    const marks: number[] = []
    for (let s = EVERY; s < end; s += EVERY) marks.push(s)
    marks.push(...inside)
    marks.sort((a, b) => a - b)
    expect(marks.length).toBeGreaterThan(8)
    const marked = engine(film.startSeason)
    const packed: ArrayBuffer[] = []
    for (const m of marks) {
      marked.advanceTo(m, film)
      packed.push(packSnapshot(marked.snapshot()))
    }
    marked.advanceTo(end, film)
    sameEngine(whole, marked)

    for (let k = 0; k < marks.length; k++) {
      const fresh = engine(film.startSeason)
      fresh.restore(unpackSnapshot(packed[k]!))
      expect(fresh.step).toBe(marks[k])
      fresh.advanceTo(end, film)
      sameEngine(whole, fresh)
    }

    for (const k of [1, marks.indexOf(inside[2]!), marks.length - 1]) {
      marked.restore(unpackSnapshot(packed[k]!))
      marked.advanceTo(end, film)
      sameEngine(whole, marked)
    }
  }, 240000)

  it('the film: sought in one go, back and forth through kept marks, and from checkpoints read back, the driver lands on the state stepped from zero', async () => {
    const whole = engine(film.startSeason)
    whole.advanceTo(end, film)
    const at = end / HZ

    const plain = engine(film.startSeason)
    const first = new SimDriver(plain, null, 'test')
    await first.seek(film, at)
    sameEngine(whole, plain)
    await first.seek(film, (end - 2 * EVERY - 7) / HZ)
    expect(plain.step).toBe(end - 2 * EVERY - 7)
    await first.seek(film, at)
    sameEngine(whole, plain)

    const store = memory()
    const writer = engine(film.startSeason)
    await new SimDriver(writer, store, 'test').seek(film, at)
    sameEngine(whole, writer)
    expect(store.held.size).toBe(Math.floor(end / EVERY))

    const reader = engine(film.startSeason)
    const second = new SimDriver(reader, store, 'test')
    await second.seek(film, at)
    expect(second.replayed).toBeLessThan(EVERY + 1)
    sameEngine(whole, reader)
  }, 240000)

  for (const season of [config.defaultSeason, 'fall']) {
    it(`the loop in ${season}: built on a rest that came through a checkpoint, every array and scalar of every frame is the one built on a rest stepped from zero`, () => {
      const tl: Timeline = stillTimeline(season)
      const rest = steps(stateSeconds('rest'))
      const whole = engine(season)
      whole.reset(season)
      whole.advanceTo(rest, tl)

      const early = engine(season)
      early.reset(season)
      early.advanceTo(steps(barSeconds + 0.3), tl)
      const packed = packSnapshot(early.snapshot())
      const through = engine(season)
      through.restore(unpackSnapshot(packed))
      through.advanceTo(rest, tl)
      sameEngine(whole, through)

      const a = new LoopPaths(whole)
      const b = new LoopPaths(through)
      const made = LoopPaths.fromRest(season, { fraction: FRACTION, collider, emitters })
      const L = a.seconds
      const judged = (Math.floor((L * config.film.fps * 0.6) / 2) * 2) / config.film.fps
      for (const t of [0, a.timeline.events[0]!.startSec + barSeconds * 0.5, a.timeline.events[0]!.startSec + barSeconds + 0.2, judged, L - DT]) {
        a.setTime(t)
        b.setTime(t)
        made.setTime(t)
        sameLoop(a, b)
        sameLoop(a, made)
      }
    }, 240000)
  }

  it('the loop: a frame is the same whatever was shown before it, and it hands the drawing its own cover map', () => {
    const season = config.defaultSeason
    const tl = stillTimeline(season)
    const sim = engine(season)
    sim.reset(season)
    sim.advanceTo(steps(stateSeconds('rest')), tl)
    const restCover = sim.cover.mm.slice()
    const loop = new LoopPaths(sim)
    expect(differs(loop.cover.mm, restCover)).toBe(-1)
    const L = loop.seconds
    const judged = (Math.floor((L * config.film.fps * 0.6) / 2) * 2) / config.film.fps
    const storm = loop.timeline.events[0]!.startSec + barSeconds * 0.75

    const take = (t: number): Bag => {
      loop.setTime(t)
      const cover = loop.cover
      return { pos: loop.pos.slice(), prev: loop.prev.slice(), opacity: loop.opacity.slice(), phase: loop.phase.slice(), state: loop.state.slice(), liquid: loop.liquid.slice(), cover: cover.mm.slice(), n: cover.n, span: cover.spanMm, step: loop.step }
    }
    const first = take(judged)
    const flying = take(storm)
    const again = take(judged)
    sameBag('frame', first, again, {}, () => false)
    sim.advanceTo(steps(stateSeconds('settled')), tl)
    expect(differs(sim.cover.mm, restCover)).toBeGreaterThan(-1)
    sameBag('frame', first, take(judged), {}, () => false)

    const lain = (state: Uint8Array): number => state.reduce((n, s) => n + (s === STATE_REST ? 1 : 0), 0)
    const sum = (mm: Float32Array): number => mm.reduce((n, v) => n + v, 0)
    loop.setTime(0)
    expect(differs(loop.cover.mm, restCover)).toBe(-1)
    expect(lain(flying.state as Uint8Array)).toBeLessThan(0.5 * lain(loop.state))
    expect(sum(flying.cover as Float32Array)).toBeLessThan(0.5 * sum(restCover))
    expect(sum(restCover)).toBeGreaterThan(0)

    const shown = new SourceSwitch(sim)
    const drawn: ParticleSource = shown
    expect(drawn.cover).toBe(sim.cover)
    shown.use(loop)
    expect(drawn.cover).toBe(loop.cover)
    expect(drawn.cover!.n).toBe(COVER_N)
    expect(drawn.cover!.spanMm).toBe(sim.cover.spanMm)
    shown.use(null)
    expect(drawn.cover).toBe(sim.cover)
  }, 240000)
})
