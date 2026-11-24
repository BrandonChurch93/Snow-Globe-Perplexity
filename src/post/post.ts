import * as THREE from 'three'
import type { Gfx } from '../core/gl'
import { Pass } from '../core/fullscreen'
import { config } from '../config'
import { flagStandIn } from '../core/standins'

flagStandIn('lens')

export const GLOW_ROWS = 135
export const GLOW_THRESHOLD = 1
export const GLOW_CEILING = 24
export const GLOW_STRENGTH = 0.5
export const GRAIN = 1.6 / 255
export const CORNER = 0.14

const BRIGHT = `uniform sampler2D uMean;
uniform float uExposure;
uniform int uDown;
uniform ivec2 uSize;
out vec4 o;
void main() {
  ivec2 base = ivec2(gl_FragCoord.xy) * uDown;
  vec3 sum = vec3(0.0);
  for (int y = 0; y < uDown; y++) {
    for (int x = 0; x < uDown; x++) {
      vec3 c = max(texelFetch(uMean, min(base + ivec2(x, y), uSize - 1), 0).rgb, 0.0) * uExposure;
      float peak = max(c.r, max(c.g, c.b));
      sum += min(c, ${GLOW_CEILING.toFixed(1)}) * clamp((peak - ${GLOW_THRESHOLD.toFixed(3)}) / max(peak, 1e-4), 0.0, 1.0);
    }
  }
  o = vec4(sum / float(uDown * uDown), 1.0);
}`

const BLUR = `uniform sampler2D uSrc;
uniform ivec2 uDir;
uniform ivec2 uSize;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 sum = texelFetch(uSrc, p, 0).rgb;
  float weight = 1.0;
  for (int i = 1; i < 7; i++) {
    float w = exp(-float(i * i) / 12.5);
    sum += texelFetch(uSrc, clamp(p + uDir * i, ivec2(0), uSize - 1), 0).rgb * w;
    sum += texelFetch(uSrc, clamp(p - uDir * i, ivec2(0), uSize - 1), 0).rgb * w;
    weight += 2.0 * w;
  }
  o = vec4(sum / weight, 1.0);
}`

const RESOLVE = `uniform sampler2D uMean;
uniform sampler2D uGlow;
uniform float uExposure;
uniform float uSeed;
uniform int uRaw;
uniform vec2 uInv;
out vec4 o;

vec3 curve(vec3 x) {
  x = max(x, 0.0);
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 encode(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(max(c, 0.0), vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}
float hash(vec2 p, float s) {
  uvec3 v = uvec3(uint(p.x), uint(p.y), uint(s * 65536.0));
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return float(v.x >> 8u) / 16777216.0;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 c = texelFetch(uMean, p, 0).rgb;
  if (uRaw == 1) { o = vec4(clamp(c, 0.0, 1.0), 1.0); return; }
  vec2 uv = gl_FragCoord.xy * uInv;
  c = max(c, 0.0) * uExposure + texture(uGlow, uv).rgb * ${GLOW_STRENGTH.toFixed(3)};
  vec2 q = uv - 0.5;
  float fall = 2.0 * dot(q, q);
  c *= 1.0 - ${CORNER.toFixed(3)} * fall * fall;
  c = encode(curve(c));
  float n = hash(gl_FragCoord.xy, uSeed) + hash(gl_FragCoord.xy + 17.0, uSeed + 0.37) - 1.0;
  o = vec4(clamp(c + n * ${GRAIN.toFixed(6)}, 0.0, 1.0), 1.0);
}`

export class Post {
  private readonly pass: Pass
  private readonly bright: Pass
  private readonly blur: Pass
  private a: THREE.WebGLRenderTarget | null = null
  private b: THREE.WebGLRenderTarget | null = null
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
    })
    this.bright = new Pass(BRIGHT, { uMean: { value: null }, uExposure: { value: 1 }, uDown: { value: 1 }, uSize: { value: new THREE.Vector2(1, 1) } })
    this.blur = new Pass(BLUR, { uSrc: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uSize: { value: new THREE.Vector2(1, 1) } })
  }

  private targets(w: number, h: number): [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget] {
    if (!this.a || !this.b || this.a.width !== w || this.a.height !== h) {
      this.a?.dispose()
      this.b?.dispose()
      const make = () =>
        new THREE.WebGLRenderTarget(w, h, {
          type: this.gfx.caps.half ? THREE.HalfFloatType : THREE.UnsignedByteType,
          format: THREE.RGBAFormat,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          depthBuffer: false,
          stencilBuffer: false,
          generateMipmaps: false,
          colorSpace: THREE.NoColorSpace,
        })
      this.a = make()
      this.b = make()
    }
    return [this.a, this.b]
  }

  textureBytes(): number {
    return this.a ? 2 * this.a.width * this.a.height * (this.gfx.caps.half ? 8 : 4) : 0
  }

  resolve(mean: THREE.Texture, raw = false): void {
    const { renderer, gl } = this.gfx
    const w = gl.drawingBufferWidth
    const h = gl.drawingBufferHeight
    const u = this.pass.material.uniforms
    u.uMean!.value = mean
    u.uExposure!.value = this.exposure
    u.uSeed!.value = (config.seed % 1000) / 1000 + this.seed
    u.uRaw!.value = raw ? 1 : 0
    ;(u.uInv!.value as THREE.Vector2).set(1 / w, 1 / h)
    if (!raw) {
      const down = Math.max(1, Math.round(Math.min(w, h) / GLOW_ROWS))
      const gw = Math.max(1, Math.ceil(w / down))
      const gh = Math.max(1, Math.ceil(h / down))
      const [a, b] = this.targets(gw, gh)
      const bu = this.bright.material.uniforms
      bu.uMean!.value = mean
      bu.uExposure!.value = this.exposure
      bu.uDown!.value = down
      ;(bu.uSize!.value as THREE.Vector2).set(w, h)
      this.bright.render(renderer, a)
      const lu = this.blur.material.uniforms
      ;(lu.uSize!.value as THREE.Vector2).set(gw, gh)
      lu.uSrc!.value = a.texture
      ;(lu.uDir!.value as THREE.Vector2).set(1, 0)
      this.blur.render(renderer, b)
      lu.uSrc!.value = b.texture
      ;(lu.uDir!.value as THREE.Vector2).set(0, 1)
      this.blur.render(renderer, a)
      u.uGlow!.value = a.texture
    }
    this.pass.render(renderer, null)
  }
}
