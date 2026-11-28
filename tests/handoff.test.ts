import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import * as L from '../tools/lib/handoff.mjs'
import * as S from '../tools/lib/handoff-shaders.mjs'
import { planProblems } from '../tools/lib/handoff-stamp.mjs'
import { crc32, zipRead, zipWrite } from '../tools/lib/handoff-zip.mjs'
import * as WinFs from '../tools/lib/handoff-win-fs.mjs'
import * as Work from '../tools/lib/handoff-work.mjs'
import { rel, readJson } from '../tools/lib/paths.mjs'

// The render handoff: the parts that need no browser. What is drawn is proven on real machines by
// .github/workflows/handoff-proof.yml; here are the rules those runs follow.

type Stamp = Record<string, unknown> & { releasedForFinalRender: boolean; engineHash: string; stillToDraw?: string[] }
const HASH = '0123456789abcdef'
const SHA = (c: string) => c.repeat(64)
const stamp = (over: Partial<Stamp> = {}): Stamp => ({
  version: 1,
  releasedForFinalRender: true,
  engineHash: HASH,
  references: [{ what: 'film-b', frame: 120 }],
  sound: { 'film-a': SHA('a'), 'film-b': SHA('b') },
  opening: { files: { 'opening.bin': SHA('c'), 'manifest.json': SHA('d') } },
  frames: { 'film-b': 3600, loop: 480, opening: 867, 'film-a': 4467 },
  ...over,
})
const goodRun = { engineHash: HASH, doctor: { pass: true, why: '' }, test: { pass: true, engineHash: HASH, machine: 'm1', small: false }, sound: [{ ok: true, why: '' }], freeGb: 500, needGb: 20, machine: 'm1' }
const NVIDIA = { name: 'NVIDIA GeForce RTX 5080' }
const RADEON = { name: 'AMD Radeon(TM) Graphics' }

describe('the names of the delivered files', () => {
  it('are the four names of the order, with the size in them', () => {
    expect(L.deliveryNames(3840, 2160)).toEqual({
      'film-a': 'Snow Globe Seasons - With Prompt - 3840x2160.mp4',
      'film-b': 'Snow Globe Seasons - Without Prompt - 3840x2160.mp4',
      loop: 'Snow Globe Seasons - Portfolio Looping Video - 3840x2160.mp4',
      still: 'Snow Globe Seasons - Portfolio Screenshot - 3840x2160.png',
    })
    expect(L.testFilmName(3840, 2160)).toBe('Snow Globe Seasons - Test - 3840x2160.mp4')
    expect(L.deliveryFolder()).toBe('Snow Globe Seasons')
  })
  it('gives a run of the tool tests another folder, so that it never passes for the film', () => {
    expect(L.deliveryFolder(true)).not.toBe(L.deliveryFolder(false))
  })
  it('knows no fifth file', () => {
    expect(() => L.deliveryName('poster', 3840, 2160)).toThrow()
  })
})

describe('the command line', () => {
  it('takes one word and nothing else', () => {
    for (const w of ['setup', 'doctor', 'test', 'render', 'check', 'deliver', 'clean']) expect(L.argProblem([w])).toBe('')
    expect(L.argProblem([])).not.toBe('')
    expect(L.argProblem(['render', '--force'])).toContain('one word')
    expect(L.argProblem(['render', '--procs', '4'])).toContain('one word')
    expect(L.argProblem(['shutdown'])).toContain('one word')
    expect(L.argProblem(['test', 'render'])).toContain('one word')
  })
  it('lets the background worker and the stamp through', () => {
    expect(L.argProblem(['render', '--worker'])).toBe('')
    expect(L.argProblem(['stamp', '--only', 'film-b:120'])).toBe('')
  })
  it('refuses a switch the stamp does not know, before anything is drawn', () => {
    for (const ok of [[], ['--proof'], ['--again'], ['--local'], ['--released', 'true'], ['--released', 'false'], ['--only', 'film-b:120,film-b:720,loop:0,opening:450', '--proof'], ['--only', 'loop:0', '--again', '--local']]) expect(L.argProblem(['stamp', ...ok])).toBe('')
    expect(L.argProblem(['stamp', '--help'])).toContain('knows no "--help"')
    expect(L.argProblem(['stamp', '--release', 'true'])).toContain('knows no "--release"')
    expect(L.argProblem(['stamp', 'released'])).toContain('knows no "released"')
    expect(L.argProblem(['stamp', '--released'])).toContain('true or false')
    expect(L.argProblem(['stamp', '--released', 'yes'])).toContain('true or false')
    expect(L.argProblem(['stamp', '--only'])).toContain('what:frame')
    expect(L.argProblem(['stamp', '--only', '--proof'])).toContain('what:frame')
    expect(L.argProblem(['stamp', '--only', 'film-b'])).toContain('what:frame')
    expect(L.argProblem(['stamp', '--proof', 'true'])).toContain('takes no value')
  })
  it('reads the test switches from one variable and refuses a word it does not know', () => {
    const t = L.testSwitches('software, small,tones,angle=d3d11,refs=film-b:120+loop:0,stretch=720-721/1,fast-watch')
    expect(t).toMatchObject({ software: true, small: true, tones: true, angle: 'd3d11', refs: 'film-b:120+loop:0', stretch: '720-721/1', fastWatch: true, linux: false, inline: false })
    expect(L.anyTestSwitch(t)).toBe(true)
    expect(L.anyTestSwitch(L.testSwitches(''))).toBe(false)
    expect(L.anyTestSwitch(L.testSwitches(undefined))).toBe(false)
    expect(() => L.testSwitches('released')).toThrow(/no switch/)
    expect(() => L.testSwitches('angle=d3d11 --no-sandbox')).toThrow(/no switch/)
    expect(() => L.testSwitches('small=yes')).toThrow(/no switch/)
  })
  it('ends every command with PASS, FAIL or RUNNING on one line', () => {
    expect(L.verdictLine('PASS', 'all\n  good')).toBe('PASS: all good')
    expect(L.verdictLine('FAIL', 'no')).toBe('FAIL: no')
    expect(() => L.verdictLine('MAYBE', 'x')).toThrow()
    expect(L.EXIT).toEqual({ PASS: 0, FAIL: 1, RUNNING: 3 })
  })
})

describe('what draws', () => {
  const soft = [
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)',
    'ANGLE (Mesa, Vulkan 1.4.335 (llvmpipe (LLVM 21.1.8 256 bits) (0x00000000)), llvmpipe)',
    'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)',
    'ANGLE (Unknown, lavapipe, Vulkan)',
    'Google SwiftShader',
    'D3D11 WARP adapter',
    'Mesa OffScreen',
    'Some Software Rasterizer',
  ]
  it('names software by every name it goes under', () => {
    for (const r of soft) expect(L.softwareName(r), r).not.toBe('')
  })
  it('takes no card for software', () => {
    for (const r of ['ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x000013C0) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)', 'ANGLE (Intel, Intel(R) UHD Graphics 770 (0x00004680) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'Warpaint 3000']) expect(L.softwareName(r), r).toBe('')
  })
  it('refuses software by name, and lets it through only by the switch of the tests', () => {
    const v = L.drawVerdict({ renderer: soft[0], cards: [NVIDIA] })
    expect(v).toMatchObject({ ok: false, software: true })
    expect(v.why).toContain('swiftshader')
    expect(L.drawVerdict({ renderer: soft[0], cards: [NVIDIA], allowSoftware: true })).toMatchObject({ ok: true, software: true })
  })
  it('wants the NVIDIA card where a machine has one beside a built in card', () => {
    expect(L.wantedCard([RADEON, NVIDIA])).toEqual({ vendor: 'NVIDIA', name: NVIDIA.name, others: [] })
    expect(L.wantedCard([RADEON])).toEqual({ vendor: 'AMD', name: RADEON.name, others: [] })
    expect(L.wantedCard([{ name: 'Apple M4 Pro' }])?.vendor).toBe('Apple')
    expect(L.wantedCard([{ name: 'Microsoft Hyper-V Video' }])).toBeNull()
    expect(L.wantedCard([])).toBeNull()
  })
  it('fails a page that draws on the small card of a machine with a large one', () => {
    const v = L.drawVerdict({ renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x000013C0) Direct3D11 vs_5_0 ps_5_0, D3D11)', cards: [RADEON, NVIDIA] })
    expect(v.ok).toBe(false)
    expect(v.software).toBe(false)
    expect(v.why).toContain('NVIDIA GeForce RTX 5080')
  })
  it('passes the NVIDIA card, the Apple card, and a machine whose cards have no known maker', () => {
    expect(L.drawVerdict({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11)', cards: [RADEON, NVIDIA] }).ok).toBe(true)
    expect(L.drawVerdict({ renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M4 Pro, Unspecified Version)', cards: [{ name: 'Apple M4 Pro' }] }).ok).toBe(true)
    expect(L.drawVerdict({ renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 770, D3D11)', cards: [{ name: 'Intel(R) UHD Graphics 770' }] }).ok).toBe(true)
  })
  it('of two cards of one maker wants the one with more memory of its own', () => {
    const small = { name: 'NVIDIA GeForce GTX 1050', memoryBytes: 2 * 1024 ** 3 }
    const large = { name: 'NVIDIA GeForce RTX 5080', memoryBytes: 16 * 1024 ** 3 }
    expect(L.wantedCard([small, large])).toEqual({ vendor: 'NVIDIA', name: large.name, others: [small.name] })
    expect(L.wantedCard([large, small])).toEqual({ vendor: 'NVIDIA', name: large.name, others: [small.name] })
    // with no memory read, the first the system names
    expect(L.wantedCard([{ name: 'NVIDIA A' }, { name: 'NVIDIA B' }])?.name).toBe('NVIDIA A')
  })
  it('reads the words of a name that tell one model from another', () => {
    expect(L.modelWords('NVIDIA GeForce RTX 5080')).toEqual(['nvidia', 'geforce', 'rtx', '5080'])
    expect(L.modelWords('AMD Radeon(TM) Graphics')).toEqual(['amd', 'radeon'])
    expect(L.modelWords('')).toEqual([])
    const page = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11)'
    expect(L.wordsMissing(page, 'NVIDIA GeForce RTX 5080')).toEqual([])
    expect(L.wordsMissing(page, 'NVIDIA GeForce RTX 5080 Laptop GPU')).toEqual(['laptop'])
    expect(L.wordsMissing(page, 'NVIDIA GeForce RTX 5090')).toEqual(['5090'])
    // a part of a word is not the word: 508 is not 5080
    expect(L.wordsMissing('NVIDIA GeForce RTX 5080', 'NVIDIA GeForce RTX 508')).toEqual(['508'])
  })
  it('holds the page to the model of the stronger card where a machine has two of one maker', () => {
    const small = { name: 'NVIDIA GeForce GTX 1050', memoryBytes: 2 * 1024 ** 3 }
    const large = { name: 'NVIDIA GeForce RTX 5080', memoryBytes: 16 * 1024 ** 3 }
    const onSmall = L.drawVerdict({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1050 (0x00001C81) Direct3D11 vs_5_0 ps_5_0, D3D11)', cards: [RADEON, small, large] })
    expect(onSmall.ok).toBe(false)
    expect(onSmall.why).toContain('more than one NVIDIA card')
    expect(onSmall.why).toContain('rtx 5080')
    const onLarge = L.drawVerdict({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11)', cards: [RADEON, small, large] })
    expect(onLarge).toMatchObject({ ok: true, card: large.name })
    expect(onLarge.look).toBeUndefined()
  })
  it('passes the one card of its maker under another wording of its name, and says so as a thing to look at', () => {
    const v = L.drawVerdict({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 5080 (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11)', cards: [RADEON, { name: 'NVIDIA GeForce RTX 5080 Founders Edition' }] })
    expect(v.ok).toBe(true)
    expect(v.look).toContain('founders edition')
    // two cards of the same model are one model: no rival, a look
    const twin = L.drawVerdict({ renderer: 'ANGLE (NVIDIA, NVIDIA RTX 5080, D3D11)', cards: [NVIDIA, NVIDIA] })
    expect(twin.ok).toBe(true)
    expect(twin.look).toContain('geforce')
  })
  it('fails a page with no WebGL', () => {
    expect(L.drawVerdict({ renderer: '', cards: [NVIDIA] }).ok).toBe(false)
    expect(L.drawVerdict({ renderer: 'no WebGL', cards: [] }).ok).toBe(false)
  })
  it('names the software renderer the Windows test machines draw with, as their doctor read it', () => {
    // MEASURED: handoff proof run 46090113975, windows-winget-lines
    expect(L.softwareName('ANGLE (Microsoft, Microsoft Basic Render Driver (0x0000008C) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('basic render')
  })
})

describe("the card's load while frames are drawn", () => {
  it('asks nvidia-smi one line a reading and reads it', () => {
    expect(L.SMI_ARGS).toEqual(['--query-gpu=utilization.gpu,memory.used,memory.total', '--format=csv,noheader,nounits'])
    expect(L.parseSmi('97, 6143, 16303')).toEqual({ busy: 97, usedMb: 6143, totalMb: 16303 })
    expect(L.parseSmi(' 0 , 512 , 16303 \r')).toEqual({ busy: 0, usedMb: 512, totalMb: 16303 })
    expect(L.parseSmi('utilization.gpu [%], memory.used [MiB], memory.total [MiB]')).toBeNull()
    expect(L.parseSmi('[N/A], 512, 16303')).toBeNull()
    expect(L.parseSmi('')).toBeNull()
  })
  it('keeps the busiest reading and the most memory in use', () => {
    expect(L.smiSummary(['3, 900, 16303', 'noise', '98, 7000, 16303', '41, 7400, 16303'])).toEqual({ readings: 3, busiest: 98, mostMb: 7400, totalMb: 16303 })
    expect(L.smiSummary([])).toEqual({ readings: 0, busiest: 0, mostMb: 0, totalMb: 0 })
    expect(L.smiSummary(undefined)).toEqual({ readings: 0, busiest: 0, mostMb: 0, totalMb: 0 })
  })
  it('says nothing to look at for a busy card, and asks for a look at an idle one', () => {
    const busy = L.loadVerdict({ readings: 40, busiest: 98, mostMb: 7400, totalMb: 16303 }, { wantNvidia: true, found: true })
    expect(busy).toEqual({ text: 'busiest 98 %, most memory in use 7400 of 16303 MiB, 40 readings two seconds apart', look: '' })
    const idle = L.loadVerdict({ readings: 40, busiest: L.IDLE_PERCENT - 1, mostMb: 600, totalMb: 16303 }, { wantNvidia: true, found: true })
    expect(idle.look).toContain('stayed idle')
    expect(L.loadVerdict({ readings: 40, busiest: L.IDLE_PERCENT, mostMb: 600, totalMb: 16303 }, { wantNvidia: true, found: true }).look).toBe('')
  })
  it('asks for a look where an NVIDIA card is there and its load cannot be read, and for none where there is no such card', () => {
    const none = L.loadVerdict({ readings: 0, busiest: 0, mostMb: 0, totalMb: 0 }, { wantNvidia: false, found: false })
    expect(none.look).toBe('')
    expect(none.text).toContain('no NVIDIA card')
    const lost = L.loadVerdict({ readings: 0, busiest: 0, mostMb: 0, totalMb: 0 }, { wantNvidia: true, found: false })
    expect(lost.look).toContain('could not be read')
    const silent = L.loadVerdict({ readings: 0, busiest: 0, mostMb: 0, totalMb: 0 }, { wantNvidia: true, found: true })
    expect(silent.look).toContain('gave no reading')
  })
})

describe('the seam of the loop', () => {
  it('passes the loop as it was measured, and fails one that jumps at its seam', () => {
    // MEASURED on the whole loop at preview size: the four steps on each side, and the seam
    const steps = [0.3827, 0.4659, 0.4522, 0.4136, 1.08, 10.56, 6.6, 0.4637, 0.4466, 0.4297, 0.4136]
    expect(L.besideSeam(steps)).toBeCloseTo(0.4659, 4)
    expect(L.seamOk({ seam: 0.6562, beside: L.besideSeam(steps) })).toBe(true)
    expect(L.seamOk({ seam: 1.5, beside: L.besideSeam(steps) })).toBe(false)
    expect(L.seamOk({ seam: 10.5, beside: L.besideSeam(steps) })).toBe(false)
  })
  it('lets a still loop pass: under one level is no jump', () => {
    expect(L.seamOk({ seam: 0.9, beside: 0.01 })).toBe(true)
    expect(L.seamOk({ seam: 1.1, beside: 0.01 })).toBe(false)
  })
})

describe('what the page wrote', () => {
  // the wording of the shader compiler of Direct3D, as the doctor read it on Windows in handoff proof run 46090113975
  const warnA = 'warning: THREE.WebGLProgram: Program Info Log: (1185,1): warning X4000: use of potentially uninitialized variable (f_glassSeen_int)\n(1203,1): warning X4000: use of potentially uninitialized variable (f_glassSeen_int)'
  const warnB = 'warning: THREE.WebGLProgram: Program Info Log: (503,12-121): warning X3595: gradient instruction used in a loop with varying iteration; partial derivatives may have undefined value'
  const warnB2 = warnB.replace('(503,12-121)', '(500,12-121)')
  it('takes a warning of the shader compiler as a warning, each different one once with its count', () => {
    const m = L.pageMessages([warnA, warnB, warnB2, warnB])
    expect(m.errors).toEqual([])
    expect(m.warnings.map((w) => w.times)).toEqual([1, 3])
    expect(m.warnings[1].text).toBe(warnB)
  })
  it('takes a shader that does not compile, an error of the page and a script that throws as errors', () => {
    const errors = ['error: THREE.WebGLProgram: Shader Error 0 - VALIDATE_STATUS false', 'pageerror: x is not defined', 'error: THREE.WebGLShader: gl.getShaderInfoLog() fragment ERROR: 0:12']
    const m = L.pageMessages([warnA, ...errors, errors[0]])
    expect(m.errors).toEqual(errors)
    expect(m.warnings).toHaveLength(1)
  })
  it('takes a line it does not know as an error', () => {
    expect(L.pageMessages(['something else']).errors).toEqual(['something else'])
    expect(L.pageMessages().errors).toEqual([])
  })
})

describe('where the machine is, and its tools', () => {
  it('lets Windows and macOS through and refuses a Linux layer inside Windows', () => {
    expect(L.placeProblem({ platform: 'win32' })).toBe('')
    expect(L.placeProblem({ platform: 'darwin' })).toBe('')
    expect(L.placeProblem({ platform: 'linux', release: '5.15.153.1-microsoft-standard-WSL2' })).toContain('WSL')
    expect(L.placeProblem({ platform: 'linux', env: { WSL_DISTRO_NAME: 'Ubuntu' } })).toContain('WSL')
    expect(L.placeProblem({ platform: 'linux', procVersion: 'Linux version 5.10 (Microsoft@Microsoft.com)' })).toContain('WSL')
  })
  it('refuses the Linux layer even with the switch that lets the tool tests run on Linux', () => {
    expect(L.placeProblem({ platform: 'linux', env: { WSL_INTEROP: '/run/WSL/1_interop' }, allowLinux: true })).toContain('WSL')
    expect(L.placeProblem({ platform: 'linux', release: '6.1.0' })).not.toBe('')
    expect(L.placeProblem({ platform: 'linux', release: '6.1.0', allowLinux: true })).toBe('')
  })
  it('takes the Node versions the build takes', () => {
    for (const v of ['v20.19.0', 'v20.20.2', 'v22.12.0', 'v22.23.5', 'v24.1.0', 'v26.0.0']) expect(L.nodeOk(v), v).toBe(true)
    for (const v of ['v18.20.0', 'v20.18.3', 'v22.11.0', 'v21.7.0', '', 'node']) expect(L.nodeOk(v), v).toBe(false)
  })
  it('reads the version of an ffmpeg build, numbered or dated', () => {
    expect(L.ffmpegVersion('ffmpeg version 8.0.1-full_build-www.gyan.dev Copyright (c) 2000-2025 the FFmpeg developers')).toMatchObject({ numbers: [8, 0, 1], dated: false })
    expect(L.ffmpegVersion('ffmpeg version n7.1 Copyright')).toMatchObject({ numbers: [7, 1, 0], dated: false })
    expect(L.ffmpegVersion('ffmpeg version 2025-11-20-git-abcdef-full_build Copyright')?.dated).toBe(true)
    expect(L.ffmpegVersion('ffprobe version 6.1.1 Copyright')).toMatchObject({ numbers: [6, 1, 1] })
    expect(L.ffmpegVersion('command not found')).toBeNull()
    expect(L.atLeast([6, 1, 1], L.LEAST.ffmpeg)).toBe(false)
    expect(L.atLeast([7, 0, 0], L.LEAST.ffmpeg)).toBe(true)
    expect(L.atLeast(null, L.LEAST.git)).toBe(false)
  })
  it('gives the exact install line of each tool for Windows and for macOS', () => {
    expect(L.installLine('git', 'win32')).toMatch(/^winget install --id Git\.Git -e /)
    expect(L.installLine('node', 'win32')).toMatch(/^winget install --id OpenJS\.NodeJS\.LTS -e /)
    expect(L.installLine('ffmpeg', 'win32')).toMatch(/^winget install --id Gyan\.FFmpeg -e /)
    expect(L.installLine('chrome', 'win32')).toMatch(/^winget install --id Google\.Chrome -e /)
    for (const t of ['git', 'node', 'ffmpeg', 'chrome'] as const) expect(L.installLine(t, 'darwin')).toMatch(/^brew install /)
  })
  it('finds a tool in the first folder that holds it, and reads the path variable under any spelling', () => {
    const has = (p: fs.PathLike) => String(p) === path.join('b', 'ffmpeg.exe')
    expect(L.findIn(['a', 'b', 'c'], ['ffmpeg.exe', 'ffmpeg'], has)).toBe(path.join('b', 'ffmpeg.exe'))
    expect(L.findIn(['a'], ['ffmpeg'], has)).toBe('')
    expect(L.pathDirs({ Path: 'C:\\a;C:\\b b;' }, 'win32')).toEqual(['C:\\a', 'C:\\b b'])
    expect(L.pathDirs({ PATH: '/usr/bin:/opt/homebrew/bin' }, 'darwin')).toEqual(['/usr/bin', '/opt/homebrew/bin'])
  })
})

describe('the gate of the full render', () => {
  it('refuses while the stamp is not released, before anything else and in the words of the order', () => {
    const r = L.renderRefusals({ ...goodRun, stamp: stamp({ releasedForFinalRender: false }) })
    expect(r).toEqual(['the film is not released for its final render yet; step 1 only'])
    // nothing else can open it: not a passed doctor and test, and no missing field either
    expect(L.renderRefusals({ stamp: stamp({ releasedForFinalRender: false }), engineHash: 'ffffffffffffffff', doctor: null, test: null, sound: [], freeGb: 0, needGb: 0 })).toEqual([L.NOT_RELEASED])
  })
  it('takes only true for released', () => {
    for (const v of ['true', 1, 'yes', null]) {
      const r = L.renderRefusals({ ...goodRun, stamp: stamp({ releasedForFinalRender: v as unknown as boolean }) })
      expect(r.length).toBeGreaterThan(0)
    }
  })
  it('refuses a stamp that still lacks references, released or not', () => {
    const r = L.renderRefusals({ ...goodRun, stamp: stamp({ stillToDraw: ['film-b:675'] }) })
    expect(r).toHaveLength(1)
    expect(r[0]).toContain(L.NOT_RELEASED)
    expect(r[0]).toContain('film-b:675')
  })
  it('lets a released stamp through when everything holds', () => {
    expect(L.renderRefusals({ ...goodRun, stamp: stamp() })).toEqual([])
  })
  it('refuses on another engine hash, a failed doctor, a missing, failed or foreign test, a wrong mix and a full disk', () => {
    expect(L.renderRefusals({ ...goodRun, stamp: stamp(), engineHash: 'ffffffffffffffff' }).join(' ')).toContain('the stamp was made for')
    expect(L.renderRefusals({ ...goodRun, stamp: stamp(), doctor: { pass: false, why: 'chrome is missing' } }).join(' ')).toContain('chrome is missing')
    expect(L.renderRefusals({ ...goodRun, stamp: stamp(), test: null }).join(' ')).toContain('has not been run')
    expect(L.renderRefusals({ ...goodRun, stamp: stamp(), test: { ...goodRun.test, pass: false } }).join(' ')).toContain('did not pass')
    expect(L.renderRefusals({ ...goodRun, stamp: stamp(), test: { ...goodRun.test, engineHash: 'ffffffffffffffff' } }).join(' ')).toContain('Run step 1 again')
    expect(L.renderRefusals({ ...goodRun, stamp: stamp(), test: { ...goodRun.test, machine: 'm2' } }).join(' ')).toContain('another machine')
    expect(L.renderRefusals({ ...goodRun, stamp: stamp(), test: { ...goodRun.test, small: true } }).join(' ')).toContain("tool's own tests")
    expect(L.renderRefusals({ ...goodRun, stamp: stamp(), sound: [{ ok: false, why: 'the sound of film-a is not here' }] })).toEqual(['the sound of film-a is not here'])
    expect(L.renderRefusals({ ...goodRun, stamp: stamp(), freeGb: 10, needGb: 20 }).join(' ')).toContain('needs 20 GB')
  })
  it('refuses a stamp that is not whole and says what it lacks', () => {
    expect(L.stampProblems(null)).toEqual(['render/STAMP.json is not a stamp'])
    expect(L.stampProblems(stamp())).toEqual([])
    expect(L.stampProblems(stamp({ engineHash: 'short' })).join(' ')).toContain('engine hash')
    expect(L.stampProblems(stamp({ frames: { 'film-b': 3600, loop: 480, opening: 867, 'film-a': 4466 } })).join(' ')).toContain('do not add up')
    expect(L.stampProblems(stamp({ releasedForFinalRender: 'false' as unknown as boolean })).join(' ')).toContain('released')
    expect(L.renderRefusals({ ...goodRun, stamp: stamp({ references: [] }) })[0]).toContain('Nothing was drawn')
  })
  it('lets the small run of the tool tests past the release and nothing else', () => {
    const closed = stamp({ releasedForFinalRender: false })
    expect(L.renderRefusals({ ...goodRun, stamp: closed, small: true, test: { ...goodRun.test, small: true } })).toEqual([])
    expect(L.renderRefusals({ ...goodRun, stamp: closed, small: true, test: null }).join(' ')).toContain('has not been run')
  })
  it('judges a mix by its sha256', () => {
    expect(L.soundVerdict('film-a', 'audio/final/film-a.wav', '', SHA('a'))).toMatchObject({ ok: false })
    expect(L.soundVerdict('film-a', 'audio/final/film-a.wav', '', SHA('a')).why).toContain('not in the public repo')
    expect(L.soundVerdict('film-a', 'audio/final/film-a.wav', SHA('b'), SHA('a')).ok).toBe(false)
    expect(L.soundVerdict('film-a', 'audio/final/film-a.wav', SHA('a'), SHA('a')).ok).toBe(true)
  })
})

describe('the tracked stamp of this branch', () => {
  const file = rel('render', 'STAMP.json')
  const s = readJson(file) as Stamp & { references: { what: string; frame: number; half: { file: string; sha256: string; width: number; height: number }; cuts: { file: string; sha256: string; w: number; h: number }[]; glass: unknown[] }[]; sound: Record<string, string>; opening: { files: Record<string, string>; folder: string; commit: string }; delivery: { names: Record<string, string>; folder: string; test: string }; frames: Record<string, number>; floors: Record<string, number>; samples: Record<string, [number, number][]> }
  it('is whole, and the render refuses it until it is released: only /root sets that, at the freeze', () => {
    expect(L.stampProblems(s)).toEqual([])
    expect(typeof s.releasedForFinalRender).toBe('boolean')
    const refusals = L.renderRefusals({ ...goodRun, engineHash: s.engineHash, test: { ...goodRun.test, engineHash: s.engineHash }, stamp: s })
    if (s.releasedForFinalRender) {
      // after the freeze: a released stamp holds every reference of the plan, and nothing in it stands in the render's way
      expect(s.stillToDraw ?? []).toEqual([])
      expect(refusals).toEqual([])
    } else {
      expect(refusals[0]).toContain(L.NOT_RELEASED)
    }
  })
  it('names the two final mixes by the sha256 of the order', () => {
    expect(s.sound['film-a']).toBe('883ee8bd67c284161d0156b0e10fcc7dc79be5c0526423809174e456544b5515')
    expect(s.sound['film-b']).toBe('3edd8ff579404fce8d62a041b2172306a6b26eb9a31d59e0b90d82315337bf23')
  })
  it('holds the opening pack by the sha256 of its two tracked files', () => {
    expect(s.opening.commit).toBe('e44b7e51f656d15a4bfd9199eeeeb3c83c1bc69c')
    for (const name of ['opening.bin', 'manifest.json']) expect(L.sha256File(rel(s.opening.folder, name)), name).toBe(s.opening.files[name])
    expect(s.opening.folder.startsWith('public')).toBe(false)
  })
  it('holds every reference file it names, lossless, and no file near the size GitHub refuses', () => {
    let total = 0
    for (const r of s.references) {
      expect(r.half.width).toBe(1920)
      expect(r.half.height).toBe(1080)
      for (const f of [r.half, ...r.cuts]) {
        const p = rel('render', 'refs', f.file)
        expect(L.sha256File(p), f.file).toBe(f.sha256)
        const size = fs.statSync(p).size
        expect(size).toBeLessThan(45e6)
        total += size
      }
      for (const c of r.cuts) expect([c.w, c.h]).toEqual([960, 540])
      if (r.what !== 'opening') expect(r.glass.length).toBeGreaterThan(0)
    }
    expect(total).toBeLessThanOrEqual(40e6)
    for (const d of ['render', 'render/refs', 'render/opening-pack']) for (const n of fs.readdirSync(rel(d))) expect(fs.statSync(rel(d, n)).size, n).toBeLessThan(45e6)
  })
  it('names the delivered files and the frame counts of the order', () => {
    expect(s.delivery.names).toEqual(L.deliveryNames(3840, 2160))
    expect(s.delivery.folder).toBe('Snow Globe Seasons')
    expect(s.frames).toEqual({ 'film-b': 3600, loop: 480, opening: 867, 'film-a': 4467 })
    expect(L.countsOf(s.samples['film-b'])).toHaveLength(3600)
    expect(L.countsOf(s.samples.loop)).toHaveLength(480)
  })
  it('agrees with its plan', () => {
    const plan = readJson(rel('render', 'PLAN.json'))
    expect(planProblems(plan, { width: 3840, height: 2160 })).toEqual([])
    expect(s.sound).toEqual(plan.sound)
    expect(s.floors).toEqual(plan.floors)
    const made = s.references.map((r) => `${r.what}:${r.frame}`)
    const wanted = (plan.frames as { what: string; frame: number }[]).map((f) => `${f.what}:${f.frame}`)
    expect([...made, ...(s.stillToDraw ?? [])].sort()).toEqual([...wanted].sort())
  })
})

describe('the plan of the stamp', () => {
  const plan = () => JSON.parse(fs.readFileSync(rel('render', 'PLAN.json'), 'utf8'))
  const format = { width: 3840, height: 2160 }
  it('refuses a box outside the picture, a frame named twice and a frame with no glass region', () => {
    const a = plan()
    a.frames[0].cuts[0].x = 3000
    expect(planProblems(a, format).join(' ')).toContain('does not lie inside')
    const b = plan()
    b.frames.push({ ...b.frames[0] })
    expect(planProblems(b, format).join(' ')).toContain('named twice')
    const c = plan()
    c.frames[0].glass = []
    expect(planProblems(c, format).join(' ')).toContain('no glass region')
    const d = plan()
    d.sound['film-a'] = 'x'
    expect(planProblems(d, format).join(' ')).toContain('sha256')
    expect(planProblems(null, format)).toHaveLength(1)
  })
})

describe('the plan of a render and of what a second run still has to do', () => {
  it('cuts chunks as the master tool does', () => {
    expect(L.chunkLines(0, 89, 30)).toEqual([{ first: 0, last: 29 }, { first: 30, last: 59 }, { first: 60, last: 89 }])
    expect(L.chunkLines(0, 479, 30)).toHaveLength(16)
    expect(L.chunkLines(0, 3599, 30)).toHaveLength(120)
    expect(L.chunkLines(0, 866, 30).at(-1)).toEqual({ first: 840, last: 866 })
    expect(L.chunkFile('film-b', { first: 30, last: 59 })).toBe('film-b-000030-000059')
  })
  it('makes batches of whole chunks', () => {
    const b = L.batchesOf(3600, 30, 6)
    expect(b).toHaveLength(20)
    expect(b[0]).toEqual({ first: 0, last: 179 })
    expect(b.at(-1)).toEqual({ first: 3420, last: 3599 })
    expect(L.batchesOf(480, 30, 6).at(-1)).toEqual({ first: 360, last: 479 })
  })
  it('draws nothing again that is finished, and carries on in the batch that was stopped', () => {
    const finished = new Set(['film-b:0', 'film-b:30', 'film-b:60', 'film-b:90', 'film-b:120', 'film-b:150', 'film-b:180'])
    const done = (what: string, c: { first: number }) => finished.has(`${what}:${c.first}`)
    const [b, loop] = L.resumePlan({ parts: [{ what: 'film-b', first: 0, last: 3599 }, { what: 'loop', first: 0, last: 479 }], chunkFrames: 30, batchChunks: 6, done })
    expect(b.finished).toBe(7)
    expect(b.framesDone).toBe(210)
    expect(b.batches).toHaveLength(19)
    expect(b.batches[0]).toEqual({ first: 180, last: 359 })
    expect(loop.finished).toBe(0)
    expect(loop.batches).toHaveLength(3)
    const all = L.resumePlan({ parts: [{ what: 'loop', first: 0, last: 479 }], chunkFrames: 30, batchChunks: 6, done: () => true })
    expect(all[0].batches).toEqual([])
    expect(all[0].framesDone).toBe(480)
  })
  it('cuts the stretch of the short test into the chunks one process and two processes draw', () => {
    const s = L.stretchPlan('', { first: 660, last: 779 }, 30)
    expect(s).toMatchObject({ first: 660, last: 779, size: 30 })
    expect(s.one).toEqual([{ first: 660, last: 689 }, { first: 690, last: 719 }])
    expect(s.two).toEqual([{ first: 720, last: 749 }, { first: 750, last: 779 }])
    const t = L.stretchPlan('720-721/1', { first: 660, last: 779 }, 30)
    expect(t.size).toBe(1)
    expect(t.one).toEqual([{ first: 720, last: 720 }])
    expect(t.two).toEqual([{ first: 721, last: 721 }])
    expect(() => L.stretchPlan('700-779', { first: 660, last: 779 }, 30)).toThrow(/whole chunks/)
  })
  it('keeps the sample count of every frame short and reads it back', () => {
    const counts = [24, 24, 96, 96, 96, 81, 24]
    const runs = L.runsOf(counts)
    expect(runs).toEqual([[24, 2], [96, 3], [81, 1], [24, 1]])
    expect(L.countsOf(runs)).toEqual(counts)
    expect(L.tally(counts)).toEqual({ 24: 3, 96: 3, 81: 1 })
    expect(L.tally(counts, 2, 4)).toEqual({ 96: 3 })
  })
})

describe('time, processes and disk', () => {
  it('fits the cost of a frame and of a sample', () => {
    const frames = [24, 24, 48, 96, 96].map((samples) => ({ samples, seconds: 0.5 + samples * 0.05 }))
    const c = L.fitCost(frames)!
    expect(c.each).toBeCloseTo(0.5, 6)
    expect(c.perSample).toBeCloseTo(0.05, 6)
    expect(c.counts).toBe(3)
    const one = L.fitCost([{ samples: 24, seconds: 2.4 }, { samples: 24, seconds: 2.4 }])!
    expect(one).toMatchObject({ each: 0, counts: 1 })
    expect(one.perSample).toBeCloseTo(0.1, 9)
    expect(L.fitCost([])).toBeNull()
    // a fit that would make a frame cost less than nothing puts everything on the samples
    const odd = L.fitCost([{ samples: 24, seconds: 1 }, { samples: 96, seconds: 9 }])!
    expect(odd.each).toBe(0)
    expect(odd.perSample).toBeGreaterThan(0)
  })
  it('uses two processes only when they pay and the memory holds them', () => {
    expect(L.procsRule({ one: 1, two: 1.6, memoryHolds: 15 }).procs).toBe(2)
    expect(L.procsRule({ one: 1, two: 1.3, memoryHolds: 2 }).procs).toBe(2)
    expect(L.procsRule({ one: 1, two: 1.29, memoryHolds: 15 }).procs).toBe(1)
    expect(L.procsRule({ one: 1, two: 1.9, memoryHolds: 1 }).procs).toBe(1)
    expect(L.procsRule({ one: 1, two: 0, memoryHolds: 15 }).procs).toBe(1)
    expect(L.procsRule({ one: 0, two: 2, memoryHolds: 15 }).procs).toBe(1)
    for (const r of [L.procsRule({ one: 1, two: 1.6, memoryHolds: 15 }), L.procsRule({ one: 1, two: 1.1, memoryHolds: 15 }), L.procsRule({ one: 1, two: 1.9, memoryHolds: 1 })]) expect(r.why.length).toBeGreaterThan(20)
  })
  it('projects the hours of film B and the loop from the samples of every frame', () => {
    const p = L.projection({ counts: { 24: 1000, 96: 2000 }, cost: { each: 1, perSample: 0.1 }, gain: 2, encodeSeconds: 600, startSeconds: 20, batches: 10, chunkSeconds: 3, chunks: 100 })
    expect(p.frames).toBe(3000)
    const draw = (1000 * (1 + 2.4) + 2000 * (1 + 9.6) + 300) / 2
    expect(p.drawSeconds).toBeCloseTo(draw, 6)
    expect(p.seconds).toBeCloseTo(draw + 600 + 200, 6)
    expect(L.TOO_LONG_HOURS).toBe(10)
  })
  it('plans the disk at its fullest', () => {
    const d = L.diskPlan({ chunkBytes: 27e6, frames: { 'film-b': 3600, loop: 480, opening: 867 }, chunkFrames: 30, pngBytes: 16e6, procs: 2, finalBytes: [500e6, 500e6, 400e6, 30e6], spare: 3 * 1024 ** 3 })
    expect(d.chunks).toBe(120 + 16 + 29)
    expect(d.intermediates).toBe(165 * 27e6)
    expect(d.inFlight).toBe(16e6 * 30 * 2)
    expect(d.copies).toBe(d.finals)
    expect(d.total).toBe(d.intermediates + d.inFlight + d.finals + d.encodeRoom + d.copies + d.spare)
    expect(L.gb(d.total)).toBeGreaterThan(9)
    expect(L.gb(d.total)).toBeLessThan(20)
  })
  it('says a length in seconds, minutes or hours', () => {
    expect(L.hoursText(42)).toBe('42 s')
    expect(L.hoursText(600)).toBe('10.0 min')
    expect(L.hoursText(4 * 3600)).toBe('4.0 h')
  })
  it('writes a heartbeat line with the frames done and left, the pace and the expected end', () => {
    const line = L.heartbeatLine({ done: 1200, total: 4947, secondsAFrame: 2.5, leftSeconds: 9000, now: new Date(2026, 0, 1, 10, 0, 0).getTime(), phase: 'film-b frames 1200 to 1379' })
    expect(line).toBe('heartbeat: film-b frames 1200 to 1379, 1200 of 4947 frames done, 3747 left, 2.50 s a frame, expected end about 12:30 (2.5 h from now)')
    expect(L.heartbeatLine({ done: 0, total: 10, secondsAFrame: 0, leftSeconds: 0 })).toContain('no pace yet')
    expect(L.secondsLeft([24, 96, 24], (i: number) => i === 0, { each: 1, perSample: 0.1 }, 2)).toBeCloseTo((1 + 9.6 + 1 + 2.4) / 2, 9)
  })
})

describe('the measures of a picture', () => {
  const W = 64
  const Hh = 32
  const picture = (f: (x: number, y: number, c: number) => number) => {
    const b = Buffer.alloc(W * Hh * 3)
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) for (let c = 0; c < 3; c++) b[(y * W + x) * 3 + c] = Math.max(0, Math.min(255, Math.round(f(x, y, c))))
    return b
  }
  const scene = picture((x, y, c) => 128 + 100 * Math.sin(x / 9 + c) * Math.cos(y / 7))
  it('halves by the mean of each 2 x 2 block, rounded half up', () => {
    const b = Buffer.from([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 10, 20, 30, 10, 20, 30, 10, 20, 31, 11, 21, 31])
    // two pictures of 2 x 2 side by side would be 4 x 2; this is one of 4 x 2: blocks (0,1 | 10,10) and (2,3 | 10,11)
    const h = L.half(b, 4, 2)
    expect([h.width, h.height]).toEqual([2, 1])
    expect([...h.data]).toEqual([5, 10, 15, 7, 12, 17])
    expect(L.half(scene, W, Hh).data).toHaveLength((W / 2) * (Hh / 2) * 3)
  })
  it('cuts a box out of a picture', () => {
    const cut = L.crop(scene, W, { x: 10, y: 4, w: 16, h: 8 })
    expect(cut).toHaveLength(16 * 8 * 3)
    expect(cut[0]).toBe(scene[(4 * W + 10) * 3])
    expect(cut[cut.length - 1]).toBe(scene[(11 * W + 25) * 3 + 2])
  })
  it('measures PSNR, and says identical pictures are identical', () => {
    expect(L.psnr(scene, scene)).toEqual({ psnr: Infinity, maxDiff: 0 })
    const off = Buffer.from(scene)
    for (let i = 0; i < off.length; i++) off[i] = Math.min(255, off[i] + 2)
    const p = L.psnr(scene, off)
    expect(p.maxDiff).toBe(2)
    expect(p.psnr).toBeGreaterThan(41)
    expect(p.psnr).toBeLessThan(43)
    expect(() => L.psnr(scene, scene.subarray(3))).toThrow()
  })
  it('has a coarser measure that forgives a shift of one pixel and does not forgive another picture', () => {
    const shifted = picture((x, y, c) => 128 + 100 * Math.sin((x - 1) / 9 + c) * Math.cos(y / 7))
    const other = picture((x, y, c) => 128 + 100 * Math.sin(x / 4 + c) * Math.cos(y / 3))
    const fine = L.psnr(scene, shifted).psnr
    const coarse = L.coarsePsnr(scene, shifted, W, Hh)
    expect(coarse).toBeGreaterThan(fine + 0.5)
    expect(L.coarsePsnr(scene, other, W, Hh)).toBeLessThan(coarse - 8)
    expect(L.coarsePsnr(scene, scene, W, Hh)).toBe(Infinity)
    expect(L.blockMeans(scene, W, Hh)).toHaveLength((W / 8) * (Hh / 8) * 3)
  })
  it('catches a glass that came out white', () => {
    const box = { x: 16, y: 8, w: 32, h: 16 }
    const good = L.glassStats(scene, W, box)
    const white = Buffer.from(scene)
    for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) white.fill(255, (y * W + x) * 3, (y * W + x) * 3 + 3)
    const bad = L.glassStats(white, W, box)
    expect(bad.meanLuma).toBeCloseTo(1, 9)
    expect(bad.nearWhite).toBe(1)
    expect(good.meanLuma).toBeGreaterThan(0.2)
    expect(good.meanLuma).toBeLessThan(0.8)
    expect(good.nearWhite).toBeLessThan(0.1)
  })
  it('refuses a flat picture and a picture of the wrong size', () => {
    expect(L.pictureProblem(Buffer.alloc(W * Hh * 3, 7), W, Hh)).toContain('flat')
    expect(L.pictureProblem(Buffer.alloc(W * Hh * 3, 255), W, Hh)).toContain('flat')
    expect(L.pictureProblem(scene, W, Hh)).toBe('')
    expect(L.pictureProblem(scene.subarray(3), W, Hh)).toContain('bytes')
  })
  it('compares a frame with its reference: whole, cuts and glass, each against its floor', () => {
    const floors = { psnrWhole: 40, coarseWhole: 42, psnrCut: 38, coarseCut: 40, glassLuma: 0.02, glassWhite: 0.01 }
    const cutBox = { name: 'middle', x: 16, y: 8, w: 32, h: 16 }
    const glassBox = { name: 'glass', x: 16, y: 8, w: 32, h: 16 }
    const ref = { half: L.half(scene, W, Hh), cuts: [{ ...cutBox, data: L.crop(scene, W, cutBox) }], glass: [{ ...glassBox, ...L.glassStats(scene, W, glassBox) }] }
    const same = L.compareFrame({ here: scene, width: W, height: Hh, ref, floors })
    expect(same.pass).toBe(true)
    expect(same.rows.map((r) => r.check)).toEqual(['a picture', 'whole picture, half size', 'whole picture, blocks', 'whole picture, how far apart', 'cut middle, full size', 'cut middle, blocks', 'cut middle, how far apart', 'glass glass, mean luma', 'glass glass, near white'])
    // how far apart is noted and holds nothing: the floors hold the test
    expect(same.rows.filter((r) => r.pass === null).map((r) => r.check)).toEqual(['whole picture, how far apart', 'cut middle, how far apart'])
    expect(same.numbers.apart).toMatchObject({ largest: 0, mean: 0, over: 0, box: null })
    const white = Buffer.from(scene)
    for (let y = 8; y < 24; y++) for (let x = 16; x < 48; x++) white.fill(255, (y * W + x) * 3, (y * W + x) * 3 + 3)
    const bad = L.compareFrame({ here: white, width: W, height: Hh, ref, floors })
    expect(bad.pass).toBe(false)
    expect(bad.rows.filter((r) => r.pass === false).map((r) => r.check)).toContain('glass glass, near white')
    const flat = L.compareFrame({ here: Buffer.alloc(W * Hh * 3), width: W, height: Hh, ref, floors })
    expect(flat.pass).toBe(false)
    expect(flat.rows).toHaveLength(1)
  })
  it('says how far two pictures stand apart, and where', () => {
    const W = 64
    const Hh = 32
    const a = Buffer.alloc(W * Hh * 3, 100)
    const b = Buffer.from(a)
    // one pixel 40 levels off in one channel, and a block of 4 x 2 pixels 9 levels off, in the lower right
    b[(3 * W + 5) * 3 + 1] = 140
    for (let y = 28; y < 30; y++) for (let x = 56; x < 60; x++) b[(y * W + x) * 3] = 109
    // and one pixel exactly at the threshold, which does not count
    b[(10 * W + 10) * 3 + 2] = 100 + L.APART.levels
    const m = L.apart(a, b, W, Hh)
    expect(m.largest).toBe(40)
    expect(m.largestAt).toEqual({ x: 5, y: 3 })
    expect(m.over).toBe(9)
    expect(m.share).toBeCloseTo(9 / (W * Hh), 9)
    expect(m.mean).toBeCloseTo((40 + 8 * 9 + L.APART.levels) / (W * Hh * 3), 9)
    expect(m.box).toEqual({ x: 5, y: 3, w: 55, h: 27 })
    expect(m.cells[0]).toEqual({ column: 8, row: 4, pixels: 8 })
    expect(m.cells[1]).toEqual({ column: 1, row: 1, pixels: 1 })
    const text = L.apartText(m, { scale: 2 })
    expect(text).toContain('largest 40 of 255 at x 10 y 6')
    expect(text).toContain(`9 pixels (${((9 / (W * Hh)) * 100).toFixed(3)} %) over ${L.APART.levels}`)
    expect(text).toContain('x 10 to 119, y 6 to 59')
    expect(text).toContain('most in column 8 row 4: 8, column 1 row 1: 1')
    expect(L.apartText(L.apart(a, a, W, Hh))).toBe(`largest 0 of 255, mean 0.000, 0 pixels (0.000 %) over ${L.APART.levels}`)
    // a cut says its places in the pixels of the full picture
    expect(L.apartText(m, { x: 1000, y: 500 })).toContain('at x 1005 y 503')
    const pic = L.apartPicture(a, b, W, Hh)
    expect(pic[(3 * W + 5) * 3]).toBe(255)
    expect(pic[(28 * W + 56) * 3 + 2]).toBe(144)
    expect(pic[0]).toBe(0)
  })
  it('writes a table with ok, FAILS and noted', () => {
    const text = L.tableText([{ check: 'a', found: 'x', wanted: 'x', pass: true }, { check: 'b', found: 'y', wanted: 'z', pass: false }, { check: 'c', found: 'w', wanted: '', pass: null }])
    expect(text.split('\n')).toHaveLength(5)
    expect(text).toMatch(/a\s+x\s+x\s+ok/)
    expect(text).toMatch(/b\s+y\s+z\s+FAILS/)
    expect(text).toMatch(/c\s+w\s+noted/)
  })
})

describe('what the shader compiler wrote', () => {
  const fragment = ['#version 300 es', '#define SHADER_NAME GlobeGlass', '#define USE_FOG 1', 'precision highp float;', 'uniform float uTime;', 'float glassSeen(int k) {', '  float x;', '  if (k > 0) x = 1.0;', '  return x;', '}', 'void main() {}'].join('\n')
  const other = fragment.replace('#define USE_FOG 1', '#define USE_FOG 0')
  const vertex = '#define SHADER_NAME GlobeGlass\nvoid main() {}'
  const translated = Array.from({ length: 30 }, (_, k) => `// translated line ${k + 1}`).join('\n')
  const program = (log: string, frag = fragment) => ({ log, askedBy: 'the page', shaders: [{ stage: 'vertex', source: vertex, translated: '' }, { stage: 'fragment', source: frag, translated }] })
  it('reads a message of the Direct3D compiler: place, kind, code and text', () => {
    expect(S.parseMessage('(1185,1): warning X4000: use of potentially uninitialized variable (f_glassSeen_int)')).toEqual({ line: 1185, column: 1, columnEnd: null, kind: 'warning', code: 'X4000', text: 'use of potentially uninitialized variable (f_glassSeen_int)' })
    expect(S.parseMessage('(503,12-121): warning X3595: gradient instruction used in a loop with varying iteration; partial derivatives may have undefined value')).toMatchObject({ line: 503, column: 12, columnEnd: 121, code: 'X3595' })
    expect(S.parseMessage('C:\\fakepath(12,3-9): error X3004: undeclared identifier')).toMatchObject({ kind: 'error', code: '' })
    expect(S.parseMessage('(7,2): error X3004: undeclared identifier x')).toMatchObject({ kind: 'error', code: 'X3004', line: 7 })
    expect(S.parseMessage('   ')).toBeNull()
    expect(S.parseMessage('something else went wrong')).toMatchObject({ kind: 'warning', line: null })
  })
  it("finds a translated name in the shader's own source", () => {
    expect(S.ownNames('f_glassSeen_int')).toEqual(['glassSeen_int', 'glassSeen'])
    expect(S.ownNames('f_stageGone')).toEqual(['stageGone'])
    expect(S.ownNames('_uTime')).toEqual(['uTime'])
    expect(S.whereWritten(fragment, 'glassSeen')).toEqual({ line: 6, text: 'float glassSeen(int k) {' })
    expect(S.whereWritten(fragment, 'glassSeen_int')).toBeNull()
    expect(S.whereWritten(fragment, 'uTime')).toBeNull()
  })
  it('lists each different program once, with its log in full and the place of each message', () => {
    const log = '(12,1): warning X4000: use of potentially uninitialized variable (f_glassSeen_int)\n(20,1): warning X4000: use of potentially uninitialized variable (f_glassSeen_int)'
    const seen = { linked: 9, logs: [program(log), program(log.replace('(12,1)', '(14,1)').replace('(20,1)', '(22,1)'), other), program('(3,5-9): warning X3577: value cannot be NaN, isnan() may not be necessary.  /Gis may force isnan() to be performed')] }
    const entries = S.sortLogs(seen)
    // the same two shaders with another switch are one entry; another message is another
    expect(entries.map((e) => e.programs)).toEqual([2, 1])
    expect(entries[0]).toMatchObject({ fragment: 'GlobeGlass', vertex: 'GlobeGlass', others: ['(14,1) (22,1)'] })
    const text = S.shaderList(seen, ['the head'])
    expect(text.startsWith('the head\n')).toBe(true)
    expect(text).toContain('programs linked by the page: 9; programs whose log is not empty: 3; different ones (other shaders or other messages): 2; messages that are errors: 0')
    expect(text).toContain(`== 1. fragment shader "GlobeGlass" (${fragment.split('\n').length} lines), vertex shader "GlobeGlass" (2 lines): 2 programs with these messages (asked by the page) ==`)
    // every different message once at the top, with the function it is about and how many programs carry it
    expect(text).toContain('the different messages, each once (2), with the function each is about and how many programs carry it:')
    expect(text).toContain('   2 programs  warning X4000: use of potentially uninitialized variable (f_glassSeen_int)\n                 in glassSeen, not written under src: the library has it')
    expect(text).toContain('this browser marks no compiler input in its translation, so read the line as near, not as exact.')
    for (const l of log.split('\n')) expect(text).toContain(`  ${l}`)
    expect(text).toContain('the same messages in the other program (the same two shaders with other switches) stand at: (14,1) (22,1)')
    expect(text).toContain('"f_glassSeen_int" is glassSeen of the fragment shader\'s own source, line 6: float glassSeen(int k) {')
    expect(text).toContain('line 12 of the fragment shader as the compiler read it: // translated line 12')
    expect(text).toContain('- warning X3577 at (3,5-9): value cannot be NaN')
    expect(S.briefLogs(seen)[0]).toEqual({ fragment: 'GlobeGlass', vertex: 'GlobeGlass', programs: 2, messages: entries[0]!.messages })
  })
  it('counts an error as an error, says when a shader has no name, and says when nothing was written', () => {
    const seen = { linked: 1, logs: [{ log: '(7,2): error X3004: undeclared identifier x', askedBy: 'this tool', shaders: [{ stage: 'fragment', source: 'precision highp float;\nuniform sampler2D tDiffuse;\nvoid main() {}', translated: '' }] }] }
    const text = S.shaderList(seen)
    expect(text).toContain('messages that are errors: 1')
    expect(text).toContain('fragment shader "no name" (3 lines), vertex shader "none" (0 lines)')
    // the library writes the line with nothing behind it for a material without a name: the next line is no name
    expect(S.sortLogs({ linked: 1, logs: [{ log: 'x', askedBy: 'the page', shaders: [{ stage: 'fragment', source: '#define SHADER_NAME \n#define USE_FOG 1\nvoid main() {}', translated: '' }] }] })[0]!.fragment).toBe('no name')
    expect(text).toContain('the browser gave back no translated shader')
    expect(S.shaderList({ linked: 4, logs: [] })).toContain('no program wrote a message')
    expect(S.shaderList(null)).toContain('the watch did not run on this page')
  })
  // the translation as Chrome gives it back under Direct3D: once as it began, once as the compiler read it
  const hlsl = [
    '// INITIAL HLSL BEGIN',
    'float f_far(in float _tx)',
    '{',
    'return _tx;',
    '}',
    '// INITIAL HLSL END',
    '',
    '// COMPILER INPUT HLSL BEGIN',
    '',
    'struct PS_INPUT',
    '{',
    '    float4 dx_Position : SV_Position;',
    '};',
    'float4 gl_texture2D(uint samplerIndex, float2 t)',
    '{',
    '    return textures2D[samplerIndex].Sample(samplers2D[samplerIndex], float2(t.x, t.y));',
    '}',
    'float f_stageShade(in float _tx)',
    '{',
    'for (int _ti = 0; (_ti < 4); (_ti++))',
    '{',
    '(_tx += gl_texture2D(_usMap, float2(_tx, _tx)).x);',
    '}',
    'return _tx;',
    '}',
    'static float _tflat = {1.0};',
    'PS_OUTPUT main(PS_INPUT input){',
    'float _tv = f_stageShade(1.0);',
    'return generateOutput();',
    '}',
    '// COMPILER INPUT HLSL END',
  ].join('\n')
  it("counts the compiler's lines from the mark of its input, and finds the function a line lies in", () => {
    const got = S.compilerInput(hlsl)
    expect(got.marked).toBe(true)
    expect(got.lines[0]).toBe('struct PS_INPUT')
    expect(got.lines.at(-1)).toBe('}')
    expect(S.compilerInput('float a;\nfloat b;')).toEqual({ lines: ['float a;', 'float b;'], marked: false })
    expect(S.functionsOf(got.lines)).toEqual([
      { name: 'gl_texture2D', from: 5, to: 8 },
      { name: 'f_stageShade', from: 9, to: 16 },
      { name: 'main', from: 18, to: 21 },
    ])
    expect(S.enclosing(hlsl, 7)).toBe('gl_texture2D')
    expect(S.enclosing(hlsl, 13)).toBe('f_stageShade')
    expect(S.enclosing(hlsl, 17)).toBe('')
    expect(S.enclosing(hlsl, 2)).toBe('')
    expect(S.enclosing('', 3)).toBe('')
    expect(S.callersOf(hlsl, 'gl_texture2D')).toEqual(['f_stageShade'])
    expect(S.callersOf(hlsl, 'f_stageShade')).toEqual(['main'])
    expect(S.callersOf(hlsl, 'nothing')).toEqual([])
  })
  it('says where in the tree a function of a shader is written, and names the caller of a helper the browser wrote', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff-src-'))
    try {
      const src = path.join(dir, 'src')
      fs.mkdirSync(path.join(src, 'core'), { recursive: true })
      fs.writeFileSync(path.join(src, 'core', 'light.ts'), ['export const light = /* glsl */ `', 'uniform sampler2D sMap;', '  float stageShade(float x) {', '    return x;', '  }', '`', 'function stageShade(x) {}'].join('\n'))
      fs.writeFileSync(path.join(src, 'core', 'light.test.ts'), 'float stageShade(float x) {')
      fs.writeFileSync(path.join(src, 'core', 'glass.ts'), 'const g = `\nvec3 glassSeen(vec3 o) {\n  return o;\n}`')
      expect(S.whereInTree(src, 'stageShade')).toEqual(['src/core/light.ts:3'])
      expect(S.whereInTree(src, 'nothing')).toEqual([])
      expect(S.whereInTree('', 'stageShade')).toEqual([])
      const own = ['#define SHADER_NAME Stage', 'uniform sampler2D sMap;', 'float stageShade(float x) {', '  return x;', '}', 'void main() {}'].join('\n')
      const seen = { linked: 1, logs: [{ log: '(7,12-80): warning X3595: gradient instruction used in a loop with varying iteration; partial derivatives may have undefined value', askedBy: 'the page', shaders: [{ stage: 'fragment', source: own, translated: hlsl }] }] }
      const text = S.shaderList(seen, [], { srcDir: src })
      expect([...S.filesOf(own, src).entries()]).toEqual([['src/core/light.ts', ['stageShade']]])
      // of two programs, the file only one of them holds comes first
      const two = [{ frag: { source: own } }, { frag: { source: `${own}\nvec3 glassSeen(vec3 o) {\n  return o;\n}` } }]
      expect(S.toldApart(two, src)).toEqual([['src/core/light.ts (stageShade)'], ['src/core/glass.ts (glassSeen)', 'src/core/light.ts (stageShade)']])
      expect(text).toContain('its fragment shader holds functions written in: src/core/light.ts (stageShade)')
      expect(text).toContain('counted from the mark COMPILER INPUT HLSL BEGIN of the translation')
      expect(text).toContain('   1 program   warning X3595: gradient instruction used in a loop with varying iteration; partial derivatives may have undefined value\n                 in gl_texture2D, a helper the browser wrote; called by stageShade, written at src/core/light.ts:3')
      expect(text).toContain('line 7 of the fragment shader as the compiler read it: return textures2D[samplerIndex].Sample(samplers2D[samplerIndex], float2(t.x, t.y));')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
  it('reads one answer of the maths probe', () => {
    const lines = ['pow(0, 0) 0.00', '0 / 0 nan', 'isnan(nan) 1.00']
    expect(S.mathsAnswer(lines, 'isnan(nan)')).toBe('1.00')
    expect(S.mathsAnswer(lines, '0 / 0')).toBe('nan')
    expect(S.mathsAnswer(lines, 'sqrt(-1)')).toBeNull()
    expect(S.mathsAnswer(undefined, 'isnan(nan)')).toBeNull()
  })
  it('draws the frames of every season and of the loop, so that every program is compiled', () => {
    const cfg = readJson(rel('config', 'showcase.json'))
    expect(Object.keys(S.WALK)).toEqual(['film-b', 'loop'])
    expect(Math.max(...S.WALK['film-b'])).toBe(3599)
    expect(Math.max(...S.WALK.loop)).toBeLessThan(480)
    expect(cfg.formats.preview.id).toBe('preview')
    expect(S.SHADER_WATCH).toContain('WEBGL_debug_shaders')
    // the watch is one expression that a page can run before its own scripts
    expect(() => new Function(S.SHADER_WATCH)).not.toThrow()
  })
})

describe('the work in the background', () => {
  const job = { id: 'render-1', cmd: 'render', state: 'running', pid: 100 }
  it('starts when nothing runs, follows what runs, and shows a result nobody has seen', () => {
    expect(L.jobStep({ job: null, cmd: 'render', alive: false, age: 0 })).toEqual({ do: 'start' })
    expect(L.jobStep({ job, cmd: 'render', alive: true, age: 5 })).toEqual({ do: 'follow' })
    expect(L.jobStep({ job: { ...job, state: 'done' }, cmd: 'render', alive: false, age: 5 })).toEqual({ do: 'show' })
    expect(L.jobStep({ job: { ...job, state: 'done', shown: true }, cmd: 'render', alive: false, age: 5 })).toEqual({ do: 'start' })
  })
  it('does not start a second long command beside a running one', () => {
    const s = L.jobStep({ job, cmd: 'check', alive: true, age: 5 })
    expect(s.do).toBe('busy')
    expect(s.why).toContain('node tools/handoff.mjs render')
  })
  it('carries on after a stop: a job whose process is gone, or that gave no sign for too long, is started again', () => {
    expect(L.jobStep({ job, cmd: 'render', alive: false, age: 30 })).toMatchObject({ do: 'start', stopped: true })
    expect(L.jobStep({ job, cmd: 'render', alive: true, age: L.STALE_SECONDS + 1 })).toMatchObject({ do: 'start', stopped: true })
    expect(L.jobStep({ job, cmd: 'check', alive: false, age: 30 })).toMatchObject({ do: 'start', stopped: false })
  })
})

describe('the handoff file and the tools it names', () => {
  const md = fs.readFileSync(rel('RENDER-ON-YOUR-PC.md'), 'utf8')
  const blocks = [...md.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1])
  const lines = blocks.flatMap((b) => b.split('\n')).map((l) => l.trim()).filter(Boolean)
  const commands = lines.filter((l) => /^(node|git|winget|brew|cd) /.test(l))
  it('holds commands, and each is one of the few kinds the order allows', () => {
    expect(commands.length).toBeGreaterThan(10)
    for (const c of commands) expect(c, c).toMatch(/^(node tools\/handoff\.mjs (setup|doctor|test|render|check|deliver|upload|clean)|winget install --id (Git\.Git|OpenJS\.NodeJS\.LTS|Gyan\.FFmpeg|Google\.Chrome|GitHub\.cli) -e --source winget --accept-package-agreements --accept-source-agreements|brew install (git|node|ffmpeg)|brew install --cask google-chrome|git clone --filter=blob:none --single-branch --branch \S+ https:\/\/github\.com\/BrandonChurch93\/Snow-Globe-Perplexity\.git Snow-Globe-Perplexity|cd Snow-Globe-Perplexity|git pull --ff-only|node --version|git --version)$/)
  })
  it('names the floors of the plan, and the plan says what they were measured on', () => {
    const plan = readJson(rel('render', 'PLAN.json')) as { floors: Record<string, number>; floorsFrom: string }
    const f = plan.floors
    const text = md.replace(/\s+/g, ' ')
    expect(text).toContain(`${f.psnrWhole} dB for the whole picture and ${f.coarseWhole} dB for it in blocks, ${f.psnrCut} dB for a cut and ${f.coarseCut} dB for it in blocks`)
    expect(text).toContain(`may lie ${f.glassLuma} from its reference in brightness`)
    expect(f.glassWhite).toBe(0.005)
    expect(text).toContain('may hold half a point more of near white')
    // the floors lie under every right picture measured and over the wrong one, as floorsFrom tells it
    const right = { psnrWhole: 40.51, coarseWhole: 43.17, psnrCut: 43.13, coarseCut: 47.96 }
    const wrong = { psnrWhole: 36.83, coarseWhole: 38.44, psnrCut: 38.42, coarseCut: 40.68 }
    // decision 274: each floor is the midpoint, rounded to a whole dB, between the wrong picture and the careful
    // case, a third renderer as far from one test renderer as the other is, on top of the measured distance
    const careful = { psnrWhole: 39.15, coarseWhole: 42.08, psnrCut: 41.84, coarseCut: 46.99 }
    const measured = { psnrWhole: [40.51, 44.86], coarseWhole: [43.17, 48.63], psnrCut: [43.13, 47.75], coarseCut: [47.96, 53.98] }
    const mse = (db: number) => 65025 / 10 ** (db / 10)
    const names = { psnrWhole: 'the whole picture', coarseWhole: 'the whole picture in blocks', psnrCut: 'a cut', coarseCut: 'a cut in blocks' }
    for (const k of Object.keys(right) as (keyof typeof right)[]) {
      expect(f[k], k).toBeLessThan(right[k])
      expect(f[k], k).toBeGreaterThan(wrong[k])
      expect(plan.floorsFrom).toContain(String(right[k]))
      expect(plan.floorsFrom).toContain(String(wrong[k]))
      const [toReference, betweenTheTwo] = measured[k]
      expect(10 * Math.log10(65025 / (mse(toReference) + mse(betweenTheTwo))), k).toBeCloseTo(careful[k], 1)
      expect(careful[k], k).toBeLessThan(right[k])
      const midpoint = (wrong[k] + careful[k]) / 2
      expect(f[k], k).toBe(Math.round(midpoint))
      expect(plan.floorsFrom).toContain(`(${wrong[k]} + ${careful[k]}) / 2 = ${midpoint.toFixed(2)}, so ${f[k]}`)
      expect(plan.floorsFrom).toContain(`${toReference} and ${betweenTheTwo} give ${careful[k]}`)
      expect(md).toContain(`| ${names[k]} | ${wrong[k]} | ${careful[k]} | ${midpoint.toFixed(2)} | ${f[k]} |`)
    }
    expect(text).toContain('Each of the four floors in dB is the midpoint, rounded to a whole dB, between a wrong picture and the careful case of a right one')
    // what differs from the cloud's pictures and is expected, and what is not, stands where the sheet is looked at
    const report = md.slice(md.indexOf('### 1.6 Report and STOP'), md.indexOf('## Step 2'))
    expect(report.length).toBeGreaterThan(500)
    const said = report.replace(/\s+/g, ' ')
    for (const expected of ["where the runs of water stand on spring's glass", 'the fine grain of the moss', 'the lumps on the table', 'the sparkles']) expect(said).toContain(expected)
    for (const not of ['stripes or blocks in that grain', 'an area that is flat or blank', 'a thing that is missing', 'a colour cast']) expect(said).toContain(not)
    expect(said).toContain('If Brandon says he sees one of the four, do not go on to step 2')
    expect(plan.floorsFrom).not.toMatch(/NOT SET/)
    expect(plan.floorsFrom).toMatch(/run \d{8,}/)
    // what was never measured stays said, in the plan and in the file
    const drawn = (readJson(rel('render', 'PLAN.json')) as { frames: { what: string }[] }).frames.filter((x) => x.what !== 'opening')
    expect(drawn.length).toBe(10)
    expect(text).toContain('so no NVIDIA card was measured')
    expect(text).toContain('Of the ten single frames this test draws, three were measured there')
    expect(text).toContain('The other seven were compared on Linux alone')
    expect(plan.floorsFrom).toContain('Not measured: any real graphics card, and the other seven frames of film B in the plan on any renderer but Linux')
  })
  it('gives the same winget lines the doctor prints', () => {
    for (const t of ['git', 'node', 'ffmpeg', 'chrome'] as const) expect(md).toContain(L.installLine(t, 'win32'))
  })
  it('never calls npm, npx, a shell or a switch of the tests', () => {
    for (const c of commands) {
      expect(c).not.toMatch(/\bnpm\b|\bnpx\b|\bbash\b|\bsudo\b|&&|\|/)
      expect(c).not.toMatch(/--(?!version|id|source|accept|filter|single|branch|cask|ff-only)[a-z]/)
    }
    expect(md).not.toContain(L.TEST_VARIABLE)
    expect(md).not.toMatch(/HANDOFF_/)
  })
  it('names every word of the tool, and no word the tool does not have', () => {
    const words = new Set(commands.map((c) => /^node tools\/handoff\.mjs (\S+)$/.exec(c)?.[1]).filter(Boolean))
    expect([...words].sort()).toEqual([...L.COMMANDS].sort())
  })
  it('is written in plain signs: no em dash, no exclamation point, only signs of the keyboard', () => {
    for (const f of ['RENDER-ON-YOUR-PC.md', 'render/README.md', 'tools/handoff.mjs', 'tools/lib/handoff.mjs', 'tools/lib/handoff-work.mjs', 'tools/lib/handoff-machine.mjs', 'tools/lib/handoff-stamp.mjs', '.github/workflows/handoff-proof.yml']) {
      const text = fs.readFileSync(rel(f), 'utf8')
      expect(text.includes('\u2014') || text.includes('\u2013'), `${f} holds a dash that is no hyphen`).toBe(false)
      if (f.endsWith('.md')) expect(/!(?!\[)/.test(text), `${f} holds an exclamation point`).toBe(false)
    }
  })
  it('tells the agent the rules at the top and the two stops', () => {
    const head = md.slice(0, 4000)
    expect(head).toMatch(/do not edit/i)
    expect(head).toMatch(/do not commit/i)
    expect(md).toMatch(/STOP/)
    expect(md).toContain(L.NOT_RELEASED)
    expect(md).toContain('RUNNING')
  })
})

describe('the upload: where it sends and under which names', () => {
  it('reads owner and name of the repo from the origin of a clone, and nothing from any other address', () => {
    for (const url of ['https://github.com/BrandonChurch93/Snow-Globe-Perplexity.git', 'https://github.com/BrandonChurch93/Snow-Globe-Perplexity', 'https://someone@github.com/BrandonChurch93/Snow-Globe-Perplexity.git\n', 'git@github.com:BrandonChurch93/Snow-Globe-Perplexity.git', 'ssh://git@github.com/BrandonChurch93/Snow-Globe-Perplexity.git/']) {
      expect(L.repoOf(url), url).toEqual({ owner: 'BrandonChurch93', repo: 'Snow-Globe-Perplexity', slug: 'BrandonChurch93/Snow-Globe-Perplexity' })
    }
    for (const url of ['', null, 'https://gitlab.com/a/b.git', 'https://github.com/a', 'https://github.com/a/b/c', 'file:///tmp/repo', 'https://github.com/a/b?x=1']) expect(L.repoOf(url), String(url)).toBeNull()
  })
  it('sends a file under the name GitHub would give it, and keeps the true name as its label', () => {
    expect(L.assetName('Snow Globe Seasons - With Prompt - 3840x2160.mp4')).toBe('Snow.Globe.Seasons.-.With.Prompt.-.3840x2160.mp4')
    for (const kind of L.KINDS) expect(L.assetName(L.deliveryName(kind, 3840, 2160))).toMatch(/^[A-Za-z0-9._-]+$/)
    expect(L.assetName(L.recordsName())).toBe('Snow.Globe.Seasons.-.Render.Records.zip')
    expect(L.assetName(L.sumsName())).toBe('Snow.Globe.Seasons.-.Render.Sums.txt')
    expect(new Set([...L.KINDS.map((k) => L.assetName(L.deliveryName(k, 3840, 2160))), L.assetName(L.recordsName()), L.assetName(L.sumsName())]).size).toBe(L.KINDS.length + 2)
  })
  it('names the draft for the render: its day, its engine hash and the machine', () => {
    const n = L.releaseNames({ date: '2026-12-01T03:04:05.000Z', engineHash: HASH, machine: "Brandon's PC (5080)" })
    expect(n.tag).toBe(`render-20261201-${HASH}-Brandon-s-PC-5080`)
    expect(n.title).toBe(`Snow Globe Seasons render, 2026-12-01, engine ${HASH}, Brandon-s-PC-5080`)
    expect(n.tag).toMatch(/^[A-Za-z0-9-]+$/)
    const small = L.releaseNames({ date: '2026-12-01', engineHash: HASH, machine: 'm', small: true })
    expect(small.tag).toMatch(/-tool-test$/)
    expect(small.title).toContain('no film')
    expect(L.releaseNames({ date: '2026-12-01', engineHash: HASH, machine: '' }).tag).toBe(`render-20261201-${HASH}-machine`)
  })
  it('marks every draft of its own test, and never a render with that mark', () => {
    const t = L.testReleaseNames({ time: '2026-11-28T02:21:21.123Z', machine: 'space sandbox' })
    expect(t.tag).toBe('handoff-upload-test-20261128022121-space-sandbox')
    expect(t.tag.startsWith(L.UPLOAD_TEST_MARK)).toBe(true)
    expect(t.title).toContain('stand-in')
    expect(L.releaseNames({ date: '2026-12-01', engineHash: HASH, machine: L.UPLOAD_TEST_MARK }).tag.startsWith(L.UPLOAD_TEST_MARK)).toBe(false)
  })
  it('has stand-ins of a few bytes whose names carry the word test and are no name of a delivered file', () => {
    const real = L.KINDS.map((k) => L.deliveryName(k, 3840, 2160))
    const names = [...L.STAND_INS.map((x) => x.label), L.STAND_IN_RECORDS, L.STAND_IN_SUMS]
    expect(names.length).toBe(6)
    expect(new Set(names.map(L.assetName)).size).toBe(6)
    for (const n of names) {
      expect(n).toMatch(/Test/)
      expect(real).not.toContain(n)
      expect([L.recordsName(), L.sumsName()]).not.toContain(n)
    }
    for (const x of L.STAND_INS) expect(Buffer.byteLength(x.text)).toBeLessThan(200)
  })
  it('knows the kind of each file it sends', () => {
    expect(L.contentType('a.mp4')).toBe('video/mp4')
    expect(L.contentType('a.PNG')).toBe('image/png')
    expect(L.contentType('a.zip')).toBe('application/zip')
    expect(L.contentType('a.txt')).toMatch(/^text\/plain/)
    expect(L.contentType('a')).toBe('application/octet-stream')
  })
  it('lets no file of 2,000 MB or more through, and none whose size is not known', () => {
    expect(L.UPLOAD_LIMIT_BYTES).toBe(2_000_000_000)
    expect(L.tooLarge([{ bytes: 1 }, { bytes: 1_999_999_999 }])).toEqual([])
    expect(L.tooLarge([{ bytes: 2_000_000_000 }, { bytes: 5 }, { bytes: undefined }, { bytes: NaN }]).length).toBe(3)
  })
})

describe('the upload: carrying on after a dropped connection', () => {
  const w = (name: string, bytes: number, c = 'a') => ({ name, bytes, sha256: SHA(c), label: name.replace(/\./g, ' ') })
  const asset = (id: number, name: string, size: number, over: Record<string, unknown> = {}) => ({ id, name, size, state: 'uploaded', ...over })
  const wanted = [w('a.mp4', 100, 'a'), w('b.mp4', 200, 'b'), w('c.png', 300, 'c')]
  it('sends everything to an empty release', () => {
    const p = L.uploadPlan(wanted, [])
    expect(p.send.map((x) => x.name)).toEqual(['a.mp4', 'b.mp4', 'c.png'])
    expect(p.keep).toEqual([])
    expect(p.drop).toEqual([])
  })
  it('keeps what is whole, removes what is short and sends only what is missing or short', () => {
    const p = L.uploadPlan(wanted, [asset(1, 'a.mp4', 100, { digest: `sha256:${SHA('a')}` }), asset(2, 'b.mp4', 150)])
    expect(p.keep.map((x) => x.name)).toEqual(['a.mp4'])
    expect(p.keep[0].id).toBe(1)
    expect(p.drop).toEqual([{ id: 2, name: 'b.mp4', why: '150 bytes where 200 are wanted' }])
    expect(p.send.map((x) => x.name)).toEqual(['b.mp4', 'c.png'])
  })
  it('removes a file GitHub has not finished, whatever size it names', () => {
    const p = L.uploadPlan(wanted, [asset(7, 'a.mp4', 100, { state: 'starter' }), asset(8, 'b.mp4', 0, { state: 'open' })])
    expect(p.drop.map((d) => d.id)).toEqual([7, 8])
    expect(p.drop[0].why).toContain('starter')
    expect(p.send.length).toBe(3)
  })
  it('does not keep a file that is as long and not the same', () => {
    const p = L.uploadPlan(wanted, [asset(1, 'a.mp4', 100, { digest: `sha256:${SHA('f')}` })])
    expect(p.keep).toEqual([])
    expect(p.drop).toEqual([{ id: 1, name: 'a.mp4', why: 'as long as the file and not the file (its sum differs)' }])
    expect(p.send.map((x) => x.name)).toContain('a.mp4')
  })
  it('keeps a whole file whose sum GitHub does not name', () => {
    expect(L.uploadPlan(wanted, [asset(1, 'a.mp4', 100, { digest: null })]).keep.map((x) => x.name)).toEqual(['a.mp4'])
  })
  it('sends nothing a second time when all is there, and leaves what others put on the release', () => {
    const all = [asset(1, 'a.mp4', 100), asset(2, 'b.mp4', 200), asset(3, 'c.png', 300), asset(4, 'notes.txt', 9)]
    const p = L.uploadPlan(wanted, all)
    expect(p.send).toEqual([])
    expect(p.drop).toEqual([])
    expect(p.others).toEqual(['notes.txt'])
  })
  it('keeps one of two files of the same name and removes the other', () => {
    const p = L.uploadPlan(wanted, [asset(1, 'a.mp4', 40), asset(2, 'a.mp4', 100)])
    expect(p.keep.map((x) => x.id)).toEqual([2])
    expect(p.drop.map((x) => x.id)).toEqual([1])
  })
})

describe('the upload: the release read back', () => {
  const wanted = [
    { name: 'a.mp4', bytes: 100, sha256: SHA('a'), label: 'a film.mp4' },
    { name: 'b.zip', bytes: 50, sha256: SHA('b'), label: 'b records.zip' },
  ]
  const good = {
    draft: true,
    assets: [
      { name: 'a.mp4', size: 100, state: 'uploaded', label: 'a film.mp4', digest: `sha256:${SHA('a')}` },
      { name: 'b.zip', size: 50, state: 'uploaded', label: 'b records.zip', digest: `sha256:${SHA('b')}` },
    ],
  }
  const failing = (release: unknown) => L.readBackRows(wanted, release as never).filter((r: { pass: boolean | null }) => r.pass === false).map((r: { check: string }) => r.check)
  it('passes when names, bytes, sums and labels are those that were sent, on a draft', () => {
    expect(failing(good)).toEqual([])
    expect(L.readBackRows(wanted, good as never).length).toBe(4)
  })
  it('fails on a missing file, a short one, another sum, another label, an unfinished one', () => {
    expect(failing({ ...good, assets: good.assets.slice(1) })).toEqual(['on the release: a.mp4'])
    expect(failing({ ...good, assets: [{ ...good.assets[0], size: 99 }, good.assets[1]] })).toEqual(['on the release: a.mp4'])
    expect(failing({ ...good, assets: [good.assets[0], { ...good.assets[1], digest: `sha256:${SHA('0')}` }] })).toEqual(['on the release: b.zip'])
    expect(failing({ ...good, assets: [{ ...good.assets[0], label: '' }, good.assets[1]] })).toEqual(['on the release: a.mp4'])
    expect(failing({ ...good, assets: [{ ...good.assets[0], state: 'starter' }, good.assets[1]] })).toEqual(['on the release: a.mp4'])
  })
  it('fails when the release is no draft, and when it could not be read', () => {
    expect(failing({ ...good, draft: false })).toEqual(['on the release: a draft'])
    expect(failing(null).length).toBe(3)
  })
  it('names what else is on the release without failing on it', () => {
    const rows = L.readBackRows(wanted, { ...good, assets: [...good.assets, { name: 'other.txt', size: 1, state: 'uploaded' }] } as never)
    expect(rows.at(-1).found).toContain('other.txt')
    expect(rows.at(-1).pass).toBeNull()
  })
})

describe('the upload: the sums file and the answers of gh', () => {
  it('writes one line a file with its sum, bytes, frames, seconds and size in pixels', () => {
    const text = L.sumsText({
      title: 'T',
      tag: 'render-x',
      made: '2026-12-01T00:00:00.000Z',
      engineHash: HASH,
      commit: 'c'.repeat(40),
      machine: 'm1',
      files: [
        { sha256: SHA('a'), bytes: 123, frames: 4467, seconds: 74.45, pixels: '3840x2160', name: 'A.mp4', label: 'A film.mp4' },
        { sha256: SHA('b'), bytes: 9, frames: 1, seconds: null, pixels: '3840x2160', name: 'S.png', label: 'S shot.png' },
        { sha256: SHA('c'), bytes: 7, name: 'R.zip', label: 'R records.zip' },
      ],
    })
    const lines = text.split('\n')
    expect(text.endsWith('\n')).toBe(true)
    expect(lines).toContain(`engine\t${HASH}`)
    expect(lines).toContain(['sha256', 'bytes', 'frames', 'seconds', 'pixels', 'name on the release', 'name of the file'].join('\t'))
    expect(lines).toContain([SHA('a'), 123, 4467, '74.450', '3840x2160', 'A.mp4', 'A film.mp4'].join('\t'))
    expect(lines).toContain([SHA('b'), 9, 1, '-', '3840x2160', 'S.png', 'S shot.png'].join('\t'))
    expect(lines).toContain([SHA('c'), 7, '-', '-', '-', 'R.zip', 'R records.zip'].join('\t'))
  })
  it('reads what gh answers: no sign in, a repo it does not see, a name that is there already', () => {
    expect(L.ghSays({ code: 0, out: '{}', err: '' })).toEqual({ ok: true, kind: '' })
    expect(L.ghSays({ code: 4, out: '', err: 'To get started with GitHub CLI, please run:  gh auth login\n' }).kind).toBe('sign in')
    expect(L.ghSays({ code: 1, out: '{"message":"Bad credentials"}', err: 'gh: Bad credentials (HTTP 401)\n' }).kind).toBe('sign in')
    expect(L.ghSays({ code: 1, out: '{"message":"Not Found"}', err: 'gh: Not Found (HTTP 404)\n' }).kind).toBe('not found')
    expect(L.ghSays({ code: 1, out: '{"errors":[{"code":"already_exists"}]}', err: 'gh: Validation Failed (HTTP 422)\n' }).kind).toBe('there already')
    expect(L.ghSays({ code: 1, out: '{"message":"Resource not accessible by integration"}', err: 'gh: Resource not accessible by integration (HTTP 403)\n' }).kind).toBe('not allowed')
    const other = L.ghSays({ code: 1, out: '', err: 'error connecting to api.github.com\ncheck your internet connection\n' })
    expect(other.kind).toBe('other')
    expect(other.said).toBe('check your internet connection')
  })
  it('names the one line for each thing only Brandon or an install can mend', () => {
    expect(L.SIGN_IN_LINE).toBe('gh auth login')
    expect(L.notSignedIn()).toContain('gh auth login')
    expect(L.notPrivate('a/b')).toContain('a/b is not private')
    expect(L.mayNotWrite('a/b')).toContain('may not write to the repo a/b')
    expect(L.mayNotWrite('a/b')).toContain('gh auth login')
    expect(L.ghMissing('win32')).toContain('winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements')
    expect(L.ghMissing('darwin')).toContain('brew install gh')
  })
  it('takes the upload as a word of the file, and the word of its own test without naming it', () => {
    expect(L.COMMANDS).toContain('upload')
    expect(L.COMMANDS).not.toContain(L.UPLOAD_TEST_WORD)
    expect(L.argProblem(['upload'])).toBe('')
    expect(L.argProblem([L.UPLOAD_TEST_WORD])).toBe('')
    for (const argv of [['upload', 'out/deliver/film.mp4'], [L.UPLOAD_TEST_WORD, 'C:\\film.mp4'], ['upload', '--public'], [L.UPLOAD_TEST_WORD, '--keep']]) {
      const said = L.argProblem(argv)
      expect(said, argv.join(' ')).toMatch(/one word and nothing else/)
      expect(said).not.toContain(`${L.UPLOAD_TEST_WORD},`)
    }
    expect(fs.readFileSync(rel('RENDER-ON-YOUR-PC.md'), 'utf8')).not.toContain(L.UPLOAD_TEST_WORD)
  })
})

describe('the records zip', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'handoff zip '))
  it('counts the check sum of a zip as every zip reader does', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926)
    expect(crc32(Buffer.alloc(0))).toBe(0)
  })
  it('writes files and texts and reads them back byte for byte', () => {
    const dir = tmp()
    const big = path.join(dir, 'a log with spaces.txt')
    fs.writeFileSync(big, 'line of a log\n'.repeat(5000))
    const bin = path.join(dir, 'bytes.json')
    fs.writeFileSync(bin, Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37) & 255)))
    const out = path.join(dir, 'records.zip')
    const made = zipWrite(out, [{ name: 'out/work/handoff/a log with spaces.txt', file: big }, { name: 'bytes.json', file: bin }, { name: 'note/über.txt', data: 'a text\n' }, { name: 'empty.txt', data: '' }])
    expect(made.entries).toBe(4)
    expect(made.bytes).toBe(fs.statSync(out).size)
    expect(made.bytes).toBeLessThan(20000)
    const back = zipRead(out)
    expect(back.map((e: { name: string }) => e.name)).toEqual(['out/work/handoff/a log with spaces.txt', 'bytes.json', 'note/über.txt', 'empty.txt'])
    expect(back[0].data.equals(fs.readFileSync(big))).toBe(true)
    expect(back[1].data.equals(fs.readFileSync(bin))).toBe(true)
    expect(back[2].data.toString('utf8')).toBe('a text\n')
    expect(back[3].data.length).toBe(0)
    expect(fs.readdirSync(dir).filter((n) => n.includes('.tmp'))).toEqual([])
    fs.rmSync(dir, { recursive: true, force: true })
  })
  it('writes a zip that the zip reader of this machine opens, when there is one', () => {
    const dir = tmp()
    const out = path.join(dir, 'records.zip')
    zipWrite(out, [{ name: 'render/STAMP.json', data: '{"a":1}\n' }, { name: 'out/report.txt', data: 'report\n'.repeat(300) }])
    const r = spawnSync('python3', ['-c', 'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print("|".join(z.namelist()));print(len(z.read("out/report.txt")))', out], { encoding: 'utf8' })
    if (!r.error && r.status !== null && !/No module|not found/i.test(r.stderr ?? '')) {
      expect(r.status, r.stderr).toBe(0)
      expect(r.stdout.trim().split('\n')).toEqual(['render/STAMP.json|out/report.txt', '2100'])
    }
    fs.rmSync(dir, { recursive: true, force: true })
  })
  it('refuses a zip that is cut short', () => {
    const dir = tmp()
    const out = path.join(dir, 'records.zip')
    zipWrite(out, [{ name: 'a.txt', data: 'abc\n'.repeat(100) }])
    const whole = fs.readFileSync(out)
    fs.writeFileSync(out, whole.subarray(0, whole.length - 30))
    expect(() => zipRead(out)).toThrow()
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

describe('Windows: a file that another program holds', () => {
  const held = (code: string) => Object.assign(new Error(code), { code })
  it('tries a rename again while the file is held, and gives the answer when it is let go', () => {
    let calls = 0
    let clock = 0
    const naps: number[] = []
    const rename = WinFs.patient(
      (a: string, b: string) => {
        if (++calls < 4) throw held(WinFs.HELD[(calls - 1) % 3])
        return `${a}>${b}`
      },
      { nap: ((ms: number) => (naps.push(ms), (clock += ms))) as any, now: () => clock },
    )
    expect(rename('x', 'y')).toBe('x>y')
    expect(calls).toBe(4)
    expect(naps).toEqual([10, 20, 40])
  })
  it('gives up after its time and throws what the system said', () => {
    let clock = 0
    let calls = 0
    const rename = WinFs.patient(
      () => {
        calls++
        throw held('EPERM')
      },
      { waitMs: 1000, nap: ((ms: number) => (clock += ms)) as any, now: () => clock },
    )
    expect(() => rename('x', 'y')).toThrow('EPERM')
    expect(clock).toBeGreaterThanOrEqual(1000)
    expect(clock).toBeLessThan(1300)
    expect(calls).toBeGreaterThan(4)
  })
  it('throws every other error at once', () => {
    let calls = 0
    const rename = WinFs.patient(
      () => {
        calls++
        throw held('ENOENT')
      },
      { nap: () => expect.unreachable('it waited for a file that is not there'), now: () => 0 },
    )
    expect(() => rename('x', 'y')).toThrow('ENOENT')
    expect(calls).toBe(1)
  })
  it('gives the removal of a folder its tries and changes nothing a caller set', () => {
    expect(WinFs.rmOptions({ recursive: true, force: true })).toEqual({ maxRetries: 20, retryDelay: 250, recursive: true, force: true })
    expect(WinFs.rmOptions({ recursive: true, maxRetries: 2 })).toEqual({ maxRetries: 2, retryDelay: 250, recursive: true })
    expect(WinFs.rmOptions({ force: true })).toEqual({ force: true })
    expect(WinFs.rmOptions(undefined)).toBeUndefined()
  })
  it('changes nothing and sets nothing on a machine that is not Windows', () => {
    const env: Record<string, string> = {}
    expect(WinFs.install('linux', env)).toMatch(/^not Windows/)
    expect(WinFs.install('darwin', env)).toMatch(/^not Windows/)
    expect(env).toEqual({})
    if (process.platform !== 'win32') expect(process.env.NODE_OPTIONS ?? '').not.toContain('handoff-win-fs')
  })
})

describe('a file on the Desktop that a player holds open', () => {
  it('knows the errors of a held file and no other', () => {
    for (const code of ['EBUSY', 'EPERM', 'EACCES']) expect(L.heldOpen(Object.assign(new Error(code), { code }))).toBe(true)
    expect(L.heldOpen(Object.assign(new Error('gone'), { code: 'ENOENT' }))).toBe(false)
    expect(L.heldOpen(new Error('no code'))).toBe(false)
    expect(L.heldOpen(null)).toBe(false)
  })
  it('names the second copy beside the first, with the same ending', () => {
    expect(L.besideName('Snow Globe Seasons - Test - 3840x2160.mp4')).toBe('Snow Globe Seasons - Test - 3840x2160 (new).mp4')
    expect(L.besideName('Snow Globe Seasons - Test - Contact Sheet.jpg')).toBe('Snow Globe Seasons - Test - Contact Sheet (new).jpg')
    expect(L.besideName('a.b.mp4')).toBe('a.b (new).mp4')
    expect(L.besideName('plain')).toBe('plain (new)')
  })
  it('says in one sentence who must do what', () => {
    const said = L.heldSentence('Snow Globe Seasons - With Prompt - 3840x2160.mp4')
    expect(said).toContain('another program holds it open')
    expect(said).toContain('Brandon closes that program, then the same line is run again')
    expect(said).not.toMatch(/[—!]/)
  })
})

describe('a browser that updated itself between the test and the render, as the tool makes it up for its own test', () => {
  it('does nothing without the switch', () => {
    expect(L.browserMovedPretend({ on: false, seen: null, testTime: '2026-11-28T02:00:00Z' })).toEqual({ pretend: false, mark: false })
    expect(L.testSwitches('small').browserMoved).toBe(false)
    expect(L.testSwitches('small,browser-moved').browserMoved).toBe(true)
    expect(() => L.testSwitches('browser-moved=1')).toThrow(/no switch/)
  })
  it('stops the first render that looks, and keeps the time of that look', () => {
    expect(L.browserMovedPretend({ on: true, seen: null, testTime: '2026-11-28T02:00:00Z' })).toEqual({ pretend: true, mark: true })
  })
  it('goes on stopping until a short test has been started after that look', () => {
    const seen = '2026-11-28T02:10:00.000Z'
    expect(L.browserMovedPretend({ on: true, seen, testTime: '2026-11-28T02:00:00.000Z' })).toEqual({ pretend: true, mark: false })
    expect(L.browserMovedPretend({ on: true, seen, testTime: seen })).toEqual({ pretend: true, mark: false })
    expect(L.browserMovedPretend({ on: true, seen, testTime: undefined })).toEqual({ pretend: true, mark: false })
    expect(L.browserMovedPretend({ on: true, seen, testTime: '2026-11-28T02:10:00.001Z' })).toEqual({ pretend: false, mark: false })
  })
  it('marks the made up version in plain words, so that no report reads as a real update', () => {
    expect(L.MADE_UP_UPDATE).toContain("the tool's own test made up")
  })
  it('is met with chunks on disk: a start that finds no finished frame draws first and is not stopped', () => {
    expect(L.browserMovedPretend({ on: true, seen: null, testTime: '2026-11-28T02:00:00Z', framesDone: 0 })).toEqual({ pretend: false, mark: false })
    expect(L.browserMovedPretend({ on: true, seen: null, testTime: '2026-11-28T02:00:00Z', framesDone: 12 })).toEqual({ pretend: true, mark: true })
  })
})

describe('the calibration picture: drawn once for a build on the machine and kept', () => {
  const want = { engineHash: 'e1', renderer: 'card', machine: 'pc · 16 x cpu · 65536 MB' }
  const rec = { sha256: 'a'.repeat(64), engineHash: 'e1', renderer: 'card', machine: want.machine, seconds: 4 }
  const chunk = (calibration: string | null, more = {}) => ({ what: 'film-b', frames: 30, engineHash: 'e1', renderer: 'card', machine: want.machine, calibration, ...more })
  it('takes a record by the rule the renderer itself has: this build, this renderer, this machine, a sha256', () => {
    expect(L.calibrationKept(rec, want)).toBe(true)
    expect(L.calibrationKept(null, want)).toBe(false)
    expect(L.calibrationKept({ ...rec, engineHash: 'e0' }, want)).toBe(false)
    expect(L.calibrationKept({ ...rec, renderer: 'swiftshader' }, want)).toBe(false)
    expect(L.calibrationKept({ ...rec, machine: 'another' }, want)).toBe(false)
    expect(L.calibrationKept({ ...rec, sha256: undefined }, want)).toBe(false)
  })
  it('keeps a record that is valid, whatever lies on disk: no test and no render replaces it', () => {
    expect(L.calibrationStep({ record: rec, chunks: [], want })).toEqual({ do: 'keep', sha256: rec.sha256 })
    expect(L.calibrationStep({ record: rec, chunks: [chunk('b'.repeat(64))], want })).toEqual({ do: 'keep', sha256: rec.sha256 })
  })
  it('writes a lost record again from the finished chunks of this machine and build, and draws nothing', () => {
    const b = 'b'.repeat(64)
    expect(L.calibrationStep({ record: null, chunks: [chunk(b), chunk(b, { what: 'loop', frames: 6 })], want })).toEqual({ do: 'restore', sha256: b, chunks: 2, frames: 36 })
    // a record of another build is no record of this one
    expect(L.calibrationStep({ record: { ...rec, engineHash: 'e0' }, chunks: [chunk(b)], want }).do).toBe('restore')
  })
  it('draws when there is no record and no chunk of this machine and build names a picture', () => {
    const b = 'b'.repeat(64)
    expect(L.calibrationStep({ record: null, chunks: [], want })).toEqual({ do: 'draw', sha256: null })
    for (const other of [{ engineHash: 'e0' }, { machine: 'another' }, { renderer: 'swiftshader' }, { what: 'opening' }, { calibration: null }]) expect(L.calibrationStep({ record: null, chunks: [chunk(b, other)], want }).do).toBe('draw')
  })
  it('takes the picture that the most frames name where finished chunks name two', () => {
    const b = 'b'.repeat(64)
    const c = 'c'.repeat(64)
    expect(L.calibrationOfChunks([chunk(c), chunk(b), chunk(b)], want).map((x) => [x.sha256[0], x.chunks, x.frames])).toEqual([['b', 2, 60], ['c', 1, 30]])
    expect(L.calibrationStep({ record: null, chunks: [chunk(c), chunk(b), chunk(b)], want }).sha256).toBe(b)
  })
  it('counts a finished chunk only when it names this build and the kept picture, so the join never finds two', () => {
    const kept = { what: 'film-b', engineHash: 'e1', calibration: rec.sha256 }
    expect(L.chunkCounts({ engineHash: 'e1', calibration: rec.sha256 }, kept)).toBe(true)
    expect(L.chunkCounts({ engineHash: 'e1', calibration: 'b'.repeat(64) }, kept)).toBe(false)
    expect(L.chunkCounts({ engineHash: 'e0', calibration: rec.sha256 }, kept)).toBe(false)
    expect(L.chunkCounts({ engineHash: 'e1' }, kept)).toBe(false)
    expect(L.chunkCounts(null, kept)).toBe(false)
    // before a picture is kept, no chunk of the engine counts
    expect(L.chunkCounts({ engineHash: 'e1', calibration: rec.sha256 }, { ...kept, calibration: null })).toBe(false)
    // the opening is no drawing of the engine and names no picture
    expect(L.chunkCounts({ engineHash: '' }, { ...kept, what: 'opening' })).toBe(true)
  })
  it('counts the pixels that differ between two drawings and the largest difference in any channel', () => {
    const a = Uint8Array.from([10, 20, 30, 40, 50, 60, 70, 80, 90])
    expect(L.pixelsApart(a, Uint8Array.from(a))).toEqual({ pixels: 0, most: 0, total: 3 })
    expect(L.pixelsApart(a, Uint8Array.from([10, 20, 30, 41, 50, 57, 70, 80, 90]))).toEqual({ pixels: 1, most: 3, total: 3 })
    expect(L.pixelsApart(a, Uint8Array.from([11, 20, 30, 40, 50, 60, 70, 80, 95]))).toEqual({ pixels: 2, most: 5, total: 3 })
    expect(L.pixelsApart(a, Uint8Array.from([1, 2, 3]))).toBe(null)
  })
  it('says it in one line of the report, with no dash and no shout, and as no pass and no fail', () => {
    const same = L.twiceLine({ pixels: 0, most: 0, total: 2073600 })
    const not = L.twiceLine({ pixels: 1234, most: 3, total: 2073600 })
    expect(same).toBe('the same twice: a second drawing differs from the kept one in 0 of 2,073,600 pixels, the largest difference in any channel is 0 levels')
    expect(not).toBe('not the same twice: a second drawing differs from the kept one in 1,234 of 2,073,600 pixels, the largest difference in any channel is 3 of 255 levels')
    expect(L.twiceLine({ same: false })).toMatch(/^not the same twice by the sha256 of the file/)
    expect(L.twiceLine({ same: true })).toMatch(/^the same twice by the sha256 of the file/)
    expect(L.twiceLine({ why: 'the second picture could not be drawn: no browser' })).toBe('not compared: the second picture could not be drawn: no browser')
    for (const t of [same, not, L.twiceLine({ same: false }), L.twiceLine(null)]) expect(t).not.toMatch(/[—!]/)
  })
  it('is proven with chunks on disk: both flows run the short test in the middle of the render, and the made up update comes after it', () => {
    for (const f of ['flow.sh', 'flow.ps1']) {
      const text = fs.readFileSync(rel('.github', 'handoff-proof', f), 'utf8')
      const first = text.indexOf('render-first-call')
      const mid = text.indexOf('test-in-mid-render')
      const on = text.indexOf('render-carries-on')
      expect(first, f).toBeGreaterThan(0)
      expect(mid, f).toBeGreaterThan(first)
      expect(on, f).toBeGreaterThan(mid)
      expect(text, f).toContain('PROBLEM: the test in the middle of the render replaced the kept calibration picture')
    }
    const sh = fs.readFileSync(rel('.github', 'handoff-proof', 'flow.sh'), 'utf8')
    expect(sh.indexOf("line render-stops-for-browser 1 'node tools/handoff.mjs render' 'the browser was updated'")).toBeGreaterThan(sh.indexOf('line test-in-mid-render'))
  })
})

describe('the browser versions a render drew with', () => {
  it('names one version plainly', () => {
    expect(L.browsersUsed([{ browser: '158.0.8127.37' }, { browser: '158.0.8127.37' }], '158.0.8127.37')).toEqual(['158.0.8127.37'])
    expect(L.browsersLine([{ browser: '158.0.8127.37' }], '158.0.8127.37')).toBe('Google Chrome 158.0.8127.37')
  })
  it('names both versions in the order of the starts when the browser was updated on the way', () => {
    const sessions = [{ browser: '158.0.8127.37' }, { browser: '158.0.8127.37' }, { browser: '158.0.8127.38' }]
    expect(L.browsersUsed(sessions, '158.0.8127.38')).toEqual(['158.0.8127.37', '158.0.8127.38'])
    const line = L.browsersLine(sessions, '158.0.8127.38')
    expect(line).toContain('158.0.8127.37, then 158.0.8127.38')
    expect(line).toContain('each version passed the short test before it drew a frame')
  })
  it('falls back to the newest short test for a render whose starts kept no version, and says so when nothing is known', () => {
    expect(L.browsersUsed([{}, { browser: null }], '158.0.8127.38')).toEqual(['158.0.8127.38'])
    expect(L.browsersLine(undefined, undefined)).toBe('Google Chrome, version not recorded')
  })
})

describe('a short test that failed: the one folder for the build thread', () => {
  it('has a switch of the tool\'s own tests that raises the floors out of reach, and nothing else', () => {
    const floors = { psnrWhole: 39, coarseWhole: 41, psnrCut: 40, coarseCut: 44, glassLuma: 0.01, glassWhite: 0.005 }
    expect(L.floorsOfTest(floors, false)).toBe(floors)
    expect(L.floorsOfTest(floors, true)).toEqual({ psnrWhole: 99, coarseWhole: 99, psnrCut: 99, coarseCut: 99, glassLuma: 0.01, glassWhite: 0.005 })
    expect(floors.psnrWhole).toBe(39)
    const t = L.testSwitches('software,floors-high')
    expect(t.floorsHigh).toBe(true)
    expect(L.testSwitches('software').floorsHigh).toBe(false)
    // the report of such a run says that it is no run of the film
    expect(L.anyTestSwitch(L.testSwitches('floors-high'))).toBe(true)
    expect(() => L.testSwitches('floors-high=40')).toThrow(/no switch/)
    expect(L.MADE_UP_FAILURE).toContain('made up')
  })
  it('names no switch of the tool\'s tests in the file an agent follows', () => {
    const md = fs.readFileSync(rel('RENDER-ON-YOUR-PC.md'), 'utf8')
    for (const word of ['HANDOFF_TEST', 'floors-high', 'browser-moved', 'fast-watch']) expect(md).not.toContain(word)
    expect(md).toContain('Snow Globe Seasons - Test - Failed')
    expect(md).toContain(L.failedTestName())
  })
  type Picked = { from: string; as: string; bytes: number; picture: boolean }
  const since = Date.parse('2026-11-28T04:00:00Z')
  const have = [
    { path: 'test.json', ms: since + 9e5, bytes: 4000 },
    { path: 'doctor.json', ms: since - 6e5, bytes: 3000 },
    { path: 'report-doctor.txt', ms: since - 6e5, bytes: 2000 },
    { path: 'shader-messages-test.txt', ms: since + 6e4, bytes: 9000 },
    { path: 'test/contact-sheet.jpg', ms: since + 5e5, bytes: 800000 },
    { path: 'compared/film-b-000120-here-half.webp', ms: since + 4e5, bytes: 1800000 },
    { path: 'compared/film-b-000120-apart-half.png', ms: since + 4e5, bytes: 380000 },
    { path: 'compared/deeper/x.png', ms: since + 4e5, bytes: 1 },
    { path: 'render-state.json', ms: since + 4e5, bytes: 1 },
  ]
  it('takes the numbers, what the doctor found, the sheet and the pictures, flat and in order', () => {
    const picked = L.failedTestPick(have, since) as Picked[]
    expect(picked.map((f) => f.as)).toEqual(['contact-sheet.jpg', 'doctor.json', 'film-b-000120-apart-half.png', 'film-b-000120-here-half.webp', 'report-doctor.txt', 'shader-messages-test.txt', 'test.json'])
    expect(picked.filter((f) => f.picture).map((f) => f.as)).toEqual(['contact-sheet.jpg', 'film-b-000120-apart-half.png', 'film-b-000120-here-half.webp'])
    expect(picked.find((f) => f.as === 'contact-sheet.jpg')?.from).toBe('test/contact-sheet.jpg')
  })
  it('leaves out the pictures of an earlier test, which would pass for this one\'s', () => {
    const old = have.map((f) => (f.path.startsWith('compared/') || f.path.startsWith('test/') || f.path.startsWith('shader') ? { ...f, ms: since - 36e5 } : f))
    expect((L.failedTestPick(old, since) as Picked[]).map((f) => f.as)).toEqual(['doctor.json', 'report-doctor.txt', 'test.json'])
  })
  it('says in the report what to send, where it lies and where it is ruled on', () => {
    expect(L.toSendLines(null)).toEqual([])
    const lines = L.toSendLines({ folder: 'C:\\Users\\b\\Desktop\\Snow Globe Seasons - Test - Failed', files: 7, bytes: 2.9e6, pictures: 3 })
    expect(lines[0]).toBe('TO SEND. The short test failed. Nothing is rendered and no floor is changed on this machine.')
    expect(lines[1]).toBe('  folder   C:\\Users\\b\\Desktop\\Snow Globe Seasons - Test - Failed')
    expect(lines[2]).toBe('  holds    this report, the numbers (test.json), the sheet of pictures and what this machine drew (3 picture files): 8 files, 2.9 MB')
    expect(lines[3]).toBe('  Brandon brings that folder into the build thread. The floors are ruled on there.')
    expect(L.toSendLines({ folder: 'x', files: 2, bytes: 5000, pictures: 0 })[2]).toBe('  holds    this report, the numbers (test.json), no picture, since the test drew none: 3 files, 0.0 MB')
  })
  it('leaves a Desktop folder of unknown ownership and keeps the failed test inside the work folder', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'failed test '))
    try {
      const H = path.join(tmp, 'work')
      const desktop = path.join(tmp, 'the Desktop')
      fs.mkdirSync(path.join(H, 'compared'), { recursive: true })
      fs.mkdirSync(path.join(H, 'test'), { recursive: true })
      fs.mkdirSync(desktop)
      const time = new Date(Date.now() - 1000).toISOString()
      for (const [n, text] of [['test.json', '{}'], ['doctor.json', '{}'], ['compared/a-here-half.webp', 'aa'], ['test/contact-sheet.jpg', 'sheet'], ['heartbeat.json', '{}']]) fs.writeFileSync(path.join(H, n), text)
      const notes: string[] = []
      const ctx = { H, note: (t: string) => notes.push(t) }
      const folder = path.join(desktop, L.failedTestName())
      fs.mkdirSync(folder)
      fs.writeFileSync(path.join(folder, 'of an earlier test.png'), 'old')
      const kept = Work.keepFailedTest(ctx, { time, desktop })
      expect(kept).toEqual({ folder: path.join(H, 'test-failed'), files: 4, bytes: 11, pictures: 2 })
      expect(fs.readdirSync(folder)).toEqual(['of an earlier test.png'])
      fs.writeFileSync(path.join(folder, 'report-test.txt'), 'FAIL: made up')
      Work.dropFailedTest(ctx, { desktop })
      expect(fs.readdirSync(folder).sort()).toEqual(['of an earlier test.png', 'report-test.txt'])
      expect(fs.existsSync(path.join(H, 'test-failed'))).toBe(false)
      // no Desktop that can be written: the folder lies in the work folder
      const noDesk = path.join(tmp, 'a file, no folder')
      fs.writeFileSync(noDesk, '')
      const inside = Work.keepFailedTest(ctx, { time, desktop: noDesk })
      expect(inside?.folder).toBe(path.join(H, 'test-failed'))
      expect(fs.readdirSync(path.join(H, 'test-failed'))).toHaveLength(4)
      expect(notes.some((n) => n.includes('could not be written'))).toBe(true)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
  it('is named in the handoff file as the tool names it, with what the agent says to Brandon', () => {
    const md = fs.readFileSync(rel('RENDER-ON-YOUR-PC.md'), 'utf8').replace(/\s+/g, ' ')
    expect(L.failedTestName()).toBe('Snow Globe Seasons - Test - Failed')
    expect(md).toContain(`one folder on the Desktop, \`${L.failedTestName()}\``)
    expect(md).toContain(`Please bring the folder ${L.failedTestName()} from your Desktop into the build thread.`)
    expect(md).toContain('Render nothing. Change no floor and no file.')
    expect(md).toContain('block `TO SEND`')
    expect(md).toContain('`out/work/handoff/test-failed`')
  })
})

describe('the proof workflow', () => {
  const yml = fs.readFileSync(rel('.github', 'workflows', 'handoff-proof.yml'), 'utf8')
  const code = yml.split('\n').filter((l) => !/^\s*#/.test(l))
  it('starts by hand, has no timer, and a push starts it on no branch but the handoff\'s own, in one line', () => {
    expect(code).toContain('  workflow_dispatch:')
    expect(code.join('\n')).not.toMatch(/schedule|cron|pull_request|workflow_run/)
    const push = code.filter((l) => /^\s+push\b/.test(l))
    // one line while the handoff is proven, none in what reaches main
    expect(push.length).toBeLessThanOrEqual(1)
    for (const l of push) expect(l).toBe('  push: { branches: [agent/p6-handoff] }')
    expect(code.join('\n')).not.toMatch(/branches:\s*\n/)
  })
  it('uses no secret, and gives leave to write to one job only', () => {
    expect(yml).not.toMatch(/secrets\./)
    const text = code.join('\n')
    expect(text).toMatch(/\npermissions:\n  contents: read\n/)
    expect(text.match(/contents: write/g)).toHaveLength(1)
    const job = text.slice(text.indexOf('\n  upload-test:'))
    expect(job).toMatch(/\n    permissions:\n      contents: write\n/)
    // the token of the run reaches two steps of that job through their environment, and nothing else
    const before = text.slice(0, text.indexOf('\n  upload-test:'))
    expect(before).not.toMatch(/GH_TOKEN|github\.token|GITHUB_TOKEN/)
    expect(job.match(/GH_TOKEN: \$\{\{ github\.token \}\}/g)).toHaveLength(2)
    expect(job.match(/github\.token|GITHUB_TOKEN/g)).toHaveLength(2)
    expect(text).toMatch(/persist-credentials: false/)
  })
  it('leaves the render line out on a test machine once the stamp is released, in both shells and in the verdict', () => {
    // the 3840 jobs prove the refusal of an unreleased stamp. With a released one the same line would start the real render.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff released '))
    const ask = () => spawnSync(process.execPath, [rel('.github', 'handoff-proof', 'released.mjs'), dir], { encoding: 'utf8' }).stdout.trim()
    try {
      expect(ask()).toBe('no')
      fs.mkdirSync(path.join(dir, 'render'))
      for (const [value, want] of [[true, 'yes'], [false, 'no'], ['true', 'no']] as const) {
        fs.writeFileSync(path.join(dir, 'render', 'STAMP.json'), JSON.stringify({ releasedForFinalRender: value }))
        expect(ask(), String(value)).toBe(want)
      }
      fs.writeFileSync(path.join(dir, 'render', 'STAMP.json'), 'no json')
      expect(ask()).toBe('no')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
    const line = "'node tools/handoff.mjs render' 'not released for its final render yet'"
    for (const f of ['flow.sh', 'flow.ps1']) {
      const text = fs.readFileSync(rel('.github', 'handoff-proof', f), 'utf8')
      const at = text.indexOf(line)
      expect(at, f).toBeGreaterThan(0)
      expect(text.indexOf(line, at + 1), `${f} runs the line at one place`).toBe(-1)
      const before = text.slice(0, at).split('\n').slice(-5).join('\n')
      expect(before, f).toContain('released.mjs')
      expect(before, f).toContain('is not run on a test machine')
    }
    const verdict = fs.readFileSync(rel('.github', 'handoff-proof', 'verdict.mjs'), 'utf8')
    expect(verdict).toContain("name === 'render-refuses-unreleased' && released")
  })
})

describe('the tool on the command line', () => {
  const tool = rel('tools', 'handoff.mjs')
  const run = (args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [tool, ...args], { cwd: rel(), encoding: 'utf8', env: { ...process.env, HANDOFF_TEST: '', ...env } })
  it('refuses a second word or a switch, with FAIL as its last line and exit code 1', () => {
    for (const args of [['render', '--force'], ['test', '--samples', '2'], [], ['help']]) {
      const r = run(args)
      expect(r.status).toBe(1)
      expect(r.stdout.trim().split('\n').at(-1)).toMatch(/^FAIL: this tool takes one word and nothing else/)
    }
  })
  it('refuses a test switch it does not know', () => {
    const r = run(['doctor'], { HANDOFF_TEST: 'released' })
    expect(r.status).toBe(1)
    expect(r.stdout.trim().split('\n').at(-1)).toMatch(/^FAIL: HANDOFF_TEST holds released/)
  })
  it('never starts npm, npx or a .cmd by a bare name, and never calls which, ldd, df, cp, rm or bash', () => {
    for (const f of ['tools/handoff.mjs', 'tools/lib/handoff.mjs', 'tools/lib/handoff-work.mjs', 'tools/lib/handoff-machine.mjs', 'tools/lib/handoff-stamp.mjs', 'tools/lib/handoff-upload.mjs', 'tools/lib/handoff-zip.mjs', 'tools/lib/handoff-win-fs.mjs']) {
      const text = fs.readFileSync(rel(f), 'utf8')
      const calls = [...text.matchAll(/\b(?:spawn|spawnSync|execFile|execFileSync|execSync|exec)\(\s*(['"`])([^'"`]+)\1/g)].map((m) => m[2])
      for (const c of calls) expect(['git', 'ffmpeg', 'ffprobe', 'sysctl', 'sw_vers', 'system_profiler', 'pmset', 'caffeinate', 'pkill', 'pgrep'], `${f} starts ${c}`).toContain(path.posix.basename(c))
      expect(text).not.toMatch(/shell:\s*true/)
    }
  })
})

describe('the root .gitattributes', () => {
  it('keeps git from changing a line ending on any machine', () => {
    expect(fs.readFileSync(rel('.gitattributes'), 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))).toEqual(['* -text'])
  })
  it('is honoured by git for the files the engine hash is made from', () => {
    const r = spawnSync('git', ['check-attr', 'text', '--', 'src/main.ts', 'config/showcase.json', 'package-lock.json'], { cwd: rel(), encoding: 'utf8' })
    if (r.status !== 0) return
    for (const l of r.stdout.trim().split('\n')) expect(l).toMatch(/: text: unset$/)
  })
})
