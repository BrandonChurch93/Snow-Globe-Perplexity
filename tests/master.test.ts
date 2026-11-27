import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { tierSamples } from '../src/config'
import { finalVideoArgs, masterVideoArgs } from '../tools/lib/encode.mjs'
import { loadConfig, readJson, rel, writeJson } from '../tools/lib/paths.mjs'
import { branchFolder, branchMatches, chunkLines, chunkStem, coverReport, framesOf, heartbeat, joinPlan, sampleRule, ruleCount, pieceCounts, slowPlan, countFacts, countsLine, lumaPsnrOf, nearestRanges, openingPack as readOpening, pad6, psnrOf, rangeChunks as chunksOfRange, ranges, readChunks, recordMatchesRun, resultName, split, stillName, stillToDo as leftToDo, table, tierOf, totalsFromCut } from '../tools/lib/master.mjs'
import { REMOTE_WAITS, Shipper, collectBranches, gitEnv, identityProblem, mainAuthor, withWaits } from '../tools/lib/mastergit.mjs'
import { levelProblems, pictureLevels, procsProblem } from '../tools/lib/master.mjs'
import { heldLine, heldRanges, parseTake } from '../tools/lib/master.mjs'
import { firstPlace, markedHolder, notNumberFrames } from '../tools/lib/master.mjs'
import { NOT_A_NUMBER, notNumberLine, notNumberLoud, notNumberOf, notNumberRecord, notNumberUnknown, shipTitle, shippedLine } from '../tools/lib/master.mjs'
import { limitsLine, limitsRecord, localProblem, machineLimits, procsGainLine, procsMemoryHolds, readLimits, sameCommand, stoppedAt, stoppedLine } from '../tools/lib/master.mjs'
import { OVERDUE, availableBytes, memoryShortLine, overdueLine, watchFrame } from '../tools/lib/master.mjs'
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
  ...(what === 'opening' ? {} : { frameSamples: Array.from({ length: last - first + 1 }, () => 12), motion: null }),
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
    const motion = { spacingPx: 0.75, maxSamplesPerFrame: 96 }
    const moving = { ...want, motion }
    const counts = Array.from({ length: 30 }, (_, i) => (i === 3 ? 48 : 12))
    expect(recordMatchesRun(rec('film-b', 0, 29, { motion, frameSamples: counts }), moving)).toBe(true)
    expect(recordMatchesRun(rec('film-b', 0, 29), moving)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { motion, frameSamples: undefined }), moving)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { motion, frameSamples: counts.slice(1) }), moving)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { motion, frameSamples: counts.map((n) => (n === 48 ? 11 : n)) }), moving)).toBe(false)
    expect(recordMatchesRun(rec('film-b', 0, 29, { motion: { ...motion, maxSamplesPerFrame: 64 }, frameSamples: counts }), moving)).toBe(false)
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
    const p = refused('film-b', [...filmB(), chunk(other, 'there')], /film-b 30 to 59 is held 2 times and the records do not agree: .*\. The pixels of their frames differ in 1 of 30 \(the first is frame 34\)\. Neither is taken/)
    expect(p.conflicts.length).toBe(1)
    expect(p.conflicts[0].frames).toEqual([34])
    expect(p.problems.length).toBe(1)
  })

  it('counts one record held by two machines as proof and joins, and takes the first by name of two intermediates that hold the same pixels in other bytes', () => {
    const p = plan('film-b', [...filmB(), chunk(rec('film-b', 30, 59, { machine: 'vm-b' }), 'there')])
    expect(p.ok).toBe(true)
    expect(p.parts.length).toBe(3)
    expect(p.twiceByTwoMachines).toBe(30)
    const other = [chunk(rec('film-b', 30, 59, { sha256: 'sha-other' }), 'there'), ...filmB()]
    const first = plan('film-b', other)
    expect(first.ok).toBe(true)
    expect(first.parts[1].record.sha256).toBe('sha-film-b-30')
    expect(first.twice).toBe(30)
    expect(first.twiceByTwoMachines).toBe(0)
    const g = (heldRanges(other) as { first: number }[]).find((x) => x.first === 30)
    expect(heldLine(g)).toBe('film-b 30 to 59 is held 2 times with the same build, the same calibration and the same pixels in all 30 frames, each drawn with the same count of samples: there/film-b-000030 (vm-a); here/film-b-000030 (vm-a). Their intermediates differ in bytes (sha256 sha-other in there/film-b-000030, sha-film-b-30 in here/film-b-000030). It counts once and the first by name is taken: here/film-b-000030')
    const named = plan('film-b', other, { take: parseTake('film-b:30-59=there/film-b-000030') })
    expect(named.ok).toBe(true)
    expect(named.parts[1].record.sha256).toBe('sha-other')
    const there = (file: string) => file.includes('there')
    const passed = (heldRanges(other, { exists: there }) as { first: number }[]).find((x) => x.first === 30)
    expect(heldLine(passed)).toMatch(/It counts once and there\/film-b-000030 is taken, since the picture of here\/film-b-000030, the first by name, is not here$/)
    const blind = [chunk(rec('film-b', 30, 59, { sha256: 'sha-other', frameHashes: [] }), 'there'), ...filmB()]
    refused('film-b', blind, /film-b 30 to 59 is held 2 times and the records do not agree: .*\. The pixels of their frames cannot be compared \(there\/film-b-000030 names no hash for each of the 30 frames\) and the intermediates differ in bytes\. Neither is taken\. Name the one to take: --take film-b:30-59=there\/film-b-000030 or --take film-b:30-59=here\/film-b-000030$/)
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

  it('writes the samples of a frame in its line and counts the hours left by samples, since frames cost unequally', () => {
    const line = heartbeat({ chunk: { first: 660, last: 689 }, frame: 678, seconds: 204.2, left: 100, average: 60, samples: 96, samplesLeft: 3600, perSample: 2 })
    expect(line).toBe('chunk 000660-000689 · frame 678 · 96 samples · 204.2 s · 100 frames left in the range (3600 samples) · 2.00 h left at 2.00 s a sample (60.0 s a frame in the mean so far)')
  })

  it('takes the count of a master frame from the rule of the final tier, and refuses when the two bases are not one number', () => {
    const cfg = loadConfig()
    const final = cfg.tiers.final
    expect(cfg.deliver.master.samples['film-b']).toBe(final.samplesPerFrame)
    expect(cfg.deliver.master.samples.loop).toBe(final.samplesPerFrame)
    expect(sampleRule('film-b')).toEqual({ base: final.samplesPerFrame, motion: { spacingPx: final.motion.spacingPx, maxSamplesPerFrame: final.motion.maxSamplesPerFrame, evenFromPx: final.motion.evenFromPx, spreadFromPx: final.motion.spreadFromPx, spreadFullPx: final.motion.spreadFullPx, slow: { underPx: cfg.deliver.master.slow.underPx, samples: cfg.deliver.master.slow.samples, runFrames: cfg.deliver.master.slow.runFrames } }, tier: 'final' })
    expect(sampleRule('loop').tier).toBe('final')
    expect(sampleRule('film-b', 1)).toEqual({ base: 1, motion: null, tier: null })
    const other = { deliver: { master: { samples: { 'film-b': 32 } } }, tiers: { final: { samplesPerFrame: 24, motion: { spacingPx: 0.75, maxSamplesPerFrame: 96 } } } }
    expect(() => sampleRule('film-b', undefined, other)).toThrow(/deliver\.master\.samples\.film-b is 32 and tiers\.final\.samplesPerFrame is 24\. .* the two must be one number\. Nothing was drawn\./)
    expect(sampleRule('film-b', undefined, { deliver: { master: { samples: { 'film-b': 24 } } }, tiers: { final: { samplesPerFrame: 24 } } })).toEqual({ base: 24, motion: null, tier: 'final' })
    const rule = sampleRule('film-b', undefined, { deliver: { master: { samples: { 'film-b': 24 } } }, tiers: other.tiers })
    expect(ruleCount(rule, 678, { samples: 96, travelPx: 80 })).toBe(96)
    expect(ruleCount(rule, 0, { samples: 24, travelPx: 0 })).toBe(24)
    expect(() => ruleCount(rule, 5, { samples: 23 })).toThrow(/as the samples of frame 5, and the rule gives a whole count from 24 to 96/)
    expect(() => ruleCount(rule, 5, { samples: 97 })).toThrow(/whole count from 24 to 96/)
    expect(() => ruleCount(rule, 5, { samples: 24.5 })).toThrow(/whole count/)
    expect(() => ruleCount(rule, 5, undefined)).toThrow(/the page gave null as the samples of frame 5/)
  })

  it('draws the slow frames of a piece at the slow count, in runs, so the count changes at most once in a run\'s length', () => {
    const slow = { underPx: 1.5, samples: 96, runFrames: 4 }
    const px = (s: string) => [...s].map((c) => (c === 's' ? 0.2 : c === 'e' ? 1.4994 : c === 'f' ? 1.4996 : 9))
    const plan = (s: string, loop = false) => slowPlan(px(s), slow, loop)
    const marks = (p: { at: boolean[] }) => p.at.map((on) => (on ? 's' : '.')).join('')
    expect(marks(plan('ssssFFFFssss'))).toBe('ssss....ssss')
    expect(plan('ssssFFFFssss')).toMatchObject({ runs: [{ first: 0, last: 3, frames: 4 }, { first: 8, last: 11, frames: 4 }], frames: 8, changes: 2 })
    expect(marks(plan('FsssFFFFsssseF'))).toBe('........sssss.')
    expect(marks(plan('FssssFFsssssFFFF'))).toBe('.sssssssssss....')
    expect(plan('FssssFFsssssFFFF')).toMatchObject({ runs: [{ first: 1, last: 11, frames: 11 }], frames: 11, changes: 2 })
    expect(marks(plan('FssssFsFsssssFFFF'))).toBe('.ssssssssssss....')
    expect(marks(plan('ssFFFFFFFssss'))).toBe('.........ssss')
    expect(plan('ssFFFFFFFssss').changes).toBe(1)
    expect(marks(plan('ssFFFFFFFssss', true))).toBe('ss.......ssss')
    expect(plan('ssFFFFFFFssss', true)).toMatchObject({ runs: [{ first: 9, last: 1, frames: 6 }], frames: 6, changes: 2 })
    expect(marks(plan('sssssFFsssss', true))).toBe('ssssssssssss')
    expect(plan('sssssFFsssss', true).changes).toBe(0)
    expect(marks(plan('FFFFFFFF'))).toBe('........')
    expect(plan('ssss')).toMatchObject({ runs: [{ first: 0, last: 3, frames: 4 }], frames: 4, changes: 0 })
    expect(marks(plan('sfsfsfsfs'))).toBe('.........')
    for (const s of ['ssssFFFFssssFsFFFFFsssssFFFsssss', 'FsFsssssssFFFsFFFFssssF', 'sssFFFFFsssssFssFFFFFss']) {
      for (const loop of [false, true]) {
        const at = plan(s, loop).at
        const n = at.length
        let last = -Infinity
        let changes = 0
        const from = loop ? at.findIndex((on, i) => on !== at[(i + n - 1) % n]) : 1
        if (from < 0) continue
        for (let k = 0; k < (loop ? n : n - 1); k++) {
          const i = (from + k) % n
          if (at[i] !== at[(i + n - 1) % n]) {
            expect(k - last).toBeGreaterThanOrEqual(slow.runFrames)
            last = k
            changes++
          }
        }
        expect(changes).toBe(plan(s, loop).changes)
      }
    }
    expect(() => slowPlan([0.1, Number.NaN], slow)).toThrow(/as the travel of frame 1/)
    const rule = { base: 24, motion: { spacingPx: 0.75, maxSamplesPerFrame: 128, slow }, tier: 'final' }
    const got = px('ssssFFFFssssF').map((travelPx, i) => ({ samples: i === 5 ? 128 : i === 9 ? 30 : 24, travelPx }))
    const whole = pieceCounts(rule, got)
    expect(whole.counts).toEqual([96, 96, 96, 96, 24, 128, 24, 24, 96, 96, 96, 96, 24])
    expect(whole.plan?.changes).toBe(3)
    expect(pieceCounts({ base: 24, motion: { spacingPx: 0.75, maxSamplesPerFrame: 128 }, tier: 'final' }, got)).toEqual({ counts: got.map((g) => g.samples), plan: null })
    expect(countsLine(rule, countFacts(whole.counts, 24, 0))).toBe('the count of a frame follows its motion (tiers.final.motion: a sample every 0.75 px of travel, at most 128; 96 in runs of 4 frames or more under 1.5 px of travel): 9 of these 13 frames draw more than the base of 24 samples, the most is 128 (frame 5); 992 samples in all, 3.18 times the base')
    expect(() => sampleRule('film-b', undefined, { deliver: { master: { samples: { 'film-b': 24 }, slow } }, tiers: { final: { samplesPerFrame: 24 } } })).toThrow(/deliver\.master\.slow needs tiers\.final\.motion/)
  })

  it('says at the start how many frames of the range draw more than the base, and the most', () => {
    const rule = { base: 24, motion: { spacingPx: 0.75, maxSamplesPerFrame: 96 }, tier: 'final' }
    const facts = countFacts([24, 24, 48, 96, 24, 31], 24, 675)
    expect(facts).toEqual({ frames: 6, over: 3, most: 96, mostAt: 678, sum: 247 })
    expect(countsLine(rule, facts)).toBe('the count of a frame follows its motion (tiers.final.motion: a sample every 0.75 px of travel, at most 96): 3 of these 6 frames draw more than the base of 24 samples, the most is 96 (frame 678); 247 samples in all, 1.72 times the base')
    expect(countsLine(rule, countFacts([24, 24], 24, 0))).toBe('the count of a frame follows its motion (tiers.final.motion: a sample every 0.75 px of travel, at most 96): every one of these 2 frames draws the base of 24 samples')
    expect(countsLine({ base: 1, motion: null, tier: null }, countFacts([1, 1, 1], 1, 0))).toBe('the count was given with --samples, so no frame follows its motion: every one of these 3 frames draws the base of 1 sample')
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

    const marked = rec('film-b', 60, 89, { mark: NOT_A_NUMBER, notNumber: notNumberRecord([{ index: 75, notNumber: 3, sanityMs: 40 }]) })
    writeJson(file('film-b-000060-000089.json', ''), marked)
    expect(a.add([{ src: path.join(dir, 'made', 'film-b-000060-000089.json'), to: 'film-b/film-b-000060-000089.json' }], shipTitle('film-b', { first: 60, last: 89 }, marked))).toBe(true)
    expect(a.push()).toBe(true)
    expect(git(remote, 'log', '--format=%s', branch).stdout.split('\n')).toContain('Chunk film-b-000060-000089, NOT A NUMBER in frame 75 (3): never encoded into a master')
    expect(readJson(path.join(dir, 'ship-a', 'agent_p6-chunks-unit', 'film-b', 'film-b-000060-000089.json')).mark).toBe(NOT_A_NUMBER)

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
    expect(chunks.map((c: Chunk) => c.record.first)).toEqual([0, 30, 60])
    expect(fs.readFileSync(chunks[1].file, 'utf8')).toBe('two')
    expect(notNumberOf(chunks[2].record)).toEqual({ total: 3, frames: [{ frame: 75, count: 3 }] })
    expect(collectBranches({ dir: into, say, facts, pattern: 'agent/p6-chunks-*' }).length).toBe(1)
    expect(said.join('\n')).toMatch(/unchanged at/)
    expect(() => new Shipper({ branch: cfg.repo.branch, say, root: dir, facts })).toThrow(/never the code branch/)
  })

  it("commits with the clone's name when the four identity variables are set and empty, and leaves one that holds a value", () => {
    const keys = ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL']
    expect(gitEnv({ GIT_AUTHOR_NAME: '', GIT_AUTHOR_EMAIL: ' ', GIT_COMMITTER_NAME: 'Kept Name', PATH: '/bin' })).toEqual({ GIT_COMMITTER_NAME: 'Kept Name', PATH: '/bin', GIT_TERMINAL_PROMPT: '0' })
    expect(gitEnv({ PATH: '/bin' })).toEqual({ PATH: '/bin', GIT_TERMINAL_PROMPT: '0' })
    const empty = Object.fromEntries(keys.map((k) => [k, '']))

    const plain = path.join(dir, 'ident-plain')
    fs.mkdirSync(plain)
    git(plain, 'init', '-q')
    git(plain, 'config', 'user.name', 'Test Person')
    git(plain, 'config', 'user.email', 'test@example.com')
    fs.writeFileSync(path.join(plain, 'a.txt'), 'a')
    git(plain, 'add', 'a.txt')
    const died = spawnSync('git', ['commit', '-q', '-m', 'a'], { cwd: plain, encoding: 'utf8', env: { ...process.env, ...empty } })
    expect(died.status).not.toBe(0)
    expect(died.stderr).toMatch(/empty ident name/)

    const remote = path.join(dir, 'remote-ident.git')
    fs.mkdirSync(remote)
    git(remote, 'init', '-q', '--bare')
    const facts = { url: remote, commit: 'none', name: 'Test Person', email: 'test@example.com' }
    const branch = 'agent/p6-chunks-ident'
    const src = (name: string) => {
      const f = path.join(dir, 'ident-made', name)
      fs.mkdirSync(path.dirname(f), { recursive: true })
      fs.writeFileSync(f, name)
      return f
    }
    const who = () => git(remote, 'log', '-1', '--format=%an <%ae> | %cn <%ce>', branch).stdout.trim()
    const kept = keys.map((k) => process.env[k])
    try {
      for (const k of keys) process.env[k] = ''
      const s = new Shipper({ branch, say: () => {}, root: path.join(dir, 'ship-ident'), facts })
      s.prepare()
      expect(s.add([{ src: src('one.json'), to: 'film-b/one.json' }], 'Chunk one')).toBe(true)
      expect(s.push()).toBe(true)
      expect(who()).toBe('Test Person <test@example.com> | Test Person <test@example.com>')
      process.env.GIT_AUTHOR_NAME = 'Named By The Shell'
      process.env.GIT_AUTHOR_EMAIL = 'shell@example.com'
      expect(s.add([{ src: src('two.json'), to: 'film-b/two.json' }], 'Chunk two')).toBe(true)
      expect(s.push()).toBe(true)
      expect(who()).toBe('Named By The Shell <shell@example.com> | Test Person <test@example.com>')
    } finally {
      keys.forEach((k, i) => {
        if (kept[i] === undefined) delete process.env[k]
        else process.env[k] = kept[i]
      })
    }
  })

  it('stops a --ship run before the first frame when its commit would not carry the name of the head of origin/main', () => {
    const keys = ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL']
    const owner = { name: 'The Owner', email: 'owner@example.com' }
    const bot = { name: 'A Bot', email: 'bot@example.com' }
    expect(identityProblem({ ...owner, of: 'the head of origin/main' }, { author: owner, committer: owner }, {})).toBeNull()
    expect(identityProblem({ ...owner, of: 'the head of origin/main' }, { author: bot, committer: bot }, {})).toBe(
      '--ship would commit as A Bot <bot@example.com> (author) and A Bot <bot@example.com> (committer), and the head of origin/main is by The Owner <owner@example.com>. Nothing is drawn. Run these two in this clone and start again: git config user.name "The Owner" && git config user.email "owner@example.com"',
    )
    expect(identityProblem(owner, { author: owner, committer: bot }, { GIT_COMMITTER_NAME: 'A Bot', GIT_AUTHOR_NAME: '' })).toMatch(/\(committer\), and the head of the code branch is by The Owner <owner@example\.com>\. Nothing is drawn\. The shell sets GIT_COMMITTER_NAME, which wins over the clone's config: unset it first\. Run these two/)
    expect(identityProblem(owner, { author: null, committer: null, why: 'fatal: empty ident name' }, {})).toMatch(/^--ship would commit as nobody git can name \(author\) and nobody git can name \(committer\) \(fatal: empty ident name\)/)
    expect(identityProblem(null, { author: owner, committer: owner }, {})).toMatch(/cannot tell whose name/)

    const clone = path.join(dir, 'who-clone')
    fs.mkdirSync(clone)
    const as = (p: { name: string; email: string }) => ({ ...process.env, GIT_AUTHOR_NAME: p.name, GIT_AUTHOR_EMAIL: p.email, GIT_COMMITTER_NAME: 'Someone Else', GIT_COMMITTER_EMAIL: 'else@example.com' })
    const commit = (text: string, p: { name: string; email: string }) => {
      fs.writeFileSync(path.join(clone, 'a.txt'), text)
      spawnSync('git', ['add', 'a.txt'], { cwd: clone })
      expect(spawnSync('git', ['commit', '-q', '-m', text], { cwd: clone, env: as(p) }).status).toBe(0)
    }
    git(clone, 'init', '-q')
    commit('one', bot)
    expect(mainAuthor(clone)).toEqual({ ...bot, of: `HEAD (this clone holds no origin/${cfg.repo.branch})` })
    commit('two', owner)
    git(clone, 'update-ref', `refs/remotes/origin/${cfg.repo.branch}`, 'HEAD')
    commit('three', bot)
    expect(mainAuthor(clone)).toEqual({ ...owner, of: `the head of origin/${cfg.repo.branch}` })

    const remote = path.join(dir, 'remote-who.git')
    const kept = keys.map((k) => process.env[k])
    try {
      for (const k of keys) process.env[k] = ''
      const wrong = new Shipper({ branch: 'agent/p6-chunks-who', say: () => {}, root: path.join(dir, 'ship-who-bot'), facts: { url: remote, commit: 'none', ...bot } })
      expect(wrong.identity()).toEqual({ author: bot, committer: bot })
      expect(identityProblem(mainAuthor(clone), wrong.identity())).toMatch(/^--ship would commit as A Bot <bot@example\.com> \(author\) and A Bot <bot@example\.com> \(committer\), and the head of origin\/\w+ is by The Owner <owner@example\.com>\. Nothing is drawn\. Run these two in this clone and start again: git config user\.name "The Owner" && git config user\.email "owner@example\.com"$/)
      expect(fs.existsSync(remote)).toBe(false)
      const right = new Shipper({ branch: 'agent/p6-chunks-who', say: () => {}, root: path.join(dir, 'ship-who-owner'), facts: { url: remote, commit: 'none', ...owner } })
      expect(identityProblem(mainAuthor(clone), right.identity())).toBeNull()
      const unset = new Shipper({ branch: 'agent/p6-chunks-who', say: () => {}, root: path.join(dir, 'ship-who-owner'), facts: { url: remote, commit: 'none', name: '', email: '' } })
      const none: Record<string, string | undefined> = { GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL, GIT_CONFIG_SYSTEM: process.env.GIT_CONFIG_SYSTEM, HOME: process.env.HOME }
      try {
        process.env.GIT_CONFIG_GLOBAL = path.join(dir, 'no-global-config')
        process.env.GIT_CONFIG_SYSTEM = path.join(dir, 'no-system-config')
        process.env.HOME = dir
        fs.writeFileSync(process.env.GIT_CONFIG_GLOBAL, '[user]\n\tname = A Bot\n\temail = bot@example.com\n')
        expect(unset.identity()).toEqual({ author: bot, committer: bot })
        expect(identityProblem(mainAuthor(clone), unset.identity())).toMatch(/^--ship would commit as A Bot <bot@example\.com> \(author\).*git config user\.name "The Owner" && git config user\.email "owner@example\.com"$/)
      } finally {
        for (const k of ['GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'HOME']) {
          if (none[k] === undefined) delete process.env[k]
          else process.env[k] = none[k]
        }
      }
      process.env.GIT_COMMITTER_NAME = 'A Bot'
      expect(identityProblem(mainAuthor(clone), right.identity())).toMatch(/and A Bot <owner@example\.com> \(committer\).*The shell sets GIT_COMMITTER_NAME, which wins over the clone's config: unset it first\./)
    } finally {
      keys.forEach((k, i) => {
        if (kept[i] === undefined) delete process.env[k]
        else process.env[k] = kept[i]
      })
    }
  })

  it('waits between tries at a remote that refuses and comes back, and says how many tries a push took', () => {
    expect(REMOTE_WAITS).toEqual([5, 15, 30])
    const slept: number[] = []
    const lines: string[] = []
    let n = 0
    const refusal = "fatal: could not read Username for 'https://github.com': terminal prompts disabled"
    const twice = () => {
      if (++n < 3) throw new Error(refusal)
      return 'tip'
    }
    expect(withWaits(twice, { what: 'the fetch', sleep: (ms: number) => slept.push(ms), say: (l: string) => lines.push(l) })).toBe('tip')
    expect(slept).toEqual([5000, 15000])
    expect(lines).toEqual([`the fetch: refused (${refusal}). Try 2 of 4 in 5 s.`, `the fetch: refused (${refusal}). Try 3 of 4 in 15 s.`, 'the fetch: answered at try 3'])
    slept.length = 0
    const never = () => {
      throw new Error(refusal)
    }
    expect(() => withWaits(never, { sleep: (ms: number) => slept.push(ms) })).toThrow(/terminal prompts disabled \(4 tries, 5, 15, 30 s apart\)$/)
    expect(slept).toEqual([5000, 15000, 30000])
    slept.length = 0
    expect(withWaits(() => 7, { sleep: (ms: number) => slept.push(ms), say: (l: string) => lines.push(l) })).toBe(7)
    expect(slept).toEqual([])
    expect(lines.length).toBe(3)

    const remote = path.join(dir, 'remote-waits.git')
    const away = `${remote}.away`
    fs.mkdirSync(remote)
    git(remote, 'init', '-q', '--bare')
    const facts = { url: remote, commit: 'none', name: 'Test Person', email: 'test@example.com' }
    const branch = 'agent/p6-chunks-waits'
    const said: string[] = []
    const say = (l: string) => said.push(l)
    const naps: number[] = []
    let back = 0
    const sleep = (ms: number) => {
      naps.push(ms)
      if (naps.length === back) fs.renameSync(away, remote)
    }
    const gone = (after: number) => {
      naps.length = 0
      back = after
      fs.renameSync(remote, away)
    }
    const src = (name: string) => {
      const f = path.join(dir, 'waits-made', name)
      fs.mkdirSync(path.dirname(f), { recursive: true })
      fs.writeFileSync(f, name)
      return f
    }
    const s = new Shipper({ branch, say, root: path.join(dir, 'ship-waits'), facts, sleep })

    gone(1)
    s.prepare()
    expect(naps).toEqual([5000])
    expect(said[0]).toMatch(/^the look at the remote tip of agent\/p6-chunks-waits: refused \(.*\)\. Try 2 of 4 in 5 s\.$/)
    expect(said[1]).toBe('the look at the remote tip of agent/p6-chunks-waits: answered at try 2')

    expect(s.add([{ src: src('one.json'), to: 'film-b/one.json' }], 'Chunk one')).toBe(true)
    gone(2)
    expect(s.push()).toBe(true)
    expect(s.tries).toBe(3)
    expect(naps).toEqual([5000, 15000])
    expect(said.slice(-2).map((l) => l.replace(/\(.*\)/, '(why)'))).toEqual(['the push to agent/p6-chunks-waits was refused (why). Try 2 of 4 in 5 s.', 'the push to agent/p6-chunks-waits was refused (why). Try 3 of 4 in 15 s.'])
    expect(shippedLine('film-b', { first: 0, last: 29 }, null, branch, s.tries)).toBe('shipped the record and the look of film-b-000000-000029 to agent/p6-chunks-waits, the push went through at try 3 (the picture travels by attachment)')
    expect(git(remote, 'log', '--format=%s', branch).stdout.trim()).toBe('Chunk one')

    expect(s.add([{ src: src('two.json'), to: 'film-b/two.json' }], 'Chunk two')).toBe(true)
    gone(99)
    expect(s.push()).toBe(false)
    expect(s.tries).toBe(4)
    expect(naps).toEqual([5000, 15000, 30000])
    expect(s.unpushed).toBe(true)
    expect(said.at(-1)).toMatch(/^the push to agent\/p6-chunks-waits was refused 4 times \(.*\)\. The chunks stay on disk and the push is tried again after the next chunk\.$/)
    fs.renameSync(away, remote)
    naps.length = 0
    expect(s.push()).toBe(true)
    expect(s.tries).toBe(1)
    expect(naps).toEqual([])
    expect(s.push()).toBe(true)
    expect(s.tries).toBe(0)
    expect(git(remote, 'log', '--format=%s', branch).stdout.trim().split('\n')).toEqual(['Chunk two', 'Chunk one'])

    const into = path.join(dir, 'collected-waits')
    gone(1)
    expect(collectBranches({ dir: into, say, facts, pattern: 'agent/p6-chunks-*', sleep }).map((x: { branch: string }) => x.branch)).toEqual([branch])
    expect(naps).toEqual([5000])
    expect(fs.existsSync(path.join(into, 'agent_p6-chunks-waits', 'film-b', 'two.json'))).toBe(true)
    gone(99)
    expect(() => collectBranches({ dir: path.join(dir, 'collected-never'), say, facts, pattern: 'agent/p6-chunks-*', sleep })).toThrow(/4 tries, 5, 15, 30 s apart/)
    expect(naps).toEqual([5000, 15000, 30000])
    fs.renameSync(away, remote)
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
    bad((m) => (m.slow.samples = 24), /slow\.samples \(24\) is not a whole count over tiers\.final\.samplesPerFrame/)
    bad((m) => (m.slow.samples = 200), /slow\.samples \(200\) .* at most tiers\.final\.motion\.maxSamplesPerFrame/)
    bad((m) => (m.slow.runFrames = 0), /slow\.runFrames \(0\)/)
    bad((m) => (m.slow.underPx = 0), /slow\.underPx \(0\)/)
    const none = JSON.parse(JSON.stringify(M))
    delete none.slow
    expect(masterConfigProblems(none)).toEqual([])
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

  it('reads the memory that is free from the kernel, and says it loud where the renders would not fit, refusing nothing', () => {
    expect(availableBytes('MemTotal:        8148272 kB\nMemFree:         7400000 kB\nMemAvailable:     941056 kB\nBuffers:           10000 kB\n')).toBe(941056 * 1024)
    expect(availableBytes('MemTotal: 8148272 kB\n')).toBeNull()
    expect(availableBytes('')).toBeNull()
    expect(memoryShortLine(1, 'uhd', 7.1 * GIB)).toBeNull()
    expect(memoryShortLine(1, 'uhd', 6.1 * GIB)).toBeNull()
    expect(memoryShortLine(1, 'uhd', 0.9 * GIB)).toBe('SHORT OF MEMORY: 0.9 GiB are free on this machine now, and one uhd render holds about 6.1 GB with the encoder. A machine short of memory does not fail, it crawls. Look at what else runs here (ps -eo rss,etime,args --sort=-rss | head) before a long run.')
    expect(memoryShortLine(2, 'uhd', 9.5 * GIB)).toMatch(/^SHORT OF MEMORY: 9\.5 GiB are free on this machine now, and 2 uhd renders hold about 10\.2 GB with the encoder\./)
    expect(memoryShortLine(2, 'uhd', 10.2 * GIB)).toBeNull()
    expect(memoryShortLine(12, 'preview', 0.5 * GIB)).toBeNull()
    expect(memoryShortLine(1, 'uhd', null)).toBeNull()
  })

  it('says a frame is overdue once it takes three times what the frames before give it and five minutes at least, again when that doubles, and ends nothing', () => {
    expect(overdueLine({ frame: 215, seconds: 1900, expected: 590.2, available: 0.9 * GIB })).toBe('OVERDUE: frame 215 has been drawing for 31.7 min, 3.2 times the 590.2 s the frames so far give it. Nothing has failed and nothing was given up. 0.9 GiB of memory are free now. A machine short of memory crawls without an error: look at free -m and at what else runs here.')
    expect(overdueLine({ frame: 3, seconds: 400, expected: 2, available: null })).toBe('OVERDUE: frame 3 has been drawing for 6.7 min, 200.0 times the 2.0 s the frames so far give it. Nothing has failed and nothing was given up. A machine short of memory crawls without an error: look at free -m and at what else runs here.')
    vi.useFakeTimers()
    try {
      const said: string[] = []
      const watch = (expected: number | null) => watchFrame({ frame: 215, expected, say: (l: string) => said.push(l), available: () => 0.9 * GIB })
      const end = watch(600)
      vi.advanceTimersByTime(1799 * 1000)
      expect(said).toEqual([])
      vi.advanceTimersByTime(2 * 1000)
      expect(said.length).toBe(1)
      expect(said[0]).toMatch(/^OVERDUE: frame 215 has been drawing for 30\.0 min, 3\.0 times the 600\.0 s the frames so far give it\. .* 0\.9 GiB of memory are free now\./)
      vi.advanceTimersByTime(1790 * 1000)
      expect(said.length).toBe(1)
      vi.advanceTimersByTime(20 * 1000)
      expect(said.length).toBe(2)
      expect(said[1]).toMatch(/^OVERDUE: frame 215 has been drawing for 60\.0 min, 6\.0 times/)
      end()
      vi.advanceTimersByTime(24 * 3600 * 1000)
      expect(said.length).toBe(2)
      const quick = watch(0.02)
      vi.advanceTimersByTime((OVERDUE.leastSeconds - 1) * 1000)
      expect(said.length).toBe(2)
      vi.advanceTimersByTime(OVERDUE.everySeconds * 1000)
      expect(said.length).toBe(3)
      quick()
      const first = watch(null)
      const none = watch(0)
      vi.advanceTimersByTime(24 * 3600 * 1000)
      expect(said.length).toBe(3)
      first()
      none()
    } finally {
      vi.useRealTimers()
    }
  })

  it('promises nothing about more processes and says to measure them', () => {
    const on = (cpus: number) => readLimits({ totalmem: 64 * GIB, cpus })
    expect(procsGainLine(1, on(4))).toBeNull()
    expect(procsGainLine(3, on(8))).toBe('--procs 3 on 8 CPUs: the best count depends on the machine. Measure it with --procs 1, 2 and 3 on three chunks before a long run, and keep the count that gives the most frames an hour.')
    expect(procsGainLine(2, on(8))).toMatch(/^--procs 2 on 8 CPUs: the best count depends on the machine\./)
    expect(procsGainLine(4, on(16))).not.toMatch(/percent|nothing|gain/)
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

describe('a range held more than once', () => {
  type Held = { what: string; first: number; last: number; holders: Chunk[]; agree: boolean; taken: Chunk | null; named: string | null; wrong: string | null; pixels: number[] }
  const at = (holder: string, record: Rec, there = false) => ({ ...chunk(record, holder), holder, file: `/x/${holder}/${record.what}-${pad6(record.first)}.mp4`, there })
  const exists = (file: string) => file.startsWith('/x/agent/p6-chunks-b/')
  const groups = (chunks: Chunk[], take = '') => heldRanges(chunks, { take: take ? parseTake(take) : [], exists }) as Held[]
  const three = () => [at('agent/p6-chunks-a', rec('film-b', 0, 29)), at('agent/p6-chunks-b', rec('film-b', 0, 29)), at('out/master', rec('film-b', 0, 29)), at('agent/p6-chunks-a', rec('film-b', 30, 59))]

  it('reads --take', () => {
    expect(parseTake(undefined)).toEqual([])
    expect(parseTake('agent/p6-chunks-a')).toEqual([{ what: null, first: null, last: null, holder: 'agent/p6-chunks-a' }])
    expect(parseTake('film-b:0-29=agent/p6-chunks-a, loop:30-59=files/again-2')).toEqual([{ what: 'film-b', first: 0, last: 29, holder: 'agent/p6-chunks-a' }, { what: 'loop', first: 30, last: 59, holder: 'files/again-2' }])
    expect(() => parseTake(true)).toThrow(/--take takes BRANCH, or WHAT:FIRST-LAST=BRANCH/)
    expect(() => parseTake('film-c:0-29=x')).toThrow(/Not understood: film-c:0-29=x/)
    expect(() => parseTake('0-29=x')).toThrow(/Not understood/)
  })

  it('lets holders agree only when the count of samples of every frame agrees too, as it does whenever the build and the pixels do', () => {
    const counts = Array.from({ length: 30 }, (_, i) => (i === 11 ? 96 : 12))
    const moving = { motion: { spacingPx: 0.75, maxSamplesPerFrame: 96 }, frameSamples: counts }
    const same = groups([at('agent/p6-chunks-a', rec('film-b', 30, 59, { ...moving, sha256: 'bytes-a' })), at('agent/p6-chunks-b', rec('film-b', 30, 59, { ...moving, sha256: 'bytes-b' }))])
    expect(same[0].agree).toBe(true)
    expect(heldLine(same[0])).toMatch(/the same pixels in all 30 frames, each drawn with the same count of samples: /)
    const other = groups([at('agent/p6-chunks-a', rec('film-b', 30, 59, moving)), at('agent/p6-chunks-b', rec('film-b', 30, 59, { ...moving, frameSamples: counts.map((n) => (n === 96 ? 48 : n)) }))])
    expect(other[0].agree).toBe(false)
    expect(other[0].taken).toBe(null)
    expect(heldLine(other[0])).toMatch(/is held 2 times and the records do not agree: .*The pixels of their frames are the same in all 30; the count of samples a frame was drawn with differs in 1 of 30 \(the first is frame 41\)\. Neither is taken/)
    const before = groups([at('agent/p6-chunks-a', rec('film-b', 30, 59, moving)), at('agent/p6-chunks-b', rec('film-b', 30, 59, { ...moving, frameSamples: undefined }))])
    expect(before[0].agree).toBe(false)
    expect(heldLine(before[0])).toMatch(/the count of samples a frame was drawn with differs in 30 of 30/)
    refused('film-b', [chunk(rec('film-b', 0, 29, { frameSamples: undefined })), ...filmB().slice(1)], /names no count of samples for each of its 30 frames/)
    refused('film-b', [chunk(rec('film-b', 0, 29, { motion: { spacingPx: 0.75, maxSamplesPerFrame: 96 } })), ...filmB().slice(1)], /the rule from motion to samples of film-b differs between chunks/)
  })

  it('counts a range once, names its holders in one line, and takes the one whose picture is there', () => {
    const g = groups(three())
    expect(g.length).toBe(2)
    expect(g[0].holders.length).toBe(3)
    expect(g[0].agree).toBe(true)
    expect(g[0].taken!.file).toBe('/x/agent/p6-chunks-b/film-b-000000.mp4')
    expect(heldLine(g[0])).toBe('film-b 0 to 29 is held 3 times with one and the same record (build, calibration, intermediate): agent/p6-chunks-a (vm-a); agent/p6-chunks-b (vm-a); out/master (vm-a). It counts once and one is taken: agent/p6-chunks-b')
    const cover = coverReport(g.map((x) => x.taken!), totals, SIZE).find((x) => x.what === 'film-b')!
    expect(cover.chunks).toBe(2)
    expect(coverReport(three(), totals, SIZE).find((x) => x.what === 'film-b')!.chunks).toBe(2)
    const p = plan('film-b', [...three(), at('agent/p6-chunks-a', rec('film-b', 60, 89))], { exists })
    expect(p.ok).toBe(true)
    expect(p.parts.map((c: Chunk) => c.file)).toEqual(['/x/agent/p6-chunks-b/film-b-000000.mp4', '/x/agent/p6-chunks-a/film-b-000030.mp4', '/x/agent/p6-chunks-a/film-b-000060.mp4'])
  })

  it('takes neither of two holders that do not agree, says how they differ, and takes the one that is named', () => {
    const two = () => [at('agent/p6-chunks-a', rec('film-b', 0, 29)), at('agent/p6-chunks-b', rec('film-b', 0, 29, { engineHash: 'build-2', sha256: 'sha-new', machine: 'vm-b', calibration: 'd'.repeat(64) })), at('agent/p6-chunks-a', rec('film-b', 30, 59)), at('agent/p6-chunks-a', rec('film-b', 60, 89))]
    const g = groups(two())
    expect(g[0].agree).toBe(false)
    expect(g[0].taken).toBeNull()
    expect(heldLine(g[0])).toBe(
      'film-b 0 to 29 is held 2 times and the records do not agree: agent/p6-chunks-a (vm-a); agent/p6-chunks-b (vm-b). The build hash is build-1 in agent/p6-chunks-a, build-2 in agent/p6-chunks-b; the calibration picture is cccccccccccc in agent/p6-chunks-a, dddddddddddd in agent/p6-chunks-b; the pixels of their frames are the same in all 30. Neither is taken. Name the one to take: --take film-b:0-29=agent/p6-chunks-a or --take film-b:0-29=agent/p6-chunks-b',
    )
    const open = g.filter((x) => !x.taken)
    const cover = coverReport(g.filter((x) => x.taken).map((x) => x.taken!), totals, SIZE, open).find((x) => x.what === 'film-b')!
    expect([cover.chunks, cover.missing, cover.notAgreed]).toEqual([2, [], [{ first: 0, last: 29 }]])

    const p = refused('film-b', two(), /^film-b 0 to 29 is held 2 times and the records do not agree/)
    expect(p.problems.length).toBe(1)
    expect(plan('film-b', two(), { take: parseTake('film-b:0-29=agent/p6-chunks-a') }).ok).toBe(true)
    const b = groups(two(), 'agent/p6-chunks-b')
    expect(b[0].taken!.record.sha256).toBe('sha-new')
    expect(heldLine(b[0])).toMatch(/\. Taken as named: agent\/p6-chunks-b$/)
    refused('film-b', two(), /the build hash of film-b differs between chunks/, { take: parseTake('agent/p6-chunks-b') })
    const wrong = groups(two(), 'film-b:0-29=agent/p6-chunks-z')
    expect(wrong[0].taken).toBeNull()
    expect(heldLine(wrong[0])).toMatch(/Neither is taken \(--take names agent\/p6-chunks-z, which does not hold it\)\. Name the one to take:/)
    const both = groups([at('files', rec('film-b', 0, 29)), at('files/again-2', rec('film-b', 0, 29, { sha256: 'sha-new', engineHash: 'build-2' }))], 'files,files/again-2')
    expect(both[0].taken).toBeNull()
    expect(both[0].wrong).toMatch(/names 2 of its holders/)
  })

  it('says a marked range once, however many hold it', () => {
    const mark = { mark: NOT_A_NUMBER, notNumber: notNumberRecord([{ index: 12, notNumber: 5, sanityMs: 40 }]) }
    const held = [at('agent/p6-chunks-a', rec('film-b', 0, 29, mark)), at('agent/p6-chunks-b', rec('film-b', 0, 29, mark)), at('agent/p6-chunks-c', rec('film-b', 0, 29, mark)), at('out/master', rec('film-b', 0, 29, mark)), at('out/master', rec('film-b', 30, 59)), at('out/master', rec('film-b', 60, 89))]
    const g = groups(held)
    expect(g.length).toBe(3)
    expect(g.filter((x) => x.taken && notNumberOf(x.taken.record)).length).toBe(1)
    const p = refused('film-b', held, /is marked NOT A NUMBER: 5 values in frame 12 \(5\)/)
    expect(p.problems.length).toBe(1)
  })

  it('names the holder of a chunk on disk, and lays one picture for one record held by three branches', () => {
    const box = fs.mkdtempSync(path.join(os.tmpdir(), 'master-held-'))
    try {
      const into = path.join(box, 'collected')
      const flat = path.join(box, 'inbox')
      fs.mkdirSync(flat, { recursive: true })
      const picture = Buffer.from(Array.from({ length: 4000 }, (_, i) => (i * 13) & 255))
      fs.writeFileSync(path.join(flat, 'attachment (1)'), picture)
      const r = rec('film-b', 0, 29, { sha256: bigSha(path.join(flat, 'attachment (1)')), bytes: picture.length, boot: 'b1' })
      const branches = ['agent/p6-chunks-a', 'agent/p6-chunks-b', 'agent/p6-chunks-c']
      for (const b of branches) writeJson(path.join(into, branchFolder(b), 'film-b', 'film-b-000000-000029.json'), r)
      writeJson(path.join(into, 'collected.json'), { branches: Object.fromEntries(branches.map((b) => [b, 'sha'])) })
      writeJson(path.join(flat, 'film-b-000000-000029.json'), r)
      const got = takeFiles(flat, into, { keep: false })
      expect([got.records, got.whole, got.problems]).toEqual([0, 1, []])
      const chunks = readChunks([into])
      expect(chunks.map((c: { holder: string }) => c.holder)).toEqual(branches)
      expect(chunks.filter((c: Chunk) => fs.existsSync(c.file)).length).toBe(1)
      const g = heldRanges(chunks, { exists: fs.existsSync }) as Held[]
      expect(g.length).toBe(1)
      expect(fs.existsSync(g[0].taken!.file)).toBe(true)
      expect(takeFiles(flat, into, { keep: false }).problems).toEqual([])
      expect(readChunks([into]).filter((c: Chunk) => fs.existsSync(c.file)).length).toBe(1)
      writeJson(path.join(flat, 'again.json'), { ...r, machine: 'vm-b' })
      expect(takeFiles(flat, into, { keep: false }).records).toBe(1)
      expect(readChunks([into]).map((c: { holder: string }) => c.holder)).toEqual([...branches, 'files'])
      expect(readChunks([into]).filter((c: Chunk) => fs.existsSync(c.file)).length).toBe(1)
    } finally {
      fs.rmSync(box, { recursive: true, force: true })
    }
  })
})

describe('values that are no number', () => {
  const frame = (index: number, notNumber?: number, sanityMs = 40) => ({ index, ...(notNumber === undefined ? {} : { notNumber, sanityMs }) })

  it('writes one total a chunk, the frames where the count is not 0, and the frames never read', () => {
    expect(notNumberRecord([frame(2100, 0), frame(2101, 0, 60)], 'float32')).toEqual({ total: 0, frames: [], unread: [], measure: expect.stringMatching(/^window\.showcase\.dev\.sanity\(\)/), precision: 'float32', blind: false, msAFrame: 50 })
    const bad = notNumberRecord([frame(2114, 0), frame(2115, 3), frame(2116), frame(2117, 1)])
    expect(bad).toMatchObject({ total: 4, frames: [{ frame: 2115, count: 3 }, { frame: 2117, count: 1 }], unread: [2116] })
    expect(notNumberRecord([frame(0, 0)], 'byte')).toMatchObject({ blind: true })
  })

  it('reads the mark back from a record, and knows a record that says nothing', () => {
    const clean = rec('film-b', 0, 29, { notNumber: notNumberRecord([frame(0, 0)]) })
    const marked = rec('film-b', 30, 59, { mark: NOT_A_NUMBER, notNumber: notNumberRecord([frame(30, 0), frame(45, 3)]), machine: 'vm07' })
    const old = rec('film-b', 60, 89)
    expect(notNumberOf(clean)).toBeNull()
    expect(notNumberOf(old)).toBeNull()
    expect(notNumberOf(marked)).toEqual({ total: 3, frames: [{ frame: 45, count: 3 }] })
    expect(notNumberOf(rec('film-b', 0, 29, { mark: NOT_A_NUMBER }))).toEqual({ total: 0, frames: [] })
    expect(notNumberOf(rec('film-b', 0, 29, { notNumber: { total: 2, frames: [] } }))).not.toBeNull()
    expect(notNumberUnknown(old)).toBe(true)
    expect(notNumberUnknown(clean)).toBe(false)
    expect(notNumberUnknown(rec('film-b', 0, 29, { notNumber: notNumberRecord([frame(0, 0), frame(1)]) }))).toBe(true)
    expect(notNumberUnknown(rec('film-b', 0, 29, { notNumber: notNumberRecord([frame(0, 0)], 'byte') }))).toBe(true)
    expect(notNumberUnknown(rec('opening', 0, 29))).toBe(false)
  })

  it('gives the collect its line and the render its loud one', () => {
    const marked = rec('film-b', 2100, 2129, { mark: NOT_A_NUMBER, notNumber: notNumberRecord([frame(2115, 3), frame(2120, 1)]), machine: 'vm07' })
    expect(notNumberLine({ record: marked, file: '/x/film-b-002100-002129.mp4', from: 'agent/p6-chunks-vm07' })).toBe('agent/p6-chunks-vm07 (film-b 2100 to 2129, drawn on vm07) holds 4 values that are no number in 2 frames: 2115 (3), 2120 (1)')
    expect(notNumberLoud('film-b', 2115, 3)).toBe('NOT A NUMBER: film-b frame 2115 holds 3 values that are no number in its mean, before the lens and the grade. Its chunk is marked NOT A NUMBER and no master is encoded from it. Tell /root the frame. Do not draw it again hoping: the same frame draws the same values.')
    expect(notNumberLoud('loop', 7, 1)).toMatch(/holds 1 value that is no number/)
  })

  it('keeps the first place of a marked frame in the record and says it in every line, and prints a record without it as before', () => {
    const at = { x: 1204, y: 388, channel: 'red', kind: 'no number' }
    const frames = [{ ...frame(2115, 3), notNumberFirst: { ...at, more: 1 } }, frame(2116, 0), { ...frame(2120, 1), notNumberFirst: { x: 9, y: 0, channel: 'alpha', kind: 'plus infinite' } }]
    const n = notNumberRecord(frames)
    expect(n.frames).toEqual([{ frame: 2115, count: 3, first: at }, { frame: 2120, count: 1, first: { x: 9, y: 0, channel: 'alpha', kind: 'plus infinite' } }])
    expect(firstPlace(null)).toBeNull()
    expect(firstPlace({ x: 1, y: 2 })).toBeNull()
    expect(notNumberRecord([{ ...frame(7, 2), notNumberFirst: { x: 'a' } }]).frames).toEqual([{ frame: 7, count: 2 }])
    const marked = rec('film-b', 2100, 2129, { mark: NOT_A_NUMBER, notNumber: n, machine: 'vm07' })
    const line = '2115 (3), the first at 1204, 388 (red, no number); 2120 (1), the first at 9, 0 (alpha, plus infinite)'
    expect(notNumberFrames(marked)).toBe(line)
    expect(notNumberLine({ record: marked, file: '/x/film-b-002100-002129.mp4', from: 'agent/p6-chunks-vm07' })).toBe(`agent/p6-chunks-vm07 (film-b 2100 to 2129, drawn on vm07) holds 4 values that are no number in 2 frames: ${line}`)
    expect(notNumberLoud('film-b', 2115, 3, at)).toMatch(/^NOT A NUMBER: film-b frame 2115 holds 3 values that are no number in its mean, the first at 1204, 388 \(red, no number\), before the lens and the grade\. /)
    const chunks = [chunk(rec('film-b', 0, 29, { mark: NOT_A_NUMBER, notNumber: notNumberRecord([{ ...frame(12, 5), notNumberFirst: at }]) })), ...filmB().slice(1)]
    refused('film-b', chunks, /is marked NOT A NUMBER: 5 values in frame 12 \(5\), the first at 1204, 388 \(red, no number\)\. It is never encoded into a master/)
    expect(shipTitle('film-b', { first: 2100, last: 2129 }, marked)).toBe('Chunk film-b-002100-002129, NOT A NUMBER in frames 2115 (3), 2120 (1): never encoded into a master')
    const old = rec('film-b', 2100, 2129, { mark: NOT_A_NUMBER, notNumber: notNumberRecord([frame(2115, 3), frame(2120, 1)]) })
    expect(notNumberFrames(old)).toBe('2115 (3), 2120 (1)')
  })

  it('counts a range as marked when a holder with the very same pixels is, whichever is taken', () => {
    const mark = { mark: NOT_A_NUMBER, notNumber: notNumberRecord([frame(12, 5)]) }
    const held = [{ ...chunk(rec('film-b', 0, 29), 'a'), holder: 'a' }, { ...chunk(rec('film-b', 0, 29, { ...mark, sha256: 'sha-other' }), 'b'), holder: 'b' }, ...filmB().slice(1)]
    const g = (heldRanges(held) as { first: number; taken: { holder: string } }[]).find((x) => x.first === 0)!
    expect(g.taken.holder).toBe('a')
    expect(markedHolder(g).holder).toBe('b')
    const p = refused('film-b', held, /^b\/film-b-000000 is marked NOT A NUMBER: 5 values in frame 12 \(5\)/)
    expect(p.problems.length).toBe(1)
    const other = [...held.slice(0, 1), { ...chunk(rec('film-b', 0, 29, { ...mark, sha256: 'sha-other', frameHashes: rec('film-b', 30, 59).frameHashes }), 'b'), holder: 'b' }, ...filmB().slice(1)]
    expect(plan('film-b', other, { take: parseTake('film-b:0-29=a') }).ok).toBe(true)
  })

  it('says the mark in the commit that ships a chunk and in the line of the run, and nothing more for a good chunk', () => {
    const c = { first: 2100, last: 2129 }
    const marked = rec('film-b', 2100, 2129, { mark: NOT_A_NUMBER, notNumber: notNumberRecord([frame(2115, 3), frame(2120, 1)]) })
    const good = rec('film-b', 2100, 2129, { notNumber: notNumberRecord([frame(2115, 0)]) })
    expect(shipTitle('film-b', c, good)).toBe('Chunk film-b-002100-002129')
    expect(shipTitle('film-b', c, good, true)).toBe('Chunk film-b-002100-002129, a test')
    expect(shipTitle('film-b', c, null)).toBe('Chunk film-b-002100-002129')
    expect(shipTitle('film-b', c, marked)).toBe('Chunk film-b-002100-002129, NOT A NUMBER in frames 2115 (3), 2120 (1): never encoded into a master')
    expect(shipTitle('film-b', c, marked, true)).toBe('Chunk film-b-002100-002129, a test, NOT A NUMBER in frames 2115 (3), 2120 (1): never encoded into a master')
    expect(shipTitle('film-b', c, rec('film-b', 2100, 2129, { mark: NOT_A_NUMBER }))).toBe('Chunk film-b-002100-002129, NOT A NUMBER in frames not named: never encoded into a master')
    expect(shippedLine('film-b', c, good, 'agent/p6-chunks-vm07')).toBe('shipped the record and the look of film-b-002100-002129 to agent/p6-chunks-vm07 (the picture travels by attachment)')
    expect(shippedLine('film-b', c, marked, 'agent/p6-chunks-vm07')).toBe('shipped the record and the look of film-b-002100-002129, marked NOT A NUMBER in frames 2115 (3), 2120 (1), to agent/p6-chunks-vm07 (the picture travels by attachment)')
  })

  it('refuses to encode a master from a marked chunk, and takes the same chunks without the mark', () => {
    const three = (over: Record<string, unknown>) => [chunk(rec('film-b', 0, 29)), chunk(rec('film-b', 30, 59, over)), chunk(rec('film-b', 60, 89))]
    expect(plan('film-b', three({})).ok).toBe(true)
    expect(plan('film-b', three({ notNumber: notNumberRecord([frame(30, 0), frame(31, 0)]) })).ok).toBe(true)
    const p = refused('film-b', three({ mark: NOT_A_NUMBER, notNumber: notNumberRecord([frame(45, 3)]) }), /is marked NOT A NUMBER: 3 values in frame 45 \(3\)\. It is never encoded into a master/)
    expect(p.problems.length).toBe(1)
    refused('film-b', three({ mark: NOT_A_NUMBER }), /is marked NOT A NUMBER/)
    refused('film-b', three({ notNumber: { total: 1, frames: [{ frame: 40, count: 1 }], unread: [] } }), /is marked NOT A NUMBER: 1 value in frame 40 \(1\)/)
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

  it.runIf(haveFfmpeg)('a frame with values that are no number: a loud line, the chunk marked in its record, the other chunks drawn, and the run ends with an error', () => {
    const d = path.join(dir, 'nan')
    const r = run(d, '--first', '0', '--last', '7', '--procs', '2', '--stand-in-nan', '5')
    expect(r.code).toBe(1)
    expect(r.lines.some((l) => /^\[0\] NOT A NUMBER: film-b frame 5 holds 3 values that are no number in its mean, the first at 7, 5 \(green, no number\), before.*Its PNG is kept as .*not-a-number.000005\.png\.$/.test(l))).toBe(true)
    expect(r.lines.some((l) => /^\[0\] finished film-b-000004-000005: .*It is marked NOT A NUMBER: frames 5 \(3\), the first at 7, 5 \(green, no number\)$/.test(l))).toBe(true)
    expect(chunks(d).length).toBe(4)
    const out = (first: number) => readJson(path.join(d, 'out', 'film-b', `film-b-${pad6(first)}-${pad6(first + 1)}.json`))
    expect(out(4).mark).toBe('NOT A NUMBER')
    expect(out(4).notNumber).toMatchObject({ total: 3, frames: [{ frame: 5, count: 3, first: { x: 7, y: 5, channel: 'green', kind: 'no number' } }], unread: [], msAFrame: 0 })
    expect(out(0).mark).toBeUndefined()
    expect(out(0).notNumber).toMatchObject({ total: 0, frames: [], unread: [] })
    expect(fs.existsSync(path.join(d, 'work', 'film-b', 'not-a-number', '000005.png'))).toBe(true)
    const end = r.lines.slice(-2)
    expect(end[0]).toMatch(/^NOT A NUMBER: .*film-b-000004-000005\.json \(film-b 4 to 5, drawn on .*\) holds 3 values that are no number in 1 frame: 5 \(3\), the first at 7, 5 \(green, no number\)$/)
    expect(end[1]).toMatch(/^master: 1 chunk of this range is marked NOT A NUMBER\. Every other chunk is drawn and may be sent\. Tell \/root the frames above\. Do not draw them again hoping/)
    const again = run(d, '--first', '0', '--last', '7', '--procs', '2', '--stand-in-nan', '5')
    expect(again.code).toBe(1)
    expect(again.lines.some((l) => /^4 chunks are finished, 0 to do/.test(l))).toBe(true)
  }, 180000)

  it.runIf(haveFfmpeg)('keeps the count of every frame in its side file and in the record, also over a run that stopped', () => {
    const d = path.join(dir, 'counts')
    const r = run(d, '--first', '0', '--last', '5', '--stand-in-more', '2', '--stand-in-fail', '3')
    expect(r.code).toBe(1)
    expect(r.lines.some((l) => l === 'the count was given with --samples, so no frame follows its motion: 1 of these 6 frames draws more than the base of 1 sample, the most is 2 (frame 2); 7 samples in all, 1.17 times the base')).toBe(true)
    expect(r.lines.some((l) => /^chunk 000002-000003 · frame 2 · 2 samples · /.test(l))).toBe(true)
    expect(readJson(path.join(frames(d, 2), '000002.json')).samples).toBe(2)
    const again = run(d, '--first', '0', '--last', '5', '--stand-in-more', '2')
    expect(again.code).toBe(0)
    expect(again.lines.some((l) => /^chunk 000002-000003: 1 of its 2 frames were on disk and were not rendered again/.test(l))).toBe(true)
    expect(again.lines.some((l) => /^chunk 000002-000003 · frame 2 · /.test(l))).toBe(false)
    expect(again.lines.some((l) => /^finished film-b-000002-000003: 2 frames, [\d.]+ s a frame in the mean, [\d.]+ s a sample \(3 samples: 1 of the frames over the base of 1, the most 2 at frame 2\), crf /.test(l))).toBe(true)
    expect(again.lines.some((l) => /^finished film-b-000004-000005: 2 frames, [\d.]+ s a frame in the mean, [\d.]+ s a sample \(2 samples: every frame at the base of 1\), crf /.test(l))).toBe(true)
    const record = (first: number) => readJson(path.join(d, 'out', 'film-b', `film-b-${pad6(first)}-${pad6(first + 1)}.json`))
    expect(record(2)).toMatchObject({ samples: 1, frameSamples: [2, 1], motion: null })
    expect(record(0).frameSamples).toEqual([1, 1])
    expect(record(4).frameSamples).toEqual([1, 1])
    const third = run(d, '--first', '0', '--last', '5', '--stand-in-more', '2')
    expect(third.lines.some((l) => /^3 chunks are finished, 0 to do/.test(l))).toBe(true)
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
