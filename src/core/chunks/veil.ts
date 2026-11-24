import * as THREE from 'three'
import type { StageFrame } from '../../scene/frame'

const TURBULENCE_POWER = 1.5
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const veilUniforms = {
  uVeil: { value: new THREE.Vector4(1, 1, 1, 0) },
  uVeilLight: { value: new THREE.Vector3() },
}

export const VEIL_FRAG_PARS = `
uniform vec4 uVeil;
uniform vec3 uVeilLight;
float stageVeil(float path) {
  return 1.0 - exp(-uVeil.a * path);
}
vec3 stageFogged(vec3 col, vec3 lit, float fog) {
  return mix(col, uVeil.rgb * (uVeilLight + 0.35 * lit), fog);
}
`

export const VEIL_FRAG = `
float stageFog = 0.0;
#ifdef STAGE_INSIDE
stageFog = stageVeil(vStageAux.x);
gl_FragColor.rgb = stageFogged(gl_FragColor.rgb, stageLit, stageFog);
#endif
`

export function updateVeil(f: StageFrame): void {
  const a = f.from.veil
  const b = f.to.veil
  const t = f.mix.veil
  const density = lerp(a.rest, b.rest, t) + lerp(a.density, b.density, t) * Math.pow(f.turbulence, TURBULENCE_POWER)
  veilUniforms.uVeil.value.set(lerp(a.tint[0], b.tint[0], t), lerp(a.tint[1], b.tint[1], t), lerp(a.tint[2], b.tint[2], t), density)
  veilUniforms.uVeilLight.value.set(f.ambient.r * 0.6 + f.keyCol.r * 0.12, f.ambient.g * 0.6 + f.keyCol.g * 0.12, f.ambient.b * 0.6 + f.keyCol.b * 0.12)
}
