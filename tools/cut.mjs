import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, rel, writeJson } from './lib/paths.mjs'
import { Session } from './lib/page.mjs'

const args = parseArgs(process.argv.slice(2))
const dir = args.out && args.out !== true ? path.resolve(String(args.out)) : rel('cut')

const n3 = (v) => String(Math.round(v * 1000) / 1000)
const clock = (s) => {
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`
}
const table = (head, rows) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n')

function cuesText(c) {
  const at = (frame) => clock(frame / c.fps)
  const bar = (frame) => {
    let b = 0
    for (let i = 0; i < c.barLines.length; i++) if (c.barLines[i] <= frame) b = i
    return b + 1
  }
  const out = []
  out.push('# The cut in words')
  out.push('')
  out.push('Written by `npm run cut` from the page. Do not edit by hand: change the config or the audio map and run it again.')
  out.push('')
  out.push(`- Source of the timing: ${c.source === 'audio-map' ? 'the music, from `cut/AUDIO-MAP.json`' : 'the default grid, until the music has a map'}.`)
  out.push(`- Film B is ${n3(c.seconds)} s: ${c.frameCount} frames at ${c.fps} a second, ${c.barLines.length} bars of ${c.beatsPerBar} beats at ${n3(c.bpm)} beats a minute.`)
  out.push(`- Times are from frame 0 of film B. In film A everything moves later by the opening, ${n3(c.opening.seconds)} s (${c.opening.frameCount} frames).`)
  if (c.musicFade) out.push(`- The music fades out from ${clock(c.musicFade.from)} to ${clock(c.musicFade.to)}.`)
  for (const n of c.notes ?? []) out.push(`- ${n}`)
  out.push('')
  out.push('## Shots')
  out.push('')
  out.push(
    table(
      ['Shot', 'Kind', 'Season', 'Starts', 'Bar', 'Bars', 'Frames', 'Length'],
      c.shots.map((s) => [`\`${s.id}\``, s.kind, s.kind === 'shake' ? `${s.from} to ${s.to}` : s.season, at(s.first), String(s.firstBar + 1), String(s.bars), `${s.first} to ${s.last}`, `${n3(s.seconds)} s`]),
    ),
  )
  out.push('')
  out.push('## Shakes')
  out.push('')
  out.push('Each shake is one bar with the camera locked. The season changes inside the swap window, behind the storm, and the globe is down on the bar line.')
  out.push('')
  out.push(
    table(
      ['Shake', 'Change', 'Lift starts', 'In the air', 'Strokes end', 'Swap window', 'Landing', 'Landing frame'],
      c.shakes.map((s) => [`\`${s.shot}\``, `${s.from} to ${s.to}`, at(s.first), at(s.liftEnd), at(s.strokesEnd), `${at(s.swap.first)} to ${at(s.swap.last)}`, `${at(s.landing)}, bar ${bar(s.landing)}`, String(s.landing)]),
    ),
  )
  out.push('')
  out.push('## Sound cues')
  out.push('')
  out.push(table(['Time', 'Frame', 'Cue', 'Note'], c.cues.map((q) => [at(q.frame), String(q.frame), `\`${q.cue}\``, q.optional ? 'only if it has a kept take' : ''])))
  out.push('')
  out.push('## Ambience')
  out.push('')
  out.push(table(['Bed', 'From', 'To', 'Fade in', 'Fade out'], c.ambience.map((b) => [`\`${b.cue}\``, clock(b.from), clock(b.to), `${n3(b.fadeIn)} s`, `${n3(b.fadeOut)} s`])))
  out.push('')
  if (c.sections?.length) {
    out.push('## Music sections')
    out.push('')
    out.push(table(['Season', 'From', 'To', 'Bars'], c.sections.map((s) => [s.season, at(s.first), at(s.last + 1), String(s.bars)])))
    out.push('')
  }
  out.push("## Film A's opening")
  out.push('')
  const o = c.opening
  const oat = (frame) => clock(frame / o.fps)
  out.push(
    table(
      ['Part', 'From', 'To', 'Frames'],
      [
        ['The prompt is typed', oat(o.typing.first), oat(o.typing.last + 1), `${o.typing.first} to ${o.typing.last}`],
        ['The reasoning control is opened and set', oat(o.reasoning.first), oat(o.reasoning.last + 1), `${o.reasoning.first} to ${o.reasoning.last}`],
        ['The send control is pressed', oat(o.send), oat(o.build.first), `${o.send} to ${o.build.first - 1}`],
        ['The build screen', oat(o.build.first), oat(o.build.last + 1), `${o.build.first} to ${o.build.last}`],
      ],
    ),
  )
  out.push('')
  out.push(`The steps of the build appear on frames ${o.steps.join(', ')}. The reasoning menu opens on frame ${o.reasoning.open} and the choice is made on frame ${o.reasoning.choose}.`)
  out.push('')
  const taps = o.cues.filter((q) => q.cue === 'key-tap')
  const others = o.cues.filter((q) => q.cue !== 'key-tap')
  if (taps.length) out.push(`- \`key-tap\`: ${taps.length} times, one for each character, from ${oat(taps[0].frame)} to ${oat(taps.at(-1).frame)}. The frames are in \`opening.cues\` of \`CUTLIST.json\`.`)
  for (const q of others) out.push(`- \`${q.cue}\`: ${oat(q.frame)}, frame ${q.frame}.`)
  out.push('')
  out.push('## The card loop')
  out.push('')
  const l = c.loop
  out.push(`${n3(l.seconds)} s, ${l.frameCount} frames at ${l.fps} a second, from the \`${l.camera}\` camera in the \`${l.format}\` format. One shake: lift on frame ${l.shake.first}, in the air on ${l.shake.liftEnd}, strokes end on ${l.shake.strokesEnd}, landing on ${l.shake.landing}. The season does not change, and the frame after the last is frame 0.`)
  out.push('')
  return out.join('\n')
}

function shotsText(c, shots) {
  const at = (frame) => clock(frame / c.fps)
  const out = []
  out.push('# The shots')
  out.push('')
  out.push('Written by `npm run cut` from the page. Do not edit by hand. Lengths are in millimetres of the real object. The camera is a function of the frame alone.')
  out.push('')
  for (const s of shots) {
    const span = c.shots.find((x) => x.id === s.shot)
    out.push(`## \`${s.shot}\``)
    out.push('')
    out.push(`- When: ${at(span.first)} to ${at(span.last + 1)}, frames ${span.first} to ${span.last}, ${span.bars} ${span.bars === 1 ? 'bar' : 'bars'}. ${span.kind === 'shake' ? `The shake from ${span.from} to ${span.to}.` : `A hold on ${span.season}.`}`)
    out.push(`- Lens: ${s.lens}.`)
    out.push(`- Move: ${s.move}`)
    out.push(`- Starts: ${s.start}.`)
    out.push(`- Ends: ${s.end}.`)
    out.push(`- Focus: ${s.focus}.`)
    out.push('- Keys:')
    for (const k of s.keys) out.push(`  - frame ${k.frame}, ${at(k.frame)}: ${k.what}`)
    out.push('')
  }
  return out.join('\n')
}

function judgedText(judged) {
  const out = []
  out.push('# The judged list')
  out.push('')
  out.push('Written by `npm run cut` from `dev.judged()`. Do not edit by hand. These are the rows for the Judged list of `kit/PROGRESS.md`: the id, its unit, and the picture.')
  out.push('')
  out.push('| Id | Unit | Picture |')
  out.push('| --- | --- | --- |')
  for (const e of judged) {
    const where = e.kind === 'film' || e.kind === 'opening' || e.kind === 'loop' ? `${e.kind} frame ${e.frame}` : e.kind
    out.push(`| \`${e.id}\` | ${e.unit} | ${where}, ${e.format}: ${e.what} |`)
  }
  out.push('')
  return out.join('\n')
}

const session = await Session.open({ local: args.local === true })
try {
  const page = await session.page({ simcache: false })
  const { list, shots, judged } = await page.evaluate(() => ({ ...window.showcase.dev.cut(), judged: window.showcase.dev.judged() }))
  fs.mkdirSync(dir, { recursive: true })
  writeJson(path.join(dir, 'CUTLIST.json'), list)
  fs.writeFileSync(path.join(dir, 'CUES.md'), cuesText(list))
  fs.writeFileSync(path.join(dir, 'SHOTS.md'), shotsText(list, shots))
  fs.writeFileSync(path.join(dir, 'JUDGED.md'), judgedText(judged))
  console.log(`cut: ${list.source}, ${list.shots.length} shots, ${list.shakes.length} shakes, ${list.frameCount} frames at ${list.fps} a second (${n3(list.seconds)} s), ${list.cues.length} cues, ${list.cameraKeys.length} camera keys, opening ${list.opening.frameCount} frames, loop ${list.loop.frameCount} frames, ${judged.length} judged pictures`)
  console.log(`wrote ${['CUTLIST.json', 'CUES.md', 'SHOTS.md', 'JUDGED.md'].map((f) => path.relative(rel(), path.join(dir, f))).join(', ')}`)
  if (page.errors.length) console.log(`page messages:\n${page.errors.join('\n')}`)
} finally {
  await session.close()
}
