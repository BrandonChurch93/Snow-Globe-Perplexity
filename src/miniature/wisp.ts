import * as THREE from 'three'
import { stageShader, type Rgb } from '../core/materials'

export interface Wisp {
  from: readonly [number, number, number]
  height: number
  lean: readonly [number, number]
  sway: number
  curl: number
  thin: number
  wide: number
  rings: number
  sides: number
  swept: readonly [number, number]
  sweepMm: number
}

const TURN = Math.PI * 2
const dir = new THREE.Vector3()
const side = new THREE.Vector3()
const other = new THREE.Vector3()
const AXIS = new THREE.Vector3(1, 0, 0)

function centre(w: Wisp, t: number, phase: number, storm: number, out: [number, number, number]): void {
  const a = TURN * phase
  const k = Math.pow(t, 1.5)
  const bend = t * t * (0.35 + 0.65 * t)
  const gust = storm * Math.pow(t, 1.2) * w.sweepMm
  const sx = w.sway * k * Math.sin(t * 6.3 - a + 0.6) + w.curl * k * t * Math.sin(t * 11 - 2 * a + 2.1)
  const sz = 0.7 * w.sway * k * Math.sin(t * 4.9 - a + 2.1) + w.curl * k * t * Math.cos(t * 9 - 2 * a)
  out[0] = w.from[0] + w.lean[0] * bend + sx * (1 + storm) + w.swept[0] * gust
  out[1] = w.from[1] + t * w.height * (1 - 0.55 * storm) + 0.3 * w.curl * k * Math.sin(t * 8 - a) * storm
  out[2] = w.from[2] + w.lean[1] * bend + sz * (1 + storm) + w.swept[1] * gust
}

const c: [number, number, number] = [0, 0, 0]
const lo: [number, number, number] = [0, 0, 0]
const hi: [number, number, number] = [0, 0, 0]

export function wispPose(g: THREE.BufferGeometry, w: Wisp, phase: number, storm: number): void {
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const nor = g.getAttribute('normal') as THREE.BufferAttribute
  let o = 0
  for (let i = 0; i <= w.rings; i++) {
    const t = i / w.rings
    centre(w, t, phase, storm, c)
    centre(w, Math.max(0, t - 0.01), phase, storm, lo)
    centre(w, Math.min(1, t + 0.01), phase, storm, hi)
    dir.set(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]).normalize()
    side.copy(AXIS).cross(dir).normalize()
    other.copy(dir).cross(side).normalize()
    const r = (w.thin + (w.wide - w.thin) * Math.pow(t, 0.8)) * (1 + 0.5 * storm * t) * (1 + 0.3 * t * Math.sin(t * 9.5 - 2 * TURN * phase) + 0.16 * Math.sqrt(t) * Math.sin(t * 23 - 4 * TURN * phase + 1.3))
    for (let k = 0; k <= w.sides; k++) {
      const ang = (k / w.sides) * TURN
      const nx = Math.cos(ang) * side.x + Math.sin(ang) * other.x
      const ny = Math.cos(ang) * side.y + Math.sin(ang) * other.y
      const nz = Math.cos(ang) * side.z + Math.sin(ang) * other.z
      pos.setXYZ(o, c[0] + nx * r, c[1] + ny * r, c[2] + nz * r)
      nor.setXYZ(o, nx, ny, nz)
      o++
    }
  }
  pos.needsUpdate = true
  nor.needsUpdate = true
}

export function wispGeometry(w: Wisp): THREE.BufferGeometry {
  const row = w.sides + 1
  const count = (w.rings + 1) * row
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= w.rings; i++) for (let k = 0; k <= w.sides; k++) uv.push(k / w.sides, i / w.rings)
  for (let i = 0; i < w.rings; i++)
    for (let k = 0; k < w.sides; k++) {
      const a = i * row + k
      const b = a + row
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  wispPose(g, w, 0, 0)
  return g
}

export function wispMaterial(part: string, tint: Rgb, strength: number, laps: number, clock: THREE.IUniform<number>, storm: THREE.IUniform<number>): THREE.ShaderMaterial {
  return stageShader({
    part,
    standIn: false,
    inside: true,
    miniature: true,
    change: 'miniature',
    uniforms: { uClock: clock, uStorm: storm },
    params: { side: THREE.FrontSide, transparent: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false },
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
uniform float uStorm;
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
  float n1 = wispNoise(p, WISP_ROWS);
  float n2 = wispNoise(p * 2.0 + vec2(1.7 + 0.9 * n1, 0.0), WISP_ROWS * 2.0);
  float n3 = wispNoise(p * 4.0 + vec2(0.3 + 1.3 * n2, 0.0), WISP_ROWS * 4.0);
  float n = 0.5 * n1 + 0.3 * n2 + 0.2 * n3;
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float ragged = mix(0.12, 0.78, clamp(0.55 * n1 + 0.45 * n3 + 0.45 * t - 0.2, 0.0, 1.0));
  float body = smoothstep(ragged, 1.0, facing);
  body *= body * (0.55 + 0.45 * facing);
  float along = smoothstep(0.0, 0.07, t) * pow(1.0 - t, 0.8);
  float gaps = smoothstep(0.24 + 0.3 * t, 0.56 + 0.3 * t, n + 0.3 * (1.0 - t));
  float torn = mix(1.0, gaps * (0.5 + n2), clamp(t * 2.4 + uStorm, 0.0, 1.0));
  float a = clamp(body * along * torn * ${strength.toFixed(3)} * (1.0 - 0.6 * uStorm), 0.0, 1.0);
  vec3 lit = stageCold(vStageLocal) * 3.0 + stageGrid(vStageLocal) * 1.0;
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
