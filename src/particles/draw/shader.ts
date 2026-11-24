import { COVER_GLSL } from '../../core/chunks/cover'
import { LIGHT_FRAG_PARS } from '../../core/chunks/light'
import { VEIL_GLSL } from '../../core/chunks/veil'
import { viewCode } from '../../diagnostics/views'
import { BLUR_HOLD, BLUR_STRICT_FROM_PX, BLUR_STRICT_TO_PX, CLUMP, EDGE_CRISP_HIGH, EDGE_CRISP_LOW, EDGE_SOFT_HIGH, EDGE_SOFT_LOW, FLASH_MOST, FLASH_WHITE, GLINT_HIGH, GLINT_LOW, GLINT_SOFT_PX, LAMPS, LENS_LOOK, LIT_MOST, LIGHT_LOOK, LOBE_CORE, LOBE_GIRTH, LOBE_REACH, LYING_LOOK, MAX_KINDS, PIXEL_SIGMA2, SETTLE_FADE, SIZE_HIGH, SIZE_LOW, SIZE_SKEW, STORM_CROSS, STORM_ALIGN, STORM_DAB_LIGHT, STORM_DAB_REACH, STORM_DAB_SLOW, STORM_DAB_TIGHT, STORM_FAR, STORM_OFF_DISC, STORM_PACE, STORM_FINE_HIGH, STORM_FINE_LOW, STORM_FINE_SOFT, STORM_FINE_SHARE, STORM_FLASH, STORM_GLINT, STORM_GLITTER, STORM_GLITTER_FROM, STORM_GLITTER_PX, STORM_GLITTER_TO, STORM_MOST_PX, STORM_SHARP, STORM_SHARP_REACH, STORM_SHARP_SHARE, STORM_SHUTTER, STORM_SIDE, STORM_SLOW, STORM_SMEAR, STORM_SMEAR_BRIGHT, STORM_SMEAR_FAINT, STORM_SMEAR_HIGH_PX, STORM_SMEAR_LOW_PX, STORM_SMEAR_FAR, STORM_SMEAR_NEAR, STORM_SMEAR_SHARE, STORM_SMEAR_SKEW, STORM_SOFT_TOP, STORM_STREAK_DIM, STORM_THIN, STORM_TOP, STORM_VEILED, STORM_WALL, STORM_WINDOW, STREAK_CAPSULE, STREAK_HOLD, STREAK_REACH, STREAK_TAPER, STRETCH_HIGH, STRETCH_LOW, THIN_FROM, THIN_LOW, THIN_TO } from './looks'

const MEAN_LOBE = 0.42
const n = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v))

const VARYINGS = `
varying vec4 vL0;
varying vec4 vL1;
varying vec4 vL2;
varying vec4 vL3;
varying vec4 vL4;
varying vec4 vCore;
varying vec4 vStreak;
varying vec4 vKind;
varying vec4 vGrid;
varying vec4 vDom;
varying vec4 vFog;
float pointSpread(float halfLong, float s2) {
  return pow(1.0 + ${n(STREAK_CAPSULE)} * halfLong / sqrt(s2), ${n(STREAK_HOLD)});
}
`

export const VERT_PARS = `
#ifdef POINT_SPRITES
#define aNow position
#define pointId gl_VertexID
#else
attribute vec3 aNow;
#define pointId gl_InstanceID
#endif
attribute vec3 aPrev;
attribute vec4 aData;
attribute float aState;
uniform vec4 uPoint;
uniform vec4 uStorm;
uniform vec4 uAperture;
uniform vec3 uEyeShift;
uniform vec4 uBlur;
uniform vec4 uLying;
uniform vec4 uLimit;
uniform vec4 uKindLook[${MAX_KINDS}];
uniform vec4 uTone;
uniform vec4 uLamp[${LAMPS}];
uniform vec4 uLampCol[${LAMPS}];
uniform sampler2D uLobes;
uniform float uLobeRows;
${LIGHT_FRAG_PARS}
${VEIL_GLSL}
${COVER_GLSL}
${VARYINGS}
vec4 pointHash(uint id) {
  uvec4 v = uvec4(id) * uvec4(1664525u, 22695477u, 747796405u, 2891336453u) + uvec4(1013904223u, 12345u, 2891336453u, 887987685u);
  v ^= v >> 15u;
  v *= 2246822519u;
  v ^= v >> 13u;
  v *= 3266489917u;
  v ^= v >> 16u;
  return vec4(v >> 8u) / 16777216.0;
}
vec3 pointTurn(vec3 v, vec3 k, float c, float s) {
  return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}
float pointGlint(vec3 face, vec3 l, vec3 v) {
  float wide = ${n(STORM_GLINT)} * uStorm.x;
  return smoothstep(${n(GLINT_LOW)} - wide, ${n(GLINT_HIGH)} - 0.5 * wide, abs(dot(face, normalize(l + v))));
}
vec4 pointLobe(int k, uint id, int variant, float shape, vec3 axis, float c, float s, float lying, float rPx, mat3 toView) {
  vec3 o = vec3(0.0);
  float rho = k == 0 ? 1.0 : 0.0;
  if (shape > 0.5 && shape < 1.5) {
    vec4 t = texelFetch(uLobes, ivec2(k, variant), 0);
    vec4 j = pointHash(id * 7u + uint(k) + 977u);
    o = (t.xyz * 2.0 - 1.0) * mix(${n(LOBE_REACH.low)}, ${n(LOBE_REACH.high)}, j.x);
    rho = t.w * mix(${n(LOBE_GIRTH.low)}, ${n(LOBE_GIRTH.high)}, j.y);
  }
  o = pointTurn(o, axis, c, s);
  o.y *= mix(1.0, uLying.x, lying);
  rho *= mix(1.0, uLying.y, lying);
  vec3 ov = toView * o;
  return vec4(ov.xy * rPx, rho * rPx, ov.z);
}
`

export const VERT_MAIN = `
  uint pid = uint(pointId);
  vec4 h = pointHash(pid);
  vec4 h2 = pointHash(pid ^ 2654435769u);
  int kind = int(aData.y + 0.5);
  vec4 look = uKindLook[kind];
  float shape = look.x;
  float lying = aState > 0.5 && aState < 2.5 ? 1.0 : 0.0;
  float afloat = 1.0 - lying;
  float shut = uPoint.z * mix(1.0, ${n(STORM_SHUTTER)}, uStorm.x);
  vec3 nowL = mix(aPrev, aNow, uPoint.x + shut * uStorm.y * afloat);
  vec3 nowW = (modelMatrix * vec4(nowL, 1.0)).xyz;
  vec3 eye = cameraPosition - uEyeShift * afloat;
  vec4 placed = lensPlace(nowW, eye);
  vec4 view = viewMatrix * vec4(placed.xyz, 1.0);
  view.xy += uAperture.xy * afloat;
  vec4 clip = projectionMatrix * view;
  clip.xy += vec2(projectionMatrix[0][0] * uAperture.x, projectionMatrix[1][1] * uAperture.y) * (uAperture.z * view.z * afloat);
  vStageWorld = nowW;
  vStageLocal = nowL;
  vStagePlaced = placed.xyz;
  vStageAux = vec3(placed.w, -view.z, length(view.xyz));

  vec3 oe = eye - uLensCentre;
  float dist = length(oe);
  float R = uLens.x;
  float on = uLens.z > 0.5 && dist > R * 1.0001 ? 1.0 : 0.0;
  float a = dot(nowW - uLensCentre, oe / dist);
  float den = max(R + (uLens.y - 1.0) * a, 0.3 * R);
  float mag = mix(1.0, uLens.y * R / den, on);
  float zImg = max(dist - mix(a, R - R * (R - a) / den, on), 1.0);
  float depth = clamp(a / uLens.w, -1.0, 1.0);
  float shrink = mix(1.0, mix(uBlur.w, 1.0, smoothstep(-1.0, 0.15, depth)), afloat);
  float spread = shape > 0.5 && shape < 1.5 ? mix(${n(SIZE_LOW)}, ${n(SIZE_HIGH)}, pow(h2.w, ${n(SIZE_SKEW)})) : 1.0;
  float rPx = aData.x * look.y * spread * uPoint.y * mag / zImg * shrink * mix(1.0, ${n(LYING_LOOK.size)}, lying);
  float glints = shape > 1.5 ? 1.0 : 0.0;
  float pick = fract(h.x * 91.0);
  float smears = (1.0 - glints) * step(pick, ${n(STORM_SMEAR_SHARE)});
  float sharps = (1.0 - glints) * (1.0 - smears) * step(pick, ${n(STORM_SMEAR_SHARE + STORM_SHARP_SHARE)});
  float fine = (pick - ${n(STORM_SMEAR_SHARE + STORM_SHARP_SHARE)}) / ${n(STORM_FINE_SHARE)};
  float fines = (1.0 - glints) * step(0.0, fine) * step(fine, 1.0);
  float shown = clamp((uStorm.z * ${n(1 + SETTLE_FADE)} - fract(h.z * 61.0)) / ${n(SETTLE_FADE)}, 0.0, 1.0);
  float pace = length((mat3(modelViewMatrix) * (aNow - aPrev)).xy) * uPoint.y * mag / (zImg * uPoint.w);
  float gust = uStorm.w * smoothstep(${n(STORM_PACE.fromPx)}, ${n(STORM_PACE.toPx)}, pace);
  float classed = 1.0 - (1.0 - smears) * (1.0 - sharps) * (1.0 - fines);
  float gusty = afloat * max(gust, (1.0 - glints) * (1.0 - classed) * (1.0 - shown));
  float soft = gusty * (smears + ${n(STORM_FINE_SOFT)} * fines);
  rPx = mix(rPx, min(rPx, mix(${n(STORM_MOST_PX)}, ${n(STORM_GLITTER_PX)}, glints) * uPoint.w), gusty * (1.0 - smears));
  float coc = uAperture.w * uPoint.y * (1.0 / zImg - uAperture.z);
  float byGlass = smoothstep(${n(LENS_LOOK.glassFrom)}, 1.0, length(nowW - uLensCentre) / uLens.w) * smoothstep(0.0, 0.3, depth) * step(fract(h.y * 29.0), ${n(LENS_LOOK.glassShare)});
  float blur = uBlur.z * (1.0 - exp(-((coc > 0.0 ? coc * uBlur.x : -coc * uBlur.y) + uTone.w * mix(${n(LENS_LOOK.glassDiscLow)}, ${n(LENS_LOOK.glassDiscHigh)}, fract(h.y * 173.0)) * byGlass * byGlass) / uBlur.z)) * afloat;
  vec3 rimAxis = cross(normalize(placed.xyz - eye), uLensCentre - eye);
  float rim = on > 0.5 ? 1.0 - smoothstep(0.9, 0.985, length(rimAxis) / R) : 1.0;

  vec2 streak = vec2(0.0);
  vec3 moved = (aNow - aPrev) * shut;
  if (gusty > 0.0) {
    vec3 current = veilCurrent(nowL);
    moved = mix(moved, current * (length(moved) * (dot(moved, current) < 0.0 ? -1.0 : 1.0)), ${n(STORM_ALIGN)} * gusty * uVeilRoll.x);
    moved *= mix(1.0, mix(${n(STORM_DAB_REACH.low)}, ${n(STORM_DAB_REACH.high)}, pow(fract(h2.z * 71.0), ${n(STORM_DAB_REACH.skew)})), gusty * smears) * mix(1.0, ${n(STORM_SHARP_REACH)}, gusty * sharps);
  }
  mat3 toView = mat3(modelViewMatrix);
  if (afloat > 0.5 && dot(moved, moved) > 1e-8) {
    #ifdef POINT_SPRITES
    streak = (toView * moved).xy * (uPoint.y * mag / zImg);
    #else
    vec3 aheadW = (modelMatrix * vec4(nowL + moved * 0.5, 1.0)).xyz;
    vec4 aheadV = viewMatrix * vec4(lensPlace(aheadW, eye).xyz, 1.0);
    aheadV.xy += uAperture.xy;
    streak = 2.0 * uPoint.y * (aheadV.xy / -aheadV.z - view.xy / -view.z);
    #endif
    float span = length(streak);
    streak *= uLimit.x / (uLimit.x + span);
  }
  float halfLong = 0.5 * length(streak);
  vec2 along = halfLong > 1e-4 ? streak / (2.0 * halfLong) : vec2(1.0, 0.0);

  float sigma = 0.5 * blur;
  float s2x = sigma * sigma + (${n(PIXEL_SIGMA2)} + ${n(GLINT_SOFT_PX * GLINT_SOFT_PX)} * glints) * uPoint.w * uPoint.w;
  if (lying > 0.5) {
    float merge = uLimit.z * rPx * smoothstep(uLying.z, uLying.w, stageCover(nowL.xz));
    s2x += merge * merge;
  }
  float core = ${n(LOBE_CORE)} * rPx * (shape > 0.5 && shape < 1.5 ? ${n(MEAN_LOBE)} : 1.0);
  float c2 = core * core;
  float bright = pow(fract(h.w * 37.0), ${n(STORM_SMEAR_SKEW)});
  float smear = soft * mix(${n(STORM_SMEAR_LOW_PX)}, ${n(STORM_SMEAR_HIGH_PX)}, fract(h.y * 53.0) * (1.0 - ${n(STORM_DAB_TIGHT)} * bright)) * mix(${n(STORM_SMEAR_FAR)}, ${n(STORM_SMEAR_NEAR)}, smoothstep(-0.4, 0.9, depth)) * mix(${n(STORM_SLOW.keep)}, 1.0, smoothstep(${n(STORM_SLOW.fromPx)}, ${n(STORM_SLOW.toPx)}, halfLong / uPoint.w)) * uPoint.w;
  s2x += smear * smear;
  float still = pow(c2 / (c2 + s2x), ${n(BLUR_HOLD)});
  float stretch = pointSpread(halfLong, c2 + s2x);
  float amp = still / stretch;
  float held = 1.0;
  if (gusty > 0.0) {
    vec4 stir = veilStir(nowL);
    float clump = min(${n(CLUMP.floor)} + ${n(CLUMP.gain)} * stir.x * mix(${n(CLUMP.core)}, 1.0, stir.y), ${n(CLUMP.most)});
    vec3 eyeL = (uGlobeInv * vec4(eye, 1.0)).xyz;
    vec2 flow2 = (toView * veilTangent(veilOnDisc(eyeL, normalize(nowL - eyeL)))).xy;
    float rollWith = abs(dot(normalize((toView * moved).xy + 1e-9), normalize(flow2 + 1e-9)));
    float want = smears * ${n(STORM_SMEAR)} * mix(${n(STORM_SMEAR_FAINT)}, ${n(STORM_SMEAR_BRIGHT)}, bright) * mix(${n(STORM_DAB_SLOW)}, 1.0, smoothstep(${n(STORM_SLOW.fromPx)}, ${n(STORM_SLOW.toPx)}, halfLong / uPoint.w)) + sharps * ${n(STORM_SHARP)} + fines * mix(${n(STORM_FINE_HIGH)}, ${n(STORM_FINE_LOW)}, fine);
    float full = pow(stretch, ${n(1 - STORM_STREAK_DIM)}) / max(still, 0.02) * mix(${n(STORM_FAR)}, 1.0, smoothstep(-0.9, 0.0, depth)) * mix(${n(STORM_OFF_DISC)}, 1.0, veilDisc(nowL)) * mix(1.0, mix(${n(STORM_CROSS.keep)}, 1.0, smoothstep(${n(STORM_CROSS.from)}, ${n(STORM_CROSS.to)}, rollWith)), smoothstep(${n(STORM_CROSS.fromPx)}, ${n(STORM_CROSS.toPx)}, halfLong / uPoint.w)) * mix(1.0, mix(mix(${n(STORM_WINDOW.small)}, ${n(STORM_WINDOW.floor)} * bright, smears), 1.0, smoothstep(${n(STORM_WINDOW.from)}, ${n(STORM_WINDOW.to)}, length((nowL.xy - vec2(${n(STORM_WINDOW.x)}, ${n(STORM_WINDOW.y)})) / vec2(${n(STORM_WINDOW.wide)}, ${n(STORM_WINDOW.high)})))), smoothstep(${n(STORM_WINDOW.back)}, ${n(STORM_WINDOW.front)}, nowL.z)) * (1.0 - ${n(STORM_SIDE)} * nowL.x / uLens.w) * mix(1.0, ${n(STORM_TOP.keep)}, smoothstep(${n(STORM_TOP.from)}, ${n(STORM_TOP.to)}, nowL.y / uLens.w));
    held = mix(1.0, glints > 0.5 ? ${n(STORM_GLITTER)} * full : clump * (want > 0.0 ? want * full : ${n(STORM_THIN)}), gusty);
  }
  held *= mix(1.0, mix(${n(STORM_PACE.unseen)}, 1.0, gust), afloat * classed * (1.0 - shown));
  held *= 1.0 - ${n(STORM_WALL.dim)} * smoothstep(${n(STORM_WALL.from)}, ${n(STORM_WALL.to)}, nowL.x / uLens.w) * uStorm.x * afloat;

  vec3 axis = normalize(h.xyz * 2.0 - 1.0 + 1e-3);
  float angle = aData.w + 6.2831853 * h.w;
  float ca = cos(angle);
  float sa = sin(angle);
  int variant = int(min(h2.x * uLobeRows, uLobeRows - 1.0));
  vec3 tilt = h2.yzw * 2.0 - 1.0;
  vec3 longAxis = normalize(tilt + 1e-3);
  mat3 shapeView = toView * (mat3(1.0) + (afloat * mix(${n(STRETCH_LOW)}, ${n(STRETCH_HIGH)}, fract(h2.x * 467.0))) * outerProduct(longAxis, longAxis));
  vL0 = pointLobe(0, pid, variant, shape, axis, ca, sa, lying, rPx, shapeView);
  vL1 = pointLobe(1, pid, variant, shape, axis, ca, sa, lying, rPx, shapeView);
  vL2 = pointLobe(2, pid, variant, shape, axis, ca, sa, lying, rPx, shapeView);
  vL3 = pointLobe(3, pid, variant, shape, axis, ca, sa, lying, rPx, shapeView);
  vL4 = pointLobe(4, pid, variant, shape, axis, ca, sa, lying, rPx, shapeView);

  vec3 keyTo;
  vec3 keyIn = stageKeyIn(nowL, keyTo);
  vec3 gridCol;
  vec3 gridTo;
  float gridAir;
  float gridShade;
  stageGridLit(nowL, gridCol, gridTo, gridAir, gridShade);
  float gridLen = length(gridTo);
  float gridFace = mix(uGridShade.x, stageWrap(gridTo.y / max(gridLen, 1e-4), uGridShade.y), min(gridLen, 1.0));
  vec3 cardIn = uRigCardCol * (uRigInside.x * uRigCard.w * mix(uGridShade.w, 1.0, gridAir));
  float cardFace = stageWrap((uLightFrame * uRigCardDir).y, uRigCard.x) * 0.31831;
  vec3 base = stageSoftIn(nowL) + gridCol * mix(uTone.y, gridFace, lying) + cardIn * mix(uRigPoint.x * ${n(LIGHT_LOOK.cardShare)}, cardFace, lying);
  vec3 toEye = normalize((uGlobeInv * vec4(eye, 1.0)).xyz - nowL);
  vec3 face = lying > 0.5 ? normalize(vec3(0.0, 1.0, 0.0) + uLimit.w * tilt) : pointTurn(normalize(cross(axis, normalize(tilt + 1e-3))), axis, ca, sa);
  vec3 flash = vec3(0.0);
  for (int i = 0; i < ${LAMPS}; i++) {
    vec3 d = uLamp[i].xyz - nowL;
    float d2 = dot(d, d);
    vec3 dn = d / sqrt(d2 + 1e-4);
    float fall = 1.0 / (1.0 + d2 / (uLampCol[i].w * uLampCol[i].w));
    if (glints > 0.5) flash += uLampCol[i].rgb * (fall * uLamp[i].w * pointGlint(face, dn, toEye));
  }
  if (glints > 0.5) flash += keyIn * pointGlint(face, uLightFrame * keyTo, toEye) + uRigRimCol * (uRigInside.x * pointGlint(face, uLightFrame * uRigRimDir, toEye));
  flash *= look.w * pow(c2 / (c2 + s2x), ${n(1 - BLUR_HOLD)});
  float flashMost = max(flash.r, max(flash.g, flash.b));
  flash = mix(flash, vec3(flashMost), ${n(FLASH_WHITE)}) * min(1.0, ${n(FLASH_MOST)} / max(flashMost, 1e-3));
  flash *= mix(1.0, min(1.0, ${n(STORM_FLASH)} / max(flashMost, 1e-3)), glints * gusty);

  float reach = 1.2 * rPx + 2.6 * sqrt(s2x) + 1.0;
  vec2 ext = min(vec2(reach) + ${n(STREAK_REACH)} * halfLong * abs(along), vec2(uLimit.y));
  float byDisc = byGlass * byGlass * afloat * (1.0 - gusty);
  vFog = veilPath(eye, placed.xyz, nowW, placed.w);
  float alpha = aData.z * rim * held * (1.0 - ${n(STORM_VEILED)} * vFog.a * gusty * (1.0 - glints)) * mix(1.0, mix(${n(THIN_LOW)}, 1.0, smoothstep(${n(THIN_FROM)}, ${n(THIN_TO)}, fract(h2.y * 211.0))), afloat * (1.0 - gusty) * (1.0 - glints) * (1.0 - byGlass * byGlass)) * mix(1.0, mix(${n(LENS_LOOK.farDim)}, 1.0, smoothstep(${n(LENS_LOOK.farDimFrom)}, ${n(LENS_LOOK.farDimTo)}, depth)), afloat * (1.0 - gusty)) * mix(1.0, ${n(LYING_LOOK.alpha)}, lying) * mix(1.0, max(1.0, ${n(LENS_LOOK.glassDiscCover)} / max(amp, 0.01)), byDisc) * mix(1.0, smoothstep(${n(STORM_GLITTER_FROM)}, ${n(STORM_GLITTER_TO)}, flashMost), glints * gusty) * pow(c2 / (c2 + sigma * sigma), ${n(1 - BLUR_HOLD)} * smoothstep(${n(BLUR_STRICT_FROM_PX)} * uPoint.w, ${n(BLUR_STRICT_TO_PX)} * uPoint.w, sigma));
  #ifdef POINT_SPRITES
  float side = 2.0 * max(ext.x, ext.y);
  gl_PointSize = side;
  vCore = vec4(side, reach, amp, alpha);
  #else
  vec2 off = position.xy * ext;
  vCore = vec4(off, amp, alpha);
  clip.xy += off * vec2(projectionMatrix[0][0], projectionMatrix[1][1]) * (clip.w / uPoint.y);
  #endif
  vec4 nearer = projectionMatrix * vec4(view.xy, view.z + min((1.2 * rPx + 2.0 * sqrt(s2x)) * zImg / (uPoint.y * mag), ${n(LENS_LOOK.liftMostMm)}), 1.0);
  clip.z = nearer.z / nearer.w * clip.w;
  vStreak = vec4(along, halfLong, s2x);
  vKind = vec4(aData.y, lying, float(pid & 4095u) + 0.01 + 0.98 * gusty, flash.r);
  vec3 warmth = mix(vec3(1.0), vec3(${LENS_LOOK.glassDiscWarm.map(n).join(', ')}), byDisc * step(fract(h.y * 311.0), ${n(LENS_LOOK.glassDiscWarmShare)}));
  vec3 lit = base * warmth * (1.0 + ${n(STORM_DAB_LIGHT - 1)} * gusty * smears * bright);
  vGrid = vec4(lit * min(1.0, ${n(LIT_MOST)} / max(max(lit.r, max(lit.g, lit.b)), 1e-3)), flash.g);
  vDom = vec4(keyIn * uRigPoint.x * warmth, flash.b);
  gl_Position = aState > 2.5 || alpha <= 0.0 ? vec4(2.0, 2.0, 2.0, 1.0) : clip;
`

export const FRAG = `
uniform vec4 uKindColor[${MAX_KINDS}];
uniform vec4 uKindPart[${MAX_KINDS}];
uniform vec4 uKindLook[${MAX_KINDS}];
uniform vec3 uUpLocal;
uniform vec4 uTone;
uniform float uPointChange;
uniform mat4 modelViewMatrix;
${VARYINGS}
void pointAdd(vec4 lobe, vec2 p, inout float f, inout vec3 nrm) {
  float r = ${n(LOBE_CORE)} * lobe.z;
  float r2 = r * r;
  if (r2 <= 0.0) return;
  float s2 = r2 + vStreak.w;
  vec2 q = p - lobe.xy;
  float t = dot(q, vStreak.xy);
  q -= vStreak.xy * clamp(t, -vStreak.z, vStreak.z);
  float u = min(abs(t) / max(vStreak.z, 1e-3), 1.0);
  float long2 = vStreak.z * vStreak.z;
  float sharp = r2 / s2;
  float g = pow(sharp, ${n(BLUR_HOLD)}) / pointSpread(vStreak.z, s2) * exp(-0.5 * dot(q, q) / s2) * (1.0 - ${n(STREAK_TAPER)} * u * u * u * u * long2 / (long2 + s2));
  f += g;
  nrm += g * (1.0 + 0.6 * lobe.w) * vec3(q / lobe.z * sharp, sqrt(max(1.0 - dot(q, q) / (lobe.z * lobe.z), 0.05)));
}
void main() {
  int kind = int(vKind.x + 0.5);
  float lying = vKind.y;
  vec4 k = uKindColor[kind];
  vec4 look = uKindLook[kind];
  #ifdef POINT_SPRITES
  vec2 p = (gl_PointCoord - 0.5) * vec2(vCore.x, -vCore.x);
  vec2 off = p - vStreak.xy * clamp(dot(p, vStreak.xy), -${n(STREAK_REACH)} * vStreak.z, ${n(STREAK_REACH)} * vStreak.z);
  if (dot(off, off) > vCore.y * vCore.y) discard;
  #else
  vec2 p = vCore.xy;
  #endif
  float f = 0.0;
  vec3 nrm = vec3(0.0, 0.0, 1e-3);
  pointAdd(vL0, p, f, nrm);
  pointAdd(vL1, p, f, nrm);
  pointAdd(vL2, p, f, nrm);
  pointAdd(vL3, p, f, nrm);
  pointAdd(vL4, p, f, nrm);
  float amp = vCore.z;
  vec3 flash = vec3(vKind.w, vGrid.w, vDom.w);
  float lit = clamp(max(flash.r, max(flash.g, flash.b)), 0.0, 1.0);
  float r0 = ${n(LOBE_CORE)} * vL0.z;
  float crisp = smoothstep(0.05, 0.5, r0 * r0 / (r0 * r0 + vStreak.w));
  float soft = clamp((fract(vKind.z) - 0.01) * ${n(1 / 0.98)}, 0.0, 1.0);
  float body = mix(smoothstep(mix(${n(EDGE_SOFT_LOW)}, ${n(EDGE_CRISP_LOW)}, crisp) * amp, mix(${n(EDGE_SOFT_HIGH)}, ${n(EDGE_CRISP_HIGH)}, crisp) * amp, f), min(f / ((look.x > 1.5 ? 1.0 : ${n(STORM_SOFT_TOP)}) * amp), 1.0), soft);
  float cover = min(amp * body * vCore.w * mix(look.z, 1.0, lit), 1.0);
  if (uDiag == ${viewCode('cover')}) {
    gl_FragColor = vec4(cover, 0.0, cover, cover);
    return;
  }
  #ifdef POINT_HASH
  if (cover <= stageHash(vec3(gl_FragCoord.xy, uSeed + vKind.z * 0.013))) discard;
  cover = 1.0;
  #else
  if (cover < 0.003) discard;
  #endif
  if (uDiag != 0) {
    if (cover < 0.5) discard;
    vec4 part = uKindPart[kind];
    if (uDiag == ${viewCode('ids')}) gl_FragColor = vec4(part.rgb, 1.0);
    else if (uDiag == ${viewCode('standins')}) gl_FragColor = vec4(part.rgb * part.a, 1.0);
    else gl_FragColor = stageDiag(k.rgb, inverseTransformDirection(normalize(nrm), viewMatrix), vFog.a, uPointChange, 0.0);
    return;
  }
  mat3 toView = mat3(modelViewMatrix);
  vec3 upV = normalize(toView * uUpLocal);
  vec3 nv = normalize(mix(normalize(nrm), upV, 0.55 * lying));
  float nk = dot(nv, normalize(mat3(viewMatrix) * stageKeyBent(vStageLocal)));
  float kd = stageWrap(nk, uTone.x);
  float keyShare = mix(${n(LIGHT_LOOK.keyFloor)} + ${n(LIGHT_LOOK.keySide)} * kd * kd, stageWrap(nk, uRigInside.z) * 0.31831 / max(uRigPoint.x, 1e-3), lying);
  vec3 light = vGrid.rgb * (1.0 + ${n(LIGHT_LOOK.skyTilt)} * dot(nv, upV)) + vDom.rgb * keyShare;
  vec3 col = k.rgb * light * mix(1.0, ${n(LYING_LOOK.shade)}, lying);
  col = mix(col, uVeil.rgb * vFog.rgb, vFog.a * mix(uTone.z, 1.0, lying));
  col += flash * k.rgb * k.a;
  gl_FragColor = vec4(col * cover, cover);
}`

