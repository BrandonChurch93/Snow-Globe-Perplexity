import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as L from '../tools/lib/handoff.mjs'
import * as X from '../tools/lib/handoff-machine.mjs'
import * as Work from '../tools/lib/handoff-work.mjs'
import { PROFILE_ENV, profileRoot, rememberBrowser, stopVerifiedProcess } from '../tools/lib/handoff-processes.mjs'

const roots: string[] = []
const temporary = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'handoff files '))
  roots.push(root)
  return root
}
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

const write = (file: string, body: string) => {
  fs.writeFileSync(file, body)
  return { file, bytes: Buffer.byteLength(body), sha256: L.sha256File(file) }
}

describe('process ownership', () => {
  it('puts only this handoff profile option in its child environment without changing its graphics switches', () => {
    vi.stubEnv(PROFILE_ENV, '')
    vi.stubEnv('SHOWCASE_LOCAL_ARGS', '')
    const H = temporary()
    const switches = Work.setChromeSwitches({ H, T: { angle: 'swiftshader' } })
    expect(switches).toEqual(['--force_high_performance_gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
    expect(process.env[PROFILE_ENV]).toBe(profileRoot(H))
  })

  it('does not end another or unrecorded browser profile or a reused process number', async () => {
    const root = temporary()
    const H = path.join(root, 'clone work')
    const owned = path.join(profileRoot(H), 'playwright_chromiumdev_profile-owned')
    const other = path.join(root, 'other work', 'playwright_chromiumdev_profile-other')
    const unrecorded = path.join(profileRoot(H), 'playwright_chromiumdev_profile-unrecorded')
    const children = [owned, other, unrecorded].map((profile) => {
      const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)', '--', `--user-data-dir=${profile}`], { stdio: 'ignore' })
      return { child, exited: once(child, 'exit') }
    })
    const [ours, theirs, fresh] = children
    try {
      expect(X.stopLeftBrowsers(H)).toBe(0)
      const ownPid = ours.child.pid as number
      const theirPid = theirs.child.pid as number
      rememberBrowser(H, ownPid, owned)
      const started = X.processStart(theirPid)
      expect(started).toBeTruthy()
      expect(stopVerifiedProcess({ pid: theirPid, started: `${started}-old` })).toBe(false)
      expect(stopVerifiedProcess({ pid: theirPid })).toBe(false)
      fs.writeFileSync(path.join(H, 'browser-processes', `${theirPid}.json`), JSON.stringify({ pid: theirPid, started, profile: owned }))
      expect(X.stopLeftBrowsers(H)).toBe(1)
      await ours.exited
      expect(X.alive(theirPid)).toBe(true)
      expect(X.alive(fresh.child.pid)).toBe(true)
    } finally {
      for (const { child } of children) child.kill()
      await Promise.all(children.map(({ exited }) => exited))
    }
  }, 15_000)

  it('records an operating system start token for a tool and drops it only after that tool closes', async () => {
    const H = temporary()
    let saw: unknown
    const r = await Work.runFile({ H, note: (line: string) => {
      if (line.includes('child ready')) saw = JSON.parse(fs.readFileSync(path.join(H, 'children.json'), 'utf8'))
    } }, process.execPath, ['-e', "console.log('child ready'); setTimeout(() => {}, 100)"])
    expect(r.code).toBe(0)
    expect(saw).toEqual([{ pid: expect.any(Number), started: expect.any(String) }])
    expect(JSON.parse(fs.readFileSync(path.join(H, 'children.json'), 'utf8'))).toEqual([])
  })
})

function failedBundle() {
  const root = temporary()
  const H = path.join(root, 'work')
  const desktop = path.join(root, 'Desktop with spaces')
  fs.mkdirSync(H)
  fs.mkdirSync(desktop)
  write(path.join(H, 'test.json'), 'old')
  const messages: string[] = []
  return { ctx: { H, note: (m: string) => messages.push(m) }, result: { desktop, time: new Date().toISOString() }, messages }
}

describe('Desktop ownership', () => {
  it('replaces or removes only the sealed files of a failure bundle, including its report', () => {
    const { ctx, result } = failedBundle()
    const first = Work.keepFailedTest(ctx, result)
    expect(first?.folder).toBe(path.join(result.desktop, L.failedTestName()))
    const folder = first?.folder as string
    Work.writeFailedTestReport(ctx, folder, 'the first report')
    write(path.join(ctx.H, 'test.json'), 'new')
    expect(Work.keepFailedTest(ctx, result)?.folder).toBe(folder)
    expect(fs.readFileSync(path.join(folder, 'test.json'), 'utf8')).toBe('new')
    expect(fs.existsSync(path.join(folder, 'report-test.txt'))).toBe(false)
    Work.writeFailedTestReport(ctx, folder, 'the second report')
    Work.dropFailedTest(ctx, result)
    expect(fs.existsSync(folder)).toBe(false)
  })

  it('keeps a failure bundle wholly intact when a file changes or another file is added', () => {
    const { ctx, result, messages } = failedBundle()
    const folder = Work.keepFailedTest(ctx, result)?.folder as string
    Work.writeFailedTestReport(ctx, folder, 'the report')
    write(path.join(folder, 'test.json'), 'new')
    write(path.join(folder, 'my notes.txt'), 'owner')
    expect(Work.keepFailedTest(ctx, result)?.folder).toBe(path.join(ctx.H, 'test-failed'))
    Work.dropFailedTest(ctx, result)
    expect(fs.readdirSync(folder).sort()).toEqual(['my notes.txt', 'report-test.txt', 'test.json'])
    expect(fs.readFileSync(path.join(folder, 'test.json'), 'utf8')).toBe('new')
    expect(messages.join('\n')).toContain('other or changed files: my notes.txt, test.json')
  })

  it('leaves a delivery folder and same-name files alone when they are not the checked copies', async () => {
    const { ctx, result } = failedBundle()
    const width = Work.loadCfg().formats.preview.width
    const height = Work.loadCfg().formats.preview.height
    const folder = path.join(result.desktop, L.deliveryFolder(true))
    fs.mkdirSync(folder)
    const files = Object.fromEntries(L.KINDS.map((kind: string) => [kind, write(path.join(ctx.H, kind), kind)]))
    write(path.join(ctx.H, 'check.json'), JSON.stringify({ pass: true, small: true, files }))
    vi.spyOn(X, 'readMachine').mockReturnValue({ desktop: result.desktop } as ReturnType<typeof X.readMachine>)
    const job = { H: ctx.H, T: { small: true }, say: () => {} }
    const renderReport = () => 'the render report'
    const unrelated = path.join(folder, 'my files')
    fs.mkdirSync(unrelated)
    expect(await Work.deliver(job, renderReport)).toMatchObject({ pass: false, why: expect.stringContaining('my files') })
    expect(fs.readdirSync(folder)).toEqual(['my files'])
    fs.rmdirSync(unrelated)
    const sameName = L.deliveryName('still', width, height)
    write(path.join(folder, sameName), 'mine')
    expect(await Work.deliver(job, renderReport)).toMatchObject({ pass: false, why: expect.stringContaining(sameName) })
    expect(fs.readFileSync(path.join(folder, sameName), 'utf8')).toBe('mine')
    expect(fs.readdirSync(folder)).toEqual([sameName])
    fs.unlinkSync(path.join(folder, sameName))
    const delivered = await Work.deliver(job, renderReport)
    expect(delivered.pass).toBe(true)
    if (!('report' in delivered) || !delivered.report) throw new Error('the delivery did not write its report')
    expect(delivered.reportSha256).toBe(L.sha256File(delivered.report))
    write(path.join(ctx.H, 'deliver.json'), JSON.stringify(delivered))
    expect((await Work.deliver(job, () => 'a second report')).pass).toBe(true)
    expect(fs.readFileSync(delivered.report, 'utf8')).toBe('the render report')
  })

  it('does not clean the work or make a records zip when a delivered file changes at the same size', () => {
    const { ctx, result } = failedBundle()
    const files = L.KINDS.map((kind: string) => ({ kind, ...write(path.join(result.desktop, kind), 'yes') }))
    write(path.join(ctx.H, 'deliver.json'), JSON.stringify({ pass: true, files }))
    write(path.join(ctx.H, 'render-state.json'), '{}')
    write(files[0].file, 'not')
    const zip = vi.fn(() => { throw new Error('do not clean this test fixture') })
    const cleaned = Work.clean({ H: ctx.H, T: { small: true } }, zip)
    expect(cleaned.pass).toBe(false)
    expect(cleaned.why).toContain('does not match the last delivery by SHA-256')
    expect(zip).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(ctx.H, 'render-state.json'))).toBe(true)
  })

  it('keeps the work when the delivered report is unsealed or differs from its sealed hash', () => {
    const { ctx, result } = failedBundle()
    const files = L.KINDS.map((kind: string) => ({ kind, ...write(path.join(result.desktop, kind), kind) }))
    const report = path.join(result.desktop, 'render report.txt')
    const sealed = write(report, 'old')
    write(path.join(ctx.H, 'render-state.json'), '{}')
    const zip = vi.fn(() => { throw new Error('do not clean this test fixture') })
    const check = (reportSha256?: string) => {
      write(path.join(ctx.H, 'deliver.json'), JSON.stringify({ pass: true, files, report, reportSha256 }))
      expect(Work.clean({ H: ctx.H, T: { small: true } }, zip)).toMatchObject({ pass: false, why: expect.stringContaining(report) })
    }
    check()
    write(report, 'new')
    check(sealed.sha256)
    expect(zip).not.toHaveBeenCalled()
    expect(fs.existsSync(path.join(ctx.H, 'render-state.json'))).toBe(true)
  })
})
