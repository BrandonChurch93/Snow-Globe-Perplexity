export const APP_SCRIPTS = ['shake', 'stir', 'drag', 'jump']

const span = (first, end, stride) => {
  const out = []
  for (let i = first; i < end; i += stride) out.push(i)
  return out
}

function even(first, last, count) {
  if (last - first + 1 <= count) return span(first, last + 1, 1)
  const out = []
  for (let k = 0; k < count; k++) out.push(first + Math.round((k * (last - first)) / (count - 1)))
  return [...new Set(out)]
}

// Close together from the first frame, then further and further apart up to the last: for a motion that starts at once and dies away slowly.
function widening(first, last, count, stride) {
  const close = Math.ceil(count / 2)
  const out = span(first, Math.min(last + 1, first + close * stride), stride)
  const from = out[out.length - 1]
  const left = count - out.length
  for (let k = 1; k <= left; k++) out.push(Math.min(last, from + Math.max(k, Math.round((last - from) ** (k / left)))))
  return [...new Set(out)].sort((a, b) => a - b)
}

export function appMarks(plan, shake, beatsPerBar) {
  const marks = plan.events.map((e) => ({ frame: e.frame, what: e.what }))
  if (plan.name === 'shake' || plan.name === 'jump') {
    const [press, landing] = plan.events.map((e) => e.frame)
    const beat = (landing - press) / beatsPerBar
    const at = (beats) => press + Math.round(beats * beat)
    marks.push(
      { frame: at(shake.liftBeats), what: 'the lift ends and the strokes begin' },
      { frame: at(shake.swapWindow.fromBeat), what: 'the swap window opens' },
      { frame: at(shake.swapWindow.toBeat), what: 'the swap window closes' },
      { frame: at(shake.liftBeats + shake.strokeBeats), what: 'the strokes end and the set down begins' },
    )
  }
  return marks.sort((a, b) => a.frame - b.frame)
}

export function appParts(plan, per) {
  const last = plan.frameCount - 1
  const whole = { id: 'whole', what: 'across the whole script', frames: even(0, last, per), stride: 0 }
  const press = plan.events[0].frame
  if (plan.name === 'shake' || plan.name === 'jump') {
    const landing = plan.events[1].frame
    const sheets = plan.name === 'shake' ? 3 : 2
    const a = Math.max(1, Math.ceil((landing - press) / (sheets * per)))
    const b = Math.max(1, Math.ceil(plan.fps / per))
    const bar = { id: 'bar', what: 'the lift, the strokes and the set down, from the press to the landing', frames: span(press, landing, a), stride: a }
    const land = { id: 'landing', what: 'the first second after the landing', frames: span(landing, Math.min(plan.frameCount, landing + plan.fps), b), stride: b }
    return { all: [whole, bar, land], usual: plan.name === 'shake' ? ['whole', 'bar', 'landing'] : ['bar', 'landing'] }
  }
  if (plan.name === 'stir') {
    const stride = Math.max(1, Math.round(plan.fps / 20))
    return { all: [whole, { id: 'turn', what: 'the liquid starting to turn and dying away, from the pointer going down to the end of the script', frames: widening(press, last, per, stride), stride: 0, close: stride }], usual: ['turn'] }
  }
  return { all: [whole, { id: 'turn', what: 'the camera turning to its limit and easing back, from the pointer going down to the end of the script', frames: even(press, last, per), stride: 0 }], usual: ['turn'] }
}

export function appSpacing(part, fps) {
  const f = part.frames
  const n = (k) => `${k} frame${k === 1 ? '' : 's'}`
  if (part.stride > 0) return `${n(part.stride)} apart at ${fps} frames a second`
  if (part.close) return `${n(part.close)} apart for the first ${Math.ceil(f.length / 2)}, then further and further apart, at ${fps} frames a second`
  const gaps = f.slice(1).map((v, k) => v - f[k])
  const lo = Math.min(...gaps)
  const hi = Math.max(...gaps)
  return gaps.length ? `${lo === hi ? n(lo) : `${lo} or ${hi} frames`} apart at ${fps} frames a second` : `one frame`
}

// What a critic reads beside a sheet made with --plain: it may name no season, the truth stays in the record's spec.
export const namesSeason = (text, seasons) => seasons.find((s) => new RegExp(`\\b${s}\\b`, 'i').test(text)) ?? ''
// What a tile's label says after its frame and its time. A plain sheet never says the season.
export const appLabelKind = (name, plain = false) => (name === 'drag' ? 'yaw' : name === 'stir' || plain ? '' : 'season')
export const plainSeasonsLegend = (count) => `the at-rest stills on one sheet; each tile is labelled only with its place on the sheet, 1 to ${count}`

export function appLegend(spec, seasons = []) {
  const p = spec.plan
  const secs = (i) => `${(i / p.fps).toFixed(2)} s`
  const name = (spec.plain ? { shake: 'a shake', jump: 'a jump to another season', stir: 'a stir of the liquid', drag: 'a drag around the globe' } : { shake: `a shake from ${p.from} to ${p.to}`, jump: `a jump from ${p.from} to ${p.to}`, stir: `a stir of the liquid in ${p.from}`, drag: `a drag around the globe in ${p.from}` })[p.name] ?? p.name
  const f = spec.frames
  // The script's own words name its seasons ("the landing in spring"): a plain legend says the new season, the old season.
  const unnamed = (what) => seasons.reduce((t, s) => t.replace(new RegExp(`\\b${s}\\b`, 'gi'), s === p.to && p.to !== p.from ? 'the new season' : s === p.from ? 'the old season' : 'another season'), what)
  const marks = (spec.marks ?? []).map((m) => `frame ${m.frame} (${secs(m.frame)}) ${spec.plain ? unnamed(m.what) : m.what}`).join('; ')
  const label = { season: ', its time and the season the app holds, written as the old season to the new one from the press to the landing', yaw: ", its time and the camera's turn around the globe in degrees" }[spec.label] ?? ' and its time'
  const text = `${name} in the app, ${spec.what}${spec.sheets > 1 ? `, sheet ${spec.sheet} of ${spec.sheets}` : ''}: frames ${f[0]} to ${f[f.length - 1]} of the script's ${p.frameCount}, ${spec.spacing}. Each tile is labelled with its frame${label}. In the script: ${marks}`
  const named = spec.plain ? namesSeason(text, seasons) : ''
  if (named) throw new Error(`the plain legend of the ${p.name} script names a season, ${named}: ${text}`)
  return text
}
