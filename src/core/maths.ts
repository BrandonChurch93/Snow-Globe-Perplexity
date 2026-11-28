import { MEAN_STEP_GLSL, NUMBER_GLSL } from './chunks/number'
import type { Gfx } from './gl'

/**
 * What this graphics card answers where GLSL leaves the answer open, and whether the glass on screen is a picture or
 * a flat sheet. The probe page prints both, so that a fault seen on one device can be traced without that device.
 * Nothing here runs in the app itself.
 */

// Every operand comes from a uniform, so that the answer is the card's and not the shader compiler's.
const CASES: ReadonlyArray<readonly [string, string]> = [
  ['pow(-2, 2)', 'pow(-uTwo, uTwo)'],
  ['pow(0, 0)', 'pow(uZero, uZero)'],
  ['sqrt(-1)', 'sqrt(-uOne)'],
  ['inversesqrt(0)', 'inversesqrt(uZero)'],
  ['log(0)', 'log(uZero)'],
  ['normalize(0)', 'normalize(vec3(uZero)).x'],
  ['atan(0, 0)', 'atan(uZero, uZero)'],
  ['acos(2)', 'acos(uTwo)'],
  ['mod(1, 0)', 'mod(uOne, uZero)'],
  ['smoothstep(1, 1, 1)', 'smoothstep(uOne, uOne, uOne)'],
  ['0 / 0', 'uZero / uZero'],
  ['1 / 0', 'uOne / uZero'],
  ['min(nan, 1)', 'min(uZero / uZero, uOne)'],
  ['max(nan, 0)', 'max(uZero / uZero, uZero)'],
  ['clamp(nan, 0, 1)', 'clamp(uZero / uZero, uZero, uOne)'],
  ['isnan(nan)', 'isnan(uZero / uZero) ? 1.0 : 0.0'],
  // The build's own test, which reads the bits (chunks/number.ts): 1 only where every form of it gives the same answer.
  ['numberBroken(0 / 0)', 'numberBroken(uZero / uZero) && numberNan(uZero / uZero) && !numberInf(uZero / uZero) && numberBroken(vec3(uOne, uZero / uZero, uOne)) && numberBroken(vec4(uOne, uOne, uOne, uZero / uZero)) ? 1.0 : 0.0'],
  ['numberBroken(1 / 0)', 'numberBroken(uOne / uZero) && numberInf(uOne / uZero) && !numberNan(uOne / uZero) && numberBroken(vec3(uOne / uZero, uOne, uOne)) && numberBroken(vec4(uOne, uOne / uZero, uOne, uOne)) ? 1.0 : 0.0'],
  ['numberBroken(1)', 'numberBroken(uOne) || numberNan(uOne) || numberInf(uOne) || numberBroken(vec3(uOne)) || numberBroken(vec4(uOne)) ? 1.0 : 0.0'],
]

// Asked in a second shader, which leaves the card's own test for a number out. Under Direct3D only a shader that
// holds that test is built with the strict rules for numbers, and the build's own shaders hold it no longer: this one
// is built as they are. Its broken values are the bits of a uniform, which no compiler can work out ahead, so the
// card says what such a value does.
const PLAIN: ReadonlyArray<readonly [string, string]> = [
  ['nan bits + 1', 'nanBits() + uOne'],
  ['nan bits - nan bits', 'nanBits() - nanBits()'],
  ['numberBroken(nan bits)', 'numberBroken(nanBits()) && numberBroken(nanBits() + uOne) && numberNan(nanBits()) && !numberInf(nanBits()) && numberBroken(vec3(uOne, nanBits(), uOne)) && numberBroken(vec4(uOne, uOne, uOne, nanBits())) ? 1.0 : 0.0'],
  ['numberBroken(inf bits)', 'numberBroken(infBits()) && numberBroken(infBits() + uOne) && numberInf(infBits()) && !numberNan(infBits()) && numberBroken(vec3(infBits(), uOne, uOne)) && numberBroken(vec4(uOne, infBits(), uOne, uOne)) ? 1.0 : 0.0'],
  // The step of the picture's mean, in the accumulator's own text (chunks/number.ts): 1 where the mean held comes back bit for bit.
  ['mean of 1 and 3', 'meanStep(vec4(uOne), vec4(uOne + uTwo), uOne / uTwo).x'],
  ['mean past a broken sample', 'same(meanStep(held(), vec4(uOne, nanBits(), uOne, uOne), uOne / uTwo), held()) && same(meanStep(held(), vec4(uOne, uOne, uOne, infBits()), uOne / uTwo), held()) ? 1.0 : 0.0'],
  ['mean after a broken first sample', 'same(meanStep(vec4(uOne, nanBits(), uOne, uOne), held(), uOne / uTwo), held()) ? 1.0 : 0.0'],
]

const PLAIN_PARS = `${MEAN_STEP_GLSL}uniform uint uNan;
uniform uint uInf;
float nanBits() { return uintBitsToFloat(uNan); }
float infBits() { return uintBitsToFloat(uInf); }
vec4 held() { return vec4(uOne, uTwo, uOne + uTwo, uOne); }
bool same(vec4 a, vec4 b) { return floatBitsToUint(a) == floatBitsToUint(b); }
`

const VERT = `#version 300 es
void main() {
  gl_Position = vec4(gl_VertexID == 1 ? 3.0 : -1.0, gl_VertexID == 2 ? 3.0 : -1.0, 0.0, 1.0);
}`

const frag = (cases: ReadonlyArray<readonly [string, string]>, pars: string) => `#version 300 es
precision highp float;
${NUMBER_GLSL}uniform float uZero;
uniform float uOne;
uniform float uTwo;
${pars}out vec4 o;
float answer(int i) {
${cases.map(([, glsl], i) => `  if (i == ${i}) return ${glsl};`).join('\n')}
  return 0.0;
}
void main() {
  float v = answer(int(gl_FragCoord.x));
  // 2 a number, 3 above every number, 1 below every number, 0 not a number
  float kind = abs(v) < 1.0e30 ? 2.0 : (v > 0.0 ? 3.0 : (v < 0.0 ? 1.0 : 0.0));
  float w = clamp((v + 8.0) / 16.0, 0.0, 1.0) * 255.0;
  o = vec4(kind / 3.0, floor(w) / 255.0, fract(w), 1.0);
}`

const KINDS = ['nan', '-inf', '', '+inf'] as const

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

/** One line a case, `pow(-2, 2) nan` or `pow(-2, 2) 4.00`. An empty list means the card would not run the test. */
export function mathsReport(gfx: Gfx): string[] {
  return [...ask(gfx, CASES, ''), ...ask(gfx, PLAIN, PLAIN_PARS)]
}

function ask(gfx: Gfx, cases: ReadonlyArray<readonly [string, string]>, pars: string): string[] {
  const gl = gfx.gl
  const n = cases.length
  const lines: string[] = []
  const vs = compile(gl, gl.VERTEX_SHADER, VERT)
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag(cases, pars))
  const program = gl.createProgram()
  const tex = gl.createTexture()
  const fb = gl.createFramebuffer()
  const vao = gl.createVertexArray()
  try {
    if (!vs || !fs || !program || !tex || !fb || !vao) return lines
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return lines
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, n, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return lines
    gl.viewport(0, 0, n, 1)
    gl.disable(gl.BLEND)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.SCISSOR_TEST)
    gl.disable(gl.CULL_FACE)
    gl.colorMask(true, true, true, true)
    gl.useProgram(program)
    gl.uniform1f(gl.getUniformLocation(program, 'uZero'), 0)
    gl.uniform1f(gl.getUniformLocation(program, 'uOne'), 1)
    gl.uniform1f(gl.getUniformLocation(program, 'uTwo'), 2)
    gl.uniform1ui(gl.getUniformLocation(program, 'uNan'), 0x7fc00000)
    gl.uniform1ui(gl.getUniformLocation(program, 'uInf'), 0x7f800000)
    gl.bindVertexArray(vao)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    const px = new Uint8Array(n * 4)
    gl.readPixels(0, 0, n, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    for (let i = 0; i < n; i++) {
      const kind = Math.round(px[i * 4]! / 85)
      const value = ((px[i * 4 + 1]! + px[i * 4 + 2]! / 255) / 255) * 16 - 8
      lines.push(`${cases[i]![0]} ${kind === 2 ? value.toFixed(2) : KINDS[kind]}`)
    }
    return lines
  } finally {
    gl.bindVertexArray(null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindTexture(gl.TEXTURE_2D, null)
    gl.useProgram(null)
    gl.deleteVertexArray(vao)
    gl.deleteFramebuffer(fb)
    gl.deleteTexture(tex)
    gl.deleteProgram(program)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    gfx.renderer.resetState()
  }
}

/** Bright in every channel: the glass's own ceiling after the grade, which no picture of the miniature reaches everywhere. */
const SHEET_FROM = 225
const SHEET_SHARE = 0.97

/**
 * Reads the picture just drawn along one row and one column through the middle of the globe. A globe that is a flat
 * bright sheet from side to side is the fault where the glass's shader gave no number; a picture is not.
 * `cx`, `cy` and `r` are the globe's disc in the picture's own pixels, the row counted from the top.
 */
export function glassReport(gfx: Gfx, disc: { cx: number; cy: number; r: number }): string {
  const gl = gfx.gl
  const width = gl.drawingBufferWidth
  const height = gl.drawingBufferHeight
  const reach = Math.max(2, Math.floor(disc.r * 0.6))
  const x0 = Math.max(0, Math.round(disc.cx) - reach)
  const x1 = Math.min(width - 1, Math.round(disc.cx) + reach)
  const row = Math.min(height - 1, Math.max(0, height - 1 - Math.round(disc.cy)))
  const y0 = Math.max(0, row - reach)
  const y1 = Math.min(height - 1, row + reach)
  const col = Math.min(width - 1, Math.max(0, Math.round(disc.cx)))
  if (x1 <= x0 || y1 <= y0) return ''
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  const across = new Uint8Array((x1 - x0 + 1) * 4)
  const down = new Uint8Array((y1 - y0 + 1) * 4)
  gl.readPixels(x0, row, x1 - x0 + 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, across)
  gl.readPixels(col, y0, 1, y1 - y0 + 1, gl.RGBA, gl.UNSIGNED_BYTE, down)
  gfx.renderer.resetState()
  let count = 0
  let bright = 0
  const sum = [0, 0, 0]
  for (const px of [across, down]) {
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i]!
      const g = px[i + 1]!
      const b = px[i + 2]!
      sum[0] += r
      sum[1] += g
      sum[2] += b
      if (Math.min(r, g, b) >= SHEET_FROM) bright++
      count++
    }
  }
  const mean = sum.map((v) => Math.round(v / count)).join(', ')
  const share = bright / count
  return `${share >= SHEET_SHARE ? 'flat sheet' : 'picture'} (mean ${mean}; ${Math.round(share * 100)}% at the ceiling)`
}
