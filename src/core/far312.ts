import type * as THREE from 'three'
import type { Pixels } from './png'

/**
 * The trials of Decision 312, T6: how spring's far picture reaches the card. The address names them (`far=`), one or more
 * joined by a comma. This file is on the trials branch alone.
 *   bytes   the file's pixels read off the thread, handed to the card as an array
 *   webp    the same pixels from a lossless WebP the job makes beside the page
 *   step    the hand-over in a task of its own, before the first frame
 *   wait    the thread waits for the card to do all it holds just before the hand-over (a small picture's levels are made
 *           on the card and one pixel of them is read back; `finish` itself does not wait in every browser)
 *   twin    an array of the same size and kind goes to the card just before it
 */
export const FAR = 'spring/slab-far.srgb.w2048.png'
const asked = typeof location === 'undefined' ? [] : (new URLSearchParams(location.search).get('far') ?? '').split(',').filter(Boolean)
export const far = { any: asked.length > 0, bytes: asked.includes('bytes'), webp: asked.includes('webp'), step: asked.includes('step'), wait: asked.includes('wait'), twin: asked.includes('twin') }

let renderer: THREE.WebGLRenderer | null = null
let source: unknown = null

export function farSource(s: unknown): void {
  source = s
}

export function farRenderer(r: THREE.WebGLRenderer): void {
  renderer = r
  if (!far.wait && !far.twin) return
  const gl = r.getContext() as WebGL2RenderingContext
  const real = gl.texSubImage2D.bind(gl) as (...a: unknown[]) => void
  let done = false
  gl.texSubImage2D = ((...a: unknown[]) => {
    if (!done && source && a.includes(source)) {
      done = true
      if (far.wait) {
        const bound = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null
        const read = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING) as WebGLFramebuffer | null
        const pack = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING) as WebGLBuffer | null
        const small = gl.createTexture()
        const fb = gl.createFramebuffer()
        gl.bindTexture(gl.TEXTURE_2D, small)
        gl.texStorage2D(gl.TEXTURE_2D, 2, gl.RGBA8, 2, 2)
        real(gl.TEXTURE_2D, 0, 0, 0, 2, 2, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(16))
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb)
        gl.framebufferTexture2D(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, small, 1)
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null)
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pack)
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, read)
        gl.bindTexture(gl.TEXTURE_2D, bound)
        gl.deleteFramebuffer(fb)
        gl.deleteTexture(small)
      }
      if (far.twin) {
        const bound = gl.getParameter(gl.TEXTURE_BINDING_2D) as WebGLTexture | null
        const twin = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, twin)
        gl.texStorage2D(gl.TEXTURE_2D, 12, gl.SRGB8_ALPHA8, 2048, 2048)
        real(gl.TEXTURE_2D, 0, 0, 0, 2048, 2048, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(2048 * 2048 * 4))
        gl.bindTexture(gl.TEXTURE_2D, bound)
        gl.deleteTexture(twin)
      }
    }
    real(...a)
  }) as typeof gl.texSubImage2D
}

export function farBytes(file: ArrayBuffer): Promise<Pixels | null> {
  return new Promise((resolve) => {
    let w: Worker
    try {
      w = new Worker(new URL('./png.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      resolve(null)
      return
    }
    const done = (p: Pixels | null): void => {
      w.terminate()
      resolve(p)
    }
    w.onmessage = (e: MessageEvent<Pixels | null>) => done(e.data)
    w.onerror = () => done(null)
    w.postMessage(file, [file])
  })
}

export async function farStep(t: THREE.Texture): Promise<boolean> {
  if (!renderer) return false
  await new Promise((r) => setTimeout(r, 0))
  renderer.initTexture(t)
  return true
}
