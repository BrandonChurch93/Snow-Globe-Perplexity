import * as THREE from 'three'
import type { Gfx } from '../core/gl'
import { Pass } from '../core/fullscreen'
import { config } from '../config'
import { grade, lensState } from './grade'

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

const RESOLVE = `uniform sampler2D uMean;
uniform sampler2D uGlow;
uniform float uExposure;
uniform float uSeed;
uniform int uRaw;
uniform vec2 uInv;
uniform vec2 uGlowTexel;
uniform vec3 uGlowGain;
uniform sampler2D uWide;
uniform vec2 uWideTexel;
uniform float uGlare;
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
  vec2 shift = q / max(length(q), 1e-4) * uLens.x * pow(r2, 0.5 * uLens.y);
  c = max(vec3(tap(gl_FragCoord.xy + shift).r, c.g, tap(gl_FragCoord.xy - shift).b), 0.0) * uExposure;
  vec2 g = uGlowTexel * 0.5;
  vec3 glow = texture(uGlow, uv + g).rgb + texture(uGlow, uv - g).rgb + texture(uGlow, uv + vec2(g.x, -g.y)).rgb + texture(uGlow, uv + vec2(-g.x, g.y)).rgb;
  c += glow * 0.25 * uGlowGain;
  if (uGlare > 0.0) {
    vec2 w = uWideTexel * 0.5;
    vec3 wide = texture(uWide, uv + w).rgb + texture(uWide, uv - w).rgb + texture(uWide, uv + vec2(w.x, -w.y)).rgb + texture(uWide, uv + vec2(-w.x, w.y)).rgb;
    c += wide * (0.25 * uGlare);
  }
  c *= 1.0 - uLens.z * pow(r2, uLens.w);
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
  private chain: THREE.WebGLRenderTarget[] = []
  exposure = 1
  seed = 0
  constructor(private readonly gfx: Gfx) {
    this.pass = new Pass(RESOLVE, {
      uMean: { value: null },
      uGlow: { value: null },
      uExposure: { value: 1 },
      uSeed: { value: (config.seed % 1000) / 1000 },
      uRaw: { value: 0 },
      uInv: { value: new THREE.Vector2(1, 1) },
      uGlowTexel: { value: new THREE.Vector2(1, 1) },
      uGlowGain: { value: new THREE.Vector3() },
      uWide: { value: null },
      uWideTexel: { value: new THREE.Vector2(1, 1) },
      uGlare: { value: 0 },
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
    for (const t of this.chain) n += t.width * t.height * (this.gfx.caps.half ? 8 : 4)
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
    const exposure = this.exposure * g.exposure
    const scale = Math.min(w, h) / REFERENCE_ROWS
    u.uMean!.value = mean
    u.uExposure!.value = exposure
    u.uSeed!.value = (config.seed % 1000) / 1000 + this.seed
    u.uRaw!.value = raw ? 1 : 0
    ;(u.uInv!.value as THREE.Vector2).set(1 / w, 1 / h)
    if (!raw) {
      const glow = this.glow(mean, w, h, exposure)
      const t = lensState.bloomTint
      const k = g.glowStrength * Math.max(g.glowSizes[0] ?? 0, MIN_WEIGHT)
      u.uGlow!.value = glow.texture
      ;(u.uGlowTexel!.value as THREE.Vector2).set(1 / glow.width, 1 / glow.height)
      ;(u.uGlowGain!.value as THREE.Vector3).set(k * (1 + g.glowTint * t.r), k * (1 + g.glowTint * t.g), k * (1 + g.glowTint * t.b))
      const wide = this.chain[this.chain.length - 2]!
      u.uWide!.value = wide.texture
      ;(u.uWideTexel!.value as THREE.Vector2).set(1 / wide.width, 1 / wide.height)
      u.uGlare!.value = lensState.glare
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
