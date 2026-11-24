import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createServer } from 'vite'
import { launch, ensureDir, freeDiskGb } from '../lib/browser.mjs'
import { loadConfig, parseArgs, rel } from '../lib/paths.mjs'
import { writeWithRecord, recordMatches } from '../lib/page.mjs'
import { engineHash, hashList, listFiles } from '../lib/hashes.mjs'

const config = loadConfig()
const args = parseArgs(process.argv.slice(2))
const outDir = rel('out/work/ui-preview')
const sizes = ['hd', 'phone', 'tablet'].map((id) => config.formats[id])
const seasons = config.seasons
const hash = engineHash()
const previewHash = hashList(listFiles(rel('tools', 'ui-preview')))
const scale = Number(args.scale ?? 1)
const only = typeof args.only === 'string' ? args.only.split(',') : null
const force = args.force === true

if (freeDiskGb() < config.sandbox.minFreeDiskGb) throw new Error(`free disk is under ${config.sandbox.minFreeDiskGb} GB`)
ensureDir(outDir)

const seasonOf = { hd: seasons[0], phone: seasons[1 % seasons.length], tablet: seasons[2 % seasons.length] }

const shots = []
for (const size of sizes) {
  const season = seasonOf[size.id]
  const controls = ['shake', ...seasons.map((s) => `season:${s}`), 'sound']
  shots.push({ id: `${size.id}-idle`, size, query: { season } })
  shots.push({ id: `${size.id}-dimmed`, size, query: { season }, act: 'dim' })
  shots.push({ id: `${size.id}-busy`, size, query: { season, hold: 1 }, act: 'busy' })
  for (const c of controls) shots.push({ id: `${size.id}-focus-${c.replace(':', '-')}`, size, query: { season }, act: 'focus', control: c })
  shots.push({ id: `${size.id}-pressed-shake`, size, query: { season }, act: 'press', control: 'shake' })
  shots.push({ id: `${size.id}-pressed-season`, size, query: { season }, act: 'press', control: `season:${seasons[(seasons.indexOf(season) + 1) % seasons.length]}` })
  shots.push({ id: `${size.id}-pressed-sound`, size, query: { season }, act: 'press', control: 'sound' })
  shots.push({ id: `${size.id}-hover-shake`, size, query: { season }, act: 'hover', control: 'shake' })
  shots.push({ id: `${size.id}-menu`, size, query: { season }, act: 'menu' })
  shots.push({ id: `${size.id}-sound-on`, size, query: { season, sound: 1 } })
  shots.push({ id: `${size.id}-sound-off`, size, query: { season } })
  shots.push({ id: `${size.id}-no-sound`, size, query: { season, nosound: 1 } })
  shots.push({ id: `${size.id}-reduced`, size, query: { season, reduced: 1 }, act: 'reduced' })
  for (let i = 0; i <= 5; i++) shots.push({ id: `${size.id}-hint-${i}`, size, query: { season }, act: 'hint', at: i / 5 })
}
for (const season of seasons) shots.push({ id: `hd-season-${season}`, size: config.formats.hd, query: { season } })
for (const size of sizes) {
  shots.push({ id: `${size.id}-probe-running`, size, query: { page: 'probe', stop: `${Object.keys(config.live.quality)[1]}-storm` }, act: 'probe-running' })
  shots.push({ id: `${size.id}-probe-done`, size, query: { page: 'probe', seconds: 0.2 }, act: 'probe-done' })
}

const selector = (control) => {
  const [kind, season] = control.split(':')
  return season ? `[data-control="${kind}"][data-season="${season}"]` : `[data-control="${kind}"]`
}

const server = await createServer({ root: rel('.'), server: { port: Number(args.port ?? 5199), host: '127.0.0.1', strictPort: false }, logLevel: 'warn' })
await server.listen()
const origin = server.resolvedUrls.local[0].replace(/\/$/, '')
const browser = await launch()
const made = []
let reused = 0

try {
  for (const shot of shots) {
    if (only && !only.some((o) => shot.id.includes(o))) continue
    const file = path.join(outDir, `${shot.id}.png`)
    const spec = { shot: shot.id, width: shot.size.width, height: shot.size.height, scale, query: shot.query, act: shot.act ?? 'none', control: shot.control ?? '', at: shot.at ?? 0, preview: previewHash }
    const record = { engineHash: hash, tool: 'ui-preview', spec }
    if (!force && recordMatches(file, { spec })) {
      reused++
      made.push(file)
      continue
    }
    const context = await browser.newContext({
      viewport: { width: shot.size.width, height: shot.size.height },
      deviceScaleFactor: scale,
      reducedMotion: shot.act === 'reduced' ? 'reduce' : 'no-preference',
      hasTouch: false,
    })
    const page = await context.newPage()
    const problems = []
    page.on('pageerror', (e) => problems.push(String(e)))
    page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))
    const query = new URLSearchParams(Object.entries(shot.query).map(([k, v]) => [k, String(v)]))
    await page.goto(`${origin}/tools/ui-preview/?${query}`)
    let frozen = true
    if (shot.act?.startsWith('probe')) {
      await page.waitForSelector(shot.act === 'probe-done' ? '[data-probe="done"]' : '[data-probe="running"]')
      if (shot.act === 'probe-running') await page.waitForTimeout(900)
    } else {
      await page.waitForSelector('#ui[data-interface="shown"]')
      await page.evaluate(() => document.fonts.ready)
      await page.waitForFunction(() => [...document.querySelectorAll('#view i')].every((i) => getComputedStyle(i).backgroundImage !== 'none'))
      await page.waitForTimeout(900)
      if (shot.act === 'dim') {
        await page.mouse.move(40, 40)
        await page.evaluate(() => document.querySelector('#ui > div').setAttribute('data-dim', ''))
        await page.waitForTimeout(1200)
      }
      if (shot.act === 'busy') {
        await page.click('[data-control="shake"]')
        await page.waitForTimeout(400)
      }
      if (shot.act === 'focus') {
        const order = ['shake', ...seasons.map((s) => `season:${s}`), 'sound']
        for (let i = 0; i <= order.indexOf(shot.control); i++) await page.keyboard.press('Tab')
        const ok = await page.evaluate((sel) => document.activeElement === document.querySelector(sel), selector(shot.control))
        if (!ok) problems.push(`focus did not reach ${shot.control}`)
        await page.waitForTimeout(300)
      }
      if (shot.act === 'press' || shot.act === 'hover') {
        const box = await page.locator(selector(shot.control)).boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        if (shot.act === 'press') await page.mouse.down()
        await page.waitForTimeout(500)
        frozen = false
      }
      if (shot.act === 'menu') {
        await page.keyboard.press('m')
        await page.waitForSelector('[data-menu]:not([hidden])')
        await page.waitForTimeout(300)
      }
      if (shot.act === 'hint') {
        await page.evaluate(() => document.getElementById('ui').dispatchEvent(new CustomEvent('hint')))
        await page.evaluate((at) => {
          for (const a of document.getAnimations()) {
            const t = a.effect.getComputedTiming()
            a.pause()
            a.currentTime = Math.min(Number(t.endTime) - 1, Number(t.endTime) * at)
          }
        }, shot.at)
        await page.waitForTimeout(120)
        frozen = false
      }
    }
    const box = await page.evaluate(() => {
      const r = document.getElementById('app').getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
    const buffer = await page.screenshot({ type: 'png', clip: box, caret: 'hide', ...(frozen ? { animations: 'disabled' } : {}) })
    const facts = await page.evaluate(() => {
      const rect = (e) => {
        const r = e.getBoundingClientRect()
        return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }
      }
      return [...document.querySelectorAll('[data-control]')].filter((e) => e.getClientRects().length).map((e) => ({ control: e.dataset.control, season: e.dataset.season ?? '', name: (e.textContent ?? '').trim(), pressed: e.getAttribute('aria-pressed'), disabled: e.getAttribute('aria-disabled'), ...rect(e) }))
    })
    writeWithRecord(file, buffer, { ...record, controls: facts, problems })
    if (problems.length) console.log(`${shot.id}: ${problems.join(' | ')}`)
    made.push(file)
    await context.close()
  }
} finally {
  await browser.close()
  await server.close()
}

console.log(`ui-preview: ${made.length - reused} written, ${reused} reused, in ${path.relative(rel('.'), outDir)}`)
