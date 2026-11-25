import type { Rgb } from '../../../core/materials'

export const season = 'spring'
export const isTree = (role: string): boolean => role === 'trunk' || role === 'crown'

export const tones: Record<'lamp' | 'flame' | 'room' | 'curtain' | 'pane' | 'lampLight' | 'roomLight' | 'haloEdge' | 'haloCore' | 'pool' | 'moss' | 'waterDeep' | 'waterPale' | 'bed' | 'bark' | 'blossom' | 'twig', Rgb> = {
  lamp: [1, 0.66, 0.3],
  flame: [1, 0.9, 0.68],
  room: [1, 0.56, 0.17],
  curtain: [0.9, 0.42, 0.14],
  pane: [0.9, 0.8, 0.66],
  lampLight: [1, 0.6, 0.34],
  roomLight: [1, 0.58, 0.32],
  haloEdge: [0.9, 0.42, 0.08],
  haloCore: [1, 0.68, 0.26],
  pool: [1, 0.55, 0.24],
  moss: [0.16, 0.24, 0.045],
  waterDeep: [0.11, 0.115, 0.13],
  waterPale: [0.4, 0.37, 0.38],
  bed: [0.13, 0.14, 0.075],
  bark: [0.2, 0.15, 0.118],
  blossom: [1, 1, 1],
  twig: [1, 1, 1],
}
