import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { config, shots } from '../src/config'
import { buildCut, cuesOf, cutList, groupsOf, openingCues, type AudioMap, type Cut } from '../src/film/cut'
import { cameraKeys, filmPose, cameraNumbers, loopCamera, loopDistanceMm, loopPose } from '../src/film/moves'
import { openingPlan } from '../src/film/opening'
import { barSeconds, filmTimeline, prerollSeconds, seasonAt } from '../src/film/timeline'
import { engineFiles, engineHash, hashList } from '../tools/lib/hashes.mjs'
import { rel } from '../tools/lib/paths.mjs'

const beats = config.film.beatsPerBar
const fps = config.film.fps
const groups = groupsOf()

function mapOf(bpm: number, bars: number, sectionBars: number[], opts: { tail?: number; lines?: number[] } = {}): AudioMap {
  const bar = (beats * 60) / bpm
  const barLines = opts.lines ?? Array.from({ length: bars }, (_, i) => i * bar)
  const seconds = (opts.lines ? opts.lines.at(-1)! + bar : bars * bar) + (opts.tail ?? 0)
  const at = (b: number) => (b >= barLines.length ? seconds : barLines[b]!)
  return {
    version: 1,
    file: 'music.wav',
    sha256: '',
    seconds,
    method: 'tracked',
    bpm,
    beatsPerBar: beats,
    beats: barLines.flatMap((t) => Array.from({ length: beats }, (_, k) => t + (k * 60) / bpm)),
    barLines,
    bars,
    sections: sectionBars.map((b, i) => ({ start: at(b), end: at(sectionBars[i + 1] ?? bars), loudness: -14 - i })),
    loudestSectionStart: at(sectionBars[0]!),
  }
}

function sound(cut: Cut): void {
  expect(cut.spans.map((s) => s.shot.id)).toEqual(shots.map((s) => s.id))
  expect(cut.spans[0]!.first).toBe(0)
  for (let i = 1; i < cut.spans.length; i++) expect(cut.spans[i]!.first).toBe(cut.spans[i - 1]!.last + 1)
  expect(cut.spans.at(-1)!.last).toBe(cut.frameCount - 1)
  expect(cut.seconds).toBe(cut.frameCount / cut.fps)
  const lines = [...cut.barLines, cut.frameCount]
  for (let i = 1; i < lines.length; i++) expect(lines[i]!).toBeGreaterThan(lines[i - 1]!)
  expect(cut.shakes.length).toBe(shots.filter((s) => s.kind === 'shake').length)
  for (const s of cut.shakes) {
    const at = lines.indexOf(s.first)
    expect(at, `${s.shot} starts on a bar line`).toBeGreaterThanOrEqual(0)
    expect(lines[at + 1], `${s.shot} lands on the next bar line`).toBe(s.landing)
    expect(cut.landings).toContain(s.landing)
    expect(s.first).toBeLessThan(s.liftEnd)
    expect(s.liftEnd).toBeLessThanOrEqual(s.swap.first)
    expect(s.swap.first).toBeLessThan(s.swap.last)
    expect(s.swap.last).toBeLessThan(s.strokesEnd)
    expect(s.strokesEnd).toBeLessThan(s.landing)
  }
  for (const span of cut.spans) if (span.shot.kind === 'hold') expect(span.bars, span.shot.id).toBeGreaterThanOrEqual(2)
  expect(cut.sections.length).toBe(groups.length)
  expect(cut.sections.reduce((n, s) => n + s.bars, 0)).toBe(cut.barLines.length)
  const tl = filmTimeline(cut)
  for (const s of cut.shakes) {
    expect(seasonAt(tl, prerollSeconds + (s.first + 0.5) / cut.fps).season).toBe(s.from)
    expect(seasonAt(tl, prerollSeconds + (s.landing + 0.5) / cut.fps).season).toBe(s.to)
  }
  expect(Math.max(...cameraNumbers(filmPose(cut, 0)).map((v, i) => Math.abs(v - cameraNumbers(filmPose(cut, (cut.frameCount - 1) / cut.fps))[i]!)))).toBeLessThan(1e-6)
}

describe('the cut with no map', () => {
  const cut = buildCut(null)

  it('is the default grid of the config', () => {
    expect(cut.source).toBe('default-grid')
    expect(cut.id).toBe('')
    expect(cut.bpm).toBe(config.film.defaultBpm)
    expect(cut.notes).toEqual([])
    expect(cut.musicFade).toBeNull()
    expect(cut.frameCount).toBe(Math.round(shots.reduce((n, s) => n + s.bars, 0) * barSeconds * fps))
    expect(cut.spans.map((s) => s.bars)).toEqual(shots.map((s) => s.bars))
    sound(cut)
  })

  it('is the same cut every time', () => {
    expect(JSON.stringify(cutList(buildCut(null), cameraKeys(buildCut(null))))).toBe(JSON.stringify(cutList(cut, cameraKeys(cut))))
  })
})

describe('the cut on a map with a section for every season', () => {
  const bpm = 96
  const starts = [0, 6, 11, 15, 20]
  const map = mapOf(bpm, 24, starts)
  const cut = buildCut(map)
  const bar = (beats * 60) / bpm

  it('uses the sections as they are', () => {
    expect(groups.length).toBe(5)
    expect(cut.source).toBe('audio-map')
    expect(cut.bpm).toBe(bpm)
    expect(cut.id).not.toBe('')
    expect(cut.frameCount).toBe(Math.round(map.seconds * fps))
    expect(cut.sections.map((s) => s.bars)).toEqual([6, 5, 4, 5, 4])
    expect(cut.sections.map((s) => s.season)).toEqual(groups.map((g) => (g[0]!.kind === 'hold' ? g[0]!.season : g[0]!.from)))
    expect(cut.notes.join(' ')).toContain('sections are used as they are')
    sound(cut)
  })

  it('lands every shake on the start of the next section, one bar of the music after it began', () => {
    expect(cut.landings).toEqual(starts.slice(1).map((b) => Math.round(b * bar * fps)))
    for (const s of cut.shakes) {
      expect(s.seconds).toBeCloseTo(bar, 9)
      expect(s.landing - s.first).toBe(Math.round(bar * fps))
    }
    const events = filmTimeline(cut).events.filter((e) => e.startSec >= prerollSeconds - 1e-9)
    expect(events.length).toBe(cut.shakes.length)
    events.forEach((e, i) => {
      expect(e.startSec).toBeCloseTo(prerollSeconds + cut.shakes[i]!.startSec, 9)
      expect(e.seconds ?? barSeconds).toBeCloseTo(bar, 9)
    })
  })

  it('gives a different id to a different fit and the same id to the same one', () => {
    expect(buildCut(mapOf(bpm, 24, starts)).id).toBe(cut.id)
    expect(buildCut(mapOf(bpm, 24, [0, 5, 11, 15, 20])).id).not.toBe(cut.id)
  })
})

describe('the cut on other maps', () => {
  it('splits the bars in the proportions of the default grid when the sections do not match the seasons, and moves a boundary to a section of the map that is near', () => {
    const cut = buildCut(mapOf(100, 30, [0, 13, 22]))
    expect(cut.source).toBe('audio-map')
    expect(cut.barLines.length).toBe(30)
    expect(cut.notes.join(' ')).toContain('3 sections')
    sound(cut)
    const landings = cut.shakes.map((s) => [...cut.barLines, cut.frameCount].indexOf(s.landing))
    expect(landings).toContain(13)
    for (const s of cut.sections) expect(s.bars).toBeGreaterThanOrEqual(3)
  })

  it('follows bar lines that drift, to the frame', () => {
    const lines = [0]
    for (let i = 1; i < 26; i++) lines.push(lines[i - 1]! + 2.4 + 0.03 * Math.sin(i * 1.7))
    const map = mapOf(100, 26, [0, 5, 10, 15, 20], { lines })
    const cut = buildCut(map)
    expect(cut.source).toBe('audio-map')
    expect(cut.barLines).toEqual(lines.map((t) => Math.round(t * fps)))
    sound(cut)
    for (const s of cut.shakes) expect(s.seconds).toBeCloseTo((s.landing - s.first) / fps, 9)
  })

  it('counts a pickup into the first bar', () => {
    const bar = 2.4
    const lines = [0.4, ...Array.from({ length: 24 }, (_, i) => 0.4 + (i + 1) * bar)]
    const cut = buildCut(mapOf(100, 25, [0, 5, 10, 15, 20], { lines }))
    expect(cut.barLines[0]).toBe(0)
    expect(cut.barLines[1]).toBe(Math.round((0.4 + bar) * fps))
    expect(cut.notes.join(' ')).toContain('pickup')
    sound(cut)
  })

  it('ends on a bar line and fades the sound when the music is longer than film.maxSeconds', () => {
    const bpm = 100
    const map = mapOf(bpm, 40, [0, 8, 16, 24, 32])
    expect(map.seconds).toBeGreaterThan(config.film.maxSeconds)
    const cut = buildCut(map)
    const last = Math.floor(config.film.maxSeconds / barSeconds + 1e-9)
    expect(cut.source).toBe('audio-map')
    expect(cut.seconds).toBeLessThanOrEqual(config.film.maxSeconds)
    expect(cut.frameCount).toBe(Math.round(last * barSeconds * fps))
    expect(cut.barLines.length).toBe(last)
    expect(cut.musicFade).toEqual({ from: Math.round((last - 1) * barSeconds * 1e4) / 1e4, to: Math.round(last * barSeconds * 1e4) / 1e4 })
    expect(cut.notes.join(' ')).toContain('longer than film.maxSeconds')
    sound(cut)
  })

  it('is as long as the music when the music is shorter than film.minSeconds', () => {
    const map = mapOf(120, 20, [0, 4, 8, 12, 16])
    expect(map.seconds).toBeLessThan(config.film.minSeconds)
    const cut = buildCut(map)
    expect(cut.source).toBe('audio-map')
    expect(cut.frameCount).toBe(Math.round(map.seconds * fps))
    expect(cut.musicFade).toBeNull()
    expect(cut.notes.join(' ')).toContain('shorter than film.minSeconds')
    sound(cut)
  })

  it('keeps the default grid when the music has too few bars for the shots', () => {
    const cut = buildCut(mapOf(60, 9, [0, 2, 4, 6, 8]))
    expect(cut.source).toBe('default-grid')
    expect(cut.notes.join(' ')).toContain('too few bars')
    expect(cut.frameCount).toBe(buildCut(null).frameCount)
    sound(cut)
  })
})

describe('the cues', () => {
  const cut = buildCut(null)
  const known = new Set(config.audio.sfx.map((s) => s.id))
  const { cues, ambience } = cuesOf(cut)

  it('names only cues the config holds, inside the film, in order', () => {
    for (const c of cues) {
      expect(known.has(c.cue), c.cue).toBe(true)
      expect(c.frame).toBeGreaterThanOrEqual(0)
      expect(c.frame).toBeLessThan(cut.frameCount)
      expect(c.at).toBeCloseTo(c.frame / fps, 4)
    }
    for (let i = 1; i < cues.length; i++) expect(cues[i]!.frame).toBeGreaterThanOrEqual(cues[i - 1]!.frame)
  })

  it('puts the lift and the shake on the first frame of every shake and the landing on its bar line', () => {
    for (const s of cut.shakes) {
      const at = (cue: string) => cues.filter((c) => c.cue === cue).map((c) => c.frame)
      if (known.has('lift')) expect(at('lift')).toContain(s.first)
      if (known.has(`shake-${s.to}`)) expect(at(`shake-${s.to}`)).toContain(s.first)
      if (known.has(`land-${s.to}`)) expect(at(`land-${s.to}`)).toContain(s.landing)
    }
  })

  it('lays one bed under every season, each crossing into the next over the bar of the shake', () => {
    expect(ambience.length).toBe(cut.shakes.length + 1)
    expect(ambience[0]!.from).toBe(0)
    expect(ambience.at(-1)!.to).toBeCloseTo(cut.seconds, 4)
    cut.shakes.forEach((s, i) => {
      expect(ambience[i]!.cue).toBe(`amb-${s.from}`)
      expect(ambience[i]!.to).toBeCloseTo(s.landing / fps, 4)
      expect(ambience[i]!.fadeOut).toBeCloseTo(s.seconds, 4)
      expect(ambience[i + 1]!.cue).toBe(`amb-${s.to}`)
      expect(ambience[i + 1]!.from).toBeCloseTo(s.first / fps, 4)
      expect(ambience[i + 1]!.fadeIn).toBeCloseTo(s.seconds, 4)
    })
  })

  it('gives the opening a tap for every character, then the send, all inside it', () => {
    const plan = openingPlan(fps)
    const list = openingCues(fps)
    expect(plan.seconds).toBeLessThanOrEqual(config.intro.maxSeconds)
    expect(plan.frameCount).toBeGreaterThan(0)
    if (known.has('key-tap')) expect(list.filter((c) => c.cue === 'key-tap').length).toBe(config.intro.prompt.length)
    for (const c of list) {
      expect(c.frame).toBeGreaterThanOrEqual(0)
      expect(c.frame).toBeLessThan(plan.frameCount)
    }
    expect(plan.typing.last).toBeLessThan(plan.reasoning.open)
    expect(plan.reasoning.open).toBeLessThan(plan.reasoning.choose)
    expect(plan.reasoning.choose).toBeLessThan(plan.send)
    expect(plan.send).toBeLessThan(plan.build.first)
    expect(plan.steps.length).toBe(config.intro.steps.length)
    expect(plan.steps.at(-1)!).toBeLessThan(plan.frameCount)
  })
})

describe('the cut list the tools read', () => {
  const cut = buildCut(null)
  const list = cutList(cut, cameraKeys(cut)) as Record<string, any>

  it('holds the frames of the film, the opening and the loop', () => {
    expect(list.frameCount).toBe(cut.frameCount)
    expect(list.fps).toBe(fps)
    expect(list.barLines).toEqual(cut.barLines)
    expect(list.landings).toEqual(cut.landings)
    expect(list.shots.map((s: { id: string }) => s.id)).toEqual(shots.map((s) => s.id))
    expect(list.shakes.length).toBe(cut.shakes.length)
    expect(list.opening.frameCount).toBe(openingPlan(fps).frameCount)
    expect(list.loop.frameCount).toBe(Math.round(config.deliver.cardLoop.seconds * fps))
    expect(list.cameraKeys.length).toBeGreaterThan(0)
    expect(JSON.stringify(list)).not.toMatch(/NaN|Infinity/)
  })

  it('says where the camera of the loop stands when it is not the camera of the config as given', () => {
    expect(list.loop.distanceMm).toBeUndefined()
    const told = cutList(cut, cameraKeys(cut), loopCamera()) as Record<string, any>
    expect(told.loop.camera).toBe(config.deliver.cardLoop.camera)
    expect(told.loop.distanceMm).toBeCloseTo(loopDistanceMm(), 1)
    expect(told.loop.cameraNumbers.length).toBe(7)
    cameraNumbers(loopPose(0)).forEach((v, i) => expect(told.loop.cameraNumbers[i]).toBeCloseTo(v, 3))
    expect(typeof told.loop.fit).toBe('string')
    expect(told.loop.fit).not.toMatch(/\u2014|!/)
    expect(JSON.stringify(told)).not.toMatch(/NaN|Infinity/)
  })
})

describe('the engine hash and the audio map', () => {
  const map = rel('cut', 'AUDIO-MAP.json')

  it('takes in the approved audio map when there is one, so a new map leaves no cached frame in place', () => {
    const without = engineFiles((f: string) => f !== map && fs.existsSync(f))
    const withIt = engineFiles((f: string) => f === map || fs.existsSync(f))
    expect(without).not.toContain(map)
    expect(withIt.at(-1)).toBe(map)
    expect(withIt.slice(0, -1)).toEqual(without)
    expect(engineFiles().includes(map)).toBe(fs.existsSync(map))
    expect(engineHash()).toBe(hashList(engineFiles()))
    expect(without.some((f: string) => f.endsWith(path.join('config', 'showcase.json')))).toBe(true)
    expect(without.some((f: string) => f.endsWith(path.join('src', 'film', 'cut.ts')))).toBe(true)
  })

  it('changes when a file of the list changes, and with every file added to it', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audiomap-'))
    const stand = path.join(dir, 'AUDIO-MAP.json')
    const some = engineFiles().slice(0, 3)
    fs.writeFileSync(stand, JSON.stringify({ bpm: 100 }))
    const a = hashList([...some, stand])
    fs.writeFileSync(stand, JSON.stringify({ bpm: 101 }))
    const b = hashList([...some, stand])
    expect(a).not.toBe(b)
    expect(a).not.toBe(hashList(some))
    expect(a).toMatch(/^[0-9a-f]{16}$/)
    fs.rmSync(dir, { recursive: true })
  })
})
