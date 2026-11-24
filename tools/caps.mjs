import fs from 'node:fs'
import os from 'node:os'
import { launch, machineId, pinnedBrowser } from './lib/browser.mjs'
import { rel, writeJson, readJson } from './lib/paths.mjs'

const file = rel('config', 'webgl-caps.json')
const previous = fs.existsSync(file) ? readJson(file) : null
const browser = await launch()
const page = await browser.newPage()
await page.goto('about:blank')
const caps = await page.evaluate(() => {
  const c = document.createElement('canvas')
  const gl = c.getContext('webgl2')
  if (!gl) return null
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const P = (n) => gl.getParameter(gl[n])
  const names = ['MAX_TEXTURE_SIZE', 'MAX_3D_TEXTURE_SIZE', 'MAX_CUBE_MAP_TEXTURE_SIZE', 'MAX_ARRAY_TEXTURE_LAYERS', 'MAX_RENDERBUFFER_SIZE', 'MAX_DRAW_BUFFERS', 'MAX_COLOR_ATTACHMENTS', 'MAX_SAMPLES', 'MAX_VERTEX_ATTRIBS', 'MAX_VERTEX_UNIFORM_VECTORS', 'MAX_FRAGMENT_UNIFORM_VECTORS', 'MAX_VARYING_VECTORS', 'MAX_TEXTURE_IMAGE_UNITS', 'MAX_VERTEX_TEXTURE_IMAGE_UNITS', 'MAX_COMBINED_TEXTURE_IMAGE_UNITS', 'MAX_UNIFORM_BUFFER_BINDINGS', 'MAX_UNIFORM_BLOCK_SIZE', 'MAX_ELEMENTS_VERTICES', 'MAX_ELEMENTS_INDICES', 'MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS']
  const limits = {}
  for (const n of names) limits[n] = P(n)
  limits.MAX_VIEWPORT_DIMS = Array.from(P('MAX_VIEWPORT_DIMS'))
  limits.ALIASED_POINT_SIZE_RANGE = Array.from(P('ALIASED_POINT_SIZE_RANGE'))
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic')
  if (aniso) limits.MAX_TEXTURE_MAX_ANISOTROPY = gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)
  const precision = (shader, kind) => {
    const f = gl.getShaderPrecisionFormat(gl[shader], gl[kind])
    return f ? [f.rangeMin, f.rangeMax, f.precision] : null
  }
  const targets = {}
  const tryTarget = (name, internal, format, type) => {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl[internal], 4, 4, 0, gl[format], gl[type], null)
    const fb = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    targets[name] = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.deleteFramebuffer(fb)
    gl.deleteTexture(tex)
  }
  gl.getExtension('EXT_color_buffer_float')
  gl.getExtension('EXT_color_buffer_half_float')
  tryTarget('RGBA16F', 'RGBA16F', 'RGBA', 'HALF_FLOAT')
  tryTarget('RGBA32F', 'RGBA32F', 'RGBA', 'FLOAT')
  tryTarget('R11F_G11F_B10F', 'R11F_G11F_B10F', 'RGB', 'HALF_FLOAT')
  tryTarget('RGBA8', 'RGBA8', 'RGBA', 'UNSIGNED_BYTE')
  return {
    version: P('VERSION'),
    shadingLanguage: P('SHADING_LANGUAGE_VERSION'),
    vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : P('VENDOR'),
    renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : P('RENDERER'),
    limits,
    precision: { vertexHighFloat: precision('VERTEX_SHADER', 'HIGH_FLOAT'), fragmentHighFloat: precision('FRAGMENT_SHADER', 'HIGH_FLOAT'), fragmentHighInt: precision('FRAGMENT_SHADER', 'HIGH_INT') },
    renderTargets: targets,
    extensions: gl.getSupportedExtensions().sort(),
    userAgent: navigator.userAgent,
  }
})
const version = browser.version()
await browser.close()
if (!caps) {
  console.error('caps: no WebGL2 context in this browser')
  process.exit(1)
}
const portable = previous?.portable ?? {}
const portableRead = previous?.portableRead
const extensions = caps.extensions.map((name) => ({ name, portable: portable[name]?.portable ?? false, note: portable[name]?.note ?? 'not looked up yet' }))
writeJson(file, {
  measured: new Date().toISOString(),
  machine: machineId(),
  os: `${os.type()} ${os.release()}`,
  browser: { name: pinnedBrowser().name, version },
  rendering: 'software, through SwiftShader',
  webgl: { version: caps.version, shadingLanguage: caps.shadingLanguage, vendor: caps.vendor, renderer: caps.renderer },
  limits: caps.limits,
  precision: caps.precision,
  renderTargets: caps.renderTargets,
  portable,
  portableRead,
  extensions,
})
console.log(`caps: ${caps.renderer}`)
console.log(`caps: browser ${version}, max texture ${caps.limits.MAX_TEXTURE_SIZE}, max 3D texture ${caps.limits.MAX_3D_TEXTURE_SIZE}, ${caps.extensions.length} extensions, ${extensions.filter((e) => e.portable).length} marked portable`)
console.log(`caps: float targets: ${JSON.stringify(caps.renderTargets)}`)
console.log(`caps: written to config/webgl-caps.json`)
