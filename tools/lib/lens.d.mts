export const LENS_STEPS: number
export const lensRadiusMm: number
export const innerRadiusMm: number
export const lensIor: number
export const sphereCentreMm: number
export function lensPlace(p: readonly number[], eye: readonly number[], centre: readonly number[], radius?: number, ior?: number, steps?: number): { apparent: [number, number, number]; exit: [number, number, number]; pathMm: number; seen: boolean }
export function refractInto(origin: readonly number[], dir: readonly number[], centre: readonly number[], radius?: number, ior?: number): { origin: [number, number, number]; dir: [number, number, number] } | null
