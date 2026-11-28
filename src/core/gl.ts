import * as THREE from 'three'

export interface Caps {
  float32: boolean
  half: boolean
  anisotropy: number
  maxTexture: number
  maxSamples: number
  denied: string[]
  renderer: string
}

export interface Gfx {
  renderer: THREE.WebGLRenderer
  gl: WebGL2RenderingContext
  canvas: HTMLCanvasElement
  caps: Caps
}

function testTarget(gl: WebGL2RenderingContext, internal: number, type: number): boolean {
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, 4, 4, 0, gl.RGBA, type, null)
  const fb = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_2D, null)
  gl.deleteFramebuffer(fb)
  gl.deleteTexture(tex)
  return ok
}

export function createGfx(canvas: HTMLCanvasElement, opts: { deny: string[]; preserve: boolean }): Gfx {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: opts.preserve,
    powerPreference: 'high-performance',
  }) as WebGL2RenderingContext | null
  if (!gl) throw new Error('This browser has no WebGL2')
  const deny = new Set(opts.deny)
  if (deny.size) {
    const getExtension = gl.getExtension.bind(gl)
    const getSupported = gl.getSupportedExtensions.bind(gl)
    gl.getExtension = ((name: string) => (deny.has(name) ? null : getExtension(name))) as typeof gl.getExtension
    gl.getSupportedExtensions = () => (getSupported() ?? []).filter((n) => !deny.has(n))
  }
  const hasFloat = !!gl.getExtension('EXT_color_buffer_float')
  const hasHalf = hasFloat || !!gl.getExtension('EXT_color_buffer_half_float')
  const float32 = hasFloat && testTarget(gl, gl.RGBA32F, gl.FLOAT)
  const half = hasHalf && testTarget(gl, gl.RGBA16F, gl.HALF_FLOAT)
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: false, alpha: false, powerPreference: 'high-performance' })
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.autoClear = true
  renderer.setPixelRatio(1)
  renderer.info.autoReset = false
  const caps: Caps = {
    float32,
    half,
    anisotropy: aniso ? (gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number) : 1,
    maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    maxSamples: gl.getParameter(gl.MAX_SAMPLES) as number,
    denied: [...deny],
    renderer: dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
  }
  return { renderer, gl, canvas, caps }
}

export function finish(gfx: Gfx): void {
  gfx.renderer.setRenderTarget(null)
  const px = new Uint8Array(4)
  gfx.gl.readPixels(0, 0, 1, 1, gfx.gl.RGBA, gfx.gl.UNSIGNED_BYTE, px)
}
