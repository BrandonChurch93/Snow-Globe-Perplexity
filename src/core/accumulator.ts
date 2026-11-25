import * as THREE from 'three'
import type { Gfx } from './gl'
import { Pass } from './fullscreen'
import type { Sample } from './sampler'

const MEAN = `uniform sampler2D uMean;
uniform sampler2D uSample;
uniform float uWeight;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uSample, p, 0);
  if (uWeight >= 1.0) { o = s; return; }
  vec4 m = texelFetch(uMean, p, 0);
  o = m + (s - m) * uWeight;
}`

/**
 * The lens fill. A picture is the mean of `count` pinhole pictures, each from its own lens point,
 * so an edge whose blur circle has a radius of s px is drawn `count` times, up to 0.29 s apart,
 * and far out of focus the copies read as steps. The stage draws, once a picture, the blur radius
 * of the front surface at every pixel (`map`); the mean is then blurred once with a radius of
 * about one lens cell, s over the root of the count. Nothing with s under `startPx[0]` is touched:
 * those pixels are copied bit for bit. The flakes afloat and the backdrop's discs are sprites
 * with their own blur and are never drawn as copies, so they are left out of the map and the
 * stage draws them alone (`guide`: the discs as they are, the flakes' cover, which is also its
 * alpha). The blur does not mix pixels whose guide differs, so a flake and a disc keep their
 * edges whatever stands before or behind them, and it stops where a flake hides the ground.
 * A pixel that is not a number is never mixed into its neighbours.
 * Only pictures of `fromSamples` samples or more are filled, and only where a half float target
 * can be drawn into.
 */
export const LENS_FILL = {
  fromSamples: 12,
  rangePx: 96,
  startPx: [4, 12],
  cells: 1.75,
  maxShare: 0.6,
  reach: 1.3,
  tilePx: 16,
  taps: 48,
  guideStep: [0.15, 0.4],
  guideFloor: 0.02,
  flakeKeep: [0.6, 0.95],
  referenceHeightPx: 1080,
}

const DRAWN = `bool drawn(vec4 g) { return g.b < 0.1 || g.b > 0.9; }`

const TILES = `uniform sampler2D uMap;
uniform ivec2 uSize;
out vec4 o;
${DRAWN}
void main() {
  ivec2 t = ivec2(gl_FragCoord.xy) * ${LENS_FILL.tilePx};
  float m = 0.0;
  for (int y = 0; y < ${LENS_FILL.tilePx}; y++) for (int x = 0; x < ${LENS_FILL.tilePx}; x++) {
    vec4 g = texelFetch(uMap, min(t + ivec2(x, y), uSize - 1), 0);
    if (drawn(g)) m = max(m, g.g);
  }
  o = vec4(m, 0.0, 0.0, 1.0);
}`

const REACH = `uniform sampler2D uTiles;
uniform ivec2 uTileSize;
uniform float uRange;
uniform int uSpan;
out vec4 o;
void main() {
  ivec2 t = ivec2(gl_FragCoord.xy);
  float s = 0.0;
  for (int y = -uSpan; y <= uSpan; y++) for (int x = -uSpan; x <= uSpan; x++) {
    ivec2 q = t + ivec2(x, y);
    if (q.x < 0 || q.y < 0 || q.x >= uTileSize.x || q.y >= uTileSize.y) continue;
    float m = texelFetch(uTiles, q, 0).r * uRange;
    float gap = length(vec2(max(abs(x) - 1, 0), max(abs(y) - 1, 0))) * ${LENS_FILL.tilePx}.0;
    s = max(s, m * (1.0 - smoothstep(${LENS_FILL.reach.toFixed(2)} * m, ${LENS_FILL.reach.toFixed(2)} * m + ${LENS_FILL.tilePx}.0, gap)));
  }
  o = vec4(s, 0.0, 0.0, 1.0);
}`

const RADIUS = `uniform sampler2D uMap;
uniform sampler2D uGuide;
uniform sampler2D uReach;
uniform ivec2 uSize;
uniform vec2 uInv;
uniform float uRange;
uniform vec3 uShare;
out vec4 o;
${DRAWN}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  float least = 2.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec4 g = texelFetch(uMap, clamp(p + ivec2(x, y), ivec2(0), uSize - 1), 0);
    if (drawn(g)) least = min(least, g.g);
  }
  float s = least <= 1.0 ? least * uRange : texture(uReach, gl_FragCoord.xy * uInv).r;
  float open = 1.0 - smoothstep(${LENS_FILL.flakeKeep[0]!.toFixed(3)}, ${LENS_FILL.flakeKeep[1]!.toFixed(3)}, texelFetch(uGuide, p, 0).a);
  o = vec4(uShare.x * s * smoothstep(uShare.y, uShare.z, s) * open, 0.0, 0.0, 1.0);
}`

const FILL = `uniform sampler2D uMean;
uniform sampler2D uRadius;
uniform sampler2D uGuide;
uniform ivec2 uSize;
uniform vec2 uTaps[${LENS_FILL.taps}];
out vec4 o;
float guide(ivec2 q) {
  vec3 g = texelFetch(uGuide, q, 0).rgb;
  return max(g.r, max(g.g, g.b));
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c = texelFetch(uMean, p, 0);
  float r = texelFetch(uRadius, p, 0).r;
  if (!(r >= 0.75)) { o = c; return; }
  float own = guide(p);
  vec4 sum = c;
  float n = 1.0;
  for (int i = 0; i < ${LENS_FILL.taps}; i++) {
    ivec2 d = ivec2(floor(r * uTaps[i] + 0.5));
    ivec2 q = p + d;
    if (q.x < 0 || q.y < 0 || q.x >= uSize.x || q.y >= uSize.y) continue;
    float w = clamp(texelFetch(uRadius, q, 0).r - length(vec2(d)) + 1.0, 0.0, 1.0);
    float other = guide(q);
    w *= 1.0 - smoothstep(${LENS_FILL.guideStep[0]!.toFixed(3)}, ${LENS_FILL.guideStep[1]!.toFixed(3)}, abs(other - own) / (max(other, own) + ${LENS_FILL.guideFloor.toFixed(3)}));
    vec4 m = texelFetch(uMean, q, 0);
    if (!(w > 0.0) || any(isnan(m)) || any(isinf(m))) continue;
    sum += m * w;
    n += w;
  }
  o = sum / n;
}`

const fills = new WeakMap<THREE.WebGLRenderTarget, LensFill>()

/** The lens fill of the accumulator that owns this sample target, if it has one. */
export const lensFillOf = (sample: THREE.WebGLRenderTarget): LensFill | undefined => fills.get(sample)

export class LensFill {
  /** Set by the stage when it has drawn `map` for the picture in hand. */
  drawn = false
  /** The blur radius that the map's green channel reads as 1, in px. */
  readonly rangePx: number
  /** The blur radius under which nothing is filled, in px. */
  readonly startPx: number
  private targets: { map: THREE.WebGLRenderTarget; guide: THREE.WebGLRenderTarget; tiles: THREE.WebGLRenderTarget; reach: THREE.WebGLRenderTarget; radius: THREE.WebGLRenderTarget } | null = null
  private passes: { tiles: Pass; reach: Pass; radius: Pass; fill: Pass } | null = null
  private readonly scale: number

  constructor(private readonly gfx: Gfx, private readonly width: number, private readonly height: number) {
    this.scale = height / LENS_FILL.referenceHeightPx
    this.rangePx = LENS_FILL.rangePx * this.scale
    this.startPx = LENS_FILL.startPx[0]! * this.scale
  }

  /** True for the one sample of a picture after which the stage draws the map: the lens point nearest the centre. */
  wants(sample: Sample | null): boolean {
    return sample !== null && sample.index === 0 && (sample.of ?? 0) >= LENS_FILL.fromSamples
  }

  /** Where the stage draws the blur: green is the radius over `rangePx`, blue stays 0.5 where nothing is drawn. */
  get map(): THREE.WebGLRenderTarget {
    return this.make().map
  }

  /** Where the stage draws the backdrop's discs and the cover of the flakes afloat, alone, on clear black and with no depth. */
  get guide(): THREE.WebGLRenderTarget {
    return this.make().guide
  }

  private make() {
    if (this.targets) return this.targets
    const { width, height } = this
    const tw = Math.ceil(width / LENS_FILL.tilePx)
    const th = Math.ceil(height / LENS_FILL.tilePx)
    const mk = (w: number, h: number, depth: boolean, filter: THREE.MagnificationTextureFilter) =>
      new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: filter,
        magFilter: filter,
        depthBuffer: depth,
        stencilBuffer: false,
        generateMipmaps: false,
      })
    this.targets = {
      map: mk(width, height, true, THREE.NearestFilter),
      guide: mk(width, height, false, THREE.NearestFilter),
      tiles: mk(tw, th, false, THREE.NearestFilter),
      reach: mk(tw, th, false, THREE.LinearFilter),
      radius: mk(width, height, false, THREE.NearestFilter),
    }
    const size = new THREE.Vector2(width, height)
    const taps: THREE.Vector2[] = []
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < LENS_FILL.taps; i++) {
      const rho = Math.sqrt(1 - Math.cbrt(1 - (i + 0.5) / LENS_FILL.taps))
      taps.push(new THREE.Vector2(rho * Math.cos(i * golden), rho * Math.sin(i * golden)))
    }
    const t = this.targets
    this.passes = {
      tiles: new Pass(TILES, { uMap: { value: t.map.texture }, uSize: { value: size } }),
      reach: new Pass(REACH, {
        uTiles: { value: t.tiles.texture },
        uTileSize: { value: new THREE.Vector2(tw, th) },
        uRange: { value: this.rangePx },
        uSpan: { value: Math.ceil((LENS_FILL.reach * this.rangePx) / LENS_FILL.tilePx) + 2 },
      }),
      radius: new Pass(RADIUS, {
        uMap: { value: t.map.texture },
        uGuide: { value: t.guide.texture },
        uReach: { value: t.reach.texture },
        uSize: { value: size },
        uInv: { value: new THREE.Vector2(1 / (tw * LENS_FILL.tilePx), 1 / (th * LENS_FILL.tilePx)) },
        uRange: { value: this.rangePx },
        uShare: { value: new THREE.Vector3() },
      }),
      fill: new Pass(FILL, { uMean: { value: null }, uRadius: { value: t.radius.texture }, uGuide: { value: t.guide.texture }, uSize: { value: size }, uTaps: { value: taps } }),
    }
    return this.targets
  }

  /** Blurs the mean of `count` samples into `to`; pixels in focus are copied. */
  run(mean: THREE.Texture, to: THREE.WebGLRenderTarget, count: number): void {
    const t = this.make()
    const p = this.passes!
    const { renderer } = this.gfx
    const share = Math.min(LENS_FILL.maxShare, LENS_FILL.cells / Math.sqrt(count))
    ;(p.radius.material.uniforms.uShare!.value as THREE.Vector3).set(share, LENS_FILL.startPx[0]! * this.scale, LENS_FILL.startPx[1]! * this.scale)
    p.fill.material.uniforms.uMean!.value = mean
    p.tiles.render(renderer, t.tiles)
    p.reach.render(renderer, t.reach)
    p.radius.render(renderer, t.radius)
    p.fill.render(renderer, to)
  }

  dispose(): void {
    if (this.targets) for (const t of Object.values(this.targets)) t.dispose()
    if (this.passes) for (const p of Object.values(this.passes)) p.dispose()
    this.targets = null
    this.passes = null
  }
}

/** How many samples a pixel of the live picture gets: `LIVE_SAMPLES`, or as many as the device reports, or none. */
export const LIVE_SAMPLES = 4

export function liveSamples(maxSamples: number): number {
  const n = Math.min(LIVE_SAMPLES, Math.floor(Number.isFinite(maxSamples) ? maxSamples : 0))
  return n >= 2 ? n : 0
}

const resolves = new Map<string, THREE.WebGLRenderTarget>()

/**
 * The frame as it stands in a multisampled target, resolved into a texture a shell can look through: what
 * `copyFramebufferToTexture` gives for a target without samples. One texture per asker, size and type.
 */
export function resolveBehind(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget, who: string): THREE.Texture | null {
  const gl = renderer.getContext() as WebGL2RenderingContext
  const from = (renderer.properties.get(target) as { __webglMultisampledFramebuffer?: WebGLFramebuffer }).__webglMultisampledFramebuffer
  if (!from) return null
  const key = `${who} ${target.width} ${target.height} ${target.texture.type}`
  let rt = resolves.get(key)
  if (!rt) {
    if (resolves.size >= 8) {
      for (const old of resolves.values()) old.dispose()
      resolves.clear()
    }
    rt = new THREE.WebGLRenderTarget(target.width, target.height, {
      type: target.texture.type,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    })
    rt.texture.colorSpace = THREE.NoColorSpace
    resolves.set(key, rt)
  }
  type Made = { __webglFramebuffer?: WebGLFramebuffer }
  let to = (renderer.properties.get(rt) as Made).__webglFramebuffer
  if (!to) {
    // Made here, in the middle of a frame, the first time and again after a lost context.
    renderer.initRenderTarget(rt)
    to = (renderer.properties.get(rt) as Made).__webglFramebuffer
  }
  if (!to) return null
  // three.js keeps a note of the framebuffers that are bound and skips a bind it believes is in place; making a target
  // (above) rebinds without correcting the note for reading. So the bindings and the note are first brought to one known
  // state, and every bind from there goes through the note: the blit then reads the multisampled frame whatever came before,
  // and three.js goes on drawing into it.
  const state = renderer.state
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  state.bindFramebuffer(gl.FRAMEBUFFER, null)
  state.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
  state.bindFramebuffer(gl.READ_FRAMEBUFFER, from)
  state.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to)
  const scissor = gl.isEnabled(gl.SCISSOR_TEST)
  if (scissor) gl.disable(gl.SCISSOR_TEST)
  gl.blitFramebuffer(0, 0, target.width, target.height, 0, 0, target.width, target.height, gl.COLOR_BUFFER_BIT, gl.NEAREST)
  if (scissor) gl.enable(gl.SCISSOR_TEST)
  state.bindFramebuffer(gl.FRAMEBUFFER, from)
  return rt.texture
}

export class Accumulator {
  readonly sample: THREE.WebGLRenderTarget
  private readonly mean: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]
  private readonly pass: Pass
  private flip = 0
  count = 0
  readonly precision: 'float32' | 'half' | 'byte'
  private readonly fill: LensFill | null
  private filled = false

  constructor(private readonly gfx: Gfx, width: number, height: number, msaa = 0) {
    const { caps } = gfx
    this.precision = caps.float32 ? 'float32' : caps.half ? 'half' : 'byte'
    const sampleType = caps.half ? THREE.HalfFloatType : THREE.UnsignedByteType
    const meanType = caps.float32 ? THREE.FloatType : sampleType
    this.sample = new THREE.WebGLRenderTarget(width, height, {
      type: sampleType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      samples: msaa,
      generateMipmaps: false,
    })
    const mk = () =>
      new THREE.WebGLRenderTarget(width, height, {
        type: meanType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      })
    this.mean = [mk(), mk()]
    this.pass = new Pass(MEAN, { uMean: { value: null }, uSample: { value: null }, uWeight: { value: 1 } })
    this.fill = caps.half ? new LensFill(gfx, width, height) : null
    if (this.fill) fills.set(this.sample, this.fill)
  }

  get width(): number {
    return this.sample.width
  }
  get height(): number {
    return this.sample.height
  }

  begin(): void {
    this.count = 0
    this.filled = false
    if (this.fill) this.fill.drawn = false
  }

  add(): void {
    const from = this.mean[this.flip]
    const to = this.mean[1 - this.flip]
    const u = this.pass.material.uniforms
    u.uMean.value = from.texture
    u.uSample.value = this.sample.texture
    u.uWeight.value = 1 / (this.count + 1)
    this.pass.render(this.gfx.renderer, to)
    this.flip = 1 - this.flip
    this.count++
    this.filled = false
  }

  /** The mean of the samples so far, with the lens fill where the stage drew its map for this picture. */
  get result(): THREE.Texture {
    const fill = this.fill
    if (!fill || !fill.drawn || this.count < LENS_FILL.fromSamples) return this.mean[this.flip].texture
    const to = this.mean[1 - this.flip]
    if (!this.filled) {
      fill.run(this.mean[this.flip].texture, to, this.count)
      this.filled = true
    }
    return to.texture
  }

  invalid(): { invalid: number; pixels: number } {
    const t = this.mean[this.flip]
    const w = t.width
    const h = t.height
    let invalid = 0
    if (this.precision === 'byte') return { invalid, pixels: w * h }
    const rows = 64
    const half = this.precision === 'half'
    const buf = half ? new Uint16Array(w * rows * 4) : new Float32Array(w * rows * 4)
    for (let y = 0; y < h; y += rows) {
      const n = Math.min(rows, h - y)
      this.gfx.renderer.readRenderTargetPixels(t, 0, y, w, n, buf)
      const len = w * n * 4
      if (half) {
        for (let i = 0; i < len; i++) if ((buf[i]! & 0x7c00) === 0x7c00) invalid++
      } else {
        for (let i = 0; i < len; i++) if (!Number.isFinite(buf[i]!)) invalid++
      }
    }
    return { invalid, pixels: w * h }
  }

  dispose(): void {
    this.sample.dispose()
    this.mean[0].dispose()
    this.mean[1].dispose()
    this.pass.dispose()
    this.fill?.dispose()
  }
}
