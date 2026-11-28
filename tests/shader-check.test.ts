import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { createGfx } from '../src/core/gl'

/**
 * three reads what the compiler said of a program at its first use and writes it to the console
 * (`renderer.debug.checkShaderErrors`). The render tools read those lines on the pages they open. A visitor's page does
 * not ask: Direct3D has a warning for a shader that draws as it should, and it stood in the visitor's console.
 */

vi.mock('three', async (original) => ({
  ...(await original<typeof import('three')>()),
  // The renderer as three makes it: the check is on until a page turns it off.
  WebGLRenderer: class {
    debug = { checkShaderErrors: true, onShaderError: null }
    info = { autoReset: true }
    outputColorSpace = ''
    toneMapping = 0
    autoClear = false
    setPixelRatio(): void {}
  },
}))

const card = { RENDERER: 1, MAX_TEXTURE_SIZE: 2, MAX_SAMPLES: 3, getExtension: (): null => null, getParameter: (): number => 4096 }
const canvas = { getContext: () => card } as unknown as HTMLCanvasElement
const checks = (opts: { preserve: boolean; visitor?: boolean }): boolean => createGfx(canvas, { deny: [], ...opts }).renderer.debug.checkShaderErrors

describe('what three asks the shader compiler', () => {
  it('live page: false, capture page: true', () => {
    expect(checks({ preserve: false, visitor: true })).toBe(false)
    expect(checks({ preserve: true, visitor: false })).toBe(true)
    // A page that says nothing of itself is read as a tool's.
    expect(checks({ preserve: true })).toBe(true)
  })

  it('is told by the one word that gives a live page its answer to a lost context', () => {
    const main = readFileSync('src/main.ts', 'utf8')
    expect(main).toContain("const capture = params.mode === 'capture'\n")
    expect(main).toContain('const visitor = !capture\n')
    expect(main).toContain('const context = visitor ? new ContextWatch(canvas) : null\n')
    expect(main).toContain('createGfx(canvas, { deny: params.deny, preserve: capture, visitor })')
    expect(main.match(/createGfx\(/g)).toHaveLength(1)
    expect(main.match(/checkShaderErrors/g)).toBeNull()
  })
})
