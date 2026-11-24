import * as THREE from 'three'

export const ROOM_LIGHTS = 12

export const ROOM_WINDOW = { halfWidth: 0.3, halfHeight: 0.62, edge: 0.075, lean: 0.22 }
export const ROOM_STRIP = { halfWidth: 0.055, halfHeight: 0.46, edge: 0.04, lean: -0.15 }
export const ROOM_ROUGH_SPREAD = 1.4
export const ROOM_SPILL = { spread: 0.373, floor: 0.42, gain: 0.75 }
export const ROOM_WASH = { spread: 0.07, at: 0.16, gain: 1.5 }
export const ROOM_GLOW = [{ azDeg: 21, elDeg: 9, spread: 0.003, gain: 5 }]
export const ROOM_SEEN = 0.012

const WASH = ROOM_WASH.spread
const f = (v: number) => v.toFixed(4)
const glowTerms = ROOM_GLOW.map((g) => {
  const az = (g.azDeg * Math.PI) / 180
  const el = (g.elDeg * Math.PI) / 180
  const dir = [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]
  return `${f(g.gain)} * ${f(g.spread)} / (${f(g.spread)} + s) * exp(-(1.0 - dot(d, vec3(${dir.map(f).join(', ')}))) / (${f(g.spread)} + s))`
}).join(' + ')

export const ROOM_GLSL = `
uniform vec3 uRoomWall;
uniform vec3 uRoomFloor;
uniform vec4 uRoomDir[${ROOM_LIGHTS}];
uniform vec3 uRoomCol[${ROOM_LIGHTS}];
uniform vec3 uRoomKey;
uniform vec3 uRoomKeyCol;
uniform vec3 uRoomRim;
uniform vec3 uRoomRimCol;
float roomErf(float x) {
  float a = abs(x);
  float t = 1.0 / (1.0 + 0.3275911 * a);
  float y = 1.0 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-a * a);
  return x < 0.0 ? -y : y;
}
float roomSpan(float x, float h, float s) {
  float k = 0.70710678 / s;
  return 0.5 * (roomErf((x + h) * k) - roomErf((x - h) * k));
}
vec3 roomSource(vec3 d, vec3 axis, vec3 col, vec2 size, float s, float lean) {
  float facing = dot(d, axis);
  if (facing <= 0.02) return vec3(0.0);
  vec3 side = cross(vec3(0.0, 1.0, 0.0), axis);
  side /= max(length(side), 1e-3);
  vec3 up = cross(axis, side);
  vec2 p = vec2(dot(d, side), dot(d, up)) / facing;
  float shape = roomSpan(p.x, size.x, s) * roomSpan(p.y, size.y, s);
  float slope = 1.0 + lean * clamp(p.y / size.y, -1.5, 1.5) + 0.4 * lean * clamp(p.x / size.x, -1.5, 1.5);
  return col * (shape * slope * smoothstep(0.02, 0.2, facing) / (4.0 * size.x * size.y));
}
vec3 roomWall(vec3 d, float s) {
  float back = 0.5 - 0.5 * d.z / max(length(d.xz), 1e-4);
  float v = ${f(WASH)} + 2.0 * s * s;
  float up = d.y - ${f(ROOM_WASH.at)};
  float wash = (0.35 + 0.65 * back * back) * exp(-up * up / v) * sqrt(${f(WASH)} / v);
  float spill = exp(-(1.0 - dot(d, uRoomRim)) / (${f(ROOM_SPILL.spread)} + s));
  float glow = ${glowTerms};
  return uRoomWall * ((1.0 + ${f(ROOM_WASH.gain)} * wash) * (${f(ROOM_SPILL.floor)} + ${f(ROOM_SPILL.gain)} * spill + glow));
}
vec3 roomSources(vec3 d, float s) {
  return roomSource(d, uRoomKey, uRoomKeyCol, vec2(${f(ROOM_WINDOW.halfWidth)}, ${f(ROOM_WINDOW.halfHeight)}), length(vec2(${f(ROOM_WINDOW.edge)}, s)), ${f(ROOM_WINDOW.lean)})
    + roomSource(d, uRoomRim, uRoomRimCol, vec2(${f(ROOM_STRIP.halfWidth)}, ${f(ROOM_STRIP.halfHeight)}), length(vec2(${f(ROOM_STRIP.edge)}, s)), ${f(ROOM_STRIP.lean)});
}
vec3 stageRoomBlur(vec3 d, float s) {
  float above = 0.5 + 0.5 * roomErf((d.y + 0.005) * 0.70710678 / (0.018 + s));
  return mix(uRoomFloor, roomWall(d, s), above) + roomSources(d, s);
}
vec3 stageRoom(vec3 d) {
  return stageRoomBlur(d, 0.0);
}
vec3 stageRoomSeen(vec3 d, float rough) {
  float s = ${f(ROOM_ROUGH_SPREAD)} * rough * rough;
  float above = 0.5 + 0.5 * roomErf((d.y + 0.005) * 0.70710678 / (0.018 + s));
  return mix(uRoomFloor, roomWall(d, s), above) + roomSources(d, s) * ${f(ROOM_SEEN)};
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
  return stageRoomBlur(d, ${f(ROOM_ROUGH_SPREAD)} * rough * rough);
}
`

export const roomUniforms = {
  uRoomWall: { value: new THREE.Color() },
  uRoomFloor: { value: new THREE.Color() },
  uRoomDir: { value: Array.from({ length: ROOM_LIGHTS }, () => new THREE.Vector4(0, 1, 0, 2)) },
  uRoomCol: { value: Array.from({ length: ROOM_LIGHTS }, () => new THREE.Color(0, 0, 0)) },
  uRoomKey: { value: new THREE.Vector3(0, 1, 0) },
  uRoomKeyCol: { value: new THREE.Color(0, 0, 0) },
  uRoomRim: { value: new THREE.Vector3(0, 1, 0) },
  uRoomRimCol: { value: new THREE.Color(0, 0, 0) },
}
