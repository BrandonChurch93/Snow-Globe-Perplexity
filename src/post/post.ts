import * as THREE from 'three'
import type { Gfx } from '../core/gl'
import { Pass } from '../core/fullscreen'
import { config } from '../config'

const RESOLVE = `uniform sampler2D uMean;
uniform float uExposure;
uniform float uSeed;
uniform int uRaw;
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
  c = encode(curve(c * uExposure));
  float n = hash(gl_FragCoord.xy, uSeed) + hash(gl_FragCoord.xy + 17.0, uSeed + 0.37) - 1.0;
  o = vec4(clamp(c + n / 255.0, 0.0, 1.0), 1.0);
}`

export class Post {
  private readonly pass: Pass
  exposure = 1
  seed = 0
  constructor(private readonly gfx: Gfx) {
    this.pass = new Pass(RESOLVE, {
      uMean: { value: null },
      uExposure: { value: 1 },
      uSeed: { value: (config.seed % 1000) / 1000 },
      uRaw: { value: 0 },
    })
  }
  resolve(mean: THREE.Texture, raw = false): void {
    const u = this.pass.material.uniforms
    u.uMean.value = mean
    u.uExposure.value = this.exposure
    u.uSeed.value = (config.seed % 1000) / 1000 + this.seed
    u.uRaw.value = raw ? 1 : 0
    this.pass.render(this.gfx.renderer, null)
  }
}
