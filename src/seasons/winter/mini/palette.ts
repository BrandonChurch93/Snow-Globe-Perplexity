import type { Palette } from '../../blockout'

export const season = 'winter'
export const palette: Palette = { ground: [0.82, 0.86, 0.92], cottage: [0.42, 0.36, 0.32], roof: [0.3, 0.12, 0.09], chimney: [0.3, 0.25, 0.23], trunk: [0.16, 0.1, 0.07], crown: [0.1, 0.24, 0.16], post: [0.03, 0.03, 0.035], lamp: [0.9, 0.7, 0.4], pond: [0.5, 0.62, 0.72], fence: [0.3, 0.22, 0.16], path: [0.5, 0.52, 0.56] }
export const isTree = (role: string): boolean => role === 'trunk' || role === 'crown'
