import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { readJson, rel } from './paths.mjs'

export const SOFTWARE_FLAGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
// The second software renderer: Mesa lavapipe behind ANGLE's Vulkan back end. It is asked for by name,
// SHOWCASE_RENDERER=lavapipe, and needs Mesa 26 or newer (mesa-vulkan-drivers). SHOWCASE_LVP_ICD names
// the driver's json when it is not in the usual place.
// --disable-gpu-rasterization: under lavapipe Chrome's GPU raster draws the page's own controls (DOM, not the
// canvas) as grey blocks and stripes in some pictures. With it they are clean, and the canvas is the same bytes
// at the same speed (six pictures and the determinism run, measured 2026-11-26).
export const LAVAPIPE_FLAGS = ['--use-angle=vulkan', '--ignore-gpu-blocklist', '--disable-gpu-rasterization']
export const LAVAPIPE_ICD = '/usr/share/vulkan/icd.d/lvp_icd.json'
export function softwareRenderer() {
  const want = (process.env.SHOWCASE_RENDERER ?? pinnedBrowser().renderer ?? 'swiftshader').toLowerCase()
  if (want === 'swiftshader') return { name: 'swiftshader', flags: SOFTWARE_FLAGS, env: undefined }
  if (want !== 'lavapipe') throw new Error(`SHOWCASE_RENDERER is ${want}. It is swiftshader or lavapipe.`)
  const icd = process.env.SHOWCASE_LVP_ICD ?? LAVAPIPE_ICD
  if (!fs.existsSync(icd)) throw new Error(`SHOWCASE_RENDERER is lavapipe and ${icd} is not there. Install mesa-vulkan-drivers (Mesa 26 or newer) or set SHOWCASE_LVP_ICD.`)
  return { name: 'lavapipe', flags: LAVAPIPE_FLAGS, env: { ...process.env, VK_ICD_FILENAMES: icd } }
}
// The name a record carries for what drew it: swiftshader, lavapipe, or card for an installed browser with its
// graphics card on. A record from before the name was written was drawn by SwiftShader if it says software.
export const rendererName = (local = false) => (local ? 'card' : softwareRenderer().name)
export const rendererOf = (record) => record?.renderer ?? (record?.graphics === 'software' ? 'swiftshader' : null)
// Two software renderers do not draw the same bytes, so a kept picture counts only under the renderer that drew it.
export function sameRenderer(record) {
  const drew = rendererOf(record)
  return !drew || drew === 'card' || drew === softwareRenderer().name
}
const COMMON_FLAGS = ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--force-color-profile=srgb', '--hide-scrollbars', '--mute-audio']

export function pinnedBrowser() {
  return readJson(rel('tools', 'browser.json'))
}

export function findBrowser() {
  const pin = pinnedBrowser()
  const home = os.homedir()
  const candidates = [process.env.SHOWCASE_CHROME, ...pin.paths.map((p) => p.replace('~', home))].filter(Boolean)
  for (const c of candidates) if (fs.existsSync(c)) return c
  throw new Error(`no browser found. Looked in: ${candidates.join(', ')}. Set SHOWCASE_CHROME to a Chrome ${pin.version} binary.`)
}

export async function launch({ local = false, headless = true, extraArgs = [] } = {}) {
  if (local) {
    return chromium.launch({ channel: 'chrome', headless: false, args: [...COMMON_FLAGS, '--ignore-gpu-blocklist', '--enable-gpu-rasterization', ...extraArgs] })
  }
  const soft = softwareRenderer()
  return chromium.launch({ executablePath: findBrowser(), headless, args: [...soft.flags, ...COMMON_FLAGS, ...extraArgs], ...(soft.env ? { env: soft.env } : {}) })
}

export function machineId() {
  const cpu = os.cpus()
  return `${os.hostname()} · ${cpu.length} x ${cpu[0]?.model ?? 'cpu'} · ${Math.round(os.totalmem() / 1048576)} MB`
}

// The browser's own notice that a synchronous read of the frame waited for the graphics pipeline. Every exact
// capture reads its frame back (src/capture, the accumulator, the probe's maths card), so the notice names the
// tool's reading and no fault of the page; the live app reads no pixels while it plays. ANGLE prints it on a
// Vulkan driver such as lavapipe and not on SwiftShader. Only this one line is passed over, by its whole wording.
const READBACK_NOTICE = /GL Driver Message \(OpenGL, Performance, GL_CLOSE_PATH_NV, High\): GPU stall due to ReadPixels$/

export const isReadbackNotice = (type, text) => type === 'warning' && READBACK_NOTICE.test(text)

export function watchPage(page, sink = []) {
  page.on('console', (m) => {
    if (isReadbackNotice(m.type(), m.text())) return
    if (m.type() === 'error' || m.type() === 'warning') sink.push(`${m.type()}: ${m.text()}`)
  })
  page.on('pageerror', (e) => sink.push(`pageerror: ${e.message}`))
  return sink
}

export const freeDiskGb = (dir = rel()) => {
  const s = fs.statfsSync(dir)
  return (s.bavail * s.bsize) / 1024 ** 3
}

export const ensureDir = (p) => {
  fs.mkdirSync(p, { recursive: true })
  return p
}

export const outWork = (...p) => path.join(rel('out', 'work'), ...p)
