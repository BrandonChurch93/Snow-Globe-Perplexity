import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { config, shots } from '../src/config'
import { FRAME } from '../src/app/framing'
import { poseOfRig, reachOf, rigOf } from '../src/film/moves'
import { changeSpan } from '../src/shake/change'
import { makeShake, rimGapMm, shakeMotion, tiltSine, type GlobePose } from '../src/shake/table'

/**
 * Pictures and numbers for a person to look at, not assertions. Run with SHAKE_LOOKS=1.
 * SHAKE_FRAME=<png of a frame of the test shake from hero> and SHAKE_FRAME_INDEX=<its frame> mark the clearance on it.
 */
const WANTED = process.env.SHAKE_LOOKS === '1'
const OUT = path.join('out', 'work', 'shake')

const s = config.shake
const BEAT_S = 60 / config.film.defaultBpm
const FRAME_BEATS = 1 / config.film.fps / BEAT_S
const DEG = 180 / Math.PI
const FOOT_MM = config.globe.baseDiameterMm / 2
const TOP_ROOM = 0.045
const RIM_ROOM_MM = 1
const film = shots.filter((shot) => shot.kind === 'shake').map((shot) => shot.id)
const NAMES = ['test', ...config.seasons.map((season) => `test:${season}`), 'preroll', ...film, 'loop', ...Array.from({ length: FRAME.shakePaths }, (_, i) => `live-${i}`)]
const hero = poseOfRig(rigOf('hero'))
const roomOf = (g: GlobePose): number => (1 - reachOf(hero, g).top) / 2
const tiltOf = (g: GlobePose): number => Math.asin(Math.min(1, tiltSine(g.tiltX, g.tiltZ))) * DEG

const INK = '#1c2126'
const SOFT = '#8a9299'
const PAPER = '#f6f4ef'
const RULE = '#d9d5cc'
const BLUE = '#1f6fb5'
const RED = '#c2452f'
const GREEN = '#2f8f6b'
const AMBER = '#b9831b'
const FONT = 'font-family="DejaVu Sans, Arial, sans-serif"'

interface Line {
  f: (beat: number) => number
  colour: string
  width: number
  label?: string
  dash?: string
}

interface Panel {
  title: string
  unit: string
  lo: number
  hi: number
  ticks: number[]
  lines: Line[]
  rules?: { v: number; label: string; colour: string }[]
  dots?: { beat: number; v: number; label: string }[]
}

function curves(file: string): string {
  const W = 1200
  const left = 96
  const right = 28
  const top = 112
  const panelH = 166
  const gap = 44
  const END = 5
  const m = shakeMotion('test')
  const path0 = makeShake('test')
  const others = ['shake-1', 'shake-2', 'shake-3', 'shake-4', 'loop'].map((name) => ({ name, m: shakeMotion(name), p: makeShake(name) }))
  const span = changeSpan('base')
  const window = s.swapWindow.toBeat - s.swapWindow.fromBeat
  const outside = { from: s.swapWindow.fromBeat + span.from * window, to: s.swapWindow.fromBeat + span.to * window }
  const xOf = (beat: number): number => left + ((W - left - right) * beat) / END
  const speedOf = (mm: typeof m) => (b: number): number => Math.hypot(mm.at('x', b, 1), mm.at('y', b, 1), mm.at('z', b, 1)) / BEAT_S
  const thin = (f: (o: (typeof others)[number]) => (b: number) => number): Line[] => others.map((o) => ({ f: f(o), colour: SOFT, width: 1 }))
  const panels: Panel[] = [
    {
      title: 'Stroke along x',
      unit: 'mm',
      lo: -30,
      hi: 30,
      ticks: [-22, 0, 22],
      lines: [...thin((o) => (b) => o.p.poseAt(b).x), { f: (b) => path0.poseAt(b).x, colour: BLUE, width: 2.6 }],
      dots: m.plan.strokes.map((t) => ({ beat: t.beat, v: t.mm * Math.cos(m.plan.planAngle), label: (t.mm * Math.cos(m.plan.planAngle)).toFixed(1) })),
    },
    {
      title: 'Height',
      unit: 'mm',
      lo: -1,
      hi: 9,
      ticks: [0, 1, 4, s.liftMm],
      lines: [
        ...thin((o) => (b) => o.p.poseAt(b).y),
        { f: (b) => path0.poseAt(b).y, colour: BLUE, width: 2.6, label: 'centre of the foot' },
        { f: (b) => rimGapMm(path0.poseAt(b)), colour: RED, width: 2, label: 'lowest point of the rim' },
      ],
      rules: [
        { v: s.liftMm, label: `liftMm ${s.liftMm}`, colour: SOFT },
        { v: RIM_ROOM_MM, label: 'rim rule 1 mm', colour: RED },
      ],
    },
    {
      title: 'Tilt',
      unit: 'degrees',
      lo: -7,
      hi: 7,
      ticks: [-6, -3, 0, 3, 6],
      lines: [
        ...thin((o) => (b) => tiltOf(o.p.poseAt(b))),
        { f: (b) => path0.poseAt(b).tiltX * DEG, colour: GREEN, width: 1.8, label: 'about x (negative: top away from the lens)' },
        { f: (b) => path0.poseAt(b).tiltZ * DEG, colour: AMBER, width: 1.8, label: 'about z' },
        { f: (b) => tiltOf(path0.poseAt(b)), colour: BLUE, width: 2.6, label: 'whole angle' },
      ],
      rules: [{ v: s.tiltDeg, label: `tiltDeg ${s.tiltDeg}`, colour: SOFT }],
    },
    {
      title: 'Speed of the globe',
      unit: 'mm/s',
      lo: 0,
      hi: 540,
      ticks: [0, 150, 300, 450],
      lines: [...thin((o) => speedOf(o.m)), { f: speedOf(m), colour: BLUE, width: 2.6 }],
      dots: [{ beat: m.plan.fastest.beat, v: m.plan.fastest.mmPerBeat / BEAT_S, label: `${(m.plan.fastest.mmPerBeat / BEAT_S).toFixed(0)} mm/s` }],
    },
    {
      title: 'Pull on the globe',
      unit: 'g',
      lo: 0,
      hi: 2.8,
      ticks: [0, 1, 2],
      lines: [
        ...thin((o) => (b) => Math.hypot(o.m.at('x', b, 2), o.m.at('z', b, 2)) / BEAT_S / BEAT_S / 9810),
        { f: (b) => Math.abs(m.at('y', b, 2)) / BEAT_S / BEAT_S / 9810, colour: RED, width: 1.8, label: 'vertical' },
        { f: (b) => Math.hypot(m.at('x', b, 2), m.at('z', b, 2)) / BEAT_S / BEAT_S / 9810, colour: BLUE, width: 2.6, label: 'sideways' },
      ],
    },
  ]
  const H = top + panels.length * (panelH + gap) + 26
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`)
  out.push(`<rect width="${W}" height="${H}" fill="${PAPER}"/>`)
  out.push(`<text x="${left}" y="42" ${FONT} font-size="25" font-weight="700" fill="${INK}">The test shake: one bar at ${config.film.defaultBpm} beats a minute, then the settle</text>`)
  out.push(`<text x="${left}" y="69" ${FONT} font-size="15.5" fill="${SOFT}">Strong lines are the path named test. Thin grey lines are shake-1 to shake-4 and loop: no two alike.</text>`)
  out.push(`<text x="${left}" y="91" ${FONT} font-size="15.5" fill="${SOFT}">Shaded: the swap window. Darker: where the base and the dressing change, on the fastest stroke.</text>`)
  const marks = [
    { beat: 0, label: 'grip' },
    { beat: m.plan.liftOff, label: 'lift off' },
    { beat: m.parts.liftEnd, label: 'top of the lift' },
    { beat: m.parts.strokesEnd, label: 'set down starts' },
    { beat: m.parts.landing, label: 'landing' },
    { beat: m.endBeat, label: 'rest' },
  ]
  panels.forEach((p, k) => {
    const y0 = top + k * (panelH + gap) + 30
    const yOf = (v: number): number => y0 + panelH - ((v - p.lo) / (p.hi - p.lo)) * panelH
    out.push(`<text x="${left}" y="${y0 - 11}" ${FONT} font-size="18" font-weight="700" fill="${INK}">${p.title}<tspan font-weight="400" fill="${SOFT}">, ${p.unit}</tspan></text>`)
    out.push(`<rect x="${left}" y="${y0}" width="${W - left - right}" height="${panelH}" fill="#ffffff" stroke="${RULE}"/>`)
    out.push(`<rect x="${xOf(s.swapWindow.fromBeat)}" y="${y0}" width="${xOf(s.swapWindow.toBeat) - xOf(s.swapWindow.fromBeat)}" height="${panelH}" fill="#e9eef3"/>`)
    out.push(`<rect x="${xOf(outside.from)}" y="${y0}" width="${xOf(outside.to) - xOf(outside.from)}" height="${panelH}" fill="#c9d6e2"/>`)
    for (const t of p.ticks) {
      out.push(`<line x1="${left}" x2="${W - right}" y1="${yOf(t)}" y2="${yOf(t)}" stroke="${RULE}" stroke-width="1"/>`)
      out.push(`<text x="${left - 10}" y="${yOf(t) + 5}" ${FONT} font-size="14" fill="${SOFT}" text-anchor="end">${t}</text>`)
    }
    for (const mk of marks) out.push(`<line x1="${xOf(mk.beat)}" x2="${xOf(mk.beat)}" y1="${y0}" y2="${y0 + panelH}" stroke="${INK}" stroke-width="1" stroke-dasharray="3 5" opacity="0.55"/>`)
    for (const r of p.rules ?? []) {
      out.push(`<line x1="${left}" x2="${W - right}" y1="${yOf(r.v)}" y2="${yOf(r.v)}" stroke="${r.colour}" stroke-width="1.2" stroke-dasharray="7 5"/>`)
      out.push(`<text x="${W - right - 8}" y="${yOf(r.v) - 6}" ${FONT} font-size="13.5" fill="${r.colour}" text-anchor="end">${r.label}</text>`)
    }
    for (const line of p.lines) {
      const pts: string[] = []
      for (let b = 0; b <= END + 1e-9; b += 1 / 240) pts.push(`${xOf(b).toFixed(1)},${yOf(Math.min(p.hi, Math.max(p.lo, line.f(b)))).toFixed(1)}`)
      out.push(`<polyline points="${pts.join(' ')}" fill="none" stroke="${line.colour}" stroke-width="${line.width}" stroke-linejoin="round"${line.dash ? ` stroke-dasharray="${line.dash}"` : ''}/>`)
    }
    for (const d of p.dots ?? []) {
      out.push(`<circle cx="${xOf(d.beat)}" cy="${yOf(d.v)}" r="4.5" fill="${PAPER}" stroke="${INK}" stroke-width="1.6"/>`)
      out.push(`<text x="${xOf(d.beat)}" y="${yOf(d.v) + (d.v < 0 ? 21 : -11)}" ${FONT} font-size="13.5" fill="${INK}" text-anchor="middle">${d.label}</text>`)
    }
    let lx = W - right
    for (const line of p.lines.filter((l) => l.label).reverse()) {
      const w = line.label!.length * 7.7
      out.push(`<text x="${lx}" y="${y0 - 11}" ${FONT} font-size="14" fill="${INK}" text-anchor="end">${line.label}</text>`)
      out.push(`<line x1="${lx - w - 32}" x2="${lx - w - 8}" y1="${y0 - 16}" y2="${y0 - 16}" stroke="${line.colour}" stroke-width="${Math.max(2.4, line.width)}"/>`)
      lx -= w + 32 + 22
    }
    if (k === 0) for (const mk of marks) out.push(`<text x="${xOf(mk.beat) + 5}" y="${y0 + 16}" ${FONT} font-size="13" fill="${INK}">${mk.label}</text>`)
    if (k === panels.length - 1) {
      for (let b = 0; b <= END; b++) out.push(`<text x="${xOf(b)}" y="${y0 + panelH + 22}" ${FONT} font-size="14" fill="${SOFT}" text-anchor="${b === 0 ? 'start' : b === END ? 'end' : 'middle'}">beat ${b}</text>`)
    }
  })
  out.push('</svg>')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, out.join('\n'))
  return out.join('\n')
}

/** The pixel of a point of the globe, given in the globe's own millimetres, through the same camera as `reachOf`. */
function pixelOf(g: GlobePose, local: [number, number, number], width: number, height: number): [number, number] {
  const e = hero.position
  let fx = hero.aim.x - e.x
  let fy = hero.aim.y - e.y
  let fz = hero.aim.z - e.z
  const fl = Math.hypot(fx, fy, fz)
  fx /= fl
  fy /= fl
  fz /= fl
  const rl = Math.hypot(fz, fx)
  const rx = -fz / rl
  const rz = fx / rl
  const ux = -rz * fy
  const uy = rz * fx - rx * fz
  const uz = rx * fy
  const k = Math.tan((hero.fovDeg / DEG) / 2)
  const [x, y, z] = local
  const ax = x * Math.cos(g.tiltZ) - y * Math.sin(g.tiltZ)
  const ay = x * Math.sin(g.tiltZ) + y * Math.cos(g.tiltZ)
  const wx = ax + g.x - e.x
  const wy = ay * Math.cos(g.tiltX) - z * Math.sin(g.tiltX) + g.y - e.y
  const wz = ay * Math.sin(g.tiltX) + z * Math.cos(g.tiltX) + g.z - e.z
  const depth = wx * fx + wy * fy + wz * fz
  const nx = (wx * rx + wz * rz) / depth / k / (width / height)
  const ny = (wx * ux + wy * uy + wz * uz) / depth / k
  return [(0.5 + nx / 2) * width, (0.5 - ny / 2) * height]
}

describe.runIf(WANTED)('looks at the shake', () => {
  it('prints the rooms of every path', () => {
    const rows: string[] = []
    let worstTop = { v: 1, name: '', beat: 0 }
    let worstRim = { v: 99, name: '', beat: 0 }
    for (const name of NAMES) {
      const m = shakeMotion(name)
      const p = makeShake(name)
      let top = { v: 1, beat: 0 }
      let rim = { v: 99, beat: 0 }
      let low = 99
      for (let b = 0; b <= m.endBeat; b += FRAME_BEATS / 8) {
        const g = p.poseAt(b)
        const room = roomOf(g)
        if (room < top.v) top = { v: room, beat: b }
        const gap = rimGapMm(g)
        low = Math.min(low, gap)
        if (b >= m.parts.liftEnd && b <= m.parts.strokesEnd && gap < rim.v) rim = { v: gap, beat: b }
      }
      if (top.v < worstTop.v) worstTop = { ...top, name }
      if (rim.v < worstRim.v) worstRim = { ...rim, name }
      rows.push(`${name}: top room ${(top.v * 100).toFixed(3)} percent at beat ${top.beat.toFixed(3)}; rim ${rim.v.toFixed(3)} mm at beat ${rim.beat.toFixed(3)}; lowest anywhere ${low.toFixed(4)} mm; peak tilt ${(m.plan.peakTilt * DEG).toFixed(2)}`)
    }
    rows.push(`worst top room ${(worstTop.v * 100).toFixed(3)} percent (${worstTop.name}, beat ${worstTop.beat.toFixed(3)}), rule ${TOP_ROOM * 100}; at rest ${(roomOf({ x: 0, y: 0, z: 0, tiltX: 0, tiltZ: 0 }) * 100).toFixed(3)}`)
    rows.push(`worst rim ${worstRim.v.toFixed(3)} mm (${worstRim.name}, beat ${worstRim.beat.toFixed(3)}), rule ${RIM_ROOM_MM}`)
    const test = makeShake('test')
    let frame = { i: 0, v: 1 }
    for (let i = 0; i <= Math.ceil(shakeMotion('test').endBeat / FRAME_BEATS); i++) {
      const room = roomOf(test.poseAt(i * FRAME_BEATS))
      if (room < frame.v) frame = { i, v: room }
    }
    rows.push(`test: the frame with the least top room is ${frame.i} (${(frame.v * 100).toFixed(3)} percent, beat ${(frame.i * FRAME_BEATS).toFixed(3)})`)
    console.log(rows.join('\n'))
    expect(worstTop.v).toBeGreaterThanOrEqual(TOP_ROOM)
    expect(worstRim.v).toBeGreaterThanOrEqual(RIM_ROOM_MM)
  })

  it('draws height, tilt and speed over the beats', async () => {
    const svg = curves(path.join(OUT, 'curves.svg'))
    await sharp(Buffer.from(svg)).flatten({ background: PAPER }).jpeg({ quality: 90 }).toFile(path.join(OUT, 'curves.jpg'))
    expect(fs.existsSync(path.join(OUT, 'curves.jpg'))).toBe(true)
  })

  it.runIf(Boolean(process.env.SHAKE_FRAME))('marks the clearance on a frame of the test shake', async () => {
    const file = process.env.SHAKE_FRAME!
    const index = Number(process.env.SHAKE_FRAME_INDEX)
    const g = makeShake('test').poseAt(index * FRAME_BEATS)
    const meta = await sharp(file).metadata()
    const W = meta.width!
    const H = meta.height!
    const k = W / 1920
    const room = roomOf(g)
    const glassTop = room * H
    const ruleY = TOP_ROOM * H
    let lowAngle = 0
    let lowY = Infinity
    for (let i = 0; i < 720; i++) {
      const a = (i / 720) * Math.PI * 2
      const x = Math.cos(a) * FOOT_MM
      const z = Math.sin(a) * FOOT_MM
      const y = x * Math.sin(g.tiltZ) * Math.cos(g.tiltX) - z * Math.sin(g.tiltX) + g.y
      if (y < lowY) {
        lowY = y
        lowAngle = a
      }
    }
    const lowLocal: [number, number, number] = [Math.cos(lowAngle) * FOOT_MM, 0, Math.sin(lowAngle) * FOOT_MM]
    const nearLocal: [number, number, number] = [-lowLocal[0], 0, -lowLocal[2]]
    const low = pixelOf(g, lowLocal, W, H)
    const near = pixelOf(g, nearLocal, W, H)
    const nearMm = nearLocal[0] * Math.sin(g.tiltZ) * Math.cos(g.tiltX) - nearLocal[2] * Math.sin(g.tiltX) + g.y
    const flat: GlobePose = { x: g.x, y: 0, z: g.z, tiltX: 0, tiltZ: 0 }
    const worldOf = (local: [number, number, number]): [number, number, number] => {
      const ax = local[0] * Math.cos(g.tiltZ) - local[1] * Math.sin(g.tiltZ)
      const ay = local[0] * Math.sin(g.tiltZ) + local[1] * Math.cos(g.tiltZ)
      return [ax, 0, ay * Math.sin(g.tiltX) + local[2] * Math.cos(g.tiltX)]
    }
    const lowFloor = pixelOf(flat, worldOf(lowLocal), W, H)
    const nearFloor = pixelOf(flat, worldOf(nearLocal), W, H)
    const centre = pixelOf(g, [0, config.globe.baseHeightMm + config.globe.sphereDiameterMm / 2, 0], W, H)
    const f = (v: number): string => v.toFixed(1)
    const ink = '#ffffff'
    const size = 25 * k
    const o: string[] = []
    const plate = (x: number, y: number, text: string, colour: string, anchor: 'start' | 'end' = 'start'): void => {
      const w = text.length * size * 0.56 + 24 * k
      o.push(`<rect x="${f(anchor === 'end' ? x - w : x)}" y="${f(y - size * 1.05)}" width="${f(w)}" height="${f(size * 1.5)}" rx="${6 * k}" fill="#0b0f16" fill-opacity="0.78"/>`)
      o.push(`<text x="${f(anchor === 'end' ? x - 12 * k : x + 12 * k)}" y="${f(y)}" ${FONT} font-size="${size}" fill="${colour}" text-anchor="${anchor}">${text}</text>`)
    }
    o.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`)
    o.push(`<line x1="0" x2="${W}" y1="${f(ruleY)}" y2="${f(ruleY)}" stroke="#ffd166" stroke-width="${2 * k}" stroke-dasharray="${14 * k} ${9 * k}"/>`)
    plate(24 * k, ruleY + 44 * k, `rule: the glass keeps ${TOP_ROOM * 100} percent of the frame height under the top edge (${f(ruleY)} px)`, '#ffd166')
    o.push(`<line x1="${f(centre[0] - 200 * k)}" x2="${f(centre[0] + 200 * k)}" y1="${f(glassTop)}" y2="${f(glassTop)}" stroke="${ink}" stroke-width="${2 * k}"/>`)
    plate(W - 24 * k, ruleY + 44 * k, `top of the glass: ${(room * 100).toFixed(2)} percent (${f(glassTop)} px)`, ink, 'end')
    const tag = (at: [number, number], floor: [number, number], letter: string, colour: string): void => {
      o.push(`<line x1="${f(at[0])}" x2="${f(floor[0])}" y1="${f(at[1])}" y2="${f(floor[1])}" stroke="${colour}" stroke-width="${3 * k}"/>`)
      o.push(`<circle cx="${f(at[0])}" cy="${f(at[1])}" r="${6 * k}" fill="none" stroke="${colour}" stroke-width="${2.5 * k}"/>`)
      o.push(`<line x1="${f(floor[0] - 18 * k)}" x2="${f(floor[0] + 18 * k)}" y1="${f(floor[1])}" y2="${f(floor[1])}" stroke="${colour}" stroke-width="${2.5 * k}"/>`)
      o.push(`<text x="${f(at[0] + 14 * k)}" y="${f(at[1] - 12 * k)}" ${FONT} font-size="${size * 1.1}" font-weight="700" fill="${colour}" stroke="#0b0f16" stroke-width="${0.8 * k}">${letter}</text>`)
    }
    tag(low, lowFloor, 'A', '#ff8a70')
    tag(near, nearFloor, 'B', '#9be3c0')
    const block = (y: number, lines: string[], colour: string): number => {
      const w = Math.max(...lines.map((l) => l.length)) * size * 0.56 + 24 * k
      o.push(`<rect x="${f(24 * k)}" y="${f(y)}" width="${f(w)}" height="${f(lines.length * size * 1.4 + 14 * k)}" rx="${6 * k}" fill="#0b0f16" fill-opacity="0.78"/>`)
      lines.forEach((l, i) => o.push(`<text x="${f(36 * k)}" y="${f(y + size * 1.15 + i * size * 1.4)}" ${FONT} font-size="${size}" fill="${colour}">${l}</text>`))
      return y + lines.length * size * 1.4 + 14 * k + 12 * k
    }
    let at = 0.4 * H
    at = block(at, ['A  the lowest point of the rim', `${lowY.toFixed(2)} mm above the surface, rule ${RIM_ROOM_MM} mm`, 'behind the foot from this lens'], '#ff8a70')
    at = block(at, ['B  the point of the rim opposite it', `${nearMm.toFixed(2)} mm above the surface`], '#9be3c0')
    block(at, [`test shake, frame ${index}, beat ${(index * FRAME_BEATS).toFixed(3)}`, `foot ${g.y.toFixed(2)} mm up, tilt ${tiltOf(g).toFixed(2)} degrees`, `${g.x.toFixed(1)} mm along x`], ink)
    o.push('</svg>')
    fs.mkdirSync(OUT, { recursive: true })
    await sharp(file).composite([{ input: Buffer.from(o.join('\n')) }]).jpeg({ quality: 90 }).toFile(path.join(OUT, 'clearance.jpg'))
    console.log(`frame ${index}: top room ${(room * 100).toFixed(3)} percent, glass top at ${f(glassTop)} px of ${H}, rule at ${f(ruleY)} px; rim low ${lowY.toFixed(3)} mm at ${f(low[0])},${f(low[1])}; opposite ${nearMm.toFixed(3)} mm at ${f(near[0])},${f(near[1])}`)
    expect(lowY).toBeCloseTo(rimGapMm(g), 3)
  })

  it.runIf(Boolean(process.env.SHAKE_LANDING))('lays the landing out frame by frame', async () => {
    const dir = process.env.SHAKE_LANDING!
    const source = process.env.SHAKE_LANDING_SOURCE ?? 'film'
    const name = process.env.SHAKE_LANDING_NAME ?? 'shake-1'
    const first = Number(process.env.SHAKE_LANDING_FIRST)
    const zero = Number(process.env.SHAKE_LANDING_ZERO ?? 0)
    const [bx, by, bw, bh] = (process.env.SHAKE_LANDING_BOX ?? '620,900,300,170').split(',').map(Number) as [number, number, number, number]
    const shake = makeShake(name)
    const landing = zero + Math.round(shake.parts.landing / FRAME_BEATS)
    const cols = 4
    const rows = 3
    const label = 52
    const head = 64
    const W = cols * bw
    const H = head + rows * (bh + label)
    const parts: { input: Buffer; left: number; top: number }[] = []
    const o: string[] = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`]
    o.push(`<text x="14" y="27" ${FONT} font-size="19" font-weight="700" fill="#f2f2f2">The landing of ${name}, every film frame, the left end of the foot at full size</text>`)
    o.push(`<text x="14" y="51" ${FONT} font-size="14.5" fill="#aab1b8">foot: height of its centre. tilt: whole angle. rim: lowest point of the rim above the surface. The dark band is the gap under the foot.</text>`)
    for (let n = 0; n < cols * rows; n++) {
      const i = first + n
      const file = path.join(dir, `${source}-${String(i).padStart(6, '0')}.png`)
      const x = (n % cols) * bw
      const y = head + Math.floor(n / cols) * (bh + label)
      parts.push({ input: await sharp(file).extract({ left: bx, top: by, width: bw, height: bh }).toBuffer(), left: x, top: y })
      const g = shake.poseAt((i - zero) * FRAME_BEATS)
      const on = i === landing
      o.push(`<rect x="${x + 0.5}" y="${y + 0.5}" width="${bw - 1}" height="${bh - 1}" fill="none" stroke="${on ? '#ffd166' : '#2a3038'}" stroke-width="${on ? 3 : 1}"/>`)
      o.push(`<text x="${x + 10}" y="${y + bh + 21}" ${FONT} font-size="15.5" font-weight="700" fill="${on ? '#ffd166' : '#f2f2f2'}">${i}${on ? '  the landing' : i < landing ? `  ${landing - i} before` : `  ${i - landing} after`}</text>`)
      o.push(`<text x="${x + 10}" y="${y + bh + 42}" ${FONT} font-size="13.5" fill="#aab1b8">foot ${g.y.toFixed(2)} mm, tilt ${tiltOf(g).toFixed(2)}, rim ${Math.max(0, rimGapMm(g)).toFixed(2)} mm</text>`)
    }
    o.push('</svg>')
    fs.mkdirSync(OUT, { recursive: true })
    await sharp({ create: { width: W, height: H, channels: 3, background: '#14181d' } })
      .composite([...parts, { input: Buffer.from(o.join('\n')), left: 0, top: 0 }])
      .jpeg({ quality: 92 })
      .toFile(path.join(OUT, 'landing.jpg'))
    expect(fs.existsSync(path.join(OUT, 'landing.jpg'))).toBe(true)
  })
})
