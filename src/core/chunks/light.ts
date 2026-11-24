import * as THREE from 'three'

export const lightUniforms = {
  uGridA: { value: null as THREE.Texture | null },
  uGridB: { value: null as THREE.Texture | null },
  uGrid: { value: new THREE.Vector4(0, 1, 1, 1) },
}

export const LIGHT_FRAG_PARS = `
uniform highp sampler3D uGridA;
uniform highp sampler3D uGridB;
uniform vec4 uGrid;
vec3 stageGrid(vec3 local) {
  vec3 at = clamp(local / (2.0 * uGrid.w) + 0.5, 0.0, 1.0);
  return mix(texture(uGridA, at).rgb * uGrid.y, texture(uGridB, at).rgb * uGrid.z, uGrid.x);
}
`

export const LIGHT_FRAG = `
vec3 stageLit = vec3(0.0);
#ifdef STAGE_INSIDE
stageLit = stageGrid(vStageLocal);
reflectedLight.indirectDiffuse += stageLit * material.diffuseContribution;
#endif
`
