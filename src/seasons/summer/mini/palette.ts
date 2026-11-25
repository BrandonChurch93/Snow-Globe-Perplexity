import type { Rgb } from '../../../core/materials'

export const season = 'summer'
export const isTree = (role: string): boolean => role === 'trunk' || role === 'crown'

export const tones: Record<'lamp' | 'flame' | 'room' | 'curtain' | 'haze' | 'lampLight' | 'roomLight' | 'paperLight' | 'creamLight' | 'haloEdge' | 'haloCore' | 'waterDeep' | 'waterSky' | 'sun', Rgb> = {
  lamp: [1, 0.66, 0.3],
  flame: [1, 0.9, 0.66],
  room: [1, 0.6, 0.2],
  curtain: [0.9, 0.46, 0.16],
  haze: [0.9, 0.84, 0.7],
  lampLight: [1, 0.62, 0.34],
  roomLight: [1, 0.6, 0.32],
  paperLight: [1, 0.5, 0.2],
  creamLight: [1, 0.74, 0.42],
  haloEdge: [0.9, 0.4, 0.07],
  haloCore: [1, 0.68, 0.26],
  waterDeep: [0.016, 0.03, 0.03],
  waterSky: [1, 0.9, 0.72],
  sun: [1, 0.86, 0.6],
}
