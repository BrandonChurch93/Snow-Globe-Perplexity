const TAU = Math.PI * 2
const C = 12

const n = (v: number): string => String(Math.round(v * 100) / 100)
const at = (radius: number, turn: number): string => `${n(C + radius * Math.sin(turn * TAU))} ${n(C - radius * Math.cos(turn * TAU))}`
const offset = (radius: number, turn: number, step: number, stepTurn: number): string =>
  `${n(C + radius * Math.sin(turn * TAU) + step * Math.sin(stepTurn * TAU))} ${n(C - radius * Math.cos(turn * TAU) - step * Math.cos(stepTurn * TAU))}`

function snowflake(): string {
  let d = ''
  for (let i = 0; i < 3; i++) d += `M${at(9.5, i / 6)}L${at(9.5, i / 6 + 0.5)}`
  for (let i = 0; i < 6; i++) {
    const t = i / 6
    d += `M${offset(6.1, t, 2.7, t - 1 / 6)}L${at(6.1, t)}L${offset(6.1, t, 2.7, t + 1 / 6)}`
  }
  return `<path d="${d}"/>`
}

function blossom(): string {
  const reach = 5.5
  const petal = 3.75
  const half = reach * Math.sin(TAU / 10)
  const cusp = reach * Math.cos(TAU / 10) + Math.sqrt(petal * petal - half * half)
  let d = `M${at(cusp, -0.1)}`
  for (let i = 0; i < 5; i++) d += `A${petal} ${petal} 0 1 1 ${at(cusp, i / 5 + 0.1)}`
  d += 'Z'
  for (let i = 0; i < 5; i++) d += `M${at(cusp, i / 5 + 0.1)}L${at(cusp - 2.5, i / 5 + 0.1)}`
  return `<path d="${d}"/><circle cx="12" cy="12" r="1.25"/>`
}

function sun(): string {
  let d = ''
  for (let i = 0; i < 8; i++) d += `M${at(6.9, i / 8)}L${at(9.3, i / 8)}`
  return `<circle cx="12" cy="12" r="3.9"/><path d="${d}"/>`
}

function leaf(): string {
  return (
    '<path d="M7.1 17C5.6 10.4 10.6 5.3 19.2 4.8C18.7 13.4 13.6 18.4 7.1 17Z"/>' +
    '<path d="M4.4 19.6L13.9 10.1M10.2 13.8L10 10.1M10.2 13.8L13.9 14"/>'
  )
}

const frame = (inner: string, name: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" data-glyph="${name}">${inner}</svg>`

export const seasonGlyphs: readonly string[] = [frame(snowflake(), 'snowflake'), frame(blossom(), 'blossom'), frame(sun(), 'sun'), frame(leaf(), 'leaf')]

export const shakeGlyph = (globe: string, arcs: string): string =>
  frame(
    `<g class="${globe}"><circle cx="12" cy="10.1" r="6.3"/><path d="M9.2 15.75L7.9 19.2H16.1L14.8 15.75"/><path d="M8.7 8.5C9.2 7.3 10.1 6.5 11.3 6.2" stroke-width="1.1"/></g>` +
      `<path class="${arcs}" d="M3.4 6.9C2.5 9 2.5 11.4 3.4 13.5M20.6 6.9C21.5 9 21.5 11.4 20.6 13.5"/>`,
    'shake',
  )

export const soundGlyph = (waves: string, cross: string): string =>
  frame(
    '<path d="M4.6 9.6H7.4L11.4 6.2V17.8L7.4 14.4H4.6Z"/>' +
      `<path class="${waves}" d="M14.7 9.5C15.8 11 15.8 13 14.7 14.5M17.3 7.3C19.6 10.1 19.6 13.9 17.3 16.7"/>` +
      `<path class="${cross}" d="M15.4 9.7L20 14.3M20 9.7L15.4 14.3"/>`,
    'sound',
  )
