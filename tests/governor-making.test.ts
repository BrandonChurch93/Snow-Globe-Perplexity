import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LIVE, LiveSession, SeasonLoader, type LiveSim } from '../src/app/session'
import { config } from '../src/config'
import { Governor } from '../src/core/quality'
import { FramePace, KEEP_MS, LAST_S, LEAST_MS, Wish, workIn, type Step } from '../src/scene/steps'
import { rel } from '../tools/lib/paths.mjs'

const told = fs.readFileSync(rel('src', 'app', 'app.ts'), 'utf8').split('\n').filter((l) => l.includes('governor.frame('))
/** The condition under which the page tells the governor of a frame, as it stands in src/app/app.ts. */
const LINE = /^\s*if \((.+)\) applyLevel\(\)$/.exec(told[0] ?? '')?.[1] ?? ''
/** The same before the seasons were made in steps: every frame of a session that does not skip. */
const BEFORE = '!session.skipping && governor.frame(dt)'

interface StageSide {
  awaited?: () => boolean
}
type Tells = (session: LiveSession, d: { stage: StageSide }, governor: Governor, dt: number) => boolean
const tells = (condition: string): Tells => new Function('session', 'd', 'governor', 'dt', `return (${condition})`) as Tells

class Counted implements LiveSim {
  step = 0
  advanceTo(step: number): void {
    this.step = Math.max(this.step, step)
  }
  reset(): void {
    this.step = 0
  }
}

class Heard extends Governor {
  heard = 0
  override frame(seconds: number): boolean {
    this.heard++
    return super.frame(seconds)
  }
}

const seasons = config.seasons
const first = config.defaultSeason
const others = seasons.filter((s) => s !== first)
const [next, third] = others as [string, string]
const EVERY = 1000 / 60
const PIECE = 0.25

interface Page {
  /** The condition under which the governor is told of a frame. */
  line: string
  /** The ms the page's own script takes of each frame. */
  script: number
  /** The ms of making left at the press on the season in the making, and on each one begun later. */
  work: number
  /** The frame at which the visitor presses for the next season. */
  press: number
  /** What becomes of the season pressed for: it is made, its files fail, they never come, or its making breaks off after `breaks` ms. */
  files?: 'come' | 'fail' | 'hang'
  breaks?: number
  /** Whether the stage has `awaited` once it is pressed, as the page's own has. */
  member?: boolean
  reduced?: boolean
  /** A second press, for the season after the next, as soon as the first is over. */
  again?: boolean
}

/**
 * A visit to a page at 60 frames a second, as `frame` in src/app/app.ts runs it: the session ticks, the stage draws the
 * moment, the governor is told of the frame where the line says so, and then every making that is not held takes its
 * turn as the stage gives it. The loader, the session, the wish and the governor are the page's own. The page rests on
 * the season it opened on and makes the next one aside; at the frame `press` the visitor presses for it.
 */
async function visit(p: Page) {
  const { script, work, press, files = 'come', member = true, reduced = false } = p
  const tell = tells(p.line)
  const governor = new Heard('auto')
  const top = governor.level.id
  const wish = new Wish()
  const pace = new FramePace()
  const d: { stage: StageSide } = { stage: {} }
  const browser = KEEP_MS - LEAST_MS - 2 * PIECE
  const making: { season: string; steps: Step[]; left: number; idle: number; done: () => void; fail: (e: unknown) => void }[] = []
  let clock = 0
  let worked = 0
  const make = (season: string): Promise<void> =>
    new Promise<void>((done, fail) => {
      const m = { season, steps: [] as Step[], left: work, idle: clock, done, fail }
      const step = (): boolean => {
        if (season === next && p.breaks !== undefined && worked >= p.breaks) throw new Error('broken')
        clock += PIECE
        if (season === next) worked += PIECE
        m.left -= PIECE
        if (m.left > 0) m.steps.unshift(step)
        return true
      }
      m.steps.push(step)
      making.push(m)
    })
  const filesOf = (season: string): Promise<void> =>
    season !== next || files === 'come' ? Promise.resolve() : files === 'fail' ? Promise.reject(new Error('no files')) : new Promise<void>(() => undefined)
  const loader = new SeasonLoader(first, (season) => (season === first ? Promise.resolve() : filesOf(season).then(() => make(season))))
  const session = new LiveSession(new Counted(), first, loader.ready)
  session.reduced = reduced
  const go = (season: string): boolean => {
    if (!session.goTo(season)) return false
    wish.press(season)
    if (member) d.stage.awaited ??= () => wish.gave
    void loader.want(season).catch(() => undefined)
    return true
  }
  /** Of each frame the governor could be told of: whether it was, and whether the page worked on the season pressed for in the frame before it. */
  const frames: { n: number; heard: boolean; given: boolean; since: number }[] = []
  let pressedAt = 0
  let second: number | null = null
  let landed: string | null = null
  let over: number | null = null
  let gave = false
  let slow = 0
  let begun = 0
  let free = 0
  let stirred = 3
  for (let n = 0; n < 40000; n++) {
    if (stirred > 0) {
      stirred--
      for (let i = 0; i < 40; i++) await null
    }
    const at = n === 0 ? 0 : Math.max(begun + EVERY, Math.ceil(free / EVERY - 1e-9) * EVERY)
    const dt = n === 0 ? 0 : (at - begun) / 1000
    if (dt * 1000 > EVERY * 1.5) slow++
    begun = at
    clock = at
    if (n < press) for (const m of making) m.left = Math.max(m.left, 4 * (script + EVERY))
    if (n === press) {
      pressedAt = session.clock
      for (const m of making) m.left = work
      worked = 0
      go(next)
      stirred = 3
    }
    if (p.again && second === null && n > press && !session.busy && go(third)) {
      second = n
      stirred = 3
    }
    const wasBusy = session.busy
    const moment = session.moment(session.tick(dt), 1)
    wish.drawn(moment)
    clock += script
    if (wasBusy && !session.busy) {
      governor.rest()
      landed = session.season
    }
    if (n === 1) governor.rest()
    else if (n > 1) {
      const before = governor.heard
      if (tell(session, d, governor, dt)) governor.rest()
      if (n > press) frames.push({ n, heard: governor.heard > before, given: gave, since: moment.time - pressedAt })
    }
    pace.frame(at)
    gave = false
    for (const m of [...making]) {
      const from = clock
      const awaited = wish.awaits(m.season)
      let broken: unknown = null
      if (!wish.holds(m.season))
        try {
          workIn(m.steps, m.season, { waited: clock - m.idle, frame: at }, wish, pace, () => clock)
        } catch (e) {
          broken = e
        }
      m.idle = clock
      if (awaited && (clock > from || broken)) gave = true
      if (m.steps.length && !broken) continue
      making.splice(making.indexOf(m), 1)
      if (broken) m.fail(broken)
      else m.done()
      stirred = 3
    }
    free = clock + browser
    if (n > press && !session.busy && !gave && !(p.again && second === null)) over ??= n
    if (over !== null && n > over + 200) break
  }
  return {
    frames,
    unheard: frames.filter((f) => !f.heard),
    lost: governor.level.id !== top,
    slow,
    landed,
    season: session.season,
    target: session.target,
    second,
    ready: (season: string): boolean => loader.ready(season),
  }
}

const scripts = [3, 6, 9, 12]
const works = [700, 800, 900, 1200, 1800]
const moments = Array.from({ length: 90 }, (_, i) => 20 + i)

describe('the governor while the page makes the season pressed for', () => {
  it('is told of a frame by one line of the page, and that line is what is run here', () => {
    expect(told.length).toBe(1)
    expect(LINE).not.toBe('')
  })

  it('is kept from the one frame drawn after the page worked on the season pressed for, and from no other', () => {
    const wish = new Wish()
    const pace = new FramePace()
    let time = 0
    const draw = (): void => wish.drawn({ beat: null, season: first, sinceLanding: Infinity, time: (time += 1 / 60) })
    const work = (season: string): void => workIn([() => undefined], season, { waited: EVERY, frame: 0 }, wish, pace, () => 0)
    draw()
    work(next)
    draw()
    expect(wish.gave).toBe(false)
    wish.press(next)
    work(third)
    draw()
    expect(wish.gave).toBe(false)
    work(next)
    expect(wish.gave).toBe(false)
    draw()
    expect(wish.gave).toBe(true)
    draw()
    expect(wish.gave).toBe(false)
  })

  it('hears every frame where the stage has no such member, as it always did', async () => {
    for (const reduced of [false, true])
      for (const script of scripts)
        for (const work of [900, 1800]) {
          const page = { script, work, press: 60, reduced }
          const where = `${reduced ? 'reduced motion, ' : ''}${script} ms script, ${work} ms left`
          const bare = await visit({ ...page, line: LINE, member: false })
          const was = await visit({ ...page, line: BEFORE })
          expect(bare.unheard.length, where).toBe(0)
          expect(bare.frames, where).toEqual(was.frames)
          expect(bare.lost, where).toBe(was.lost)
          expect(bare.landed, where).toBe(next)
        }
  })

  it('hears none of the frames the page gave to the season pressed for, and every frame from the one after its last piece', async () => {
    for (const reduced of [false, true])
      for (const script of scripts)
        for (const work of works) {
          const where = `${reduced ? 'reduced motion, ' : ''}${script} ms script, ${work} ms left`
          const v = await visit({ line: LINE, script, work, press: 60, reduced })
          expect(v.landed, where).toBe(next)
          expect(v.unheard.length, where).toBeGreaterThan(0)
          expect(v.unheard[0]!.n, where).toBe(61)
          for (const f of v.frames) expect(f.heard, `${where}, frame ${f.n}`).toBe(!f.given)
          const last = v.unheard.at(-1)!.n
          expect(v.unheard.length, where).toBe(last - 60)
          expect(v.frames.filter((f) => f.n > last).length, where).toBeGreaterThan(200)
        }
  })

  it('hears again two frames after the press is LAST_S old at the latest, however much of the season is left', async () => {
    for (const reduced of [false, true])
      for (const script of [3, 12, 40])
        for (const work of [4000, 20000, 60000]) {
          const where = `${reduced ? 'reduced motion, ' : ''}${script} ms script, ${work} ms left`
          const v = await visit({ line: LINE, script, work, press: 60, reduced })
          expect(v.landed, where).toBe(next)
          expect(v.unheard.length, where).toBeGreaterThan(0)
          const old = v.frames.find((f) => f.since > LAST_S)!
          const last = v.unheard.at(-1)!
          expect(last.n, where).toBe(old.n + 1)
          expect(last.since, where).toBeLessThanOrEqual(LAST_S + 2 * LIVE.maxFrameSeconds)
          expect(v.frames.find((f) => f.n === old.n + 2)!.heard, where).toBe(true)
        }
  })

  it('loses no level to that making, at any moment of the press', async () => {
    for (const script of scripts)
      for (const work of works) {
        let lost = 0
        for (const press of moments) if ((await visit({ line: LINE, script, work, press })).lost) lost++
        expect(lost, `${script} ms script, ${work} ms left`).toBe(0)
      }
  })

  it('would lose one with every frame heard: what the line is for', async () => {
    const lost = async (script: number, work: number): Promise<number> => {
      let n = 0
      for (const press of moments) if ((await visit({ line: BEFORE, script, work, press })).lost) n++
      return n
    }
    expect(await lost(12, 1800)).toBe(90)
    expect(await lost(9, 1200)).toBeGreaterThan(45)
    expect(await lost(6, 1800)).toBeGreaterThan(45)
    expect(await lost(3, 1800)).toBe(0)
  })

  it('hears every frame of a press for a season whose files fail, and of one whose files never come', async () => {
    for (const files of ['fail', 'hang'] as const)
      for (const reduced of [false, true])
        for (const script of [3, 12]) {
          const where = `files ${files}, ${reduced ? 'reduced motion, ' : ''}${script} ms script`
          const v = await visit({ line: LINE, script, work: 1800, press: 60, files, reduced })
          expect(v.frames.length, where).toBeGreaterThan(200)
          expect(v.unheard.length, where).toBe(0)
          expect(v.season, where).toBe(first)
          expect(v.target, where).toBe(null)
          expect(v.ready(next), where).toBe(false)
          expect(v.lost, where).toBe(false)
        }
  })

  it('hears every frame again after a making that breaks off', async () => {
    for (const reduced of [false, true]) {
      const where = reduced ? 'reduced motion' : 'a shake'
      const v = await visit({ line: LINE, script: 12, work: 1800, press: 60, breaks: 300, reduced })
      expect(v.unheard.length, where).toBeGreaterThan(0)
      for (const f of v.frames) expect(f.heard, `${where}, frame ${f.n}`).toBe(!f.given)
      const last = v.unheard.at(-1)!.n
      expect(v.unheard.length, where).toBe(last - 60)
      expect(v.frames.filter((f) => f.n > last).length, where).toBeGreaterThan(200)
      expect(v.season, where).toBe(first)
      expect(v.target, where).toBe(null)
      expect(v.ready(next), where).toBe(false)
    }
  })

  it('is held off by the season pressed for last and by no other', async () => {
    for (const files of ['fail', 'hang'] as const)
      for (const reduced of [false, true]) {
        const where = `files ${files}, ${reduced ? 'reduced motion' : 'a shake'}`
        const v = await visit({ line: LINE, script: 12, work: 1200, press: 60, files, reduced, again: true })
        expect(v.second, where).not.toBe(null)
        expect(v.frames.filter((f) => f.n <= v.second!).every((f) => f.heard), where).toBe(true)
        expect(v.unheard.length, where).toBeGreaterThan(0)
        for (const f of v.frames) expect(f.heard, `${where}, frame ${f.n}`).toBe(!f.given)
        expect(v.landed, where).toBe(third)
        expect(v.ready(third), where).toBe(true)
        expect(v.ready(next), where).toBe(false)
        expect(v.lost, where).toBe(false)
      }
  })
})
