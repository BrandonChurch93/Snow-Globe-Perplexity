import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import sharp from 'sharp'
import { Session, cfg } from './lib/page.mjs'
import { serve } from './lib/server.mjs'
import { watchPage } from './lib/browser.mjs'
import { rel, parseArgs, writeJson } from './lib/paths.mjs'
import { buildPack, openPack, packServed, PACK_DIRS, PACK_FILES } from './lib/openingpack.mjs'

const HELP = `npm run opening -- [options]

Draws the prompt opening of film A, one picture for every frame of openingPlan(), with the team's skill
for the product's interface, and writes the pack the page shows: public/opening/.

  --skill DIR     the skill that draws the two screens (default: ~/.perplexity/skills/space/synthetic-ui,
                  then ~/.perplexity/skills/org/synthetic-query-typing)
  --effort DIR    the package whose change of the reasoning level is carried into the work copy
                  (default: ~/.perplexity/skills/org/synthetic-query-typing)
  --master        draw at device scale 3 into out/work/opening/master/ (never committed, never hosted)
  --stills A,B,C  also write these frames as PNG files to out/work/opening/stills/
  --only-stills   draw the frames named by --stills and nothing else: no pack, no checks
  --page          draw nothing: ask the built page for frames of the opening, out of order and in a run,
                  and compare what it shows with the pack, pixel for pixel (hd, and the master's size
                  when a master pack exists). Writes out/work/opening/page.json
`

class Stop extends Error {}

const args = parseArgs(process.argv.slice(2))
const home = (...p) => path.join(os.homedir(), '.perplexity', 'skills', ...p)
const WORK = rel('out', 'work', 'opening')
const COPY = path.join(WORK, 'skill')
const LOGICAL = { width: 1280, height: 720 }
const MAX_BYTES = 12 * 1024 * 1024
const RED_OVER_BLUE = 6
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex')
const near = (a, b) => Math.abs(a - b) < 1e-9

function describe(dir) {
  const file = path.join(dir, 'SKILL.md')
  if (!fs.existsSync(file)) return null
  const head = fs.readFileSync(file, 'utf8').split('\n---')[0]
  const name = /^name:\s*(.+)$/m.exec(head)?.[1].trim() ?? ''
  const version = /version:\s*['"]?([0-9][^'"\s]*)/.exec(head)?.[1] ?? ''
  return { dir, name, version }
}

function findSkill() {
  const asked = typeof args.skill === 'string' ? [path.resolve(args.skill)] : [home('space', 'synthetic-ui'), home('org', 'synthetic-query-typing')]
  for (const dir of asked) {
    const d = describe(dir)
    if (d && fs.existsSync(path.join(dir, 'scripts', 'composer.mjs'))) return d
  }
  throw new Stop(`the skill for the product's interface is not on this machine (looked in ${asked.join(', ')}): the opening cannot be drawn here, and the pack in public/opening/ stays as it is`)
}

function findEffort() {
  const dir = typeof args.effort === 'string' ? path.resolve(args.effort) : home('org', 'synthetic-query-typing')
  const d = describe(dir)
  const model = path.join(dir, 'scripts', 'sequence-model.mjs')
  if (!d || !fs.existsSync(model) || !fs.readFileSync(model, 'utf8').includes('export function effortTimeline')) throw new Stop(`the package with the change of the reasoning level is not on this machine (looked in ${dir}): name it with --effort DIR`)
  return d
}

const once = (src, what, anchor) => {
  const n = src.split(anchor).length - 1
  if (n !== 1) throw new Stop(`the skill's source no longer matches the edit "${what}": its anchor is there ${n} times, not once`)
}

function edit(src, what, anchor, put) {
  once(src, what, anchor)
  return src.replace(anchor, () => put(anchor))
}

function carry(src, what, from, to) {
  once(src, `${what}, start`, from)
  const a = src.indexOf(from)
  const b = src.indexOf(to, a + from.length)
  if (b < 0) throw new Stop(`the skill's source no longer matches the edit "${what}": its end is not there`)
  return src.slice(a, b).trimEnd()
}

function prepare(skill, effort) {
  fs.rmSync(COPY, { recursive: true, force: true })
  fs.cpSync(skill.dir, COPY, { recursive: true, filter: (p) => path.basename(p) !== 'node_modules' })
  fs.copyFileSync(path.join(effort.dir, 'scripts', 'sequence-model.mjs'), path.join(COPY, 'scripts', 'effort-model.mjs'))

  const theirs = fs.readFileSync(path.join(effort.dir, 'scripts', 'composer.mjs'), 'utf8')
  for (const [what, anchor] of [['the control row of the level change', '{ x: 798, y: 425,'], ['the height of its control', 'h: 38, chevronX']]) once(theirs, what, anchor)
  const menuDef = carry(theirs, 'the menu', 'const MENU = {', 'function chipBox(')
  const rowAndTick = carry(theirs, 'the rows and the check mark', 'function rowBox(', '// Where the pointer is')
  const pointerFn = carry(theirs, "the pointer's path", 'function effortPointer(t) {', '// Word-wrap typed text')
  const shown = carry(theirs, 'the level shown', 'const shownEffort = ', 'const pointer = effortPointer(t);')
  const fill = edit(carry(theirs, "the control's hover and pressed fill", 'const pointer = effortPointer(t);', 'effortDots('), "the control's pressed colour", 'C.pill)', () => 'C.pillBg)')
  const menu = edit(carry(theirs, 'the menu and the pointer drawn', 'if (effortTo) {\n    if (menuOpacity > 0) {', 'if (t >= T.sendMoveStart) {'), "the menu's card", 'shadowCard(', () => 'shadowMenu(')

  const file = path.join(COPY, 'scripts', 'composer.mjs')
  let s = fs.readFileSync(file, 'utf8')
  once(s, 'the control row of the composer', 'const cy = 436;')
  once(s, 'the right edge of the control', 'const selectorRightX = 975;')
  s = edit(s, "the composer's text in grey levels", 'canvas.getContext("2d", { alpha: false })', () => 'canvas.getContext("2d")')
  s = edit(s, 'the level change read in', 'const qs = new URLSearchParams(location.search);', (a) => `import { effortTimeline, EFFORTS, EFFORT_PACING } from "./effort-model.mjs";\n${a}`)
  s = edit(s, "the film's clock read in", 'const fps = 60;', (a) => `${a}\nconst FILM = JSON.parse(qs.get("film"));\nif (FILM.fps !== fps) throw new Error("the film's frame rate is not the page's");\nlet filmGeometry = null;`)
  s = edit(s, 'typing starts on the first key', 'T.typeDuration = prompt.length / cps;', () => 'T.typeStart = FILM.keyTaps[0] / fps;\nT.typeDuration = (FILM.keyTaps[FILM.keyTaps.length - 1] - FILM.keyTaps[0]) / fps;')
  s = edit(s, 'the pointer leaves for the send', 'T.sendMoveStart = T.typeEnd + hold;', () => 'T.sendMoveStart = FILM.toSend / fps;')
  s = edit(s, 'the pointer is on the send', 'T.sendMoveEnd = T.sendMoveStart + (quick ? .58 : .90);', () => 'T.sendMoveEnd = FILM.atSend / fps;')
  s = edit(
    s,
    'the send is pressed',
    'T.send = T.sendMoveEnd + (quick ? .16 : .22);',
    () =>
      'T.send = FILM.send / fps;\nconst effortTo = FILM.to;\nconst E = effortTimeline({ effort, effortTo, start: FILM.enter / fps, resume: T.typeStart });\nif (E.added !== 0) throw new Error("the film types before the level change has ended");\nT.effortSelect = E.effortSelect;',
  )
  s = edit(s, 'a character for every key', 'Math.floor((t - T.typeStart) / T.typeDuration * prompt.length)', () => 'FILM.keyTaps.filter(k => k <= Math.round(t * fps)).length')
  s = edit(s, 'the menu, its rows and its check mark', 'function composer(t) {', (a) => `${menuDef}\n{ const dx = 975 + 12 - MENU.x - MENU.w, dy = 436 + 19 - 425 - 38; for (const k of ["x", "rowX", "labelX", "checkX", "pointerX"]) MENU[k] += dx; for (const k of ["y", "rowY"]) MENU[k] += dy; }\n${rowAndTick}\n${a}`)
  s = edit(s, 'the level shown on the control', 'const effortW = measure(effort, 19, 400);', () => `${shown}\n  const effortW = measure(shownEffort, 19, 400);`)
  s = edit(
    s,
    "the control's box, the pointer and the fill",
    'const starCx = modelX - 8 - starSize / 2;',
    (a) => `${a}\n  const chipBox = label => { const x = starCx + effortW - measure(label, 19, 400) - starSize / 2 - 12; return { x, y: cy - 19, w: selectorRightX + 12 - x, h: 38 }; };\n  ${pointerFn}\n  ${fill}`,
  )
  s = edit(s, 'the level written on the control', 'text(effort, effortX,', () => 'text(shownEffort, effortX,')
  s = edit(s, 'the menu drawn over the composer', 'if (t >= T.sendMoveStart) {', (a) => `${menu}\n  ${a}`)
  s = edit(s, 'the state of the level change', '    effort,\n', () => '    effort: shownEffort,\n    effortMenu: { opacity: menuOpacity, hover: menuHover },\n    effortPointer: pointer ? { x: pointer.x, y: pointer.y, opacity: pointer.opacity, pressed: pointer.pressed } : null,\n')
  s = edit(
    s,
    'the measures of the level change',
    'actualGenerationSubmitted: false\n  };',
    (a) =>
      `${a}\n  filmGeometry = { chip: chipBox(effort), chipAfter: chipBox(effortTo), controls: { modes: { x: pillX, y: pillY, w: pillW, h: pillH }, microphone: { x: micX - 10.25, y: cy - 10.25, w: 20.5, h: 20.5 }, send: { x: sendX - sendR, y: sendY - sendR, w: sendR * 2, h: sendR * 2 }, chin: { x: leftRailX, y: chinCy - chinIconSize / 2, w: plugStartX + chinIconSize + 7.5 + measure("Plugins", 17.5, 450) - leftRailX, h: chinIconSize }, input: { x: leftRailX, y: inputY - 24, w: cardX + cardW - 24 - leftRailX, h: 404 + 8 - (inputY - 24) } } };`,
  )
  s = edit(
    s,
    'the measures reported',
    'await window.renderAt(0);',
    (a) =>
      `${a}\nwindow.__motion.effortChange = { from: effort, to: effortTo, levels: EFFORTS, pacing: EFFORT_PACING, times: E, menu: { ...MENU, rows: EFFORTS.map(label => ({ label, ...rowBox(label) })) }, ...filmGeometry };`,
  )
  fs.writeFileSync(file, s)

  const model = path.join(COPY, 'scripts', 'sequence-model.mjs')
  fs.writeFileSync(model, edit(fs.readFileSync(model, 'utf8'), 'the first line arrives on the film', 'let at = .45;', () => 'let at = c.thinking.first;'))

  const thread = path.join(COPY, 'scripts', 'sequence.mjs')
  fs.writeFileSync(thread, edit(fs.readFileSync(thread, 'utf8'), "the build screen's text in grey levels", "canvas.getContext('2d', { alpha: false })", () => "canvas.getContext('2d')"))
}

const seconds = (frames, fps) => Math.round((frames / fps) * 1e6) / 1e6

function threadConfig(plan, intro) {
  const fps = plan.fps
  const ends = [...plan.steps.slice(1), plan.lastDone]
  return {
    mode: 'thinking',
    query: intro.prompt,
    thinking: {
      heading: intro.buildTitle,
      first: seconds(plan.steps[0] - plan.build.first, fps),
      steps: intro.steps.map((title, n) => ({ title, duration: seconds(ends[n] - plan.steps[n], fps) })),
      endHold: seconds(plan.frameCount - plan.lastDone, fps),
    },
  }
}

async function openScreens(session, plan, intro, scale) {
  const server = await serve({ dist: COPY, bare: true })
  const context = await session.browser.newContext({ viewport: LOGICAL, deviceScaleFactor: scale })
  const refused = []
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (url.startsWith(server.url) || url.startsWith('data:')) return route.continue()
    refused.push(url)
    return route.abort()
  })
  const errors = []
  const open = async (address) => {
    const page = await context.newPage()
    page.setDefaultTimeout(0)
    watchPage(page, errors)
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`)
    })
    await page.goto(address)
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 })
    return page
  }
  fs.writeFileSync(path.join(COPY, 'scripts', 'film.json'), JSON.stringify(threadConfig(plan, intro)))
  const film = { fps: plan.fps, enter: plan.pointer.enter, keyTaps: plan.keyTaps, toSend: plan.pointer.toSend, atSend: plan.pointer.atSend, send: plan.send, to: intro.reasoning }
  const q = new URLSearchParams({ q: intro.prompt, model: intro.model, effort: intro.reasoningFrom, cps: String(intro.charsPerSecond), capture: '1', film: JSON.stringify(film) })
  const composer = await open(`${server.url}scripts/composer.html?${q}`)
  const thread = await open(`${server.url}scripts/sequence.html?config=film.json&capture=1`)
  const draw = async (i) => {
    const onThread = i >= plan.build.first
    const page = onThread ? thread : composer
    const t = onThread ? (i - plan.build.first) / plan.fps : i / plan.fps
    const r = await page.evaluate(async (at) => {
      const state = await window.renderAt(at)
      return { state, fonts: document.fonts.check('24px Pplx'), url: document.getElementById('scene').toDataURL('image/png') }
    }, t)
    return { state: r.state, fonts: r.fonts, png: Buffer.from(r.url.slice(r.url.indexOf(',') + 1), 'base64') }
  }
  const motion = { composer: await composer.evaluate(() => structuredClone(window.__motion)), thread: await thread.evaluate(() => structuredClone(window.__motion)) }
  return { draw, motion, errors, refused, close: async () => (await context.close(), await server.close()) }
}

const rgb = async (png, width, height) => {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  if (info.width !== width || info.height !== height || info.channels !== 3) throw new Stop(`a picture came out ${info.width} x ${info.height}, not ${width} x ${height}`)
  return data
}

async function edges(png) {
  const { data } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let holes = 0
  let warmest = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 255) holes++
    if (data[i] - data[i + 2] > warmest) warmest = data[i] - data[i + 2]
  }
  return { holes, warmest }
}

function sayState(plan, i, s) {
  if (i < plan.build.first) {
    const c = s.composer
    return { screen: 'prompt', typed: c.typedText.length, level: c.effort, menu: Math.round(c.effortMenu.opacity * 1e6) / 1e6, sent: c.illustrativeSubmit, pressed: c.sendPressed, lines: 0, done: 0 }
  }
  return { screen: 'build', typed: s.query.length, level: null, menu: 0, sent: true, pressed: false, lines: s.rows.filter((r) => r.visible).length, done: s.rows.filter((r) => r.complete).length }
}

function filmChecks(plan, intro, states, raw, motion, effortModel) {
  const out = {}
  const all = (name, fails) => {
    out[name] = fails.length === 0
    if (fails.length) out[`${name}Fails`] = fails.slice(0, 8)
  }
  const prompt = states.slice(0, plan.build.first)
  const build = states.slice(plan.build.first)
  const frames = (list, test, from = 0) => list.map((s, n) => (test(s, n + from) ? -1 : n + from)).filter((n) => n >= 0)

  const pace = effortModel.EFFORT_PACING
  const want = effortModel.effortTimeline({ effort: intro.reasoningFrom, effortTo: intro.reasoning, start: plan.pointer.enter / plan.fps, resume: plan.typing.first / plan.fps })
  const at = (sec) => Math.ceil(sec * plan.fps - 1e-6)
  const E = motion.composer.effortChange.times
  out.levelNames = JSON.stringify(effortModel.EFFORTS) === JSON.stringify(intro.reasoningLevels)
  out.levelPacing = near(pace.travel, plan.pacing.toControl) && near(pace.dwell, plan.pacing.rest) && near(pace.menuFade, plan.pacing.menuIn) && near(pace.read, plan.pacing.read) && near(pace.rowTravel, plan.pacing.toLevel) && near(pace.settle, plan.pacing.settle) && near(pace.menuOut, plan.pacing.menuOut) && near(pace.pointerOut, plan.pacing.pointerOut) && near(pace.beat, plan.pacing.beat)
  out.levelTimes =
    JSON.stringify(E) === JSON.stringify(want) &&
    want.added === 0 &&
    at(E.effortMoveStart) === plan.pointer.enter &&
    at(E.effortArrive) === plan.pointer.atControl &&
    at(E.effortOpen) === plan.reasoning.open &&
    at(E.effortMenuOpen) === plan.menu.full &&
    at(E.effortRowMove) === plan.pointer.toLevel &&
    at(E.effortRowArrive) === plan.pointer.atLevel &&
    at(E.effortSelect) === plan.reasoning.choose &&
    at(E.effortClose) === plan.menu.fade &&
    at(E.effortMenuGone) === plan.menu.gone &&
    at(E.effortEnd) === plan.pointer.gone
  const geo = motion.composer.effortChange
  const menuBox = { x: geo.menu.x, y: geo.menu.y, w: geo.menu.w, h: geo.menu.h }
  const apart = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
  out.menuInsideFrame = menuBox.x >= 0 && menuBox.y >= 0 && menuBox.x + menuBox.w <= LOGICAL.width && menuBox.y + menuBox.h <= LOGICAL.height
  out.menuClearOfControls = [geo.chip, geo.chipAfter, ...Object.values(geo.controls)].every((b) => apart(menuBox, b))
  out.controlClearOfMicrophone = apart(geo.chip, geo.controls.microphone) && apart(geo.chipAfter, geo.controls.microphone) && apart(geo.chip, geo.controls.modes) && apart(geo.chipAfter, geo.controls.modes)
  out.menuUnderControl = near(geo.menu.y - (geo.chip.y + geo.chip.h), 3)
  out.composerLength = Math.round(motion.composer.duration * plan.fps) === plan.build.first
  out.buildLength = Math.round(motion.thread.duration * plan.fps) === plan.frameCount - plan.build.first

  all('levelBeforeChoice', frames(prompt.slice(0, plan.reasoning.choose), (s) => s.level === intro.reasoningFrom))
  all('levelFromChoice', frames(prompt.slice(plan.reasoning.choose), (s) => s.level === intro.reasoning, plan.reasoning.choose))
  all('menuOpenOnlyInItsFrames', frames(raw.slice(0, plan.build.first), (s, i) => s.composer.effortMenu.opacity > 0 === (i >= plan.reasoning.open && i < plan.menu.gone)))
  all('menuFullyOpen', frames(raw.slice(plan.menu.full, plan.menu.fade), (s) => s.composer.effortMenu.opacity === 1, plan.menu.full))
  out.menuFullyOpenSeconds = (plan.menu.fade - plan.menu.full) / plan.fps
  all('menuHoverOnChoice', frames(raw.slice(plan.pointer.atLevel, plan.menu.fade), (s) => s.composer.effortMenu.hover === intro.reasoning, plan.pointer.atLevel))
  all('typedText', frames(raw.slice(0, plan.build.first), (s, i) => s.composer.typedText === intro.prompt.slice(0, plan.keyTaps.filter((k) => k <= i).length)))
  all('wholePromptFromLastKey', frames(raw.slice(plan.keyTaps.at(-1), plan.build.first), (s) => s.composer.complete && s.composer.typedText === intro.prompt, plan.keyTaps.at(-1)))
  all('promptInsideInput', frames(raw.slice(0, plan.build.first), (s) => s.composer.textBoundsFit))
  all('sendPressedOnSend', frames(prompt, (s, i) => s.sent === i >= plan.send && (i !== plan.send || s.pressed)))
  all('linesOnScreen', frames(build, (s, i) => s.lines === plan.steps.filter((f) => f <= i).length, plan.build.first))
  all('linesDone', frames(build, (s, i) => s.done === [...plan.steps.slice(1), plan.lastDone].filter((f) => f <= i).length, plan.build.first))
  out.everyLineDoneBeforeLastFrame = build.at(-1).done === intro.steps.length && plan.lastDone < plan.frameCount - 1
  out.lastFrameShowsNoWorkingLine = raw.at(-1).rows.every((r) => r.complete && !r.active && !r.hasHighlightCard)
  out.promptOnBuildScreen = raw.at(-1).promptLines.join(' ') === intro.prompt
  return out
}

function skillChecks(plan, raw, fonts, screens, twice) {
  const composer = raw.slice(0, plan.build.first)
  const thread = raw.slice(plan.build.first)
  return {
    fontLoaded: fonts.every(Boolean) && thread.every((s) => s.fontLoaded),
    noRuntimeErrors: screens.errors.length === 0 && screens.refused.length === 0,
    fixedFraming: composer.every((s) => s.composer.zoom === 1 && s.composer.zoomY === 1 && s.composer.offsetX === 0 && s.composer.offsetY === 0 && s.composer.opacity === 1) && thread.every((s) => s.framing.scale === 1 && s.framing.x === 0 && s.framing.y === 0 && s.framing.opacity === 1),
    sequenceLayout: Object.values(screens.motion.thread.layout.checks).every(Boolean),
    oneActiveStep: thread.every((s) => s.rows.filter((r) => r.active).length <= 1),
    activeHighlightConsistent: thread.every((s) => s.rows.every((r) => r.hasHighlightCard === r.active)),
    sameTimeSamePicture: twice,
    noRealSubmit: raw.every((s) => (s.composer ?? s).actualGenerationSubmitted === false),
  }
}

async function checkPage() {
  const session = await Session.open()
  const results = []
  try {
    for (const format of [cfg.formats.hd, cfg.formats.master]) {
      const id = format.id
      const served = packServed(format.width)
      if (!served) throw new Stop('there is no opening pack in dist/opening/: run npm run opening, then npm run build')
      if (served.name === 'hd, enlarged') {
        results.push({ format: id, pack: served.name, compared: 0, note: 'no master pack, so the page enlarges the hd pack and there is nothing to compare it with pixel for pixel' })
        continue
      }
      const pack = await openPack(served.name === 'master' ? PACK_DIRS.master() : PACK_DIRS.hosted())
      const page = await session.page({ format: id, simcache: false })
      const plan = await page.evaluate(() => window.showcase.dev.openingPlan())
      const jumbled = [plan.frameCount - 1, 0, plan.send, plan.reasoning.choose, plan.reasoning.choose - 1, plan.build.first, plan.build.first - 1, Math.round((plan.typing.first + plan.typing.last) / 2), 1, plan.steps[2], plan.reasoning.open, plan.lastDone, plan.keyTaps[40], plan.keyTaps[40] - 1]
      const run = Array.from({ length: served.name === 'master' ? 12 : 90 }, (_, n) => plan.typing.first - 20 + n)
      const differing = []
      let names = new Set()
      for (const i of [...jumbled, ...run]) {
        await page.evaluate((n) => window.showcase.renderOpeningFrame(n), i)
        const shown = await rgb(await session.grabStage(page), format.width, format.height)
        const want = await pack.frame(i, { copy: false })
        if (!shown.equals(want)) {
          let n = 0
          for (let o = 0; o < want.length; o += 3) if (shown[o] !== want[o] || shown[o + 1] !== want[o + 1] || shown[o + 2] !== want[o + 2]) n++
          differing.push({ frame: i, pixels: n })
        }
        names.add(await page.evaluate(() => document.getElementById('opening').dataset.pack))
      }
      const flagged = await page.evaluate(() => window.showcase.dev.flagged())
      const register = (await page.evaluate(() => window.showcase.info())).standIns.some((x) => x.name === 'opening')
      const refused = await page.evaluate((n) => window.showcase.renderOpeningFrame(n).then(() => '', (e) => String(e.message)), plan.frameCount)
      results.push({ format: id, pack: served.name, said: [...names], compared: jumbled.length + run.length, differing, flaggedAsStandIn: flagged.includes('opening'), registerSaysStandIn: register, errors: page.errors.slice(0, 10), refusesAFrameItDoesNotHold: refused })
      await page.context().close()
    }
  } finally {
    await session.close()
  }
  const pass = results.every((r) => !r.differing || (r.differing.length === 0 && r.said.length === 1 && r.said[0] === r.pack && r.errors.length === 0 && r.refusesAFrameItDoesNotHold !== '' && !r.flaggedAsStandIn))
  writeJson(path.join(WORK, 'page.json'), { pass, results })
  for (const r of results) console.log(r.differing ? `opening: the page at ${r.format} shows the ${r.pack} pack: ${r.compared} frames asked out of order and in a run, ${r.differing.length} differ from the pack` : `opening: the page at ${r.format}: ${r.note}`)
  if (results.some((r) => r.registerSaysStandIn)) console.log('opening: parts/PARTS.json still lists the opening as a stand-in, so info().standIns names it until the register is changed')
  if (!pass) throw new Stop('the page does not show the pack as it is. See out/work/opening/page.json')
}

async function main() {
  if (args.help) return console.log(HELP)
  if (args.page === true) return checkPage()
  const skill = findSkill()
  const effort = findEffort()
  if (fs.realpathSync(skill.dir) === fs.realpathSync(effort.dir)) throw new Stop(`only ${skill.name} ${skill.version} was found (${skill.dir}). This tool draws the two screens with synthetic-ui and takes from ${effort.name} only the change of the reasoning level: name synthetic-ui with --skill DIR. The pack in public/opening/ stays as it is`)
  const master = args.master === true
  const scale = master ? cfg.formats.master.width / LOGICAL.width : cfg.formats.hd.width / LOGICAL.width
  const width = LOGICAL.width * scale
  const height = LOGICAL.height * scale
  const stills = typeof args.stills === 'string' ? args.stills.split(',').map(Number) : []
  prepare(skill, effort)
  const effortModel = await import(pathToFileURL(path.join(COPY, 'scripts', 'effort-model.mjs')).href)

  const session = await Session.open()
  let screens = null
  try {
    const page = await session.page({ simcache: false })
    const plan = await page.evaluate(() => window.showcase.dev.openingPlan())
    await page.close()
    const intro = cfg.intro
    screens = await openScreens(session, plan, intro, scale)
    const stillDir = path.join(WORK, 'stills')
    if (stills.length) fs.mkdirSync(stillDir, { recursive: true })
    const keep = async (i, png) => {
      if (stills.includes(i)) fs.writeFileSync(path.join(stillDir, `${master ? 'master' : 'hd'}-${String(i).padStart(4, '0')}.png`), png)
    }
    if (args['only-stills'] === true) {
      for (const i of stills) await keep(i, (await screens.draw(i)).png)
      console.log(`opening: ${stills.length} stills in ${path.relative(rel(), stillDir)}/ (${skill.name} ${skill.version}, the level change of ${effort.name} ${effort.version})`)
      return
    }

    const t0 = Date.now()
    const pack = buildPack({ width, height, fps: plan.fps })
    const raw = []
    const fonts = []
    const probes = [0, plan.reasoning.open, Math.round((plan.reasoning.open + plan.reasoning.choose) / 2), plan.reasoning.choose, Math.round((plan.typing.first + plan.typing.last) / 2), plan.send, plan.build.first, Math.round((plan.build.first + plan.build.last) / 2), plan.frameCount - 1]
    const first = new Map()
    const corners = (p) => [0, width - 1, (height - 1) * width, height * width - 1].map((n) => p.subarray(n * 3, n * 3 + 3).toString('hex'))
    let ground = ''
    let groundHolds = true
    let holes = 0
    let warmest = 0
    for (let i = 0; i < plan.frameCount; i++) {
      const f = await screens.draw(i)
      await keep(i, f.png)
      raw.push(f.state)
      fonts.push(f.fonts)
      const pixels = await rgb(f.png, width, height)
      if (i === 0) ground = corners(pixels)[0]
      if (i === 0 || i === plan.build.first || i === plan.frameCount - 1) groundHolds &&= corners(pixels).every((c) => c === ground)
      if (probes.includes(i)) {
        first.set(i, sha(pixels))
        const e = await edges(f.png)
        holes += e.holes
        warmest = Math.max(warmest, e.warmest)
      }
      await pack.add(pixels)
      if (i % 100 === 99) console.log(`opening: ${i + 1} of ${plan.frameCount} frames drawn`)
    }
    let twice = true
    for (const i of [...probes].reverse()) twice &&= sha(await rgb((await screens.draw(i)).png, width, height)) === first.get(i)
    const states = raw.map((s, i) => sayState(plan, i, s))
    const checks = { skill: skillChecks(plan, raw, fonts, screens, twice), film: filmChecks(plan, intro, states, raw, screens.motion, effortModel) }
    const out = master ? PACK_DIRS.master() : PACK_DIRS.source()
    const made = await pack.finish(states, `#${ground}`)
    checks.pack = { rebuiltEqualsDrawn: made.exact, underLimit: master || made.bytes <= MAX_BYTES, oneGroundColour: groundHolds, everyPixelPainted: holes === 0, textInGreyLevels: warmest <= RED_OVER_BLUE, warmestPixel: warmest }
    const failed = Object.entries(checks).flatMap(([group, c]) => Object.entries(c).filter(([, v]) => v === false).map(([k]) => `${group}.${k}`))
    const record = {
      pass: failed.length === 0,
      failed,
      pack: master ? 'master' : 'hd',
      width,
      height,
      fps: plan.fps,
      frameCount: plan.frameCount,
      pictures: made.pictures,
      images: made.images,
      bytes: made.bytes,
      sha256: failed.length ? null : { manifest: sha(made.manifest), bin: sha(made.bin), pack: sha(Buffer.concat([made.manifest, made.bin])) },
      skill: { name: skill.name, version: skill.version },
      levelChange: { name: effort.name, version: effort.version },
      plan,
      measures: screens.motion.composer.effortChange,
      checks,
      errors: screens.errors,
      refused: screens.refused,
    }
    writeJson(path.join(WORK, master ? 'checks-master.json' : 'checks.json'), record)
    if (failed.length) throw new Stop(`the opening was drawn but not written: ${failed.length} of its checks failed (${failed.join(', ')}). See out/work/opening/${master ? 'checks-master.json' : 'checks.json'}`)
    fs.mkdirSync(out, { recursive: true })
    fs.writeFileSync(path.join(out, PACK_FILES.manifest), made.manifest)
    fs.writeFileSync(path.join(out, PACK_FILES.bin), made.bin)
    const read = await openPack(out)
    if (read.frameCount !== plan.frameCount) throw new Stop('the pack on disk does not open again')
    if (!master && fs.existsSync(rel('dist', 'index.html'))) {
      fs.mkdirSync(PACK_DIRS.hosted(), { recursive: true })
      for (const f of Object.values(PACK_FILES)) fs.copyFileSync(path.join(out, f), path.join(PACK_DIRS.hosted(), f))
    }
    console.log(
      `opening: ${plan.frameCount} frames at ${plan.fps} a second (${plan.seconds.toFixed(2)} s), ${width} x ${height}, ${made.pictures} pictures in ${made.images} stored images, ${(made.bytes / 1e6).toFixed(2)} MB, in ${path.relative(rel(), out)}/ · every check passes · sha256 ${record.sha256.pack} · ${skill.name} ${skill.version} with the level change of ${effort.name} ${effort.version} · ${((Date.now() - t0) / 1000).toFixed(0)} s`,
    )
  } finally {
    if (screens) await screens.close().catch(() => {})
    await session.close()
  }
}

main().catch((e) => {
  console.error(e instanceof Stop ? `opening: ${e.message}` : e)
  process.exit(1)
})
