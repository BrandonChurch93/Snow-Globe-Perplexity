import * as THREE from 'three'

export interface MirrorSource {
  at: readonly [number, number, number]
  strength: number
}

export const MIRROR_MAX = 32

export function mirrorUniforms(sources: readonly MirrorSource[]): Record<string, THREE.IUniform> {
  if (sources.length > MIRROR_MAX) throw new Error(`a mirror takes at most ${MIRROR_MAX} sources`)
  const list: THREE.Vector4[] = []
  for (let i = 0; i < MIRROR_MAX; i++) {
    const s = sources[i]
    list.push(s ? new THREE.Vector4(s.at[0], s.at[1], s.at[2], s.strength) : new THREE.Vector4())
  }
  return { uMirror: { value: list }, uMirrorCount: { value: sources.length } }
}

export const MIRROR_GLSL = `
uniform vec4 uMirror[${MIRROR_MAX}];
uniform int uMirrorCount;
uniform mat4 uGlobeInv;
vec3 villageSight() {
  vec3 d = normalize(vStagePlaced - cameraPosition);
  vec3 oc = cameraPosition - uLensCentre;
  float b = dot(oc, d);
  float h = b * b - dot(oc, oc) + uLens.x * uLens.x;
  vec3 entry = cameraPosition + d * (-b - sqrt(max(h, 0.0)));
  return normalize(mat3(uGlobeInv) * (entry - vStageWorld));
}
vec3 villageInside(vec3 viewNormal) {
  return normalize(mat3(uGlobeInv) * inverseTransformDirection(viewNormal, viewMatrix));
}
float villageMirror(vec3 n, vec3 sight, float tight, float wide, float wideShare) {
  vec3 r = reflect(-sight, n);
  float sum = 0.0;
  for (int i = 0; i < ${MIRROR_MAX}; i++) {
    if (i >= uMirrorCount) break;
    vec3 to = uMirror[i].xyz - vStageLocal;
    float d = length(to);
    float miss = 1.0 - dot(r, to / d);
    sum += uMirror[i].w * (exp(-miss / tight) + wideShare * exp(-miss / wide));
  }
  return sum;
}
`
