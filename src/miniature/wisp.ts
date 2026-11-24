import * as THREE from 'three'
import { stageShader, type Rgb } from '../core/materials'

export interface Wisp {
  from: readonly [number, number, number]
  height: number
  lean: readonly [number, number]
  sway: number
  thin: number
  wide: number
  rings: number
  sides: number
}

export function wispGeometry(w: Wisp): THREE.BufferGeometry {
  const pos: number[] = []
  const nor: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  const centre = (t: number): [number, number, number] => {
    const up = t * w.height
    const bend = t * t
    return [w.from[0] + w.lean[0] * bend + w.sway * Math.sin(t * 5.1 + 0.6) * t, w.from[1] + up, w.from[2] + w.lean[1] * bend + w.sway * 0.7 * Math.sin(t * 3.7 + 2.1) * t]
  }
  for (let i = 0; i <= w.rings; i++) {
    const t = i / w.rings
    const c = centre(t)
    const a = centre(Math.max(0, t - 0.01))
    const b = centre(Math.min(1, t + 0.01))
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize()
    const side = new THREE.Vector3(1, 0, 0).cross(dir).normalize()
    const other = dir.clone().cross(side).normalize()
    const r = w.thin + (w.wide - w.thin) * Math.pow(t, 0.8)
    for (let k = 0; k <= w.sides; k++) {
      const ang = (k / w.sides) * Math.PI * 2
      const nx = Math.cos(ang) * side.x + Math.sin(ang) * other.x
      const ny = Math.cos(ang) * side.y + Math.sin(ang) * other.y
      const nz = Math.cos(ang) * side.z + Math.sin(ang) * other.z
      pos.push(c[0] + nx * r, c[1] + ny * r, c[2] + nz * r)
      nor.push(nx, ny, nz)
      uv.push(k / w.sides, t)
    }
  }
  const row = w.sides + 1
  for (let i = 0; i < w.rings; i++)
    for (let k = 0; k < w.sides; k++) {
      const a = i * row + k
      const b = a + row
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

export function wispMaterial(part: string, tint: Rgb, strength: number, laps: number, clock: THREE.IUniform<number>): THREE.ShaderMaterial {
  return stageShader({
    part,
    standIn: false,
    inside: true,
    miniature: true,
    change: 'miniature',
    uniforms: { uClock: clock },
    params: { transparent: true, depthWrite: false, side: THREE.FrontSide },
    vertexPars: `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
`,
    vertexMain: `
vUv = uv;
vN = normalize(normalMatrix * normal);
vV = -mvPosition.xyz;
`,
    fragment: `
uniform float uClock;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
const float WISP_ROWS = 6.0;
float wispHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float wispNoise(vec2 p, float rows) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, rows);
  float y1 = mod(i.y + 1.0, rows);
  float x0 = mod(i.x, 4.0);
  float x1 = mod(i.x + 1.0, 4.0);
  return mix(mix(wispHash(vec2(x0, y0)), wispHash(vec2(x1, y0)), f.x), mix(wispHash(vec2(x0, y1)), wispHash(vec2(x1, y1)), f.x), f.y);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  #ifdef STAGE_INSIDE
  if (stageOutside()) discard;
  #endif
  float t = vUv.y;
  float rise = uClock * ${laps.toFixed(1)} * WISP_ROWS;
  vec2 p = vec2(vUv.x * 4.0 + t * 1.3, t * WISP_ROWS - rise);
  float n = 0.6 * wispNoise(p, WISP_ROWS) + 0.4 * wispNoise(p * 2.0 + vec2(1.7, 0.0), WISP_ROWS * 2.0);
  float body = pow(abs(dot(normalize(vN), normalize(vV))), 1.7);
  float along = smoothstep(0.0, 0.05, t) * pow(1.0 - t, 1.35);
  float a = clamp(body * along * (0.35 + 1.1 * n) * ${strength.toFixed(3)}, 0.0, 1.0);
  vec3 lit = uVeilLight * 1.6 + stageGrid(vStageLocal) * 0.9;
  vec3 col = ${`vec3(${tint[0].toFixed(4)}, ${tint[1].toFixed(4)}, ${tint[2].toFixed(4)})`} * lit;
  float fog = stageVeil(vStageAux.x);
  gl_FragColor = vec4(stageFogged(col, stageGrid(vStageLocal), fog), a);
  if (uDiag != 0) {
    if (a < 0.35) discard;
    gl_FragColor = stageDiag(vec3(${tint[0].toFixed(4)}, ${tint[1].toFixed(4)}, ${tint[2].toFixed(4)}), normalize(vN), fog, c, 0.0);
  }
}
`,
  })
}
