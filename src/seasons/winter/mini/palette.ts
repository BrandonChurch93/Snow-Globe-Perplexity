import type { Rgb } from '../../../core/materials'
import type { Palette } from '../../blockout'

export const season = 'winter'
export const palette: Palette = { ground: [0.82, 0.86, 0.92], cottage: [0.42, 0.36, 0.32], roof: [0.3, 0.12, 0.09], chimney: [0.3, 0.25, 0.23], trunk: [0.16, 0.1, 0.07], crown: [0.1, 0.24, 0.16], post: [0.03, 0.03, 0.035], lamp: [0.9, 0.7, 0.4], pond: [0.5, 0.62, 0.72], fence: [0.3, 0.22, 0.16], path: [0.5, 0.52, 0.56] }
export const isTree = (role: string): boolean => role === 'trunk' || role === 'crown'

export const tones: Record<'snow' | 'bulb' | 'lamp' | 'flame' | 'room' | 'curtain' | 'rime' | 'dust' | 'iceDeep' | 'icePale' | 'smoke' | 'sheen' | 'bulbLight' | 'lampLight' | 'roomLight' | 'haloEdge' | 'haloCore', Rgb> = {
  snow: [0.97, 0.975, 0.985],
  bulb: [1, 0.7, 0.4],
  lamp: [1, 0.62, 0.26],
  flame: [1, 0.9, 0.68],
  room: [1, 0.52, 0.15],
  curtain: [0.86, 0.38, 0.13],
  rime: [0.72, 0.82, 0.95],
  dust: [0.83, 0.88, 0.96],
  iceDeep: [0.45, 0.62, 0.77],
  icePale: [0.68, 0.73, 0.79],
  smoke: [0.64, 0.53, 0.5],
  sheen: [0.78, 0.87, 1],
  bulbLight: [1, 0.58, 0.3],
  lampLight: [1, 0.56, 0.33],
  roomLight: [1, 0.56, 0.33],
  haloEdge: [0.85, 0.36, 0.05],
  haloCore: [1, 0.62, 0.2],
}
