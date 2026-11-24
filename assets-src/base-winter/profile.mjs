import { loadConfig } from '../../tools/lib/paths.mjs'

const G = loadConfig().globe
export const SPHERE_R = G.sphereDiameterMm / 2
export const TOP = G.baseHeightMm
export const CENTRE_H = G.baseHeightMm - G.collarDepthMm + SPHERE_R
export const FOOT_R = 58.8

export const sphereRadiusAt = (h) => Math.sqrt(Math.max(SPHERE_R * SPHERE_R - (CENTRE_H - h) * (CENTRE_H - h), 0))

export const RIM = { r: FOOT_R, top: 3.6, chamfer: 0.35 }
export const ROPE = { ringR: 57.25, h: 4.95, tube: 1.5, strands: 96 }
export const BEAD = { ringR: 56.55, h: 7.55, tube: 0.95 }
export const LIP = { ringR: 53.7, h: TOP - 0.1, tube: 1.05 }
export const LEDGE = { inner: 42.4, outer: 52.75, h: TOP - 0.05, dish: 0.25 }
export const COLLAR = { top: TOP + 2.1, outer: 42.4, crown: 41.15, gap: 0.12 }
export const CUP = { depth: 0.6 }

export const BODY = [
  [56.2, 8.35],
  [56.55, 9.2],
  [56.5, 10.6],
  [56.15, 12.2],
  [55.55, 13.9],
  [54.7, 15.8],
  [53.6, 17.9],
  [52.5, 20.0],
  [51.55, 22.2],
  [50.85, 24.4],
  [50.5, 26.4],
  [50.5, 28.2],
  [50.8, 29.8],
  [51.4, 31.0],
  [52.3, 31.7],
]

export const CARVING = { low: 9.4, high: 22.6 }

export const PROFILE_NOTES = [
  `rim: radius ${RIM.r}, from the slab to ${RIM.top}`,
  `rope ring: centre radius ${ROPE.ringR}, height ${ROPE.h}, strand radius ${ROPE.tube}, ${ROPE.strands} strands`,
  `bead: centre radius ${BEAD.ringR}, height ${BEAD.h}, radius ${BEAD.tube}`,
  `body, radius at height: ${BODY.map(([r, h]) => `${r}@${h}`).join(' ')}`,
  `ledge lip: centre radius ${LIP.ringR}, height ${LIP.h.toFixed(2)}, radius ${LIP.tube}`,
  `ledge floor: radius ${LEDGE.inner} to ${LEDGE.outer} at height ${LEDGE.h.toFixed(2)}`,
  `collar: crown radius ${COLLAR.crown} at height ${COLLAR.top.toFixed(2)}, glass radius there ${sphereRadiusAt(COLLAR.top).toFixed(2)}`,
]

export function ring() {
  const out = []
  out.push([RIM.r, 0, '#ff4040'], [RIM.r, RIM.top, '#ff4040'])
  out.push([ROPE.ringR + ROPE.tube, ROPE.h, '#ffd040'], [ROPE.ringR, ROPE.h + ROPE.tube, '#ffd040'])
  out.push([BEAD.ringR + BEAD.tube, BEAD.h, '#40ff80'], [BEAD.ringR, BEAD.h + BEAD.tube, '#40ff80'])
  for (const [r, h] of BODY) out.push([r, h, '#40c0ff'])
  out.push([LIP.ringR + LIP.tube, LIP.h, '#ff40ff'], [LIP.ringR, LIP.h + LIP.tube, '#ff40ff'], [LIP.ringR, LIP.h - LIP.tube, '#ff40ff'])
  out.push([LEDGE.inner, LEDGE.h, '#ffffff'])
  out.push([COLLAR.crown, COLLAR.top, '#ffff00'], [sphereRadiusAt(COLLAR.top), COLLAR.top, '#00ffff'])
  return out
}
