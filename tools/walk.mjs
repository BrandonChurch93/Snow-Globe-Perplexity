import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import sharp from 'sharp'
import { parseArgs, rel } from './lib/paths.mjs'

/**
 * The whole visitor's walk of one layout (items 1 to 9 of kit/09-QA-GAUNTLET.md and what goes with them), in the order a
 * visitor minds: three runs of tools/visit.mjs, then one line an item: PASS, FAIL or NOT SEEN, with the lines of the walk
 * that say so.
 *
 *   node tools/walk.mjs --layout hd|phone|tablet [--url http://localhost:4173/] [--quality low] [--wait 300]
 *   node tools/walk.mjs --layout 600x600 [--touch] [--ratio 2]   (a window of any size, as tools/visit.mjs takes it)
 *     runs   <layout>-1  first paint, the hint and the look of the controls, the Shake control, the space bar, four shakes in a
 *                        row, the season marks, the first look measured
 *            <layout>-2  the hint and the controls a second time, keyboard and menu, reduced motion, the season links
 *            <layout>-3  stir and look around, the level of quality, the probe and the other modes, turning or resizing
 *     under out/work/visit/, and writes out/work/visit/<layout>-walk.txt.
 *   node tools/walk.mjs --layout phone --read walk-phone,walk-phone-more
 *     runs nothing and reads those folders of out/work/visit/ (a line walked twice is shown twice, and both count).
 *
 * The built site has to be served first (npx vite preview --port 4173 --strictPort). A flat black picture is a browser that
 * was killed: the walk says so and that run does not count.
 */

const args = parseArgs(process.argv.slice(2))
const str = (k, d) => (args[k] && args[k] !== true ? String(args[k]) : d)
const layout = str('layout', 'hd')
const RUNS = [
  ['1', '1,7,11,2,3,12,6,16'],
  ['2', '11,8,9,10'],
  ['3', '4,5,15,14,13'],
]
let names = args.read && args.read !== true ? String(args.read).split(',') : null
const took = []
if (!names) {
  names = []
  for (const [k, only] of RUNS) {
    const name = `${layout}-${k}`
    const pass = ['tools/visit.mjs', '--layout', layout, '--only', only, '--name', name]
    for (const o of ['url', 'quality', 'wait', 'ratio']) if (args[o] && args[o] !== true) pass.push(`--${o}`, String(args[o]))
    if (args.touch === true) pass.push('--touch')
    const t0 = Date.now()
    const r = spawnSync(process.execPath, pass, { cwd: rel(), stdio: 'inherit' })
    took.push(`${name} ${Math.round((Date.now() - t0) / 1000)} s${r.status === 0 ? '' : `, ended with ${r.status ?? r.signal}`}`)
    names.push(name)
  }
}

const lines = new Map()
const add = (x, run) => lines.set(x.action, [...(lines.get(x.action) ?? []), { ...x, run }])
const said = { pageErrors: [], console: [], failedRequests: [], black: [], missing: [] }
for (const name of names) {
  const dir = rel('out', 'work', 'visit', name)
  const file = path.join(dir, 'result.json')
  if (!fs.existsSync(file)) {
    said.missing.push(name)
    const facts = path.join(dir, 'facts.jsonl')
    if (fs.existsSync(facts)) for (const l of fs.readFileSync(facts, 'utf8').split('\n').filter(Boolean)) add(JSON.parse(l), name)
    continue
  }
  const r = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const l of r.lines) add(l, name)
  for (const k of ['pageErrors', 'console', 'failedRequests']) for (const x of r[k] ?? []) said[k].push(`${name}: ${x}`)
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.png'))) {
    const st = await sharp(path.join(dir, f)).removeAlpha().stats()
    if (Math.max(...st.channels.map((c) => c.max)) < 8) said.black.push(`${name}/${f}`)
  }
}

const touch = /^\d+x\d+$/.test(layout) ? args.touch === true : layout !== 'hd'
const sizeLines = (re) => [...lines.keys()].filter((k) => re.test(k))
const ITEMS = [
  ['1', 'opens live, in the default season, at rest, with only the controls; the still first, then the live picture', ['first-paint', 'first-look', 'first-settle']],
  ['2', 'the Shake control, the space bar and each mark shake and land in the right season; four in a row', ['shake-control', ...(touch && !lines.has('space-bar') ? [] : ['space-bar']), ...sizeLines(/^mark-(?!current)/), ...sizeLines(/^row-\d-[a-z]+$/), 'four-in-a-row'], (have) => have.filter((k) => /^mark-/.test(k)).length >= 4 && have.filter((k) => /^row-/.test(k)).length >= 4],
  ['3', 'a second shake cannot be started while one plays', ['shake-control-during', ...(touch && !lines.has('space-bar-during') ? [] : ['space-bar-during']), ...sizeLines(/^row-\d-[a-z]+-during$/), 'shake-control'], (have) => have.some((k) => /^row-/.test(k))],
  ['4', 'a quick drag stirs and changes no season; a slow drag turns the camera inside its limits and eases back', ['stir', 'look-held', 'look-returned', 'look-limits']],
  ['5', 'each season opens from its own link', sizeLines(/^link-/), (have) => have.length >= 4],
  ['6a', 'every control reached and used by keyboard, named, with its focus shown', ['focus-on-control', 'tab-order', 'enter-on-shake', 'space-on-shake']],
  ['6b', 'with reduced motion a season changes with no shake', ['reduced-start', 'reduced-middle', 'reduced-end', 'reduced-alone']],
  ['7', 'the controls in their places, never missing, dimmed and back (clear of the globe: by eye, the pictures across a shake)', ['places', 'look', 'hint-pulse', 'hint-after', 'dimmed', 'returned', 'controls-watched']],
  ['8', 'no sound before the first interaction (the rest of the item needs the sound files)', ['sound-at-start']],
  ['9', 'the level of quality picked by itself and forced from the menu; the probe to its end with its text', ['quality-by-itself', 'quality-high', 'quality-medium', 'quality-low', 'menu-open', 'mode-probe']],
  ['turn', touch ? 'the screen turned and back, at rest and in a shake' : 'the window resized and back, at rest and in a shake', sizeLines(/^(rest|shake)-\d+x\d+/), (have) => have.length >= 4],
  ['modes', 'the film by itself and the loop open and run', ['mode-autopilot', 'mode-loop']],
]

const out = []
out.push(`walk ${layout}: ${names.join(', ')}${took.length ? ` (${took.join('; ')})` : ''}`)
for (const [id, what, wanted, enough] of ITEMS) {
  const have = wanted.filter((k) => lines.has(k))
  const bad = have.filter((k) => lines.get(k).some((l) => !l.ok))
  const lacking = wanted.filter((k) => !lines.has(k))
  const whole = have.length > 0 && lacking.length === 0 && (!enough || enough(have))
  const verdict = bad.length ? 'FAIL' : whole ? 'PASS' : have.length ? 'PART' : 'NOT SEEN'
  const show = (k) => lines.get(k).map((l) => `${l.ok ? '' : 'NOT '}${k} (${l.run}/${l.file})`).join(', ')
  out.push(`${id.padEnd(5)} ${verdict.padEnd(8)} ${what}`)
  if (have.length) out.push(`      ${have.map(show).join(', ')}`)
  if (lacking.length && have.length) out.push(`      not walked: ${lacking.join(', ')}`)
}
const ours = said.console.filter((l) => /: (error|warning): /.test(l))
out.push(`console: ${said.console.length} lines, ${ours.length} of them errors or warnings; page errors ${said.pageErrors.length}; requests that did not come ${said.failedRequests.filter((f) => !/ERR_ABORTED/.test(f)).length} (and ${said.failedRequests.filter((f) => /ERR_ABORTED/.test(f)).length} cut off by the tool leaving the page)`)
for (const l of [...new Set(said.console)]) out.push(`      ${l}`)
for (const l of [...new Set(said.pageErrors)]) out.push(`      page error: ${l}`)
for (const l of [...new Set(said.failedRequests.filter((f) => !/ERR_ABORTED/.test(f)))]) out.push(`      request: ${l}`)
if (said.black.length) out.push(`FLAT BLACK pictures, their runs do not count: ${said.black.join(', ')}`)
if (said.missing.length) out.push(`no result.json (the run did not end): ${said.missing.join(', ')}`)
const text = out.join('\n') + '\n'
fs.writeFileSync(rel('out', 'work', 'visit', `${layout}-walk.txt`), text)
process.stdout.write(text)
