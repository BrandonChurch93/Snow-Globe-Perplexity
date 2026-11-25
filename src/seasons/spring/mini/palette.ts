import type { Rgb } from '../../../core/materials'

export const season = 'spring'
export const isTree = (role: string): boolean => role === 'trunk' || role === 'crown'

export const tones: Record<'lamp' | 'flame' | 'room' | 'curtain' | 'pane' | 'lampLight' | 'roomLight' | 'haloEdge' | 'haloCore' | 'pool' | 'moss' | 'waterDeep' | 'waterPale' | 'bed' | 'bark' | 'blossom' | 'twig', Rgb> = {
  lamp: [1, 0.66, 0.3],
  flame: [1, 0.9, 0.68],
  room: [1, 0.47, 0.11],
  curtain: [0.9, 0.42, 0.14],
  pane: [0.9, 0.8, 0.66],
  lampLight: [1, 0.6, 0.34],
  roomLight: [1, 0.58, 0.32],
  haloEdge: [0.9, 0.42, 0.08],
  haloCore: [1, 0.68, 0.26],
  pool: [1, 0.55, 0.24],
  moss: [0.16, 0.24, 0.045],
  waterDeep: [0.04, 0.055, 0.055],
  waterPale: [0.55, 0.46, 0.48],
  bed: [0.13, 0.14, 0.075],
  bark: [1.62, 1.33, 1.2],
  blossom: [1.15, 1.02, 1.17],
  twig: [1, 1, 1],
}
