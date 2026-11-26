import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { tierSamples } from '../src/config'
import { finalVideoArgs, masterVideoArgs } from '../tools/lib/encode.mjs'
import { loadConfig, readJson, rel, writeJson } from '../tools/lib/paths.mjs'
import { branchFolder, branchMatches, chunkLines, chunkStem, coverReport, framesOf, heartbeat, joinPlan, lumaPsnrOf, nearestRanges, openingPack as readOpening, pad6, psnrOf, rangeChunks as chunksOfRange, ranges, readChunks, recordMatchesRun, resultName, split, stillName, stillToDo as leftToDo, table, tierOf, totalsFromCut } from '../tools/lib/master.mjs'
import { Shipper, collectBranches } from '../tools/lib/mastergit.mjs'
import { levelProblems, pictureLevels, procsProblem } from '../tools/lib/master.mjs'
import { limitsLine, limitsRecord, localProblem, machineLimits, procsGainLine, procsMemoryHolds, readLimits, sameCommand, stoppedAt, stoppedLine } from '../tools/lib/master.mjs'
import { bestRun, bigSha, butCrf, crfLadder, crfOf, encodeProofRows, finalKbps, hashFolder, intermediateVideo, masterConfigProblems, partName, partPlan, psnrFacts, sendGroups, splitFile, takeFiles, unsplitFile } from '../tools/lib/master.mjs'
import { flatValue, refuseFlat } from '../tools/lib/page.mjs'
import { frameLevels } from '../tools/lib/encode.mjs'
import sharp from 'sharp'

type Rec = Record<string, unknown> & { what: string; first: number; last: number }
type Chunk = { record: Rec; file: string; from: string }

type Line = { k: number; first: number; last: number }
type Pack = { width: number; height: number; fps: number; frameCount: number; frame: (i: number) => Promise<Buffer> }
const rangeChunks = chunksOfRange as (total: number, first?: number | null, last?: number | null, size?: number) => Line[]
const stillToDo = leftToDo as (chunks: Line[], on: { done: (c: Line) => boolean; has: (c: Line, i: number) => boolean }) => (Line & { missing: number[] })[]
const openingPack = readOpening as unknown as (dir: string, load: (dir: string) => Promise<unknown>) => Promise<Pack>

const cfg = loadConfig()
const M = cfg.deliver.master
const SIZE = 30
const totals = { 'film-b': 90, opening: 45, loop: 60 }
const ARGS = ['-c:v', 'libx264', '-crf', '15']

const rec = (what: keyof typeof totals, first: number, last: number, over: Record<string, unknown> = {}): Rec => ({
  what,
  first,
  last,
  frames: last - first + 1,
  total: totals[what],
  engineHash: 'build-1',
  renderer: what === 'opening' ? 'pack' : 'lavapipe',
  ...(what === 'opening' ? {} : { calibration: 'c'.repeat(64) }),
  samples: 12,
  format: 'uhd',
  fps: 60,
  encoderArgs: ARGS,
  sha256: `sha-${what}-${first}`,
  bytes: 1,
  frameHashes: Array.from({ length: last - first + 1 }, (_, i) => `px-${what}-${first + i}`),
  machine: 'vm-a',
  verify: { ok: true },
  ...over,
})
const chunk = (record: Rec, from = 'here'): Chunk => ({ record, file: `/x/${from}/${record.what}-${pad6(record.first)}.mp4`, from: `${from}/${record.what}-${pad6(record.first)}` })
const filmB = (over: Record<string, unknown> = {}) => [chunk(rec('film-b', 0, 29, over)), chunk(rec('film-b', 30, 59, over)), chunk(rec('film-b', 60, 89, over))]
const plan = (which: string, chunks: Chunk[], more: Record<string, unknown> = {}) => joinPlan({ which, chunks, totals, size: SIZE, ...more })
const refused = (which: string, chunks: Chunk[], rx: RegExp, more: Record<string, unknown> = {}) => {
  const p = plan(which, chunks, more)
  expect(p.ok).toBe(false)
  expect(p.problems.join('\n')).toMatch(rx)
  return p
}

describe('the chunk lines', () => {
  it('cuts every timeline at the same places, the last chunk shorter', () => {
    const film = chunkLines(3600)
    expect(film.length).toBe(3600 / M.chunkFrames)
    expect(film[0]).toEqual({ k: 0, first: 0, last: M.chunkFrames - 1 })
    expect(film[film.length - 1].last).toBe(3599)
    const odd = chunkLines(100, 30)
    expect(odd.map((c) => [c.first, c.last])).toEqual([[0, 29], [30, 59], [60, 89], [90, 99]])
    for (const total of [1, 29, 30, 31, 480, 870, 3600]) {
      const lines = chunkLines(total, 30)
      expect(lines.flatMap(framesOf)).toEqual(Array.from({ length: total }, (_, i) => i))
      for (const c of lines) expect(c.first).toBe(c.k * 30)
    }
  })

  it('gives the chunks of any range that is on the lines', () => {
    expect(rangeChunks(3600, null, null, 30).length).toBe(120)
    expect(rangeChunks(3600, 30, 89, 30).map((c) => c.k)).toEqual([1, 2])
    expect(rangeChunks(100, 90, 99, 30)).toEqual([{ k: 3, first: 90, last: 99 }])
    expect(rangeChunks(100, 60, null, 30).map((c) => c.first)).toEqual([60, 90])
    for (let a = 0; a < 4; a++) for (let b = a; b < 4; b++) expect(rangeChunks(100, a * 30, Math.min(b * 30 + 29, 99), 30).length).toBe(b - a + 1)
  })

  it('refuses a range off the lines and names the nearest ranges that are on them', () => {
    expect(() => rangeChunks(3600, 10, 100, 30)).toThrow(/not on the chunk lines.*--first 0 --last 119, or --first 30 --last 89/)
    expect(() => rangeChunks(3600, 10, 50, 30)).toThrow(/--first 0 --last 59/)
    expect(() => rangeChunks(3600, 0, 30, 30)).toThrow(/--first 0 --last 59, or --first 0 --last 29/)
    expect(() => rangeChunks(100, 90, 95, 30)).toThrow(/--first 90 --last 99/)
    expect(() => rangeChunks(3600, 0, 3600, 30)).toThrow(/past them/)
    expect(() => rangeChunks(3600, 60, 59, 30)).toThrow(/--last not before --first/)
    expect(() => rangeChunks(3600, 1.5, 59, 30)).toThrow(/frame indexes/)
    expect(nearestRanges(3600, 10, 100, 30)).toEqual([{ first: 0, last: 119 }, { first: 30, last: 89 }])
    for (const r of nearestRanges(100, 31, 97, 30)) expect(() => rangeChunks(100, r.first, r.last, 30)).not.toThrow()
  })
})

describe('what a second run still has to render', () => {
  const chunks = rangeChunks(90, null, null, 30)

  it('leaves out finished chunks and frames that are on disk', () => {
    const todo = stillToDo(chunks, { done: (c: Line) => c.first === 0, has: (_c: Line, i: number) => i < 40 })
    expect(todo.map((c) => c.first)).toEqual([30, 60])
    expect(todo[0].missing).toEqual(Array.from({ length: 20 }, (_, i) => 40 + i))
    expect(todo[1].missing.length).toBe(30)
    expect(stillToDo(chunks, { done: () => true, has: () => false })).toEqual([])
    const again = stillToDo(chunks, { done: () => false, has: () => true })
    expect(again.length).toBe(3)
    expect(again.every((c) => c.missing.length === 0)).toBe(true)
  })

  it('gives every chunk to one render process', () => {
    const lanes = [0, 1, 2].map((w) => split(chunkLines(300, 30), 3, w))
    expect(lanes.flat().length).toBe(10)
    expect(new Set(lanes.flat().map((c) => c.first)).size).toBe(10)
    expect(lanes[1].map((c: Line) => c.k)).toEqual([1, 4, 7])
  })

  it('takes a finished chunk as finished only when it is from this build, these samples and this encoder', () => {
    const want = { what: 'film-b', first: 0, last: 29, engineHash: 'build-1', samples: 12, format: 'uhd', fps: 60, test: false, encoderArgs: ARGS }
    expect(recordMatchesRun(rec('film-b', 0, 29), want)).toBe(true)
    expect(recordMatchesRun(null, want)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { engineHash: 'build-2' }), want)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { samples: 8 }), want)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { format: 'hd' }), want)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { encoderArgs: [...ARGS, '-g', '60'] }), want)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { test: true }), want)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { encoderArgs: ['-c:v', 'libx264', '-crf', '2'] }), want)).toBe(true)
    expect(recordMatchesRun(rec('film-b', 0, 29, { verify: { ok: false } }), want)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { frameHashes: ['one'] }), want)).toBe(false)
  })

  it('does not take a chunk drawn by another renderer, or on another calibration, as finished', () => {
    const want = { what: 'film-b', first: 0, last: 29, engineHash: 'build-1', samples: 12, format: 'uhd', fps: 60, test: false, renderer: 'lavapipe', calibration: 'c'.repeat(64), encoderArgs: ARGS }
    expect(recordMatchesRun(rec('film-b', 0, 29), want)).toBe(true)
    expect(recordMatchesRun(rec('film-b', 0, 29, { renderer: 'swiftshader' }), want)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { renderer: undefined }), want)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { calibration: 'd'.repeat(64) }), want)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { calibration: undefined }), want)).toBe(false)
    const pack = { what: 'opening', first: 0, last: 29, engineHash: 'build-1', samples: 12, format: 'uhd', fps: 60, test: false, renderer: 'pack', calibration: null, encoderArgs: ARGS }
    expect(recordMatchesRun(rec('opening', 0, 29), pack)).toBe(true)
  })
})

describe('the join', () => {
  it('takes whole coverage, in order, whatever order the chunks come in', () => {
    const p = plan('film-b', filmB().reverse())
    expect(p.problems).toEqual([])
    expect(p.ok).toBe(true)
    expect(p.frames).toBe(90)
    expect(p.parts.map((c: Chunk) => c.record.first)).toEqual([0, 30, 60])
    expect(plan('loop', [chunk(rec('loop', 0, 29)), chunk(rec('loop', 30, 59))]).ok).toBe(true)
  })

  it('refuses when a frame is covered by nothing', () => {
    refused('film-b', [filmB()[0], filmB()[2]], /frames 30 to 59 are covered by no chunk/)
    refused('film-b', [], /frames 0 to 89 are covered by no chunk/)
    refused('film-a', filmB(), /opening: frames 0 to 44 are covered by no chunk/)
  })

  it('refuses when two chunks cover a frame and their frame hashes differ', () => {
    const other = rec('film-b', 30, 59, { machine: 'vm-b', sha256: 'sha-other' })
    ;(other.frameHashes as string[])[4] = 'px-different'
    const p = refused('film-b', [...filmB(), chunk(other, 'there')], /both cover frames 30 to 59 and their frame hashes differ in 1 of them \(the first is frame 34\)/)
    expect(p.conflicts.length).toBe(1)
    expect(p.conflicts[0].frames).toEqual([34])
  })

  it('counts equal hashes from two machines as proof and joins', () => {
    const p = plan('film-b', [...filmB(), chunk(rec('film-b', 30, 59, { machine: 'vm-b', sha256: 'sha-other' }), 'there')])
    expect(p.ok).toBe(true)
    expect(p.parts.length).toBe(3)
    expect(p.twiceByTwoMachines).toBe(30)
    const same = plan('film-b', [...filmB(), chunk(rec('film-b', 30, 59, { sha256: 'sha-other' }), 'there')])
    expect(same.twice).toBe(30)
    expect(same.twiceByTwoMachines).toBe(0)
  })

  it('refuses when the build, the samples, the format or the encoder differ between chunks', () => {
    const one = (over: Record<string, unknown>) => [filmB()[0], chunk(rec('film-b', 30, 59, over)), filmB()[2]]
    refused('film-b', one({ engineHash: 'build-2' }), /the build hash of film-b differs between chunks/)
    refused('film-b', one({ samples: 8 }), /the samples of film-b differs between chunks/)
    refused('film-b', one({ format: 'hd' }), /the format differs between chunks/)
    refused('film-b', one({ encoderArgs: [...ARGS, '-g', '60'] }), /the list of encoder arguments \(but for the quality\) differs between chunks/)
    expect(plan('film-b', one({ encoderArgs: ['-c:v', 'libx264', '-crf', '4'] })).problems).toEqual([])
    refused('film-b', one({ fps: 30 }), /the frame rate differs between chunks/)
    refused('film-b', one({ renderer: 'swiftshader' }), /the renderer of film-b differs between chunks/)
    refused('film-b', one({ calibration: 'd'.repeat(64) }), /the calibration picture of film-b differs between chunks/)
    refused('film-b', one({ calibration: undefined }), /names no calibration picture/)
    expect(plan('film-a', [chunk(rec('opening', 0, 29)), chunk(rec('opening', 30, 59)), ...filmB()]).problems.join(' ')).not.toMatch(/renderer|calibration/)
  })

  it('refuses a chunk marked test, and a test join takes nothing else', () => {
    refused('film-b', [filmB()[0], chunk(rec('film-b', 30, 59, { test: true })), filmB()[2]], /is marked test/)
    refused('film-b', filmB(), /is not marked test/, { test: true })
    const p = plan('film-b', [chunk(rec('film-b', 30, 59, { test: true })), chunk(rec('film-b', 60, 89, { test: true }))], { test: true })
    expect(p.ok).toBe(true)
    expect(p.frames).toBe(60)
    expect(p.parts.map((c: { offset: number }) => c.offset)).toEqual([-30, -30])
    refused('film-b', [chunk(rec('film-b', 0, 29, { test: true })), chunk(rec('film-b', 60, 89, { test: true }))], /frames 30 to 59 are covered by no chunk/, { test: true })
  })

  it('refuses a chunk whose mp4 is not the one its record names', () => {
    refused('film-b', filmB(), /does not match the sha256 in its record \(it is changed/, { sha: (f: string) => (f.includes('000030') ? 'changed' : `sha-film-b-${Number(f.slice(-10, -4))}`) })
    refused('film-b', filmB(), /the mp4 is missing/, { sha: (f: string) => (f.includes('000060') ? null : `sha-film-b-${Number(f.slice(-10, -4))}`) })
    expect(plan('film-b', filmB(), { sha: (f: string) => `sha-film-b-${Number(f.slice(-10, -4))}` }).ok).toBe(true)
  })

  it('refuses chunks that are off the lines, of another plan, never verified or without their hashes', () => {
    refused('film-b', [...filmB(), chunk(rec('film-b', 10, 39))], /frames 10 to 39\) is not on the chunk lines/)
    refused('film-b', [...filmB().slice(0, 2), chunk(rec('film-b', 60, 80))], /is not on the chunk lines/)
    refused('film-b', filmB({ total: 120 }), /rendered for a plan of 120 frames, and the plan \(cut\/CUTLIST\.json\) holds 90/)
    refused('film-b', filmB({ verify: { ok: false } }), /was never verified/)
    refused('film-b', filmB({ frameHashes: [] }), /holds 0 frame hashes for 30 frames/)
    expect(() => plan('film-c', filmB())).toThrow(/--encode takes film-b, film-a, loop/)
  })

  it("joins film A from the opening's chunks and then film B's", () => {
    const opening = [chunk(rec('opening', 0, 29, { samples: 0, engineHash: 'build-0' })), chunk(rec('opening', 30, 44, { samples: 0, engineHash: 'build-0' }))]
    const p = plan('film-a', [...filmB(), ...opening])
    expect(p.problems).toEqual([])
    expect(p.frames).toBe(135)
    expect(p.parts.map((c: Chunk & { offset: number }) => [c.record.what, c.record.first, c.offset])).toEqual([['opening', 0, 0], ['opening', 30, 0], ['film-b', 0, 45], ['film-b', 30, 45], ['film-b', 60, 45]])
    refused('film-a', [...filmB(), opening[0]], /opening: frames 30 to 44 are covered by no chunk/)
    refused('film-a', [...filmB(), opening[0], chunk(rec('opening', 30, 59, { samples: 0, engineHash: 'build-0', total: 60 }))], /opening were rendered for a plan of 60 frames/)
  })
})

describe('names', () => {
  it('names the results as the config gives them, each its own', () => {
    expect(resultName('film-a')).toBe(M.names['film-a'])
    expect(resultName('film-b')).toBe(M.names['film-b'])
    expect(resultName('loop')).toBe(M.names.loop)
    expect(resultName('still')).toBe(M.names.still)
    expect(new Set(['film-a', 'film-b', 'loop', 'still'].map(resultName)).size).toBe(4)
    expect(() => resultName('film-c')).toThrow(/no name for film-c/)
  })

  it('names chunks, frames, tiers and branches', () => {
    expect(chunkStem('film-b', 30, 59)).toBe('film-b-000030-000059')
    expect(chunkStem('opening', 840, 869)).toBe('opening-000840-000869')
    expect(stillName()).toBe('frame-000000.png')
    expect(tierOf(12)).toBe('samples-12')
    expect(tierSamples(tierOf(12))).toBe(12)
    expect(tierSamples('final')).toBe(cfg.tiers.final.samplesPerFrame)
    expect(() => tierSamples('samples-0')).toThrow(/no such tier/)
    expect(() => tierSamples('samples-x')).toThrow(/no such tier/)
    expect(branchMatches('agent/p6-chunks-vm3')).toBe(true)
    expect(branchMatches('agent/p6-chunks-test')).toBe(true)
    expect(branchMatches('agent/p6-master')).toBe(false)
    expect(branchMatches('x/agent/p6-chunks-vm3')).toBe(false)
    expect(branchMatches(cfg.repo.branch)).toBe(false)
    expect(branchFolder('agent/p6-chunks-vm3')).toBe('agent_p6-chunks-vm3')
  })

  it('takes the frame counts from the cut', () => {
    const cut = readJson(rel('cut', 'CUTLIST.json'))
    expect(totalsFromCut()).toEqual({ 'film-b': cut.frameCount, opening: cut.opening.frameCount, loop: cut.loop.frameCount })
    expect(cut.fps).toBe(cfg.film.fps)
  })

  it('pins a closed GOP of one chunk, no scene cuts and no rate cap for the intermediate', () => {
    const v = intermediateVideo()
    const a = masterVideoArgs(v, M.chunkFrames).join(' ')
    expect(a).toContain(`-g ${M.chunkFrames} -keyint_min ${M.chunkFrames} -sc_threshold 0`)
    expect(a).toContain('+cgop+bitexact')
    expect(a).toContain('open-gop=0')
    expect(a).toContain(`-preset ${M.intermediate.preset} `)
    expect(a).toContain(`-crf ${M.intermediate.crf} `)
    expect(a).not.toMatch(/maxrate|bufsize/)
    expect(a).toContain('-pix_fmt yuv420p')
    expect(a).toContain('-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv')
    expect(() => masterVideoArgs({ ...v, codec: 'vp9' }, 30)).toThrow(/no master encoder/)
  })
})

describe('what the tool says', () => {
  it('writes one heartbeat line a frame', () => {
    const line = heartbeat({ chunk: { first: 30, last: 59 }, frame: 41, seconds: 12.34, left: 720, average: 10 })
    expect(line).toBe('chunk 000030-000059 · frame 41 · 12.3 s · 720 frames left in the range · 2.00 h left at 10.0 s a frame')
  })

  it('writes the proof as one table', () => {
    const t = table([{ check: 'frames', wanted: 60, found: 60, pass: true }, { check: 'size', wanted: '3840 x 2160', found: '1920 x 1080', pass: false }, { check: 'seam', wanted: 'measured', found: '3 of 255', pass: null }]).split('\n')
    expect(t.length).toBe(5)
    expect(t[2]).toMatch(/^frames\s+60\s+60\s+pass$/)
    expect(t[3]).toMatch(/FAIL$/)
    expect(t[4]).toMatch(/measured$/)
  })

  it('says what is there and what is missing, by range', () => {
    const r = coverReport([chunk(rec('film-b', 0, 29)), chunk(rec('film-b', 60, 89)), chunk(rec('film-b', 30, 59, { test: true }))], totals, SIZE)
    const b = r.find((x) => x.what === 'film-b')!
    expect(b.there).toEqual([{ first: 0, last: 29 }, { first: 60, last: 89 }])
    expect(b.missing).toEqual([{ first: 30, last: 59 }])
    expect(b.chunks).toBe(2)
    expect(b.wanted).toBe(3)
    expect(ranges([5, 1, 2, 3, 9, 8])).toEqual([{ first: 1, last: 3 }, { first: 5, last: 5 }, { first: 8, last: 9 }])
  })

  it('measures two pictures', () => {
    const a = Buffer.from([10, 20, 30, 40])
    expect(psnrOf(a, Buffer.from(a)).psnr).toBe(Infinity)
    const d = psnrOf(a, Buffer.from([10, 20, 30, 44]))
    expect(d.maxDiff).toBe(4)
    expect(d.differing).toBe(1)
    expect(d.psnr).toBeCloseTo(10 * Math.log10((255 * 255) / 4), 6)
    expect(() => psnrOf(a, Buffer.from([1]))).toThrow(/different sizes/)
    const grey = Buffer.from([100, 100, 100, 50, 60, 70])
    expect(lumaPsnrOf(grey, Buffer.from(grey))).toBe(Infinity)
    expect(lumaPsnrOf(grey, Buffer.from([102, 102, 102, 52, 62, 72]))).toBeCloseTo(10 * Math.log10((255 * 255) / 4), 6)
    expect(lumaPsnrOf(Buffer.from([100, 100, 100]), Buffer.from([100, 100, 110]))).toBeGreaterThan(psnrOf(Buffer.from([100, 100, 100]), Buffer.from([100, 100, 110])).psnr)
  })
})

describe('files on disk', () => {
  let dir = ''
  const git = (cwd: string, ...a: string[]) => spawnSync('git', a, { cwd, encoding: 'utf8' })

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'master-test-'))
  })
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('finds chunk records in any folder and knows the test ones by their place', () => {
    const root = path.join(dir, 'collected')
    writeJson(path.join(root, 'agent_p6-chunks-a', 'film-b', 'film-b-000000-000029.json'), rec('film-b', 0, 29))
    writeJson(path.join(root, 'agent_p6-chunks-a', 'test', 'film-b', 'film-b-000030-000059.json'), rec('film-b', 30, 59, { test: true }))
    writeJson(path.join(root, 'agent_p6-chunks-a', 'film-b', 'notes.json'), { what: 'film-b' })
    writeJson(path.join(root, 'agent_p6-chunks-a', 'loop', 'loop-000000-000029.json'), { what: 'something else', first: 0, last: 29 })
    const found = readChunks([root])
    expect(found.map((c: { inside: string }) => c.inside)).toEqual(['agent_p6-chunks-a/film-b/film-b-000000-000029.mp4', 'agent_p6-chunks-a/test/film-b/film-b-000030-000059.mp4'])
    expect(found.map((c: { test: boolean }) => c.test)).toEqual([false, true])
    expect(found[0].from).toBe('collected/agent_p6-chunks-a/film-b/film-b-000000-000029.mp4')
    expect(readChunks([path.join(dir, 'nothing')])).toEqual([])
  })

  it("reads the opening's pictures through one small function", async () => {
    const pack = path.join(dir, 'opening')
    await expect(openingPack(pack, async () => ({}))).rejects.toThrow(/holds no manifest\.json/)
    writeJson(path.join(pack, 'manifest.json'), { frameCount: 3 })
    const load = async (d: string) => ({ width: 4, height: 2, fps: 60, frameCount: readJson(path.join(d, 'manifest.json')).frameCount, background: [0, 0, 0], frame: async (i: number) => Buffer.alloc(4 * 2 * 3, i) })
    const p = await openingPack(pack, load)
    expect([p.width, p.height, p.fps, p.frameCount]).toEqual([4, 2, 60, 3])
    expect((await p.frame(2)).equals(Buffer.alloc(24, 2))).toBe(true)
    await expect(openingPack(pack, async () => ({ width: 4, height: 2, fps: 60, frameCount: 0 }))).rejects.toThrow(/gives no frameCount/)
  })

  it('ships chunks from two machines to one orphan branch and collects them', () => {
    const remote = path.join(dir, 'remote.git')
    fs.mkdirSync(remote)
    expect(git(remote, 'init', '-q', '--bare').status).toBe(0)
    const facts = { url: remote, commit: 'none', name: 'Test Person', email: 'test@example.com' }
    const said: string[] = []
    const say = (l: string) => said.push(l)
    const file = (name: string, text: string) => {
      const f = path.join(dir, 'made', name)
      fs.mkdirSync(path.dirname(f), { recursive: true })
      fs.writeFileSync(f, text)
      return f
    }
    const branch = 'agent/p6-chunks-unit'
    const a = new Shipper({ branch, say, root: path.join(dir, 'ship-a'), facts })
    const b = new Shipper({ branch, say, root: path.join(dir, 'ship-b'), facts })
    a.prepare()
    b.prepare()
    writeJson(file('film-b-000000-000029.json', ''), rec('film-b', 0, 29))
    writeJson(file('film-b-000030-000059.json', ''), rec('film-b', 30, 59, { machine: 'vm-b' }))
    expect(a.add([{ src: file('film-b-000000-000029.mp4', 'one'), to: 'film-b/film-b-000000-000029.mp4' }, { src: path.join(dir, 'made', 'film-b-000000-000029.json'), to: 'film-b/film-b-000000-000029.json' }], 'Chunk film-b-000000-000029')).toBe(true)
    expect(a.push()).toBe(true)
    expect(a.add([{ src: path.join(dir, 'made', 'film-b-000000-000029.mp4'), to: 'film-b/film-b-000000-000029.mp4' }], 'Chunk again')).toBe(false)
    expect(b.add([{ src: file('film-b-000030-000059.mp4', 'two'), to: 'film-b/film-b-000030-000059.mp4' }, { src: path.join(dir, 'made', 'film-b-000030-000059.json'), to: 'film-b/film-b-000030-000059.json' }], 'Chunk film-b-000030-000059')).toBe(true)
    expect(b.push()).toBe(true)
    expect(b.unpushed).toBe(false)

    const log = git(remote, 'log', '--format=%B', branch).stdout
    expect(git(path.join(dir, 'ship-a', 'agent_p6-chunks-unit'), 'config', '--local', 'user.email').stdout.trim()).toBe('test@example.com')
    expect(log).toContain('Chunk film-b-000030-000059')
    for (const body of git(remote, 'log', '--format=%B%x00', branch).stdout.split('\0').filter((x) => x.trim())) expect(body.match(/Co-authored-by: Perplexity <noreply@perplexity\.ai>/g)?.length).toBe(1)
    expect(git(remote, 'branch', '--list').stdout.trim().split('\n').length).toBe(1)

    const into = path.join(dir, 'collected-2')
    const found = collectBranches({ dir: into, say, facts, pattern: 'agent/p6-chunks-*' })
    expect(found.map((x: { branch: string }) => x.branch)).toEqual([branch])
    expect(fs.existsSync(path.join(into, '.clone'))).toBe(false)
    expect(fs.existsSync(path.join(into, 'agent_p6-chunks-unit', '.git'))).toBe(false)
    const chunks = readChunks([into])
    expect(chunks.map((c: Chunk) => c.record.first)).toEqual([0, 30])
    expect(fs.readFileSync(chunks[1].file, 'utf8')).toBe('two')
    expect(collectBranches({ dir: into, say, facts, pattern: 'agent/p6-chunks-*' }).length).toBe(1)
    expect(said.join('\n')).toMatch(/unchanged at/)
    expect(() => new Shipper({ branch: cfg.repo.branch, say, root: dir, facts })).toThrow(/never the code branch/)
    expect(() => new Shipper({ branch, say, root: dir, facts: { ...facts, name: '' } })).toThrow(/user\.name and user\.email are not set/)
  })
})

describe('a flat frame', () => {
  const flatPng = (v: number) => sharp({ create: { width: 64, height: 36, channels: 3, background: { r: v, g: v, b: v } } }).png().toBuffer()
  const realPng = async () => {
    const raw = Buffer.alloc(64 * 36 * 3)
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 7) % 251
    return sharp(raw, { raw: { width: 64, height: 36, channels: 3 } }).png().toBuffer()
  }

  it('is refused when a picture comes back as one value, black or any other', async () => {
    expect(await flatValue(await flatPng(0))).toEqual([0, 0, 0])
    expect(await flatValue(await flatPng(37))).toEqual([37, 37, 37])
    expect(await flatValue(await realPng())).toBeNull()
    await expect(refuseFlat(await flatPng(0), 'film-b frame 12')).rejects.toThrow(/film-b frame 12 came back as one flat value \(0, 0, 0\)/)
    await expect(refuseFlat(await realPng(), 'film-b frame 12')).resolves.toBeUndefined()
  })

  it('is seen in the raw picture, with the mean a decoded frame must keep', () => {
    expect(pictureLevels(Buffer.alloc(300, 0))).toEqual({ flat: true, mean: 16 })
    expect(pictureLevels(Buffer.alloc(300, 255)).mean).toBeCloseTo(235, 6)
    const mixed = Buffer.alloc(300, 0)
    mixed[299] = 9
    expect(pictureLevels(mixed).flat).toBe(false)
  })

  it('fails a chunk whose decoded frame is flat or has drifted from its picture', () => {
    const src = [{ index: 30, mean: 60, flat: false }, { index: 31, mean: 61, flat: false }]
    expect(levelProblems([{ flat: false, mean: 60.2, min: 16, max: 200 }, { flat: false, mean: 60.9, min: 16, max: 200 }], src)).toEqual([])
    expect(levelProblems([{ flat: true, mean: 16, min: 16, max: 16 }, { flat: false, mean: 61, min: 16, max: 200 }], src).join(' ')).toMatch(/frame 30 decodes to one flat value \(16\)/)
    expect(levelProblems([{ flat: false, mean: 60, min: 16, max: 200 }, { flat: false, mean: 63.5, min: 16, max: 200 }], src).join(' ')).toMatch(/frame 31 decodes to a mean of 63.50 and its picture's is 61.00/)
    expect(levelProblems([{ flat: true, mean: 16, min: 16, max: 16 }], [{ index: 0, mean: 16, flat: true }])).toEqual([])
  })

  it('is found in an encoded file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flat-'))
    const file = path.join(dir, 'flat.mp4')
    const made = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=64x36:rate=60:duration=0.05', '-f', 'lavfi', '-i', 'color=black:size=64x36:rate=60:duration=0.05', '-filter_complex', '[0:v][1:v]concat=n=2:v=1', '-pix_fmt', 'yuv420p', '-c:v', 'libx264', file])
    if (made.error || made.status !== 0) return
    const levels = frameLevels(file) as { flat: boolean }[]
    expect(levels.map((f) => f.flat)).toEqual([false, false, false, true, true, true])
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe('the one encode of a master', () => {
  it('holds a config that level 5.2 can play, and names what is wrong when it does not', () => {
    expect(masterConfigProblems()).toEqual([])
    const bad = (change: (m: typeof M) => void, rx: RegExp) => {
      const m = JSON.parse(JSON.stringify(M))
      change(m)
      expect(masterConfigProblems(m).join('\n')).toMatch(rx)
    }
    bad((m) => delete m.intermediate, /intermediate is missing/)
    bad((m) => (m.intermediate.partMb = 60), /partMb \(60\) is not above 0 and at most 50/)
    bad((m) => (m.intermediate.crf = 40), /intermediate\.crf \(40\)/)
    bad((m) => (m.final.passes = 1), /passes \(1\) is not 2/)
    bad((m) => (m.final.targetMb['film-b'] = cfg.platform.maxFileMb + 1), /targetMb\.film-b .* at most platform\.maxFileMb/)
    bad((m) => (m.final.refs = 6), /refs \(6\) is not 1 to 5/)
    bad((m) => (m.final.keyint = 30), /keyint \(30\) is under/)
    bad((m) => (m.video.maxrateMbps = 400), /wider than level 5\.2/)
    bad((m) => delete m.final.loop.seamDb, /seamDb is missing/)
  })

  it('asks for a long GOP, two passes to a rate, and nothing wider than the level', () => {
    const a = finalVideoArgs(M.video, M.final, { kbps: 60000, threads: 4 }).join(' ')
    expect(a).toContain(`-preset ${M.final.preset} -profile:v high -level:v 5.2 -pix_fmt yuv420p -b:v 60000k`)
    expect(a).toContain(`-maxrate ${M.video.maxrateMbps * 1000}k -bufsize ${M.video.bufsizeMbps * 1000}k`)
    expect(a).toContain(`-g ${M.final.keyint} -keyint_min ${M.final.minKeyint} -bf ${M.final.bframes} -refs ${M.final.refs}`)
    expect(a).toContain(`aq-mode=${M.final.aqMode}`)
    expect(a).toContain('open-gop=0')
    expect(a).not.toContain('sc_threshold')
    expect(a).toContain('-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv')
    const loop = finalVideoArgs(M.video, M.final, { crf: 10, params: M.final.loop.params }).join(' ')
    expect(loop).toContain('-crf 10')
    expect(loop).not.toContain('-b:v')
    if (M.final.loop.params) expect(loop).toContain(M.final.loop.params)
    expect(() => finalVideoArgs(M.video, M.final, {})).toThrow(/a rate or to a quality/)
    expect(() => finalVideoArgs(M.video, M.final, { kbps: 1, crf: 1 })).toThrow(/a rate or to a quality/)
    expect(() => finalVideoArgs({ ...M.video, codec: 'vp9' }, M.final, { crf: 1 })).toThrow(/no master encoder/)
  })

  it('tries a chunk that missed its floor at lower crf, and takes it as the same chunk', () => {
    expect(crfLadder(6)).toEqual([6, 4, 2, 0])
    expect(crfLadder(5)).toEqual([5, 3, 1, 0])
    expect(crfLadder(0)).toEqual([0])
    expect(butCrf(['-c:v', 'libx264', '-crf', '6', '-g', '30'])).toEqual(['-c:v', 'libx264', '-g', '30'])
    expect(butCrf(['-g', '30'])).toEqual(['-g', '30'])
    expect(crfOf({ encoderArgs: masterVideoArgs({ ...intermediateVideo(), crf: 4 }, 30) })).toBe(4)
    expect(crfOf({})).toBe(null)
  })

  it('works out the rate that fills the target with the sound in it', () => {
    const kbps = finalKbps({ targetMb: 500, seconds: 60, audioKbps: 320 })
    expect(kbps).toBeGreaterThan(64000)
    expect(kbps).toBeLessThan(66667 - 320)
    expect(((kbps + 320) * 60) / 8000).toBeLessThan(500)
    expect(finalKbps({ targetMb: 500, seconds: 74.45, audioKbps: 320 })).toBeLessThan(kbps)
    expect(() => finalKbps({ targetMb: 0.001, seconds: 60, audioKbps: 320 })).toThrow(/leaves no bits/)
    expect(() => finalKbps({ targetMb: 500, seconds: 0 })).toThrow(/above zero/)
  })

  it('gives the least and mean of a list, and its best second', () => {
    expect(psnrFacts([44, 41.234, 43], 60)).toEqual({ least: 41.23, leastFrame: 61, mean: 42.74 })
    expect(bestRun([1, 5, 6, 2, 9], 2)).toEqual({ first: 1, last: 2, mean: 5.5 })
    expect(bestRun([1, 2], 60)).toEqual({ first: 0, last: 1, mean: 1.5 })
    expect(bestRun([], 60)).toBe(null)
    expect(sendGroups(Array.from({ length: 23 }, (_, i) => i)).map((g: number[]) => g.length)).toEqual([10, 10, 3])
  })

  const facts = (over: Record<string, unknown> = {}) => ({
    wantFrames: 3600,
    frames: 3600,
    decodeErrors: [] as string[],
    format: { width: 3840, height: 2160 },
    width: 3840,
    height: 2160,
    steps: { off: 0, count: 3599, start: 0, firstOff: 0 },
    rFrameRate: '60/1',
    avgFrameRate: '60/1',
    pixFmt: 'yuv420p',
    tags: 'bt709 / bt709 / bt709 / tv',
    codec: 'h264',
    profile: 'High',
    level: 52,
    refs: 5,
    keys: Array.from({ length: 12 }, (_, i) => i * 300),
    sound: { wanted: true, codec: 'aac', sampleRate: cfg.audio.sampleRate, channels: 2, kbps: 317, seconds: 60, pictureSeconds: 60 },
    flat: 0,
    flatAllowed: 0,
    fast: true,
    bytes: 498e6,
    targetMb: 500,
    minPsnr: M.final.minPsnr,
    psnr: { least: M.final.minPsnr + 3, leastFrame: 700, mean: M.final.minPsnr + 6 },
    bestHold: { first: 60, last: 119, mean: 44.5 },
    ...over,
  })
  type Row = { check: string; pass: boolean | null; found: string; wanted: string }
  const failing = (over: Record<string, unknown>) => (encodeProofRows(facts(over)) as Row[]).filter((r) => r.pass === false).map((r) => r.check)

  it('proves a finished film row by row', () => {
    const rows = encodeProofRows(facts()) as Row[]
    expect(rows.filter((r) => r.pass === false)).toEqual([])
    expect(rows.map((r) => r.check)).toEqual(['frames', 'every frame decodes', 'size of the picture', 'pts steps', 'frame rate', 'pixel format', 'colour tags', 'codec', 'reference frames', 'key frames', 'sound', 'sound bit rate', 'sound length', 'flat frames', 'starts fast', 'file size', 'luma PSNR against the chunks', 'the best hold'])
    expect(rows.find((r) => r.check === 'the best hold')?.pass).toBe(null)
    expect(table(rows)).toMatch(/luma PSNR against the chunks .* least .* dB at frame 700, mean .* dB +pass/)
  })

  it('fails the row that is wrong and no other', () => {
    expect(failing({ frames: 3599 })).toEqual(['frames'])
    expect(failing({ decodeErrors: ['broken'] })).toEqual(['every frame decodes'])
    expect(failing({ steps: { off: 1, count: 3599, start: 0, firstOff: 0.03 } })).toEqual(['pts steps'])
    expect(failing({ avgFrameRate: '359900/5999' })).toEqual(['frame rate'])
    expect(failing({ pixFmt: 'yuv444p' })).toEqual(['pixel format'])
    expect(failing({ tags: 'unknown / bt709 / bt709 / tv' })).toEqual(['colour tags'])
    expect(failing({ level: 60 })).toEqual(['codec'])
    expect(failing({ profile: 'High 4:4:4 Predictive' })).toEqual(['codec'])
    expect(failing({ refs: 8 })).toEqual(['reference frames'])
    expect(failing({ keys: [0, 301, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 3000, 3300] })).toEqual(['key frames'])
    expect(failing({ keys: [0, 300] })).toEqual(['key frames'])
    expect(failing({ keys: Array.from({ length: 12 }, (_, i) => i * 300 + 2) })).toEqual(['key frames'])
    expect(failing({ sound: { wanted: true, codec: null } })).toEqual(['sound', 'sound bit rate', 'sound length'])
    expect(failing({ sound: { wanted: true, codec: 'aac', sampleRate: cfg.audio.sampleRate, channels: 2, kbps: 317, seconds: 59.5, pictureSeconds: 60 } })).toEqual(['sound length'])
    expect(failing({ sound: { wanted: false, codec: 'aac' } })).toEqual(['sound'])
    expect(failing({ sound: { wanted: false, codec: null } })).toEqual([])
    expect(failing({ flat: 1 })).toEqual(['flat frames'])
    expect(failing({ flat: 3, flatAllowed: 3 })).toEqual([])
    expect(failing({ fast: false })).toEqual(['starts fast'])
    expect(failing({ bytes: 500.2e6 })).toEqual(['file size'])
    expect(failing({ bytes: 600e6, targetMb: null })).toEqual(['file size'])
    expect(failing({ psnr: { least: M.final.minPsnr - 0.01, leastFrame: 12, mean: 50 } })).toEqual(['luma PSNR against the chunks'])
    expect(failing({ opening: { wanted: 867, found: 866 } })).toEqual(["the opening's frames"])
  })

  it('holds the loop to the best second of film B and to an even wrap', () => {
    const loop = (l: Record<string, unknown>, more: Record<string, unknown> = {}) => failing({ wantFrames: 480, frames: 480, keys: [0, 300], sound: { wanted: false, codec: null }, targetMb: null, bestHold: null, psnr: { least: 45, leastFrame: 200, mean: 46 }, loop: { wanted: 44.5, first: 45.4, last: 45.1, seamDb: 1, ...l }, ...more })
    expect(loop({})).toEqual([])
    expect(loop({ wanted: 45.2 })).toEqual(["the loop against film B's best hold"])
    expect(loop({ last: 43.9 })).toEqual(['the wrap'])
    expect(loop({ wanted: null })).toEqual(["the loop against film B's best hold"])
    expect(loop({ wanted: null }, { test: true })).toEqual([])
  })
})

describe('files that travel by attachment', () => {
  let box: string
  beforeAll(() => {
    box = fs.mkdtempSync(path.join(os.tmpdir(), 'snow-globe-parts-'))
  })
  afterAll(() => fs.rmSync(box, { recursive: true, force: true }))
  const bytesOf = (n: number, seed: number) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 31 + seed * 7 + (i >> 5)) & 255))
  const mb = (bytes: number) => bytes / 1e6

  it('cuts a file into as few even parts as the limit allows', () => {
    expect(partPlan(100, 45)).toEqual([{ k: 1, n: 1, start: 0, bytes: 100 }])
    const p = partPlan(100e6, 45)
    expect(p.length).toBe(3)
    expect(p.reduce((n: number, x: { bytes: number }) => n + x.bytes, 0)).toBe(100e6)
    for (const x of p) expect(x.bytes).toBeLessThanOrEqual(45e6)
    expect(p.map((x: { start: number }) => x.start)).toEqual([0, 33333334, 66666668])
    expect(partPlan(45e6, 45).length).toBe(1)
    expect(partPlan(45e6 + 1, 45).length).toBe(2)
    expect(partPlan(500e6, 45).length).toBe(12)
    expect(partName('film.mp4', 3, 12)).toBe('film.mp4.part-03-of-12')
    expect(() => partPlan(10, 0)).toThrow(/some size/)
  })

  it('splits a file and puts it together again from parts under any names, in any order', () => {
    const file = path.join(box, 'film.mp4')
    fs.writeFileSync(file, bytesOf(10007, 1))
    const made = splitFile(file, path.join(box, 'parts'), mb(3000))
    expect(made.parts.length).toBe(4)
    expect(made.bytes).toBe(10007)
    expect(made.sha256).toBe(bigSha(file))
    expect(made.parts.map((p: { file: string }) => p.file)).toEqual([1, 2, 3, 4].map((k) => `film.mp4.part-0${k}-of-04`))
    const flat = path.join(box, 'came')
    fs.mkdirSync(flat)
    made.parts.forEach((p: { file: string }, k: number) => fs.copyFileSync(path.join(box, 'parts', p.file), path.join(flat, `attachment (${4 - k}).bin`)))
    const out = path.join(box, 'again', 'film.mp4')
    const got = unsplitFile(made, hashFolder(flat), out)
    expect(got.ok).toBe(true)
    expect(fs.readFileSync(out).equals(fs.readFileSync(file))).toBe(true)
    expect(fs.readdirSync(flat).length).toBe(4)
  })

  it('names the parts that are missing and writes nothing', () => {
    const file = path.join(box, 'b.mp4')
    fs.writeFileSync(file, bytesOf(9000, 2))
    const made = splitFile(file, path.join(box, 'parts-b'), mb(4000))
    fs.rmSync(path.join(box, 'parts-b', made.parts[1].file))
    const out = path.join(box, 'again-b', 'b.mp4')
    const got = unsplitFile(made, hashFolder(path.join(box, 'parts-b')), out)
    expect(got.ok).toBe(false)
    expect(got.missing).toEqual(['part 2 of 3 (b.mp4.part-02-of-03)'])
    expect(got.why).toMatch(/1 of its 3 parts is not here/)
    expect(fs.existsSync(out)).toBe(false)
  })

  it('refuses parts that do not make the file the manifest names', () => {
    const file = path.join(box, 'c.mp4')
    fs.writeFileSync(file, bytesOf(9000, 3))
    const made = splitFile(file, path.join(box, 'parts-c'), mb(4000))
    const out = path.join(box, 'again-c', 'c.mp4')
    const lie = { ...made, sha256: 'f'.repeat(64) }
    const got = unsplitFile(lie, hashFolder(path.join(box, 'parts-c')), out)
    expect(got.ok).toBe(false)
    expect(got.why).toMatch(/its 3 parts are all here and together they are .* not the ffffffffffff its record names/)
    expect(fs.existsSync(out)).toBe(false)
    expect(fs.existsSync(`${out}.joining`)).toBe(false)
    const changed = path.join(box, 'parts-c', made.parts[0].file)
    fs.writeFileSync(changed, Buffer.concat([fs.readFileSync(changed).subarray(1), Buffer.from([0])]))
    expect(unsplitFile(made, hashFolder(path.join(box, 'parts-c')), out).missing).toEqual(['part 1 of 3 (c.mp4.part-01-of-03)'])
  })

  it('collects records, whole chunks, parts and the screenshot from one flat folder', () => {
    const made = path.join(box, 'made')
    const flat = path.join(box, 'flat')
    const into = path.join(box, 'collected')
    fs.mkdirSync(made)
    fs.mkdirSync(flat)
    const one = bytesOf(5000, 4)
    const two = bytesOf(12000, 5)
    const still = bytesOf(700, 6)
    const sha = (b: Buffer) => {
      const f = path.join(made, 'x')
      fs.writeFileSync(f, b)
      return bigSha(f)
    }
    fs.writeFileSync(path.join(made, 'loop-000030-000059.mp4'), two)
    const cut = splitFile(path.join(made, 'loop-000030-000059.mp4'), path.join(made, 'parts'), mb(5000))
    expect(cut.parts.length).toBe(3)
    const r1 = rec('loop', 0, 29, { sha256: sha(one), bytes: one.length, boot: 'b1', still: { file: 'frame-000000.png', bytes: still.length, sha256: sha(still) } })
    const r2 = rec('loop', 30, 59, { sha256: cut.sha256, bytes: two.length, boot: 'b1', parts: cut.parts })
    writeJson(path.join(flat, 'download-7'), r2)
    writeJson(path.join(flat, 'loop-000000-000029.json'), r1)
    fs.writeFileSync(path.join(flat, 'notes.json'), '{"hello": 1}')
    fs.writeFileSync(path.join(flat, 'zz (1)'), one)
    fs.writeFileSync(path.join(flat, 'shot.png'), still)
    fs.copyFileSync(path.join(made, 'parts', cut.parts[2].file), path.join(flat, 'a'))
    fs.copyFileSync(path.join(made, 'parts', cut.parts[0].file), path.join(flat, 'b'))
    fs.writeFileSync(path.join(flat, 'stranger.bin'), bytesOf(10, 9))

    const first = takeFiles(flat, into, { keep: false })
    expect(first.records).toBe(2)
    expect(first.whole).toBe(1)
    expect(first.stills).toBe(1)
    expect(first.fromParts).toBe(0)
    expect(first.problems.length).toBe(1)
    expect(first.problems[0]).toMatch(/loop 30 to 59, drawn on vm-a: 1 of its 3 parts is not here \(part 2 of 3/)
    expect(first.strangers.map((f: string) => path.basename(f)).sort()).toEqual(['notes.json', 'stranger.bin'])

    fs.copyFileSync(path.join(made, 'parts', cut.parts[1].file), path.join(flat, 'late'))
    const second = takeFiles(flat, into, { keep: false })
    expect(second.records).toBe(0)
    expect(second.fromParts).toBe(1)
    expect(second.problems).toEqual([])
    expect(fs.readdirSync(flat).sort()).toEqual(['notes.json', 'stranger.bin'])

    const chunks = readChunks([into])
    expect(chunks.map((c: Chunk) => c.record.first)).toEqual([0, 30])
    expect(fs.readFileSync(chunks[0].file).equals(one)).toBe(true)
    expect(fs.readFileSync(chunks[1].file).equals(two)).toBe(true)
    expect(fs.readFileSync(path.join(path.dirname(chunks[0].file), 'frame-000000.png')).equals(still)).toBe(true)
    const p = plan('loop', chunks, { sha: bigSha })
    expect(p.problems).toEqual([])
    expect(() => takeFiles(path.join(into, 'files'), into)).toThrow(/not inside the folder that is collected into/)
    expect(() => takeFiles(path.join(box, 'nowhere'), into)).toThrow(/does not exist/)
  })

  it('leaves a chunk out when the file that came is not the one its record names', () => {
    const flat = path.join(box, 'flat-2')
    const into = path.join(box, 'collected-bad')
    fs.mkdirSync(flat)
    writeJson(path.join(flat, 'r.json'), rec('film-b', 0, 29, { sha256: 'e'.repeat(64), bytes: 5000, boot: 'b1' }))
    fs.writeFileSync(path.join(flat, 'film-b-000000-000029.mp4'), bytesOf(5000, 8))
    const got = takeFiles(flat, into, { keep: true })
    expect(got.records).toBe(1)
    expect(got.whole).toBe(0)
    expect(got.problems.join(' ')).toMatch(/film-b 0 to 29, drawn on vm-a: no file with its sha256 is here/)
    expect(fs.existsSync(path.join(flat, 'r.json'))).toBe(true)
    const p = plan('film-b', readChunks([into]), { sha: (f: string) => (fs.existsSync(f) ? bigSha(f) : null) })
    expect(p.problems.join(' ')).toMatch(/the mp4 is missing/)
  })

  it('takes two chunks that hold the same bytes, as two still stretches of the opening do', () => {
    const flat = path.join(box, 'flat-3')
    const into = path.join(box, 'collected-same')
    fs.mkdirSync(flat)
    const same = bytesOf(4000, 11)
    fs.writeFileSync(path.join(flat, 'only-one-file'), same)
    const sha = bigSha(path.join(flat, 'only-one-file'))
    writeJson(path.join(flat, 'a.json'), rec('opening', 0, 29, { sha256: sha, bytes: same.length, boot: 'b1' }))
    writeJson(path.join(flat, 'b.json'), rec('opening', 30, 59, { sha256: sha, bytes: same.length, boot: 'b1' }))
    const got = takeFiles(flat, into, { keep: false })
    expect(got.records).toBe(2)
    expect(got.problems).toEqual([])
    const chunks = readChunks([into])
    expect(chunks.map((c: Chunk) => c.record.first)).toEqual([0, 30])
    expect(chunks.every((c: Chunk) => fs.readFileSync(c.file).equals(same))).toBe(true)
    expect(fs.readdirSync(flat)).toEqual([])
  })

  it('lets a test encode skip what was never rendered, and a real one never', () => {
    const t = (a: number, b: number) => chunk(rec('film-b', a, b, { test: true }))
    const p = plan('film-b', [t(660, 669), t(60, 69)], { test: true, gaps: true })
    expect(p.problems).toEqual([])
    expect(p.frames).toBe(20)
    expect(p.parts.map((c: { at: number }) => c.at)).toEqual([0, 10])
    refused('film-b', [t(60, 69), t(660, 669)], /frames 70 to 659 are covered by no chunk/, { test: true })
    refused('film-b', [filmB()[0], filmB()[2]], /frames 30 to 59 are covered by no chunk/, { gaps: true })
  })
})

describe('what the machine may really use', () => {
  const GIB = 2 ** 30
  const node = { totalmem: 253 * GIB, cpus: 64 }
  const files = (map: Record<string, string>) => (f: string) => map[f] ?? null

  it('reads memory.max and cpu.max of the cgroup the process is in', () => {
    const l = readLimits({ cgroup: '0::/kubepods/pod1/c1\n', read: files({ '/sys/fs/cgroup/kubepods/pod1/c1/memory.max': '25769803776\n', '/sys/fs/cgroup/kubepods/pod1/c1/cpu.max': '800000 100000\n' }), ...node })
    expect(l).toEqual({ memoryBytes: 24 * GIB, cpus: 8, memoryFrom: 'cgroup', cpusFrom: 'cgroup', machineMemoryBytes: 253 * GIB, machineCpus: 64 })
    expect(limitsLine(l)).toBe("limits: 24 GiB of memory (the cgroup's memory.max; the machine shows 253 GiB), 8 CPUs (the cgroup's cpu.max; the machine shows 64)")
    expect(limitsRecord(l)).toEqual({ memoryGiB: 24, cpus: 8, memoryFrom: 'cgroup', cpusFrom: 'cgroup', machineMemoryGiB: 253, machineCpus: 64 })
  })

  it('takes max as no limit, and the least of the folders above', () => {
    const l = readLimits({ cgroup: '0::/a/b/c', read: files({ '/sys/fs/cgroup/a/b/c/memory.max': 'max\n', '/sys/fs/cgroup/a/b/c/cpu.max': 'max 100000\n', '/sys/fs/cgroup/a/b/memory.max': '8209612800\n', '/sys/fs/cgroup/a/memory.max': '17179869184\n', '/sys/fs/cgroup/a/cpu.max': '250000 100000' }), ...node })
    expect(l.memoryBytes).toBe(8209612800)
    expect(l.cpus).toBe(2.5)
    const none = readLimits({ cgroup: '0::/', read: files({ '/sys/fs/cgroup/memory.max': 'max', '/sys/fs/cgroup/cpu.max': 'max 100000' }), ...node })
    expect(none).toMatchObject({ memoryBytes: 253 * GIB, cpus: 64, memoryFrom: 'machine', cpusFrom: 'machine' })
    expect(limitsLine(none)).toBe('limits: 253 GiB of memory, 64 CPUs')
  })

  it('falls back to the machine when the files are missing, the text is empty or the limit is over the machine', () => {
    expect(readLimits({ cgroup: '0::/gone', ...node })).toMatchObject({ memoryBytes: 253 * GIB, cpus: 64, memoryFrom: 'machine', cpusFrom: 'machine' })
    expect(readLimits({ cgroup: '', read: files({ '/sys/fs/cgroup/memory.max': '1024' }), ...node })).toMatchObject({ memoryFrom: 'machine' })
    expect(readLimits({ ...node })).toMatchObject({ memoryBytes: 253 * GIB, cpus: 64 })
    expect(readLimits({ cgroup: '0::/x', read: files({ '/sys/fs/cgroup/x/memory.max': String(999 * GIB), '/sys/fs/cgroup/x/cpu.max': '9900000 100000', '/sys/fs/cgroup/x/garbage': 'x' }), ...node })).toMatchObject({ memoryFrom: 'machine', cpusFrom: 'machine' })
    expect(readLimits({ cgroup: '0::/x', read: files({ '/sys/fs/cgroup/x/memory.max': 'lots', '/sys/fs/cgroup/x/cpu.max': '100000' }), ...node })).toMatchObject({ memoryFrom: 'machine', cpusFrom: 'machine' })
  })

  it('reads the old names where a machine still has cgroup v1', () => {
    const l = readLimits({
      cgroup: '11:memory:/docker/abc\n4:cpu,cpuacct:/docker/abc\n1:name=systemd:/docker/abc\n',
      read: files({ '/sys/fs/cgroup/memory/memory.limit_in_bytes': String(16 * GIB), '/sys/fs/cgroup/cpu,cpuacct/docker/abc/cpu.cfs_quota_us': '400000', '/sys/fs/cgroup/cpu,cpuacct/docker/abc/cpu.cfs_period_us': '100000' }),
      ...node,
    })
    expect(l).toMatchObject({ memoryBytes: 16 * GIB, cpus: 4, memoryFrom: 'cgroup', cpusFrom: 'cgroup' })
    const open = readLimits({ cgroup: '11:memory:/\n4:cpu,cpuacct:/\n', read: files({ '/sys/fs/cgroup/memory/memory.limit_in_bytes': '9223372036854771712', '/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_quota_us': '-1', '/sys/fs/cgroup/cpu,cpuacct/cpu.cfs_period_us': '100000' }), ...node })
    expect(open).toMatchObject({ memoryFrom: 'machine', cpusFrom: 'machine' })
  })

  it('reads this machine without an error', () => {
    const l = machineLimits()
    expect(l.memoryBytes).toBeGreaterThan(0)
    expect(l.memoryBytes).toBeLessThanOrEqual(os.totalmem())
    expect(l.cpus).toBeGreaterThan(0)
  })

  it('refuses the processes the memory cannot hold, by the limit and not by the node', () => {
    const pod = readLimits({ cgroup: '0::/p', read: files({ '/sys/fs/cgroup/p/memory.max': String(24 * GIB), '/sys/fs/cgroup/p/cpu.max': '800000 100000' }), ...node })
    expect(procsMemoryHolds(24 * GIB)).toBe(5)
    expect(procsProblem(12, 'uhd', pod)).toMatch(/^--procs 12 is refused: this process may use 24 GiB \(its cgroup's memory.max\) and one uhd render holds about 4.1 GB.*The most here is --procs 5\.$/)
    expect(procsProblem(6, 'uhd', pod)).not.toBeNull()
    expect(procsProblem(5, 'uhd', pod)).toBeNull()
    expect(procsProblem(12, 'uhd', readLimits({ ...node }))).toBeNull()
    const small = readLimits({ totalmem: 7.8 * GIB, cpus: 4 })
    expect(procsProblem(2, 'uhd', small)).toMatch(/the machine's memory.*The most here is --procs 1\.$/)
    expect(procsProblem(1, 'uhd', small)).toBeNull()
    expect(procsProblem(2, 'hd', small)).toBeNull()
    expect(procsProblem(3, 'uhd', readLimits({ totalmem: 15.6 * GIB, cpus: 4 }))).toBeNull()
    expect(procsProblem(4, 'uhd', readLimits({ totalmem: 15.6 * GIB, cpus: 4 }))).not.toBeNull()
  })

  it('says in a plain line when the CPUs gain nothing from more processes', () => {
    const on = (cpus: number) => readLimits({ totalmem: 64 * GIB, cpus })
    expect(procsGainLine(1, on(4))).toBeNull()
    expect(procsGainLine(2, on(8))).toBeNull()
    expect(procsGainLine(3, on(8))).toBe('--procs 3 on 8 CPUs: one software render already uses every core. Measured on 8 CPUs, a second process added about 10 percent and a third nothing. It runs, but expect no gain over --procs 2.')
    expect(procsGainLine(2, on(4))).toMatch(/expect no gain over --procs 1\.$/)
    expect(procsGainLine(4, on(16))).toBeNull()
  })

  it('refuses --local where no display is', () => {
    expect(localProblem(true, 'linux', {})).toMatch(/^--local is refused: it starts the installed Chrome in a window, with the graphics card of this machine, and no display is here/)
    expect(localProblem(true, 'linux', { DISPLAY: ':0' })).toBeNull()
    expect(localProblem(true, 'linux', { WAYLAND_DISPLAY: 'wayland-0' })).toBeNull()
    expect(localProblem(true, 'darwin', {})).toBeNull()
    expect(localProblem(false, 'linux', {})).toBeNull()
  })

  it('names the chunk and the frame of a stop and reads them back, and gives the command as it was typed', () => {
    const line = stoppedLine({ first: 930, last: 959 }, 937, 'the WebGL context was lost before the picture was read back. No picture was written.')
    expect(line).toBe('stopped at chunk 000930-000959, frame 937: the WebGL context was lost before the picture was read back. No picture was written.')
    expect(stoppedAt(`master: ${line}`)).toEqual({ first: 930, last: 959, frame: 937, why: 'the WebGL context was lost before the picture was read back. No picture was written.' })
    expect(stoppedAt('master: something else')).toBeNull()
    expect(stoppedAt(`master: ${stoppedLine({ first: 0, last: 29 }, 4, 'Target closed\nCall log:\n  - waiting')} 4 frames stay.\nCall log:`)).toEqual({ first: 0, last: 29, frame: 4, why: 'Target closed 4 frames stay.' })
    expect(sameCommand(['--what', 'film-b', '--first', '900', '--last', '1259', '--procs', '5', '--worker', '3'])).toBe('npm run master -- --what film-b --first 900 --last 1259 --procs 5')
    expect(sameCommand(['--encode', 'film-b', '--x264', 'a b'])).toBe("npm run master -- --encode film-b --x264 'a b'")
  })
})

describe('render processes side by side, with a stand-in for the renderer', () => {
  const tool = rel('tools', 'master.mjs')
  const haveFfmpeg = !spawnSync('ffmpeg', ['-version']).error
  const run = (dir: string, ...more: string[]) => {
    const r = spawnSync(process.execPath, [tool, '--what', 'film-b', '--chunk', '2', '--format', 'preview', '--samples', '1', '--stand-in', dir, ...more], { encoding: 'utf8', env: { ...process.env, DISPLAY: '' } })
    return { code: r.status, lines: (r.stdout + r.stderr).split('\n').filter(Boolean) }
  }
  const frames = (dir: string, first: number) => path.join(dir, 'work', 'film-b', `frames-${pad6(first)}-${pad6(first + 1)}`)
  const chunks = (dir: string) => (fs.existsSync(path.join(dir, 'out', 'film-b')) ? fs.readdirSync(path.join(dir, 'out', 'film-b')).filter((f) => f.endsWith('.mp4')).sort() : [])
  let dir = ''
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'master-procs-'))
  })
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it.runIf(haveFfmpeg)('starts 12 workers over 12 fresh chunks and none dies', () => {
    const d = path.join(dir, 'twelve')
    fs.mkdirSync(frames(d, 10), { recursive: true })
    fs.writeFileSync(path.join(frames(d, 10), 'frames.json'), '{"what": "film-')
    fs.writeFileSync(path.join(frames(d, 10), '000010.png'), 'left by a run that was killed')
    const r = run(d, '--first', '0', '--last', '23', '--procs', '12')
    expect(r.lines.filter((l) => /master:|ENOTEMPTY|JSON|stopped/.test(l))).toEqual([])
    expect(r.code).toBe(0)
    expect(r.lines[0]).toMatch(/^limits: [\d.]+ GiB of memory.*, [\d.]+ CPUs?/)
    expect(r.lines.filter((l) => /^\[\d+\] finished film-b-/.test(l)).length).toBe(12)
    expect(new Set(r.lines.map((l) => /^\[(\d+)\] finished/.exec(l)?.[1]).filter(Boolean)).size).toBe(12)
    expect(chunks(d).length).toBe(12)
    expect(fs.readdirSync(path.join(d, 'work', 'film-b'))).toEqual([])
    const record = readJson(path.join(d, 'out', 'film-b', 'film-b-000000-000001.json'))
    expect(record.limits).toEqual(limitsRecord(machineLimits()))
    expect(record).toMatchObject({ renderer: 'stand-in', test: true })
    const again = run(d, '--first', '0', '--last', '23', '--procs', '12')
    expect(again.code).toBe(0)
    expect(again.lines.some((l) => /^12 chunks are finished, 0 to do/.test(l))).toBe(true)
  }, 180000)

  it.runIf(haveFfmpeg)('a worker reads and drops the folders of its own chunks only', () => {
    const d = path.join(dir, 'lanes')
    fs.mkdirSync(frames(d, 0), { recursive: true })
    fs.mkdirSync(frames(d, 2), { recursive: true })
    fs.writeFileSync(path.join(frames(d, 2), 'frames.json'), '{"what": "film-')
    fs.writeFileSync(path.join(frames(d, 2), '000002.png'), 'being written by its owner')
    const r = run(d, '--first', '0', '--last', '7', '--procs', '4', '--worker', '3')
    expect(r.lines.filter((l) => /^master:/.test(l))).toEqual([])
    expect(r.code).toBe(0)
    expect(chunks(d)).toEqual(['film-b-000006-000007.mp4'])
    expect(fs.readdirSync(frames(d, 0))).toEqual([])
    expect(fs.readdirSync(frames(d, 2)).sort()).toEqual(['000002.png', 'frames.json'])
    expect(fs.readFileSync(path.join(frames(d, 2), 'frames.json'), 'utf8')).toBe('{"what": "film-')
  }, 120000)

  it.runIf(haveFfmpeg)('a lost context in one worker: the parent names the chunk and the frame, the PNGs stay, and the last line is the command that goes on', () => {
    const d = path.join(dir, 'lost')
    const typed = ['--first', '0', '--last', '11', '--procs', '3', '--stand-in-fail', '9']
    const r = run(d, ...typed)
    expect(r.code).toBe(1)
    expect(r.lines.some((l) => /^\[1\] master: stopped at chunk 000008-000009, frame 9: the WebGL context was lost/.test(l))).toBe(true)
    const end = r.lines.slice(r.lines.findIndex((l) => l.startsWith('master: ')))
    expect(end[0]).toMatch(/^master: render process 1 stopped at chunk 000008-000009, frame 9: the WebGL context was lost before the picture was read back.*1 of this chunk's 2 frames are PNGs in .*frames-000008-000009 and stay there\.$/)
    expect(end[1]).toMatch(/^Nothing drawn is lost: every finished frame is a PNG under .*A lost context is most often a browser killed for memory \(dmesg says so\): if it was, go on with a smaller --procs than 3\.$/)
    expect(end[2]).toBe(`To go on from there: npm run master -- --what film-b --chunk 2 --format preview --samples 1 --stand-in ${d} ${typed.join(' ')}`)
    expect(end.length).toBe(3)
    expect(fs.readdirSync(frames(d, 8)).sort()).toEqual(['000008.json', '000008.png', 'frames.json', 'source.json'])
    expect(chunks(d)).toEqual(['film-b-000000-000001.mp4', 'film-b-000002-000003.mp4', 'film-b-000004-000005.mp4', 'film-b-000006-000007.mp4', 'film-b-000010-000011.mp4'])
    const on = run(d, '--first', '0', '--last', '11', '--procs', '3')
    expect(on.code).toBe(0)
    expect(on.lines.some((l) => /^5 chunks are finished, 1 to do, 1 frames to render \(1 more are on disk as PNGs\)/.test(l))).toBe(true)
    expect(on.lines.some((l) => /chunk 000008-000009: 1 of its 2 frames were on disk and were not rendered again/.test(l))).toBe(true)
    expect(chunks(d).length).toBe(6)
    const one = run(path.join(dir, 'lost-one'), '--first', '0', '--last', '3', '--stand-in-fail', '2')
    expect(one.code).toBe(1)
    expect(one.lines.at(-1)).toMatch(/^To go on from there: npm run master -- --what film-b .* --first 0 --last 3 --stand-in-fail 2$/)
    expect(one.lines.at(-3)).toMatch(/^master: stopped at chunk 000002-000003, frame 2: the WebGL context was lost/)
  }, 180000)

  it('refuses --local on a machine without a display before anything is started', () => {
    const r = spawnSync(process.execPath, [tool, '--what', 'film-b', '--first', '0', '--last', '29', '--local'], { encoding: 'utf8', env: { ...process.env, DISPLAY: '', WAYLAND_DISPLAY: '' } })
    const lines = (r.stdout + r.stderr).split('\n').filter(Boolean)
    if (process.platform === 'linux') {
      expect(r.status).toBe(1)
      expect(lines.at(-1)).toMatch(/^master: --local is refused: it starts the installed Chrome in a window/)
    }
  }, 60000)

  it('keeps the stand-in out of anything a master is made from', () => {
    const r = spawnSync(process.execPath, [tool, '--what', 'film-b', '--first', '0', '--last', '29', '--stand-in', path.join(dir, 'no')], { encoding: 'utf8' })
    expect(r.status).toBe(1)
    expect(r.stdout).toMatch(/--stand-in DIR is for the tool's own tests/)
    expect(fs.existsSync(path.join(dir, 'no'))).toBe(false)
  }, 60000)
})
