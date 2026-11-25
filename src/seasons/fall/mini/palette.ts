import type { Rgb } from '../../../core/materials'

export const season = 'fall'
export const isTree = (role: string): boolean => role === 'trunk' || role === 'crown'

export const tones: Record<'lamp' | 'flame' | 'lampLight' | 'purple' | 'purpleDrape' | 'purpleLight' | 'green' | 'greenDrape' | 'greenLight' | 'pumpkinLight' | 'ember' | 'emberLight' | 'pondLight' | 'haloEdge' | 'haloCore' | 'moss' | 'water' | 'fogGlint', Rgb> = {
  lamp: [1, 0.6, 0.24],
  flame: [1, 0.88, 0.62],
  lampLight: [1, 0.58, 0.3],
  purple: [0.62, 0.13, 1],
  purpleDrape: [0.42, 0.06, 0.8],
  purpleLight: [0.72, 0.3, 1],
  green: [0.16, 1, 0.12],
  greenDrape: [0.06, 0.62, 0.08],
  greenLight: [0.3, 1, 0.28],
  pumpkinLight: [1, 0.5, 0.14],
  ember: [1, 0.55, 0.18],
  emberLight: [1, 0.5, 0.2],
  pondLight: [0.25, 1, 0.42],
  haloEdge: [0.85, 0.34, 0.05],
  haloCore: [1, 0.62, 0.2],
  moss: [0.075, 0.105, 0.03],
  water: [0.006, 0.016, 0.014],
  fogGlint: [0.12, 0.62, 0.3],
}
