import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { LIVE_SAMPLES, liveSamples, resolveBehind } from '../src/core/accumulator'

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

describe('multisampling in the live picture', () => {
  it('asks for the same count whatever the level, clamped to what the device reports', () => {
    expect(LIVE_SAMPLES).toBe(4)
    expect(liveSamples(16)).toBe(4)
    expect(liveSamples(8)).toBe(4)
    expect(liveSamples(4)).toBe(4)
    expect(liveSamples(3)).toBe(3)
    expect(liveSamples(2)).toBe(2)
  })

  it('asks for none where the device gives none, so the picture is drawn as before', () => {
    expect(liveSamples(1)).toBe(0)
    expect(liveSamples(0)).toBe(0)
    expect(liveSamples(-1)).toBe(0)
    expect(liveSamples(Number.NaN)).toBe(0)
    expect(liveSamples(undefined as unknown as number)).toBe(0)
  })

  it('gives the live target its samples from the device and from nothing else', () => {
    const painter = read('src/app/painter.ts')
    expect(painter).toContain('samples: liveSamples(this.gfx.caps.maxSamples)')
    expect(painter).not.toMatch(/quality|level/i)
  })

  it('leaves the capture path without samples', () => {
    const capture = read('src/capture/showcase.ts')
    const made = capture.match(/new Accumulator\([^)]*\)/g) ?? []
    expect(made.length).toBeGreaterThan(0)
    for (const call of made) expect(call).toBe('new Accumulator(gfx, format.width, format.height)')
  })
})

/**
 * A stand-in for the renderer with three.js's own habit: `state.bindFramebuffer` skips a bind its note says is in place,
 * a bind of FRAMEBUFFER does not correct the note for reading, and making a target leaves the canvas bound.
 */
function fakeRenderer() {
  const READ = 0x8ca8
  const DRAW = 0x8ca9
  const BOTH = 0x8d40
  const real: Record<number, unknown> = { [READ]: null, [DRAW]: null }
  const note: Record<number, unknown> = {}
  const props = new Map<object, Record<string, unknown>>()
  const blits: { read: unknown; draw: unknown; rect: number[]; scissor: boolean }[] = []
  let scissor = false
  let made = 0
  const rawBind = (t: number, f: unknown) => {
    if (t === BOTH) real[READ] = real[DRAW] = f
    else real[t] = f
  }
  const gl = {
    READ_FRAMEBUFFER: READ,
    DRAW_FRAMEBUFFER: DRAW,
    FRAMEBUFFER: BOTH,
    SCISSOR_TEST: 0x0c11,
    COLOR_BUFFER_BIT: 0x4000,
    NEAREST: 0x2600,
    bindFramebuffer: rawBind,
    isEnabled: () => scissor,
    enable: () => (scissor = true),
    disable: () => (scissor = false),
    blitFramebuffer: (...rect: number[]) => blits.push({ read: real[READ], draw: real[DRAW], rect: rect.slice(0, 8), scissor }),
  }
  const state = {
    bindFramebuffer(t: number, f: unknown): boolean {
      if (note[t] === f) return false
      rawBind(t, f)
      note[t] = f
      if (t === DRAW) note[BOTH] = f
      if (t === BOTH) note[DRAW] = f
      return true
    },
  }
  const get = (o: object) => {
    let p = props.get(o)
    if (!p) props.set(o, (p = {}))
    return p
  }
  const renderer = {
    getContext: () => gl,
    state,
    properties: { get },
    initRenderTarget(rt: object) {
      get(rt).__webglFramebuffer = { made: ++made }
      state.bindFramebuffer(BOTH, get(rt).__webglFramebuffer)
      state.bindFramebuffer(BOTH, null)
    },
  }
  return { renderer, gl, state, real, note, props, blits, get, READ, DRAW, BOTH, setScissor: (on: boolean) => (scissor = on), madeCount: () => made }
}

describe('the look behind under samples', () => {
  const target = (w: number, h: number) => new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 })

  it('gives nothing for a target that has no multisampled frame', () => {
    const f = fakeRenderer()
    expect(resolveBehind(f.renderer as never, target(64, 32), 'test-none')).toBeNull()
    expect(f.blits.length).toBe(0)
  })

  it('reads the multisampled frame for every asker, the second in a frame as the first', () => {
    const f = fakeRenderer()
    const t = target(320, 180)
    const from = { name: 'multisampled' }
    f.get(t).__webglMultisampledFramebuffer = from
    // three.js is drawing into the multisampled frame, and its note for reading says so too.
    f.state.bindFramebuffer(f.READ, from)
    f.state.bindFramebuffer(f.BOTH, from)
    const a = resolveBehind(f.renderer as never, t, 'test-first')
    const b = resolveBehind(f.renderer as never, t, 'test-second')
    expect(a).not.toBeNull()
    expect(b).not.toBeNull()
    expect(a).not.toBe(b)
    expect(f.blits.length).toBe(2)
    for (const blit of f.blits) {
      expect(blit.read).toBe(from)
      expect(blit.draw).not.toBe(from)
      expect(blit.draw).not.toBeNull()
      expect(blit.rect).toEqual([0, 0, 320, 180, 0, 0, 320, 180])
    }
    // Afterwards three.js draws into the multisampled frame again, and its note agrees with what is bound.
    expect(f.real[f.READ]).toBe(from)
    expect(f.real[f.DRAW]).toBe(from)
    expect(f.note[f.READ]).toBe(from)
    expect(f.note[f.DRAW]).toBe(from)
    expect(f.note[f.BOTH]).toBe(from)
  })

  it('keeps one texture per asker and size, and makes another when the picture is resized', () => {
    const f = fakeRenderer()
    const t = target(200, 100)
    f.get(t).__webglMultisampledFramebuffer = { name: 'a' }
    const first = resolveBehind(f.renderer as never, t, 'test-size')!
    expect(resolveBehind(f.renderer as never, t, 'test-size')).toBe(first)
    const made = f.madeCount()
    const larger = target(400, 200)
    f.get(larger).__webglMultisampledFramebuffer = { name: 'b' }
    const second = resolveBehind(f.renderer as never, larger, 'test-size')!
    expect(second).not.toBe(first)
    expect((second.image as { width: number }).width).toBe(400)
    expect(f.madeCount()).toBe(made + 1)
    expect(f.blits.at(-1)!.rect).toEqual([0, 0, 400, 200, 0, 0, 400, 200])
  })

  it('makes its frame again after a lost context, and copies the whole frame with a scissor set', () => {
    const f = fakeRenderer()
    const t = target(128, 72)
    const from = { name: 'c' }
    f.get(t).__webglMultisampledFramebuffer = from
    const first = resolveBehind(f.renderer as never, t, 'test-lost')!
    const made = f.madeCount()
    f.props.clear()
    f.get(t).__webglMultisampledFramebuffer = from
    f.setScissor(true)
    expect(resolveBehind(f.renderer as never, t, 'test-lost')).toBe(first)
    expect(f.madeCount()).toBe(made + 1)
    expect(f.blits.at(-1)!.read).toBe(from)
    expect(f.blits.at(-1)!.scissor).toBe(false)
    expect(f.gl.isEnabled()).toBe(true)
  })
})
