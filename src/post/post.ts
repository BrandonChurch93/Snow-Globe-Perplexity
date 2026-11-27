import * as THREE from 'three'
import type { Gfx } from '../core/gl'
import { Pass } from '../core/fullscreen'
import { config } from '../config'
import { grade, lensState } from './grade'

/** How many seats of the glass a picture's glow is laid round: the samples of a picture are gathered into this many spans of the shutter. */
export const GLOW_SEATS = 8
/** Where the glow ends down the ball, in radii of the ball about the line of the collar: it begins to go this far above the line and is gone this far below. */
const GLOW_CUT = [0.14, 0.04] as const
/** How near the picture's edge the glow begins to die, in picture heights: at the edge itself it is nothing, so no edge of the picture is a lit line. */
const GLOW_EDGE = 0.05
/** How far inside the limb of the ball the heart of the cover dies, in radii of the ball: it is a light in the glass and never lies on the room. */
const HEART_LIMB = 0.06
/** The patch at the heart that is read for how bright the storm stands there: its radius in radii of the ball, and how many places in it are read at each seat. */
const HEART_PATCH = 0.12
const HEART_TAPS = 24
/** What the level of the heart is kept as in its one pixel: a share of it, so that a target of bytes holds a storm brighter than white. */
const LEVEL_SHARE = 0.25

/** The fall of the camera's exposure under the cover of a change between two seasons, as a share of the exposure: 1 at every other time. */
export const lensFall = {
  dim: 1,
  /** How many times over the lens blooms what burns in the picture: 1 but under the cover, where the heart of the glass and the highlights of its limb bloom wider (lighting.ts, `CHANGE_BLOOM.bloom`). */
  bloom: 1,
  /** The room's own tone, laid back under the fallen exposure over the whole picture. */
  room: new THREE.Color(0, 0, 0),
  /**
   * Where the glass was in the picture at each sample drawn into it: the middle of the ball (x and y from the lower left,
   * 0 to 1), its radius in picture heights, and how many samples the seat stands for (the first three are sums over those).
   * The stage fills it (stage.ts); the glow of the cover is laid round every seat, so it moves and smears with the glass.
   */
  seats: Array.from({ length: GLOW_SEATS }, () => new THREE.Vector4(0, 0, 0, 0)),
  /** With each seat, the way from the middle of the ball to the middle of the collar in the picture (picture heights, a sum as well): below there the base hides the ball, and the glow has no limb to lie on. */
  downs: Array.from({ length: GLOW_SEATS }, () => new THREE.Vector2(0, 0)),
  /** How far the glow of the cover reaches out of the limb of the ball and how far into it, in radii of the ball. */
  reach: new THREE.Vector2(1, 1),
  /** The white the lens adds at the very heart of the storm under the cover, on the square of the light's bell (`bell`): nothing dark stands in the middle of it. */
  heart: new THREE.Color(0, 0, 0),
  /**
   * Where the heart sits and how the lens takes the storm in the ball: how far down the ball's axis from its middle the
   * heart is (radii of the ball), the reach of the bell the picture is laid on itself by (radii, to one part in e), the level
   * the strongest channel of the storm is brought to at the middle of the heart under the whole cover, and the most times
   * over that the picture may be laid on itself for it. That bell is wide and flat on top (`bell.x`), so the picture is laid
   * on itself by nearly the same number over the middle of the ball and by none at the limb: what falls off from the heart
   * is then the storm's own light, as the scene's flood lays it on the storm from the middle, and the storm's own strokes
   * are what burns, the bright ones to white and the dark ones still darker than what is round them. How many times over
   * is read from the picture (the mean of a patch at the heart, `HEART_PATCH`), so a thin storm and a dense one, a pale
   * season's and a deep one's, all come to the same white at the heart.
   */
  heartShape: new THREE.Vector4(0, 1, 0, 1),
  /**
   * How much of that stands: the cover, 0 to 1, as an exponent on how many times over the picture is laid on itself (as the
   * exposure falls by the cover as an exponent). A straight share gave the first frame of the rise a tenth of the whole
   * white at once and held the glass white through the tail until it fell in a few frames.
   */
  heartShare: 0,
  /**
   * The air of the storm at the heart: how many times the storm's own level there (the patch that is read) is laid on the
   * light's bell (`bell`) before the picture is laid on itself, in the storm's own colour. Where a storm is thin a thing
   * behind it stands in the heart at twice the storm's level with a hard outline, and the lens made of it a white shape
   * inside the glass. With the air under it the thing is a little more light in a ball that is full of it, and the strokes
   * still cross.
   */
  air: 0,
  /**
   * The two bells of the heart. x is the power of the way out from the heart that the first bell falls by, the one the
   * picture is laid on itself by (`heartShape.y` is its reach): 1 is a point at the middle, 2 is round on top, 3 and more is
   * flat over the middle and falls near its reach. y and z are the reach (radii of the ball, to one part in e) and the
   * power of the second, the light's bell, on which the air lies and on whose square the white lies: narrower than the
   * first and round on top, whitest at the middle and gone by the limb. One narrow bell for all three made a lamp in the
   * glass: the picture, the air and the white all fell together and the white ended a fifth of a radius out.
   */
  bell: new THREE.Vector3(1, 1, 1),
  /**
   * How the lens takes the highlights of the limb under the cover: how many times over what the picture holds on the limb of
   * the ball is added to itself, and how wide the limb is to either side of the ball's line, in radii of the ball. What is
   * bright there (the key on the glass, the frost, a streak that crosses the limb) blooms to white; what is dark stays dark.
   */
  limb: new THREE.Vector2(0, 1),
}

/** Empties the seats of the glass: the stage calls it before the first sample of a picture. */
export function clearSeats(): void {
  for (const s of lensFall.seats) s.set(0, 0, 0, 0)
  for (const d of lensFall.downs) d.set(0, 0)
}

/** One more sample of the picture: where the glass is in it and how large. `span` is the sample's place in the shutter, 0 to 1. */
export function addSeat(span: number, x: number, y: number, radius: number, downX: number, downY: number): void {
  const i = Math.min(GLOW_SEATS - 1, Math.max(0, Math.floor(span * GLOW_SEATS)))
  const s = lensFall.seats[i]!
  s.set(s.x + x, s.y + y, s.z + radius, s.w + 1)
  const d = lensFall.downs[i]!
  d.set(d.x + downX, d.y + downY)
}

const REFERENCE_ROWS = 1080
const TRIANGLE_STD = Math.sqrt(6)
const MIN_WEIGHT = 1e-4

const BRIGHT = `uniform sampler2D uMean;
uniform float uExposure;
uniform int uDown;
uniform ivec2 uSize;
uniform vec3 uGlow;
out vec4 o;
void main() {
  ivec2 base = ivec2(gl_FragCoord.xy) * uDown;
  vec3 sum = vec3(0.0);
  for (int y = 0; y < uDown; y++) {
    for (int x = 0; x < uDown; x++) {
      vec3 c = max(texelFetch(uMean, min(base + ivec2(x, y), uSize - 1), 0).rgb, 0.0) * uExposure;
      float peak = max(c.r, max(c.g, c.b));
      if (!(peak < 1e6)) continue;
      float knee = clamp(peak - uGlow.x + uGlow.y, 0.0, 2.0 * uGlow.y);
      float over = max(knee * knee / (4.0 * uGlow.y + 1e-5), peak - uGlow.x);
      sum += min(c, uGlow.z) * over / max(peak, 1e-5);
    }
  }
  o = vec4(sum / float(uDown * uDown), 1.0);
}`

const DOWN = `uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform vec2 uInv;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * uInv;
  vec3 sum = texture(uSrc, uv).rgb * 4.0;
  sum += texture(uSrc, uv + uTexel).rgb;
  sum += texture(uSrc, uv - uTexel).rgb;
  sum += texture(uSrc, uv + vec2(uTexel.x, -uTexel.y)).rgb;
  sum += texture(uSrc, uv + vec2(-uTexel.x, uTexel.y)).rgb;
  o = vec4(sum / 8.0, 1.0);
}`

const UP = `uniform sampler2D uSrc;
uniform vec2 uTexel;
uniform vec2 uInv;
uniform float uWeight;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy * uInv;
  vec2 h = uTexel * 0.5;
  vec3 sum = texture(uSrc, uv + vec2(-2.0 * h.x, 0.0)).rgb;
  sum += texture(uSrc, uv + vec2(2.0 * h.x, 0.0)).rgb;
  sum += texture(uSrc, uv + vec2(0.0, -2.0 * h.y)).rgb;
  sum += texture(uSrc, uv + vec2(0.0, 2.0 * h.y)).rgb;
  sum += texture(uSrc, uv + h).rgb * 2.0;
  sum += texture(uSrc, uv - h).rgb * 2.0;
  sum += texture(uSrc, uv + vec2(h.x, -h.y)).rgb * 2.0;
  sum += texture(uSrc, uv + vec2(-h.x, h.y)).rgb * 2.0;
  o = vec4(sum * (uWeight / 12.0), 1.0);
}`

const LEVEL = `uniform sampler2D uMean;
uniform float uExposure;
uniform vec2 uInv;
uniform vec4 uSeat[${GLOW_SEATS}];
uniform vec2 uSeatDown[${GLOW_SEATS}];
uniform float uHeartAt;
out vec4 o;
void main() {
  // The mean of the picture over a patch at the heart of the ball, at every seat of the glass: one pixel, read by the resolve.
  vec2 wide = vec2(uInv.y / uInv.x, 1.0);
  ivec2 hi = textureSize(uMean, 0) - 1;
  vec3 sum = vec3(0.0);
  float all = 0.0;
  for (int i = 0; i < ${GLOW_SEATS}; i++) {
    vec4 s = uSeat[i];
    if (!(s.w > 0.0)) continue;
    vec2 down = uSeatDown[i];
    vec2 mid = down * (uHeartAt / max(length(down), 1e-5));
    for (int k = 0; k < ${HEART_TAPS}; k++) {
      float turn = float(k) * 2.39996323;
      vec2 rel = mid + sqrt((float(k) + 0.5) / ${HEART_TAPS.toFixed(1)}) * ${HEART_PATCH.toFixed(3)} * vec2(cos(turn), sin(turn));
      vec3 c = max(texelFetch(uMean, clamp(ivec2((s.xy + rel * s.z / wide) / uInv), ivec2(0), hi), 0).rgb, 0.0);
      if (!(max(c.r, max(c.g, c.b)) < 1e6)) continue;
      sum += s.w * c;
      all += s.w;
    }
  }
  o = vec4(sum * (uExposure * ${LEVEL_SHARE.toFixed(2)} / max(all, 1e-5)), 1.0);
}`

const RESOLVE = `uniform sampler2D uMean;
uniform sampler2D uGlow;
uniform float uExposure;
uniform float uSeed;
uniform int uRaw;
uniform vec2 uInv;
uniform vec2 uGlowTexel;
uniform vec3 uGlowGain;
uniform vec3 uGlare;
uniform vec4 uSeat[${GLOW_SEATS}];
uniform vec2 uSeatDown[${GLOW_SEATS}];
uniform vec2 uReach;
uniform vec3 uHeart;
uniform vec4 uHeartShape;
uniform float uHeartShare;
uniform float uHeartAir;
uniform vec3 uHeartBell;
uniform sampler2D uLevel;
uniform vec2 uLimb;
uniform vec3 uRoom;
uniform vec4 uCurve;
uniform float uCurveBlack;
uniform vec4 uHold;
uniform float uHoldEnd;
uniform vec3 uLift;
uniform vec3 uGamma;
uniform vec3 uGain;
uniform float uSat;
uniform vec4 uShadow;
uniform vec4 uGrain;
uniform vec3 uGrainShape;
uniform vec4 uLens;
out vec4 o;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 curve(vec3 x) {
  x = max(x, 0.0);
  return clamp((x * (uCurve.x * x + uCurve.y)) / (x * (uCurve.z * x + uCurve.w) + uCurveBlack), 0.0, 1.0);
}
vec3 film(vec3 x) {
  x = max(x, 0.0);
  vec3 each = curve(x);
  float top = max(x.r, max(x.g, x.b));
  vec3 held = x * (curve(vec3(top)).r / max(top, 1e-5));
  float hold = uHold.x * smoothstep(uHold.y, uHold.z, top) * (1.0 - smoothstep(uHold.w, uHoldEnd, top));
  return mix(each, held, hold);
}
vec3 encode(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}
vec3 hash3(vec2 p, float s) {
  uvec3 v = uvec3(uint(p.x), uint(p.y), uint(s * 65536.0));
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return vec3(v >> 8u) / 16777216.0;
}
float speck(vec2 cell, float s) {
  vec3 h = hash3(cell, s);
  return h.x + h.y - 1.0;
}
float grain(vec2 at, float pitch, float s) {
  vec2 g = (at - 0.5) / pitch;
  vec2 i = floor(g);
  vec2 w = g - i;
  float n = mix(mix(speck(i, s), speck(i + vec2(1.0, 0.0), s), w.x), mix(speck(i + vec2(0.0, 1.0), s), speck(i + vec2(1.0, 1.0), s), w.x), w.y);
  float k = ((1.0 - w.x) * (1.0 - w.x) + w.x * w.x) * ((1.0 - w.y) * (1.0 - w.y) + w.y * w.y);
  return n / sqrt(k);
}
vec3 tap(vec2 at) {
  vec2 f = at - 0.5;
  vec2 i = floor(f);
  vec2 w = f - i;
  ivec2 a = ivec2(i);
  ivec2 hi = textureSize(uMean, 0) - 1;
  vec3 c00 = texelFetch(uMean, clamp(a, ivec2(0), hi), 0).rgb;
  vec3 c10 = texelFetch(uMean, clamp(a + ivec2(1, 0), ivec2(0), hi), 0).rgb;
  vec3 c01 = texelFetch(uMean, clamp(a + ivec2(0, 1), ivec2(0), hi), 0).rgb;
  vec3 c11 = texelFetch(uMean, clamp(a + ivec2(1, 1), ivec2(0), hi), 0).rgb;
  return mix(mix(c00, c10, w.x), mix(c01, c11, w.x), w.y);
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 c = texelFetch(uMean, p, 0).rgb;
  if (uRaw == 1) { o = vec4(clamp(c, 0.0, 1.0), 1.0); return; }
  vec2 uv = gl_FragCoord.xy * uInv;
  vec2 q = (uv - 0.5) / uInv;
  vec2 mid = 0.5 / uInv;
  float r2 = dot(q, q) / dot(mid, mid);
  vec2 shift = q / max(length(q), 1e-4) * uLens.x * pow(max(r2, 1e-12), 0.5 * uLens.y);
  c = max(vec3(tap(gl_FragCoord.xy + shift).r, c.g, tap(gl_FragCoord.xy - shift).b), 0.0) * uExposure;
  vec2 g = uGlowTexel * 0.5;
  vec3 glow = texture(uGlow, uv + g).rgb + texture(uGlow, uv - g).rgb + texture(uGlow, uv + vec2(g.x, -g.y)).rgb + texture(uGlow, uv + vec2(-g.x, g.y)).rgb;
  c += glow * 0.25 * uGlowGain;
  if (uGlare.r + uGlare.g + uGlare.b > 0.0) {
    // The glow of the lens round the glass that burns: round, laid on the limb of the ball where the ball is in this picture
    // (one seat for each span of the shutter, so it smears as the ball does), hottest on the limb itself and falling off
    // outward to nothing within a fraction of a radius, and inward as fast. Where the base hides the ball there is no limb
    // and no glow. Inside the ball the lens takes the storm itself: what the picture holds is laid on itself, by one number
    // over the middle of the ball on a bell that is flat on top and gone at the limb, and again on the limb, so the strokes
    // that are bright go to white with their colour round them and the ball is never a flat disc with a lamp in it. How
    // many times over is read from the picture at the heart (uLevel), so every season's storm comes to the same white
    // there. The air of the storm and the lens's own white lie on a second, narrower bell that is round on top. The room's
    // own tone is laid back over the whole picture.
    vec2 wide = vec2(uInv.y / uInv.x, 1.0);
    float ring = 0.0;
    float heart = 0.0;
    float light = 0.0;
    float limb = 0.0;
    for (int i = 0; i < ${GLOW_SEATS}; i++) {
      vec4 s = uSeat[i];
      vec2 rel = (uv - s.xy) * wide / max(s.z, 1e-5);
      float from = length(rel) - 1.0;
      vec2 down = uSeatDown[i];
      float seat = length(down);
      float low = dot(rel, down) / max(seat, 1e-5);
      float open = 1.0 - smoothstep(seat - ${GLOW_CUT[0].toFixed(3)}, seat + ${GLOW_CUT[1].toFixed(3)}, low);
      ring += s.w * (from > 0.0 ? exp(-from / uReach.x) : exp(-from * from / (uReach.y * uReach.y))) * open;
      limb += s.w * exp(-from * from / (uLimb.y * uLimb.y)) * open;
      float away = length(rel - down * (uHeartShape.x / max(seat, 1e-5)));
      float within = s.w * open * (1.0 - smoothstep(-${HEART_LIMB.toFixed(3)}, 0.0, from));
      heart += within * exp(-pow(max(away / uHeartShape.y, 1e-5), uHeartBell.x));
      light += within * exp(-pow(max(away / uHeartBell.y, 1e-5), uHeartBell.z));
    }
    vec2 margin = min(uv, 1.0 - uv) * wide;
    vec3 storm = texelFetch(uLevel, ivec2(0), 0).rgb * ${(1 / LEVEL_SHARE).toFixed(1)};
    float most = clamp(uHeartShape.z / max(max(storm.r, max(storm.g, storm.b)), 1e-4), 1.0, uHeartShape.w) - 1.0;
    // The air of the storm at the heart first, so what stands behind a thin storm has no hard outline in the light.
    c += storm * (uHeartAir * light);
    // By the cover as an exponent, as the exposure falls: the heart rises and dies in even stops and never in one frame.
    c *= uLimb.x * limb + pow(max(1.0 + most * heart, 1.0), uHeartShare);
    c += uGlare * (ring * smoothstep(0.0, ${GLOW_EDGE.toFixed(3)}, min(margin.x, margin.y))) + uHeart * (light * light) + uRoom;
  }
  c *= 1.0 - uLens.z * pow(max(r2, 1e-12), uLens.w);
  c = film(c);
  c = pow(max(c * uGain + uLift * (1.0 - c), 0.0), uGamma);
  float l = dot(c, LUMA);
  c = max(mix(vec3(l), c, uSat), 0.0);
  c *= mix(uShadow.rgb, vec3(1.0), smoothstep(0.0, uShadow.w, l));
  c = encode(c);
  float v = dot(c, LUMA);
  float amount = v < uGrain.w ? mix(uGrain.x, uGrain.y, smoothstep(0.0, uGrain.w, v)) : mix(uGrain.y, uGrain.z, smoothstep(uGrain.w, 1.0, v));
  float n = grain(gl_FragCoord.xy, uGrainShape.x, uSeed);
  vec3 tint = (hash3(gl_FragCoord.xy + 31.0, uSeed + 0.19) * 2.0 - 1.0) * 0.7071;
  vec3 d = hash3(gl_FragCoord.xy + 71.0, uSeed + 0.53);
  vec3 dither = (d + d.yzx - 1.0) * uGrainShape.z;
  o = vec4(clamp(c + mix(vec3(n), tint, uGrainShape.y) * amount + dither, 0.0, 1.0), 1.0);
}`

export class Post {
  private readonly pass: Pass
  private readonly bright: Pass
  private readonly down: Pass
  private readonly up: Pass
  private readonly level: Pass
  /** One pixel: how bright the storm stands at the heart of the ball in the picture in hand (`LEVEL`). */
  private readonly heart: THREE.WebGLRenderTarget
  private chain: THREE.WebGLRenderTarget[] = []
  /** The level is read in the first picture as well: its program is then linked there, under the first still, and not in the first change. */
  private levelled = false
  exposure = 1
  seed = 0
  constructor(private readonly gfx: Gfx) {
    const seats = Array.from({ length: GLOW_SEATS }, () => new THREE.Vector4(0.5, 0.5, 1, 0))
    const downs = Array.from({ length: GLOW_SEATS }, () => new THREE.Vector2(0, -1))
    this.heart = new THREE.WebGLRenderTarget(1, 1, {
      type: gfx.caps.half ? THREE.HalfFloatType : THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
      colorSpace: THREE.NoColorSpace,
    })
    this.level = new Pass(LEVEL, { uMean: { value: null }, uExposure: { value: 1 }, uInv: { value: new THREE.Vector2(1, 1) }, uSeat: { value: seats }, uSeatDown: { value: downs }, uHeartAt: { value: 0 } })
    this.pass = new Pass(RESOLVE, {
      uMean: { value: null },
      uGlow: { value: null },
      uExposure: { value: 1 },
      uSeed: { value: (config.seed % 1000) / 1000 },
      uRaw: { value: 0 },
      uInv: { value: new THREE.Vector2(1, 1) },
      uGlowTexel: { value: new THREE.Vector2(1, 1) },
      uGlowGain: { value: new THREE.Vector3() },
      uGlare: { value: new THREE.Color(0, 0, 0) },
      uSeat: { value: seats },
      uSeatDown: { value: downs },
      uReach: { value: new THREE.Vector2(1, 1) },
      uHeart: { value: new THREE.Color(0, 0, 0) },
      uHeartShape: { value: new THREE.Vector4(0, 1, 0, 1) },
      uHeartShare: { value: 0 },
      uHeartAir: { value: 0 },
      uHeartBell: { value: new THREE.Vector3(1, 1, 1) },
      uLevel: { value: this.heart.texture },
      uLimb: { value: new THREE.Vector2(0, 1) },
      uRoom: { value: new THREE.Color(0, 0, 0) },
      uCurve: { value: new THREE.Vector4() },
      uCurveBlack: { value: 1 },
      uHold: { value: new THREE.Vector4(0, 0, 1, 1) },
      uHoldEnd: { value: 2 },
      uLift: { value: new THREE.Vector3() },
      uGamma: { value: new THREE.Vector3(1, 1, 1) },
      uGain: { value: new THREE.Vector3(1, 1, 1) },
      uSat: { value: 1 },
      uShadow: { value: new THREE.Vector4(1, 1, 1, 1) },
      uGrain: { value: new THREE.Vector4() },
      uGrainShape: { value: new THREE.Vector3(1, 0, 0) },
      uLens: { value: new THREE.Vector4() },
    })
    this.bright = new Pass(BRIGHT, { uMean: { value: null }, uExposure: { value: 1 }, uDown: { value: 1 }, uSize: { value: new THREE.Vector2(1, 1) }, uGlow: { value: new THREE.Vector3() } })
    this.down = new Pass(DOWN, { uSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uInv: { value: new THREE.Vector2() } })
    this.up = new Pass(UP, { uSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uInv: { value: new THREE.Vector2() }, uWeight: { value: 1 } })
    const m = this.up.material
    m.blending = THREE.CustomBlending
    m.blendEquation = THREE.AddEquation
    m.blendSrc = THREE.OneFactor
    m.blendDst = THREE.OneFactor
    m.blendSrcAlpha = THREE.ZeroFactor
    m.blendDstAlpha = THREE.OneFactor
  }

  private targets(w: number, h: number, levels: number): THREE.WebGLRenderTarget[] {
    const first = this.chain[0]
    if (!first || first.width !== w || first.height !== h || this.chain.length !== levels + 1) {
      for (const t of this.chain) t.dispose()
      this.chain = []
      let tw = w
      let th = h
      for (let i = 0; i <= levels; i++) {
        this.chain.push(
          new THREE.WebGLRenderTarget(tw, th, {
            type: this.gfx.caps.half ? THREE.HalfFloatType : THREE.UnsignedByteType,
            format: THREE.RGBAFormat,
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            depthBuffer: false,
            stencilBuffer: false,
            generateMipmaps: false,
            colorSpace: THREE.NoColorSpace,
          }),
        )
        tw = Math.max(1, Math.ceil(tw / 2))
        th = Math.max(1, Math.ceil(th / 2))
      }
    }
    return this.chain
  }

  textureBytes(): number {
    let n = 0
    for (const t of [...this.chain, this.heart]) n += t.width * t.height * (this.gfx.caps.half ? 8 : 4)
    return n
  }

  private glow(mean: THREE.Texture, w: number, h: number, exposure: number): THREE.WebGLRenderTarget {
    const { renderer } = this.gfx
    const g = grade
    const sizes = g.glowSizes.map((v) => Math.max(v, MIN_WEIGHT))
    const down = Math.max(1, Math.round(Math.min(w, h) / g.glowRows))
    const chain = this.targets(Math.max(1, Math.ceil(w / down)), Math.max(1, Math.ceil(h / down)), sizes.length)
    const bu = this.bright.material.uniforms
    bu.uMean!.value = mean
    bu.uExposure!.value = exposure
    bu.uDown!.value = down
    ;(bu.uSize!.value as THREE.Vector2).set(w, h)
    ;(bu.uGlow!.value as THREE.Vector3).set(g.glowThreshold, Math.max(g.glowKnee, 1e-4), g.glowCeiling)
    this.bright.render(renderer, chain[0]!)
    const du = this.down.material.uniforms
    for (let i = 1; i < chain.length; i++) {
      const from = chain[i - 1]!
      const to = chain[i]!
      du.uSrc!.value = from.texture
      ;(du.uTexel!.value as THREE.Vector2).set(1 / from.width, 1 / from.height)
      ;(du.uInv!.value as THREE.Vector2).set(1 / to.width, 1 / to.height)
      this.down.render(renderer, to)
    }
    const uu = this.up.material.uniforms
    for (let i = chain.length - 2; i >= 1; i--) {
      const from = chain[i + 1]!
      const to = chain[i]!
      uu.uSrc!.value = from.texture
      ;(uu.uTexel!.value as THREE.Vector2).set(1 / from.width, 1 / from.height)
      ;(uu.uInv!.value as THREE.Vector2).set(1 / to.width, 1 / to.height)
      uu.uWeight!.value = sizes[i]! / sizes[i - 1]!
      this.up.render(renderer, to)
    }
    return chain[1]!
  }

  resolve(mean: THREE.Texture, raw = false): void {
    const { renderer, gl } = this.gfx
    const w = gl.drawingBufferWidth
    const h = gl.drawingBufferHeight
    const g = grade
    const u = this.pass.material.uniforms
    const exposure = this.exposure * g.exposure * (raw ? 1 : lensFall.dim)
    const scale = Math.min(w, h) / REFERENCE_ROWS
    u.uMean!.value = mean
    u.uExposure!.value = exposure
    u.uSeed!.value = (config.seed % 1000) / 1000 + this.seed
    u.uRaw!.value = raw ? 1 : 0
    ;(u.uInv!.value as THREE.Vector2).set(1 / w, 1 / h)
    if (!raw) {
      const glow = this.glow(mean, w, h, exposure)
      const t = lensState.bloomTint
      const k = g.glowStrength * Math.max(g.glowSizes[0] ?? 0, MIN_WEIGHT) * lensFall.bloom
      u.uGlow!.value = glow.texture
      ;(u.uGlowTexel!.value as THREE.Vector2).set(1 / glow.width, 1 / glow.height)
      ;(u.uGlowGain!.value as THREE.Vector3).set(k * (1 + g.glowTint * t.r), k * (1 + g.glowTint * t.g), k * (1 + g.glowTint * t.b))
      ;(u.uGlare!.value as THREE.Color).copy(lensState.glare)
      // Each seat as the mean of its samples, weighed by its share of the picture's samples.
      const seats = u.uSeat!.value as THREE.Vector4[]
      let all = 0
      for (const s of lensFall.seats) all += s.w
      const downs = u.uSeatDown!.value as THREE.Vector2[]
      lensFall.seats.forEach((s, i) => {
        if (s.w > 0) {
          seats[i]!.set(s.x / s.w, s.y / s.w, s.z / s.w, s.w / all)
          // The way to the collar in radii of the ball, so its length is how far down the ball the collar sits.
          downs[i]!.copy(lensFall.downs[i]!).multiplyScalar(1 / s.z)
        } else {
          seats[i]!.set(0.5, 0.5, 1, 0)
          downs[i]!.set(0, -1)
        }
      })
      ;(u.uReach!.value as THREE.Vector2).copy(lensFall.reach)
      ;(u.uHeart!.value as THREE.Color).copy(lensFall.heart)
      ;(u.uHeartShape!.value as THREE.Vector4).copy(lensFall.heartShape)
      u.uHeartShare!.value = lensFall.heartShare
      u.uHeartAir!.value = lensFall.air
      ;(u.uHeartBell!.value as THREE.Vector3).copy(lensFall.bell)
      if (lensFall.heartShare > 0 || !this.levelled) {
        this.levelled = true
        // How bright the storm stands at the heart of the ball in this picture: read once, into one pixel.
        const lu = this.level.material.uniforms
        lu.uMean!.value = mean
        lu.uExposure!.value = exposure
        ;(lu.uInv!.value as THREE.Vector2).set(1 / w, 1 / h)
        lu.uHeartAt!.value = lensFall.heartShape.x
        this.level.render(renderer, this.heart)
      }
      ;(u.uLimb!.value as THREE.Vector2).copy(lensFall.limb)
      ;(u.uRoom!.value as THREE.Color).copy(lensFall.room)
      ;(u.uCurve!.value as THREE.Vector4).set(g.curveGain, g.curveToe, g.curveShoulder, g.curveMid)
      u.uCurveBlack!.value = g.curveBlack
      ;(u.uHold!.value as THREE.Vector4).set(g.colourHold, g.colourHoldFrom, g.colourHoldFull, g.whiteFrom)
      u.uHoldEnd!.value = g.whiteFull
      ;(u.uLift!.value as THREE.Vector3).set(g.lift[0], g.lift[1], g.lift[2])
      ;(u.uGamma!.value as THREE.Vector3).set(1 / g.gamma[0], 1 / g.gamma[1], 1 / g.gamma[2])
      ;(u.uGain!.value as THREE.Vector3).set(g.gain[0], g.gain[1], g.gain[2])
      u.uSat!.value = g.saturation
      ;(u.uShadow!.value as THREE.Vector4).set(g.shadowTint[0], g.shadowTint[1], g.shadowTint[2], Math.max(g.shadowTintTo, 1e-5))
      const step = TRIANGLE_STD / 255
      ;(u.uGrain!.value as THREE.Vector4).set(g.grainDark * step, g.grainMid * step, g.grainBright * step, Math.min(Math.max(g.grainMidAt, 1e-3), 0.999))
      ;(u.uGrainShape!.value as THREE.Vector3).set(Math.max(1, g.grainSizePx * scale), g.grainChroma, g.ditherLsb / 255)
      ;(u.uLens!.value as THREE.Vector4).set(g.fringePx * scale, g.fringePower, g.cornerDark, g.cornerPower)
    }
    this.pass.render(renderer, null)
  }
}
