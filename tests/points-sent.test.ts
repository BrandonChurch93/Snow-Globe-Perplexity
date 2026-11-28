import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as THREE from 'three'
import { WebGLAttributes } from 'three/src/renderers/webgl/WebGLAttributes.js'
import { describe, expect, it } from 'vitest'
import { levels } from '../src/core/quality'
import type { ParticleSource } from '../src/core/stage'
import { ParticleDraw } from '../src/particles/draw/points'

const SOURCE = readFileSync(join(__dirname, '..', 'src', 'particles', 'draw', 'points.ts'), 'utf8')
const N = 1000
const FLOATS_EACH = 3 + 3 + 4 + 1
const NAMES = ['aNow', 'aPrev', 'aData', 'aState']
const FRACTIONS = levels.map((l) => l.particleFraction)

/** A list of N particles in which every number tells which frame wrote it. */
function listOf(frame: number): ParticleSource {
  const made = <T extends Float32Array | Uint8Array>(a: T, of: (i: number) => number): T => {
    for (let i = 0; i < a.length; i++) a[i] = of(i)
    return a
  }
  return {
    count: N,
    step: frame,
    pos: made(new Float32Array(N * 3), (i) => frame * 4096 + i),
    prev: made(new Float32Array(N * 3), (i) => frame * 4096 - i),
    sizes: made(new Float32Array(N), (i) => 1 + frame + (i % 7)),
    kindOf: new Uint8Array(N),
    kinds: [],
    state: made(new Uint8Array(N), (i) => (i + frame) % 3),
    liquid: new Float64Array(0),
    opacity: made(new Float32Array(N), (i) => (1 + ((i + frame) % 5)) / 8),
    phase: made(new Float32Array(N), (i) => frame + i / 2),
  }
}

/** A GPU that keeps what it is sent, by WebGL 2's rule for a part of an array: a length of 0 is all the rest of it. */
function gpu() {
  const held = new Map<object, Float32Array>()
  const sent = { floats: 0 }
  let bound: object | null = null
  const gl = {
    ARRAY_BUFFER: 34962,
    FLOAT: 5126,
    createBuffer: (): object => ({}),
    bindBuffer: (_target: number, buffer: object | null): void => {
      bound = buffer
    },
    bufferData: (_target: number, data: Float32Array): void => {
      held.set(bound!, data.slice())
      sent.floats += data.length
    },
    bufferSubData: (_target: number, atByte: number, data: Float32Array, from = 0, length = 0): void => {
      const count = length === 0 ? data.length - from : length
      held.get(bound!)!.set(data.subarray(from, from + count), atByte / data.BYTES_PER_ELEMENT)
      sent.floats += count
    },
  }
  const attributes = new WebGLAttributes(gl as unknown as WebGL2RenderingContext)
  return {
    sent,
    send: (a: THREE.BufferAttribute): void => attributes.update(a, gl.ARRAY_BUFFER),
    holds: (a: THREE.BufferAttribute): Float32Array => held.get(attributes.get(a)!.buffer)!,
  }
}

/** The page's particles on a renderer of the test's own: a frame fills the list, then three's own sender takes every attribute of the mesh that is drawn. */
function page(quads: boolean) {
  const draw = new ParticleDraw(100)
  const g = gpu()
  const mesh = (): THREE.Points | THREE.Mesh => draw.points.children.find((o) => (quads ? (o as THREE.Mesh).isMesh : (o as THREE.Points).isPoints)) as THREE.Points | THREE.Mesh
  const lists = (): THREE.BufferAttribute[] => NAMES.map((name) => mesh().geometry.getAttribute(quads || name !== 'aNow' ? name : 'position') as THREE.BufferAttribute)
  const fill = (frame: number, fraction: number): void => (draw as unknown as { fill(s: ParticleSource, fraction: number, quads: boolean, mix: number): void }).fill(listOf(frame), fraction, quads, 0.5)
  return {
    draw,
    lists,
    fill,
    /** One frame that is drawn. What it sent, in floats. */
    frame(frame: number, fraction: number): number {
      fill(frame, fraction)
      const before = g.sent.floats
      for (const a of lists()) g.send(a)
      return g.sent.floats - before
    },
    /** How many particles the mesh draws. */
    draws: (): number => (quads ? (mesh().geometry as THREE.InstancedBufferGeometry).instanceCount : mesh().geometry.drawRange.count),
    /** Of every particle the mesh draws: is what the GPU holds what the page has now. */
    current(): boolean {
      const n = quads ? (mesh().geometry as THREE.InstancedBufferGeometry).instanceCount : mesh().geometry.drawRange.count
      return lists().every((a) => {
        const has = g.holds(a)
        for (let i = 0; i < n * a.itemSize; i++) if (has[i] !== a.array[i]) return false
        return true
      })
    },
    /** Of the whole list: is what the GPU holds what the page has now. */
    whole: (): boolean => lists().every((a) => g.holds(a).every((v, i) => v === a.array[i])),
  }
}

describe.each([
  ['the quads of the live app', true],
  ['the sprites of the film', false],
])('what a frame sends of the particles: %s', (_name, quads) => {
  it('has a level that draws all and levels that draw a part', () => {
    expect(Math.max(...FRACTIONS)).toBe(1)
    expect(FRACTIONS.filter((f) => f > 0 && f < 1).length).toBeGreaterThan(0)
    expect(SOURCE).toContain('this.fill(source, f.quality.particleFraction, mesh.quads, f.moment.mix)')
  })

  it('sends at every level the particles that level draws and no more', () => {
    for (const fraction of FRACTIONS) {
      const p = page(quads)
      expect(p.frame(1, fraction), 'the first frame makes the buffers, of the whole list').toBe(N * FLOATS_EACH)
      for (let frame = 2; frame < 5; frame++) {
        expect(p.frame(frame, fraction), `at ${fraction}`).toBe(Math.floor(N * fraction) * FLOATS_EACH)
        expect(p.draws(), `at ${fraction}`).toBe(Math.floor(N * fraction))
        expect(p.draw.drawn).toBe(p.draws())
      }
    }
  })

  it('leaves in the GPU, of every particle a frame draws, what that frame wrote, through every change of level', () => {
    const p = page(quads)
    let frame = 1
    p.frame(frame, 1)
    for (const from of FRACTIONS) {
      for (const to of FRACTIONS) {
        for (const fraction of [from, to]) {
          p.frame(++frame, fraction)
          expect(p.draws()).toBe(Math.floor(N * fraction))
          expect(p.current(), `frame ${frame}, from ${from} to ${to}, at ${fraction}`).toBe(true)
          expect(p.whole(), 'a part was sent, so the rest is of an older frame: the check above can fail').toBe(fraction === 1)
        }
      }
    }
  })

  it('sends the part of the frame that is drawn, after frames that filled the list and were not drawn', () => {
    const p = page(quads)
    p.frame(1, 1)
    for (let frame = 2; frame < 7; frame++) p.fill(frame, frame % 2 ? 1 : 0.3)
    for (const a of p.lists()) expect(a.updateRanges).toEqual([{ start: 0, count: 300 * a.itemSize }])
    expect(p.frame(7, 0.6)).toBe(600 * FLOATS_EACH)
    expect(p.current()).toBe(true)
    for (const a of p.lists()) expect(a.updateRanges).toEqual([])
  })

  it('names no part where nothing is drawn: a part of no length would be read as all the rest', () => {
    const p = page(quads)
    p.frame(1, 1)
    p.fill(2, 0.3)
    p.fill(3, 0)
    expect(p.draws()).toBe(0)
    for (const a of p.lists()) expect(a.updateRanges).toEqual([])
    expect(p.frame(4, 0.3)).toBe(300 * FLOATS_EACH)
    expect(p.current()).toBe(true)
  })
})
