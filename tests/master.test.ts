import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { tierSamples } from '../src/config'
import { masterVideoArgs } from '../tools/lib/encode.mjs'
import { loadConfig, readJson, rel, writeJson } from '../tools/lib/paths.mjs'
import { branchFolder, branchMatches, chunkLines, chunkStem, coverReport, framesOf, heartbeat, joinPlan, lumaPsnrOf, nearestRanges, openingPack as readOpening, pad6, psnrOf, rangeChunks as chunksOfRange, ranges, readChunks, recordMatchesRun, resultName, split, stillName, stillToDo as leftToDo, table, tierOf, totalsFromCut } from '../tools/lib/master.mjs'
import { Shipper, collectBranches } from '../tools/lib/mastergit.mjs'

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
    refused('film-b', one({ encoderArgs: [...ARGS, '-g', '60'] }), /the list of encoder arguments differs between chunks/)
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
    expect(() => plan('film-c', filmB())).toThrow(/--join takes film-b, film-a, loop/)
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

  it('pins a closed GOP of one chunk with no scene cuts', () => {
    const a = masterVideoArgs(M.video, M.chunkFrames).join(' ')
    expect(a).toContain(`-g ${M.chunkFrames} -keyint_min ${M.chunkFrames} -sc_threshold 0`)
    expect(a).toContain('+cgop+bitexact')
    expect(a).toContain('open-gop=0')
    expect(a).toContain(`-crf ${M.video.crf} -maxrate ${M.video.maxrateMbps * 1000}k -bufsize ${M.video.bufsizeMbps * 1000}k`)
    expect(a).toContain('-pix_fmt yuv420p')
    expect(a).toContain('-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv')
    expect(() => masterVideoArgs({ ...M.video, codec: 'vp9' }, 30)).toThrow(/no master encoder/)
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
