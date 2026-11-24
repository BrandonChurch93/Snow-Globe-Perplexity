import * as THREE from 'three'

export const ROOM_LIGHTS = 12

export const ROOM_GLSL = `
uniform vec3 uRoomWall;
uniform vec3 uRoomFloor;
uniform vec4 uRoomDir[${ROOM_LIGHTS}];
uniform vec3 uRoomCol[${ROOM_LIGHTS}];
vec3 stageRoom(vec3 d) {
  float back = 0.5 - 0.5 * d.z / max(length(d.xz), 1e-4);
  float wash = (0.35 + 0.65 * back * back) * exp(-d.y * d.y / 0.045);
  vec3 wall = uRoomWall * (1.0 + 1.6 * wash);
  return mix(uRoomFloor, wall, smoothstep(-0.03, 0.02, d.y));
}
vec3 stageRoomLights(vec3 d, float soft) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${ROOM_LIGHTS}; i++) {
    float c = dot(d, uRoomDir[i].xyz);
    sum += uRoomCol[i] * smoothstep(uRoomDir[i].w - soft, uRoomDir[i].w + soft * 0.2, c);
  }
  return sum;
}
vec3 stageRoomSoft(vec3 d, float rough) {
  return stageRoom(d) + 0.0 * rough;
}
`

export const roomUniforms = {
  uRoomWall: { value: new THREE.Color() },
  uRoomFloor: { value: new THREE.Color() },
  uRoomDir: { value: Array.from({ length: ROOM_LIGHTS }, () => new THREE.Vector4(0, 1, 0, 2)) },
  uRoomCol: { value: Array.from({ length: ROOM_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
}
