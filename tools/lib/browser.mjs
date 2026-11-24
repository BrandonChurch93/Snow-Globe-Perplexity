import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright-core'
import { readJson, rel } from './paths.mjs'

export const SOFTWARE_FLAGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
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
  return chromium.launch({ executablePath: findBrowser(), headless, args: [...SOFTWARE_FLAGS, ...COMMON_FLAGS, ...extraArgs] })
}

export function machineId() {
  const cpu = os.cpus()
  return `${os.hostname()} · ${cpu.length} x ${cpu[0]?.model ?? 'cpu'} · ${Math.round(os.totalmem() / 1048576)} MB`
}

export function watchPage(page, sink = []) {
  page.on('console', (m) => {
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
