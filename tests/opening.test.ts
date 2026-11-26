import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { openingPlan, PAUSES } from '../src/film/opening'
import { chainTo, fitBox, imagePixels, imagesOf, PACK_VERSION, readManifest, windowOf, type PackManifest } from '../src/film/openingPack'
import { SOFTWARE_FLAGS, softwareRenderer } from '../tools/lib/browser.mjs'
import { openPack, packRenderer, readPack, rendererLine, rendererProblem, PACK_RENDERER } from '../tools/lib/openingpack.mjs'

interface State {
  screen: string
  typed: number
  level: string | null
  menu: number
  sent: boolean
  pressed: boolean
  lines: number
  done: number
}

const dir = path.resolve(__dirname, '..', 'public', 'opening')
const manifestBytes = fs.readFileSync(path.join(dir, 'manifest.json'))
const bin = fs.readFileSync(path.join(dir, 'opening.bin'))
const json = (): Record<string, any> => JSON.parse(manifestBytes.toString('utf8'))
const plan = openingPlan()
const intro = config.intro
const m: PackManifest = readManifest(json(), bin.length, plan)
const states: State[] = json().states

describe("the opening's times", () => {
  it('keeps the typing at the speed of the config and puts a key on a frame for every character', () => {
    expect(plan.keyTaps.length).toBe(intro.prompt.length)
    plan.keyTaps.forEach((k, n) => expect(k).toBe(Math.round((plan.typing.first / plan.fps + n / intro.charsPerSecond) * plan.fps)))
    expect(plan.keyTaps[0]).toBe(plan.typing.first)
    expect(plan.keyTaps.at(-1)!).toBeLessThanOrEqual(plan.typing.last)
    expect(plan.typing.last - plan.typing.first + 1).toBe(Math.round((intro.prompt.length / intro.charsPerSecond) * plan.fps))
  })

  it('stays inside the longest the config allows and gives the pauses of the config their length', () => {
    expect(plan.seconds).toBeLessThanOrEqual(intro.maxSeconds)
    expect(plan.frameCount).toBe(Math.round(plan.seconds * plan.fps))
    expect(plan.send - plan.pointer.toSend).toBe(Math.round(intro.pauseBeforeSendSeconds * plan.fps))
    for (let n = 1; n < plan.steps.length; n++) expect(plan.steps[n]! - plan.steps[n - 1]!).toBe(Math.round(intro.stepSeconds * plan.fps))
    expect(plan.frameCount - plan.steps.at(-1)!).toBe(Math.round(intro.holdSeconds * plan.fps))
    expect(plan.steps.length).toBe(intro.steps.length)
  })

  it('opens on the screen at rest, sets the level before a word is typed and presses the send where the pause ends', () => {
    expect(plan.reasoning.first / plan.fps).toBeGreaterThanOrEqual(0.35)
    expect(plan.reasoning.first / plan.fps).toBeLessThanOrEqual(0.6)
    expect(plan.pointer.enter).toBe(plan.reasoning.first)
    const order = [plan.pointer.enter, plan.pointer.atControl, plan.reasoning.open, plan.menu.full, plan.pointer.toLevel, plan.pointer.atLevel, plan.reasoning.choose, plan.menu.fade, plan.menu.gone, plan.pointer.gone, plan.typing.first]
    for (let n = 1; n < order.length; n++) expect(order[n]!, `time ${n} of the level change`).toBeGreaterThanOrEqual(order[n - 1]!)
    expect(plan.reasoning.last).toBe(plan.pointer.gone - 1)
    expect(plan.pointer.toSend).toBe(plan.typing.last + 1)
    expect(plan.pointer.atSend).toBeGreaterThan(plan.pointer.toSend)
    expect(plan.pointer.atSend).toBeLessThan(plan.send)
    expect((plan.pointer.atSend - plan.pointer.toSend) / plan.fps).toBeGreaterThanOrEqual(0.5)
    expect(plan.send).toBeLessThan(plan.build.first)
  })

  it('takes the pacing of the level change as the team gave it, to the hundredth of a second', () => {
    expect(plan.pacing).toEqual({ toControl: 0.55, rest: 0.12, menuIn: 0.2, read: 0.12, toLevel: 0.35, settle: 0.2, menuOut: 0.16, pointerOut: 0.18, beat: 0.25 })
    for (const k of Object.keys(plan.pacing) as (keyof typeof plan.pacing)[]) expect(plan.pacing[k]).toBe(PAUSES[k])
    const s = (frames: number): number => frames / plan.fps
    expect(s(plan.pointer.atControl - plan.pointer.enter)).toBeCloseTo(PAUSES.toControl, 1)
    expect(s(plan.reasoning.open - plan.pointer.atControl)).toBeCloseTo(PAUSES.rest, 1)
    expect(s(plan.menu.full - plan.reasoning.open)).toBeCloseTo(PAUSES.menuIn, 1)
    expect(s(plan.pointer.atLevel - plan.pointer.toLevel)).toBeCloseTo(PAUSES.toLevel, 1)
    expect(s(plan.menu.gone - plan.menu.fade)).toBeCloseTo(PAUSES.menuOut, 1)
  })

  it('keeps the build screen quick: a moment before the first line, every line done before the cut', () => {
    const build = (plan.frameCount - plan.build.first) / plan.fps
    expect(build).toBeGreaterThan(4)
    expect(build).toBeLessThan(5)
    expect((plan.steps[0]! - plan.build.first) / plan.fps).toBeCloseTo(PAUSES.beforeFirstStep, 1)
    expect(plan.lastDone).toBeGreaterThan(plan.steps.at(-1)!)
    expect((plan.frameCount - plan.lastDone) / plan.fps).toBeGreaterThanOrEqual(0.35)
    expect(plan.build.last).toBe(plan.frameCount - 1)
  })
})

describe('the opening pack that is committed', () => {
  it("is the film's opening: its frame count, its rate, the hd size, under the host's share", () => {
    expect(m.version).toBe(PACK_VERSION)
    expect(m.frameCount).toBe(plan.frameCount)
    expect(m.fps).toBe(plan.fps)
    expect([m.width, m.height]).toEqual([config.formats.hd.width, config.formats.hd.height])
    expect(m.background).toMatch(/^#[0-9a-f]{6}$/)
    expect(manifestBytes.length + bin.length).toBeLessThanOrEqual(12 * 1024 * 1024)
    expect(states.length).toBe(plan.frameCount)
  })

  it('stores every picture once and reaches every frame from a whole picture', () => {
    const seen = new Set<string>()
    for (const [at, length] of m.images) {
      const key = `${at}:${length}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
    expect(m.images.reduce((n, i) => n + i[1], 0)).toBe(bin.length)
    expect('key' in m.pictures[m.frames[0]!]!).toBe(true)
    for (let f = 1; f < m.frameCount; f++) expect(m.frames[f]! - m.frames[f - 1]!, `frame ${f}`).toBeGreaterThanOrEqual(0)
    for (let f = 1; f < m.frameCount; f++) expect(m.frames[f]! - m.frames[f - 1]!, `frame ${f}`).toBeLessThanOrEqual(1)
    for (let p = 0; p < m.pictures.length; p++) {
      const chain = chainTo(m.pictures, -1, p)
      expect('key' in m.pictures[chain[0]!]!, `picture ${p}`).toBe(true)
      expect(chain.at(-1)).toBe(p)
    }
  })

  it('says for every frame what the screen showed: the characters typed, the level, the menu, the send, the lines', () => {
    for (let f = 0; f < plan.frameCount; f++) {
      const s = states[f]!
      const at = `frame ${f}`
      if (f < plan.build.first) {
        expect(s.screen, at).toBe('prompt')
        expect(s.typed, at).toBe(plan.keyTaps.filter((k) => k <= f).length)
        expect(s.level, at).toBe(f < plan.reasoning.choose ? intro.reasoningFrom : intro.reasoning)
        expect(s.menu > 0, at).toBe(f >= plan.reasoning.open && f < plan.menu.gone)
        if (f >= plan.menu.full && f < plan.menu.fade) expect(s.menu, at).toBe(1)
        expect(s.sent, at).toBe(f >= plan.send)
        expect(s.lines + s.done, at).toBe(0)
      } else {
        expect(s.screen, at).toBe('build')
        expect(s.typed, at).toBe(intro.prompt.length)
        expect(s.lines, at).toBe(plan.steps.filter((k) => k <= f).length)
        expect(s.done, at).toBe(f >= plan.lastDone ? intro.steps.length : Math.max(0, s.lines - 1))
      }
    }
    expect(states[plan.send]!.pressed).toBe(true)
    expect(states[plan.frameCount - 1]!.done).toBe(intro.steps.length)
  })

  it('names no model and holds nothing of the skill but pictures', () => {
    const text = manifestBytes.toString('utf8')
    expect(text.includes(intro.model)).toBe(false)
    expect(Object.keys(json()).sort()).toEqual(['background', 'fps', 'frameCount', 'frames', 'height', 'images', 'pictures', 'states', 'version', 'width'])
    for (const [at] of m.images) expect(bin.subarray(at, at + 4).toString('latin1')).toBe('RIFF')
  })

  it('rebuilds to pictures of the ground colour at the corners, and a later frame differs from the first', async () => {
    const pack = await openPack(dir)
    const first: Buffer = await pack.frame(0)
    const typing: Buffer = await pack.frame(Math.round((plan.typing.first + plan.typing.last) / 2))
    const last: Buffer = await pack.frame(plan.frameCount - 1)
    const corner = (b: Buffer): string => `#${b.subarray(0, 3).toString('hex')}`
    for (const b of [first, typing, last]) {
      expect(b.length).toBe(m.width * m.height * 3)
      expect(corner(b)).toBe(m.background)
    }
    expect(first.equals(typing)).toBe(false)
    expect(typing.equals(last)).toBe(false)
    const again: Buffer = await pack.frame(0)
    expect(again.equals(first)).toBe(true)
  })

  it('reads the size of a stored picture from its own bytes', () => {
    const key = m.pictures[m.frames[0]!]!
    const [at, length] = m.images[imagesOf(key)[0]!]!
    expect(imagePixels(new Uint8Array(bin.buffer, bin.byteOffset + at, length), 1)).toBe(m.width * m.height)
    expect(imagePixels(new Uint8Array(40), 77)).toBe(77)
  })
})

describe("the page's reading of a pack", () => {
  const small = (): Record<string, any> => ({ version: PACK_VERSION, width: 4, height: 2, fps: 60, frameCount: 4, background: '#ffffff', images: [[0, 10], [10, 5], [15, 5]], pictures: [{ key: 0 }, { from: 0, patches: [[1, 0, 0]] }, { from: 1, patches: [[2, 1, 1], [1, 0, 0]] }], frames: [0, 1, 1, 2], states: [] })
  const read = (change: (p: Record<string, any>) => void, bytes = 20, frames = 4): PackManifest => {
    const p = small()
    change(p)
    return readManifest(p, bytes, { frameCount: frames, fps: 60 })
  }

  it('takes a sound manifest and refuses one that is stale or damaged, in plain words', () => {
    expect(read(() => undefined).frames).toEqual([0, 1, 1, 2])
    expect(() => readManifest(null, 20, { frameCount: 4, fps: 60 })).toThrow(/not a manifest/)
    expect(() => read((p) => (p.version = 2))).toThrow(/version 2, and this build reads version 1/)
    expect(() => read(() => undefined, 20, 5)).toThrow(/holds 4 frames at 60 a second, and the film's opening is 5 frames at 60\. Make it again with npm run opening/)
    expect(() => read((p) => (p.fps = 30))).toThrow(/Make it again with npm run opening/)
    expect(() => read(() => undefined, 19)).toThrow(/do not fit its file/)
    expect(() => read((p) => (p.pictures[1].patches[0][0] = 3))).toThrow(/names a picture it does not hold/)
    expect(() => read((p) => (p.pictures[2].from = 2))).toThrow(/names a picture it does not hold/)
    expect(() => read((p) => (p.frames[3] = 3))).toThrow(/names a picture it does not hold/)
    expect(() => read((p) => delete p.background)).toThrow(/manifest is damaged/)
  })

  it('finds the pictures to draw, in order, from the one on screen or from the last whole picture', () => {
    const p = read(() => undefined).pictures
    expect(chainTo(p, -1, 2)).toEqual([0, 1, 2])
    expect(chainTo(p, 0, 2)).toEqual([1, 2])
    expect(chainTo(p, 2, 2)).toEqual([])
    expect(chainTo(p, 2, 1)).toEqual([0, 1])
    expect(chainTo(p, 1, 0)).toEqual([0])
  })

  it('keeps in memory what the next frames need and no more than a few whole pictures', () => {
    const all = windowOf(m, chainTo(m.pictures, -1, m.frames[0]!), 0, () => 1)
    expect(all.has(imagesOf(m.pictures[m.frames[0]!]!)[0]!)).toBe(true)
    const whole = m.width * m.height
    for (const f of [0, plan.typing.first, plan.send, plan.build.first - 2, plan.steps[1]!]) {
      const chain = chainTo(m.pictures, m.frames[f]!, m.frames[Math.min(m.frameCount - 1, f + 1)]!)
      const sizes = new Map<number, number>()
      const pixels = (n: number): number => {
        const [at, length] = m.images[n]!
        const size = imagePixels(new Uint8Array(bin.buffer, bin.byteOffset + at, length), whole)
        sizes.set(n, size)
        return size
      }
      const w = windowOf(m, chain, f + 1, pixels)
      for (const q of chain) for (const n of imagesOf(m.pictures[q]!)) expect(w.has(n)).toBe(true)
      const ahead = new Set<number>()
      for (let g = f + 1; g <= Math.min(m.frameCount - 1, f + 13); g++) for (const n of imagesOf(m.pictures[m.frames[g]!]!)) ahead.add(n)
      for (const n of w) expect(ahead.has(n), `frame ${f}: image ${n} is one of the next frames`).toBe(true)
      let held = 0
      for (const n of w) held += sizes.get(n)!
      expect(held).toBeLessThanOrEqual(5 * whole)
    }
  })

  it('reads in the tools what the page reads', async () => {
    const pack = readPack(manifestBytes, bin)
    expect([pack.width, pack.height, pack.fps, pack.frameCount, pack.background]).toEqual([m.width, m.height, m.fps, m.frameCount, m.background])
    expect(fitBox(m.width * 2, m.height * 2, m.width, m.height)).toEqual({ x: 0, y: 0, w: m.width * 2, h: m.height * 2, scale: 2 })
  })
})

describe('the renderer that draws the opening', () => {
  const root = path.resolve(__dirname, '..')
  const swiftshader: string = JSON.parse(fs.readFileSync(path.join(root, 'config', 'webgl-caps.json'), 'utf8')).webgl.renderer
  const lavapipe = 'ANGLE (Mesa, Vulkan 1.4.335 (llvmpipe (LLVM 21.1.8 256 bits) (0x00000000)), llvmpipe)'
  const plain = 'the opening is drawn by SwiftShader, the renderer of the committed pack'

  it('is SwiftShader for every run that draws, and none is named for the run that only asks the page', () => {
    expect(PACK_RENDERER).toBe('swiftshader')
    for (const args of [{}, { master: true }, { stills: '0,90' }, { stills: '90', 'only-stills': true }, { skill: 'a', effort: 'b' }]) expect(packRenderer(args)).toBe('swiftshader')
    expect(packRenderer()).toBe('swiftshader')
    expect(packRenderer({ page: true })).toBe(null)
    expect(packRenderer({ help: true })).toBe(null)
  })

  it("beats SHOWCASE_RENDERER and the machine's default once the tool has named it", () => {
    const before = process.env.SHOWCASE_RENDERER
    try {
      for (const said of [undefined, 'lavapipe', 'swiftshader', 'something else']) {
        if (said === undefined) delete process.env.SHOWCASE_RENDERER
        else process.env.SHOWCASE_RENDERER = said
        process.env.SHOWCASE_RENDERER = String(packRenderer({ master: true }))
        expect(softwareRenderer().name).toBe('swiftshader')
        expect(softwareRenderer().flags).toBe(SOFTWARE_FLAGS)
        expect(softwareRenderer().env).toBe(undefined)
      }
    } finally {
      if (before === undefined) delete process.env.SHOWCASE_RENDERER
      else process.env.SHOWCASE_RENDERER = before
    }
  })

  it('says so in one line and names what it sets aside', () => {
    expect(rendererLine(undefined, undefined)).toBe(plain)
    expect(rendererLine(undefined, 'swiftshader')).toBe(plain)
    expect(rendererLine('swiftshader', 'lavapipe')).toBe(plain)
    expect(rendererLine('SwiftShader', 'lavapipe')).toBe(plain)
    expect(rendererLine(undefined, 'lavapipe')).toBe(`${plain}, whatever this machine's default is (lavapipe)`)
    expect(rendererLine('lavapipe', 'swiftshader')).toBe(`${plain}, whatever SHOWCASE_RENDERER says (lavapipe)`)
    expect(rendererLine('lavapipe', 'lavapipe')).toBe(`${plain}, whatever SHOWCASE_RENDERER says (lavapipe)`)
    expect(rendererLine('card', undefined)).toBe(`${plain}, whatever SHOWCASE_RENDERER says (card)`)
  })

  it('stops in plain words when the browser about to draw is not SwiftShader', () => {
    expect(swiftshader).toMatch(/SwiftShader/)
    expect(rendererProblem('swiftshader', swiftshader)).toBe('')
    const problems: string[] = [rendererProblem('lavapipe', lavapipe), rendererProblem('lavapipe', swiftshader), rendererProblem('swiftshader', lavapipe), rendererProblem('swiftshader', ''), rendererProblem('swiftshader', undefined)]
    expect(problems[0]).toMatch(/^the renderer is lavapipe\. The opening is drawn by SwiftShader only/)
    expect(problems[1]).toMatch(/^the renderer is lavapipe\./)
    expect(problems[2]).toMatch(/^the browser was asked for SwiftShader and answers with "ANGLE \(.*llvmpipe.*"\. The opening is drawn by SwiftShader only/)
    expect(problems[3]).toMatch(/answers with no renderer at all\./)
    expect(problems[4]).toBe(problems[3])
    for (const p of problems) {
      expect(p).toMatch(/Nothing was drawn, and the pack stays as it is$/)
      expect(p.includes('\n')).toBe(false)
    }
  })

  it('is named by the tool before its browser starts and asked of the browser before a frame is drawn, and --page is left alone', () => {
    const tool = fs.readFileSync(path.join(root, 'tools', 'opening.mjs'), 'utf8')
    const main = tool.slice(tool.indexOf('async function main()'))
    const steps = ['return checkPage()', 'rendererLine(process.env.SHOWCASE_RENDERER, pinnedBrowser().renderer)', 'process.env.SHOWCASE_RENDERER = packRenderer(args)', 'await Session.open()', 'rendererProblem(softwareRenderer().name, graphics)', 'throw new Stop(problem)', 'session.page(', 'openScreens(session']
    let last = 0
    for (const step of steps) {
      const at = main.indexOf(step)
      expect(at, step).toBeGreaterThan(last)
      expect(main.indexOf(step, at + 1), `${step}, once`).toBe(-1)
      last = at
    }
    const page = tool.slice(tool.indexOf('async function checkPage()'), tool.indexOf('async function main()'))
    expect(page.includes('await Session.open()')).toBe(true)
    expect(page.includes('SHOWCASE_RENDERER')).toBe(false)
    expect(page.includes('packRenderer')).toBe(false)
  })
})
