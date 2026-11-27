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
 * What the spread of one sample needs: the camera of the sample's moment without its place in the pixel or on the lens,
 * the ball there, and the ball and the camera half a sample spacing before and after.
 */
export interface Spread {
  /** Clip space of the sample's moment to the world. */
  toWorld: THREE.Matrix4
  /** The world to the ball's own space at the sample's moment. */
  toBall: THREE.Matrix4
  /** The ball's own space to clip space half a spacing before, and half a spacing after. */
  before: THREE.Matrix4
  after: THREE.Matrix4
  /** The ball in mm of its own space: the sphere's centre height and radius; the base's radius, foot and top. */
  ball: { sphere: [number, number]; base: [number, number, number] }
  /** The share of the full reach, 0 to 1: the taps lie this share of a spacing apart. */
  reach: number
}

/**
 * The reach of the spread in sample spacings and its weights: a tent over three spacings to either side. A streak is
 * the sum of copies one spacing apart, and a small bright thing is met by three or four of them, so its copies beat
 * against the pixels with a period of two or three pixels; a tent this wide lets nothing of that period through.
 */
export const SPREAD = { weights: [1, 2, 3, 4, 3, 2, 1], sphereMarginMm: 0.75, baseMarginMm: 4, baseBelowMm: 0.5, baseAboveMm: 1.5 }

/**
 * One sample of a frame in which the ball travels, spread along the ball's own motion on the picture before it is
 * added. A pixel whose ray meets the ball (the sphere of the glass) or the base (an upright cylinder) is read as the
 * mean of the sample along the path that point of the ball takes on the picture in the spacings around the sample's
 * moment: the point is where the ray is nearest the sphere's centre, or where it enters the base. Every other pixel,
 * the table, the backdrop and the table's image of the ball, is copied bit for bit. A value that is not a number is
 * never mixed into its neighbours.
 */
const SPREAD_PASS = (sphere: [number, number], base: [number, number, number]) => `uniform sampler2D uSample;
uniform mat4 uToWorld;
uniform mat4 uToBall;
uniform mat4 uBefore;
uniform mat4 uAfter;
uniform vec2 uSize;
uniform float uReach;
out vec4 o;
const float W[${SPREAD.weights.length}] = float[${SPREAD.weights.length}](${SPREAD.weights.map((w) => w.toFixed(1)).join(', ')});
bool meets(vec3 from, vec3 dir, out vec3 at) {
  vec3 c = from - vec3(0.0, ${sphere[0].toFixed(3)}, 0.0);
  float b = dot(c, dir);
  float disc = b * b - dot(c, c) + ${(sphere[1] * sphere[1]).toFixed(3)};
  bool ball = disc >= 0.0 && -b > 0.0;
  float ballIn = -b - sqrt(max(disc, 0.0));
  float a = dot(dir.xz, dir.xz);
  float h = dot(from.xz, dir.xz);
  float d2 = h * h - a * (dot(from.xz, from.xz) - ${(base[0] * base[0]).toFixed(3)});
  bool foot = false;
  float footIn = 0.0;
  if (a > 1e-12 && d2 >= 0.0 && abs(dir.y) > 1e-9) {
    float r = sqrt(d2);
    float y0 = (${base[1].toFixed(3)} - from.y) / dir.y;
    float y1 = (${base[2].toFixed(3)} - from.y) / dir.y;
    footIn = max((-h - r) / a, min(y0, y1));
    float footOut = min((-h + r) / a, max(y0, y1));
    foot = footIn <= footOut && footIn > 0.0;
  }
  if (foot && (!ball || footIn < ballIn)) { at = from + dir * footIn; return true; }
  if (ball) { at = from - dir * b; return true; }
  return false;
}
bool sound(vec4 v) { return !(any(isnan(v)) || any(isinf(v))); }
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 own = texelFetch(uSample, p, 0);
  o = own;
  vec2 ndc = gl_FragCoord.xy / uSize * 2.0 - 1.0;
  vec4 n0 = uToWorld * vec4(ndc, -1.0, 1.0);
  vec4 n1 = uToWorld * vec4(ndc, 1.0, 1.0);
  vec3 from = (uToBall * vec4(n0.xyz / n0.w, 1.0)).xyz;
  vec3 to = (uToBall * vec4(n1.xyz / n1.w, 1.0)).xyz;
  vec3 at;
  if (!meets(from, normalize(to - from), at) || !sound(own)) return;
  vec4 a = uBefore * vec4(at, 1.0);
  vec4 b = uAfter * vec4(at, 1.0);
  if (!(a.w > 0.0 && b.w > 0.0)) return;
  vec2 hop = (b.xy / b.w - a.xy / a.w) * 0.5 * uSize * uReach;
  if (!(dot(hop, hop) > 1e-8)) return;
  vec4 sum = vec4(0.0);
  float n = 0.0;
  for (int i = 0; i < ${SPREAD.weights.length}; i++) {
    vec4 v = i == ${(SPREAD.weights.length - 1) / 2} ? own : texture(uSample, (gl_FragCoord.xy - float(i - ${(SPREAD.weights.length - 1) / 2}) * hop) / uSize);
    if (!sound(v)) continue;
    sum += v * W[i];
    n += W[i];
  }
  o = sum / n;
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

export type OddKind = 'plus infinite' | 'minus infinite' | 'no number'

/** A value that is not finite: its pixel from the top left, its channel and what it is. */
export interface OddPlace {
  x: number
  y: number
  channel: 'red' | 'green' | 'blue' | 'alpha'
  kind: OddKind
}

export interface Sanity {
  invalid: number
  pixels: number
  first: OddPlace | null
}

/** One sample as drawn: its values that are not finite, its largest finite colour value, and the watched pixel in it and in the sample before. */
export interface SampleFacts {
  invalid: number
  first: OddPlace | null
  peak: number
  peakAt: { x: number; y: number } | null
  at: number[] | null
  before: number[] | null
}

const CHANNELS = ['red', 'green', 'blue', 'alpha'] as const

const halfKind = (v: number): OddKind => ((v & 0x3ff) !== 0 ? 'no number' : (v & 0x8000) !== 0 ? 'minus infinite' : 'plus infinite')
const floatKind = (v: number): OddKind => (Number.isNaN(v) ? 'no number' : v < 0 ? 'minus infinite' : 'plus infinite')

/** The number a half float's 16 bits stand for. */
export function halfValue(v: number): number {
  const sign = (v & 0x8000) !== 0 ? -1 : 1
  const e = (v >> 10) & 31
  const m = v & 0x3ff
  if (e === 31) return m !== 0 ? NaN : sign * Infinity
  return sign * (e === 0 ? m * 2 ** -24 : (1 + m / 1024) * 2 ** (e - 15))
}

/** `i` counts values from the bottom row, as a target is read. */
const placeOf = (i: number, w: number, h: number, kind: OddKind): OddPlace => ({ x: (i >> 2) % w, y: h - 1 - Math.floor((i >> 2) / w), channel: CHANNELS[i & 3]!, kind })

export class Accumulator {
  readonly sample: THREE.WebGLRenderTarget
  private readonly mean: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]
  private readonly pass: Pass
  private flip = 0
  count = 0
  readonly precision: 'float32' | 'half' | 'byte'
  private readonly fill: LensFill | null
  private filled = false
  /** Set to have every sample read as it is drawn: `at` is the pixel whose values are kept, from the top left; without one it is the first place that is not finite. */
  watch: { at: { x: number; y: number } | null; keep: boolean } | null = null
  samples: SampleFacts[] = []
  private spare: Uint16Array | null = null
  private heldBefore: Uint16Array | null = null
  private spread: { target: THREE.WebGLRenderTarget; pass: Pass } | null = null

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
    this.samples = []
    this.spare ??= this.heldBefore
    this.heldBefore = null
    if (this.watch && !this.watch.keep) this.watch.at = null
    if (this.fill) this.fill.drawn = false
  }

  /** Adds the sample in hand to the mean; with `spread`, as it reads spread along the ball's motion (see `SPREAD_PASS`). */
  add(spread: Spread | null = null): void {
    if (this.watch) this.samples.push(this.look())
    const from = this.mean[this.flip]
    const to = this.mean[1 - this.flip]
    const u = this.pass.material.uniforms
    u.uMean.value = from.texture
    u.uSample.value = spread && spread.reach > 0 && this.precision !== 'byte' ? this.spreadOut(spread) : this.sample.texture
    u.uWeight.value = 1 / (this.count + 1)
    this.pass.render(this.gfx.renderer, to)
    this.flip = 1 - this.flip
    this.count++
    this.filled = false
  }

  private spreadOut(by: Spread): THREE.Texture {
    const { width, height } = this
    if (!this.spread) {
      const target = new THREE.WebGLRenderTarget(width, height, {
        type: this.sample.texture.type,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        stencilBuffer: false,
        generateMipmaps: false,
      })
      const pass = new Pass(SPREAD_PASS(by.ball.sphere, by.ball.base), {
        uSample: { value: this.sample.texture },
        uToWorld: { value: new THREE.Matrix4() },
        uToBall: { value: new THREE.Matrix4() },
        uBefore: { value: new THREE.Matrix4() },
        uAfter: { value: new THREE.Matrix4() },
        uSize: { value: new THREE.Vector2(width, height) },
        uReach: { value: 1 },
      })
      this.spread = { target, pass }
    }
    const u = this.spread.pass.material.uniforms
    ;(u.uToWorld!.value as THREE.Matrix4).copy(by.toWorld)
    ;(u.uToBall!.value as THREE.Matrix4).copy(by.toBall)
    ;(u.uBefore!.value as THREE.Matrix4).copy(by.before)
    ;(u.uAfter!.value as THREE.Matrix4).copy(by.after)
    u.uReach!.value = by.reach
    this.spread.pass.render(this.gfx.renderer, this.spread.target)
    return this.spread.target.texture
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

  /** Every sample of the picture in hand as it was drawn, when `watch` is on: what `sanity` cannot tell from the mean. */
  private look(): SampleFacts {
    const t = this.sample
    const w = t.width
    const h = t.height
    const facts: SampleFacts = { invalid: 0, first: null, peak: 0, peakAt: null, at: null, before: null }
    if (this.precision === 'byte' || t.samples > 0) return facts
    const len = w * h * 4
    const buf = this.spare && this.spare.length === len ? this.spare : new Uint16Array(len)
    this.gfx.renderer.readRenderTargetPixels(t, 0, 0, w, h, buf)
    let peak = 0
    let peakI = -1
    for (let i = 0; i < len; i++) {
      const v = buf[i]!
      if ((v & 0x7c00) === 0x7c00) {
        facts.invalid++
        if (!facts.first) facts.first = placeOf(i, w, h, halfKind(v))
      } else if ((i & 3) !== 3 && (v & 0x7fff) > peak) {
        peak = v & 0x7fff
        peakI = i
      }
    }
    facts.peak = halfValue(peak)
    if (peakI >= 0) facts.peakAt = { x: (peakI >> 2) % w, y: h - 1 - Math.floor((peakI >> 2) / w) }
    const mark = this.watch?.at ?? null
    const texel = (b: Uint16Array, x: number, y: number) => [0, 1, 2, 3].map((c) => halfValue(b[((h - 1 - y) * w + x) * 4 + c]!))
    if (mark && mark.x >= 0 && mark.x < w && mark.y >= 0 && mark.y < h) facts.at = texel(buf, mark.x, mark.y)
    else if (facts.first && this.watch && !this.watch.at) {
      this.watch.at = { x: facts.first.x, y: facts.first.y }
      facts.at = texel(buf, facts.first.x, facts.first.y)
      if (this.heldBefore) facts.before = texel(this.heldBefore, facts.first.x, facts.first.y)
    }
    this.spare = this.heldBefore
    this.heldBefore = buf
    return facts
  }

  invalid(): Sanity {
    const t = this.mean[this.flip]
    const w = t.width
    const h = t.height
    let invalid = 0
    let first: OddPlace | null = null
    if (this.precision === 'byte') return { invalid, pixels: w * h, first }
    const rows = 64
    const half = this.precision === 'half'
    const buf = half ? new Uint16Array(w * rows * 4) : new Float32Array(w * rows * 4)
    for (let y = 0; y < h; y += rows) {
      const n = Math.min(rows, h - y)
      this.gfx.renderer.readRenderTargetPixels(t, 0, y, w, n, buf)
      const len = w * n * 4
      for (let i = 0; i < len; i++) {
        const v = buf[i]!
        if (half ? (v & 0x7c00) !== 0x7c00 : Number.isFinite(v)) continue
        invalid++
        // The rows are read from the bottom up, so the first place by rows from the top is the last one met in the highest row.
        const place = placeOf(y * w * 4 + i, w, h, half ? halfKind(v) : floatKind(v))
        if (!first || place.y < first.y || (place.y === first.y && place.x < first.x)) first = place
      }
    }
    return { invalid, pixels: w * h, first }
  }

  dispose(): void {
    this.sample.dispose()
    this.mean[0].dispose()
    this.mean[1].dispose()
    this.pass.dispose()
    this.fill?.dispose()
    this.spread?.target.dispose()
    this.spread?.pass.dispose()
    this.spread = null
  }
}
