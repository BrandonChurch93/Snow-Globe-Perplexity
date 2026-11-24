import * as THREE from 'three'
import { stageShader } from '../core/materials'
import { viewCode } from '../diagnostics/views'
import { ROOM_GLSL, roomUniforms } from '../scene/backdrop'
import { innerRadiusMm, lensRadiusMm } from './lens'

export const shellUniforms = {
  uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uKeyCol: { value: new THREE.Color() },
  uRimDir: { value: new THREE.Vector3(0, 1, 0) },
  uRimCol: { value: new THREE.Color() },
  uDress: { value: new THREE.Vector4(1, 1, 1, 0) },
  uBloom: { value: new THREE.Color() },
  uOverlay: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
}

const THROUGH = `
${ROOM_GLSL}
uniform vec3 uLensCentre;
uniform vec4 uLens;
void main() {
  vec3 n = normalize(vStageWorld - uLensCentre);
  vec3 v = normalize(vStageWorld - cameraPosition);
  vec3 t = uLens.z > 0.5 ? refract(v, n, 1.0 / uLens.y) : v;
  float chord = 2.0 * uLens.x * max(dot(-n, t), 0.0);
  vec3 n2 = normalize(vStageWorld + t * chord - uLensCentre);
  vec3 o = uLens.z > 0.5 ? refract(t, -n2, uLens.y) : v;
  if (dot(o, o) < 0.5) o = reflect(t, -n2);
  vec3 col = stageRoom(o) + stageRoomLights(o, 0.012);
  float fog = stageVeil(chord);
  vec3 lit = stageGrid(vStageLocal * 0.5);
  col = mix(col, uVeil.rgb * (uVeilLight + lit), fog);
  gl_FragColor = vec4(col, 1.0);
  if (uDiag != 0) gl_FragColor = stageDiag(col, n, fog, 0.0, 0.0);
}`

const SHELL = `
uniform vec3 uLensCentre;
uniform vec4 uLens;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
uniform vec4 uDress;
uniform vec3 uBloom;
uniform vec3 uOverlay[3];
uniform vec3 uRoomWall;
void main() {
  if (uDiag != 0) {
    if (uDiag != ${viewCode('ids')} && uDiag != ${viewCode('standins')}) discard;
    vec2 cell = mod(floor(gl_FragCoord.xy), 4.0);
    if (cell.x == 0.0 && cell.y == 0.0) gl_FragColor = vec4(uOverlay[0], 0.0);
    else if (cell.x == 2.0 && cell.y == 0.0) gl_FragColor = vec4(uOverlay[1], 0.0);
    else if (cell.x == 0.0 && cell.y == 2.0) gl_FragColor = vec4(uOverlay[2], 0.0);
    else discard;
    return;
  }
  vec3 n = normalize(vStageWorld - uLensCentre);
  vec3 v = normalize(vStageWorld - cameraPosition);
  float nv = clamp(dot(n, -v), 0.0, 1.0);
  float fresnel = 0.04 + 0.96 * pow(1.0 - nv, 5.0);
  vec3 r = reflect(v, n);
  vec3 env = uRoomWall * (2.0 + 6.0 * smoothstep(-0.2, 0.8, r.y));
  env += uKeyCol * 14.0 * smoothstep(0.985, 0.997, dot(r, uKeyDir));
  env += uKeyCol * 0.35 * smoothstep(0.06, 0.0, abs(dot(r, normalize(cross(uKeyDir, vec3(0.0, 1.0, 0.0)))) - 0.25)) * smoothstep(0.1, 0.5, r.y) * smoothstep(0.95, 0.6, r.y);
  env += uRimCol * 3.0 * smoothstep(0.9, 0.99, dot(r, uRimDir));
  vec3 col = env * fresnel;
  col += uRimCol * 0.05 * pow(1.0 - nv, 3.0);
  col += uDress.rgb * uDress.a * 0.05 * (0.4 + 0.6 * pow(1.0 - nv, 2.0));
  col += uBloom * (0.25 + 0.75 * nv);
  gl_FragColor = vec4(col, (1.0 - fresnel) * (1.0 - 0.5 * uDress.a));
}`

const BUBBLE = `
uniform vec3 uKeyCol;
void main() {
  vec3 v = normalize(vStageWorld - cameraPosition);
  vec3 n = normalize(vStageWorld - vBubble);
  float rim = pow(1.0 - clamp(dot(n, -v), 0.0, 1.0), 2.0);
  vec3 col = uKeyCol * (0.05 + 0.9 * rim);
  gl_FragColor = vec4(col, 1.0);
  if (uDiag != 0) gl_FragColor = stageDiag(vec3(1.0), n, 0.0, 0.0, 0.0);
}`

export class Shell {
  readonly through: THREE.Mesh
  readonly shell: THREE.Mesh
  readonly bubble: THREE.Mesh
  readonly bubbleRadius = 2.4

  constructor() {
    const sphere = new THREE.SphereGeometry(lensRadiusMm, 96, 64)
    this.through = new THREE.Mesh(sphere, stageShader({ part: 'liquid', uniforms: { ...roomUniforms }, fragment: THROUGH, params: { depthWrite: false } }))
    this.through.userData.standIn = 'liquid'
    this.through.renderOrder = -0.5
    this.shell = new THREE.Mesh(
      sphere,
      stageShader({
        part: 'glass',
        uniforms: { ...shellUniforms, uRoomWall: roomUniforms.uRoomWall },
        fragment: SHELL,
        params: {
          transparent: true,
          depthWrite: false,
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.SrcAlphaFactor,
          blendSrcAlpha: THREE.ZeroFactor,
          blendDstAlpha: THREE.OneFactor,
        },
      }),
    )
    this.shell.userData.standIn = 'glass'
    this.shell.renderOrder = 10
    this.bubble = new THREE.Mesh(
      new THREE.SphereGeometry(this.bubbleRadius, 20, 14),
      stageShader({
        part: 'liquid',
        inside: true,
        uniforms: { uKeyCol: shellUniforms.uKeyCol },
        vertexPars: 'varying vec3 vBubble;',
        vertexMain: 'vBubble = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
        fragment: `varying vec3 vBubble;\n${BUBBLE}`,
      }),
    )
    this.bubble.userData.standIn = 'liquid'
    this.bubble.renderOrder = 4
  }

  placeBubble(up: THREE.Vector3, slosh: THREE.Vector3): void {
    const d = up.clone().addScaledVector(slosh, -0.004)
    if (d.lengthSq() < 1e-9) d.set(0, 1, 0)
    d.normalize().multiplyScalar(innerRadiusMm - this.bubbleRadius - 0.4)
    this.bubble.position.copy(d)
  }
}
