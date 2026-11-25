import * as THREE from 'three'
import { config } from '../../config'
import { stageShader } from '../../core/materials'
import { groundAt, groundY } from '../../scene/layout'
import type { KitMoment, SeasonKit } from '../kit'

// Part `veil-spring` and the colours of the season's particle kinds.
//
// Two things make the season's air. The petal mist is the liquid's own veil (the shared chunk, read only): `veil` gives it a
// faint pink, a density that lets the storm hide the miniature at its height, and nothing at rest. The dawn mist is drawn
// here: a lit volume low on the island, inside the glass, that lies on the ground at the landing and rises and thins as the
// water stills.
export const standIns: string[] = []

export const veil: SeasonKit['veil'] = { tint: [1, 0.8, 0.86], density: 0.2, rest: 0 }
export const particles: SeasonKit['particles'] = { petal: { color: [1, 0.74, 0.8], glow: 0 }, mote: { color: [0.5, 0.44, 0.42], glow: 0 } }

const PART = 'veil-spring'
const INNER = config.globe.sphereDiameterMm / 2 - config.globe.glassThicknessMm

const look = {
  /** The sheets the volume is cut into, front to back, and how finely each is cut for the lens to bend it. */
  sheets: 18,
  cols: 28,
  rows: 8,
  topMm: 34,
  /** How high the mist stands (the height at which it has thinned to a third) on the landing and at rest, and how long it takes to rise. */
  heightMm: [3.2, 8.5],
  riseSeconds: 5,
  /** How thick it is on the landing and at rest. */
  density: [3.2, 2.2],
  thinSeconds: 7,
  /** How much of it the storm blows off. */
  blown: 0.7,
  tint: [1, 0.8, 0.82],
  cold: 3.2,
  warm: 1.6,
  /** How far the banks drift round in one period, mm. */
  driftMm: 5,
}

const GROUND = { cells: 96, lowMm: groundY - 6, spanMm: 20 }

// The height of the island under every place, for the mist to lie on: it thins into the ground and never ends at it in a line.
function groundMap(): THREE.DataTexture {
  const c = GROUND.cells
  const data = new Uint8Array(c * c)
  for (let j = 0; j < c; j++)
    for (let i = 0; i < c; i++) {
      const x = ((i + 0.5) / c - 0.5) * 2 * INNER
      const z = ((j + 0.5) / c - 0.5) * 2 * INNER
      data[j * c + i] = Math.round(255 * Math.min(1, Math.max(0, (groundAt(x, z) - GROUND.lowMm) / GROUND.spanMm)))
    }
  const t = new THREE.DataTexture(data, c, c, THREE.RedFormat, THREE.UnsignedByteType)
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearFilter
  t.colorSpace = THREE.NoColorSpace
  t.needsUpdate = true
  return t
}

const mistUniforms = {
  uMistGround: { value: null as THREE.Texture | null },
  /** The height in mm, the density of one sheet, the place in the period (0 to 1), the storm (0 to 1). */
  uMist: { value: new THREE.Vector4(look.heightMm[1], 0, 0, 0) },
}

const n = (x: number): string => x.toFixed(4)

const MIST = `
uniform vec4 uMist;
uniform sampler2D uMistGround;
float mistHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float mistNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mistHash(i), mistHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(mistHash(i + vec3(0.0, 1.0, 0.0)), mistHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(mistHash(i + vec3(0.0, 0.0, 1.0)), mistHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(mistHash(i + vec3(0.0, 1.0, 1.0)), mistHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  #ifdef STAGE_INSIDE
  if (stageOutside()) discard;
  #endif
  if (uMist.y <= 0.0) discard;
  vec3 p = vStageLocal;
  float y = p.y - (${n(GROUND.lowMm)} + ${n(GROUND.spanMm)} * texture2D(uMistGround, p.xz / ${n(2 * INNER)} + 0.5).r);
  // Banks: two sizes of billow that drift round once a period and lean with the height, so no sheet shows as a sheet.
  float turn = 6.2831853 * uMist.z;
  vec3 drift = ${n(look.driftMm)} * vec3(sin(turn), 0.0, cos(turn));
  float coarse = mistNoise(vec3(p.x, y * 1.6, p.z) * 0.058 + drift * 0.058 + 3.7);
  float fine = mistNoise(vec3(p.x, y * 1.3, p.z) * 0.17 - drift.zyx * 0.17 + vec3(0.0, 0.25 * sin(turn + 1.3), 0.0) + 11.3);
  float bank = smoothstep(0.24, 0.78, 0.68 * coarse + 0.32 * fine);
  float high = uMist.x * (0.55 + 0.9 * coarse);
  float low = exp(-max(y, 0.0) / high) * smoothstep(0.0, 2.6, y);
  float wall = 1.0 - smoothstep(0.84, 0.985, length(p) / ${n(INNER)});
  float dens = uMist.y * low * wall * (0.28 + 0.72 * bank) * (1.0 - ${n(look.blown)} * uMist.w);
  float a = 1.0 - exp(-dens);
  if (a <= 0.002) discard;
  vec3 lit = stageCold(p) * ${n(look.cold)} + stageGrid(p) * ${n(look.warm)};
  vec3 col = vec3(${look.tint.map(n).join(', ')}) * lit * (0.8 + 0.4 * fine);
  float fog = stageVeil(vStageAux.x);
  gl_FragColor = vec4(stageFogged(col, stageGrid(p), fog), a);
  if (uDiag != 0) {
    if (a < 0.5) discard;
    gl_FragColor = stageDiag(vec3(${look.tint.map(n).join(', ')}), vec3(0.0, 0.0, 1.0), fog, c, 0.0);
  }
}
`

function sheetsGeometry(): THREE.BufferGeometry {
  const at: number[] = []
  const idx: number[] = []
  const reach = Math.sqrt(INNER * INNER - groundY * groundY) * 0.98
  for (let s = 0; s < look.sheets; s++) {
    // Back to front, so the sheets blend in the order the camera needs.
    const z = reach * 0.94 * (-1 + (2 * (s + 0.5)) / look.sheets)
    const half = Math.sqrt(Math.max(reach * reach - z * z, 1))
    const base = at.length / 3
    for (let i = 0; i <= look.rows; i++)
      for (let k = 0; k <= look.cols; k++) at.push(half * (-1 + (2 * k) / look.cols), groundY - 4 + (look.topMm * i) / look.rows, z)
    const row = look.cols + 1
    for (let i = 0; i < look.rows; i++)
      for (let k = 0; k < look.cols; k++) {
        const a = base + i * row + k
        idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
      }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(at, 3))
  g.setIndex(idx)
  return g
}

let sheets: THREE.Mesh | null = null

/** The dawn mist: mounted with the glass dressing, inside the glass. */
export function mist(): THREE.Object3D {
  if (sheets) return sheets
  mistUniforms.uMistGround.value = groundMap()
  sheets = new THREE.Mesh(
    sheetsGeometry(),
    stageShader({
      part: PART,
      standIn: false,
      inside: true,
      change: 'miniature',
      uniforms: mistUniforms,
      fragment: MIST,
      // Not `transparent`: the glass stamps its depth before the transparent things are drawn, and the mist must be drawn
      // before that, after the miniature (as the smoke of winter's chimney is).
      params: { side: THREE.DoubleSide, transparent: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false },
    }),
  )
  sheets.renderOrder = 3
  sheets.frustumCulled = false
  return sheets
}

/** The mist at a moment: on the ground and thick at the landing, risen and thin at rest; `bare` between the swap and the landing. */
export function mistAt(sinceLanding: number): { heightMm: number; density: number } {
  const t = sinceLanding < Infinity ? Math.max(0, sinceLanding) : 1e4
  const risen = 1 - Math.exp(-t / look.riseSeconds)
  const thinned = 1 - Math.exp(-t / look.thinSeconds)
  return { heightMm: look.heightMm[0]! + (look.heightMm[1]! - look.heightMm[0]!) * risen, density: look.density[0]! + (look.density[1]! - look.density[0]!) * thinned }
}

export function updateMist(moment: KitMoment, bare: boolean): void {
  const m = mistAt(moment.sinceLanding)
  const storm = Math.min(1, Math.max(0, moment.frame.turbulence))
  mistUniforms.uMist.value.set(m.heightMm, bare ? 0 : m.density / look.sheets, (moment.time / moment.period) % 1, storm)
}
