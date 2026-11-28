import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import * as L from '../tools/lib/handoff.mjs'
import * as X from '../tools/lib/handoff-machine.mjs'
import * as Work from '../tools/lib/handoff-work.mjs'
import { PROFILE_ENV, profileRoot, rememberBrowser, stopVerifiedProcess } from '../tools/lib/handoff-processes.mjs'
import { compareLoopScreenshot, decodeScreenshot, LOOP_SCREENSHOT_MEASURE, validScreenshotSpec } from '../tools/lib/handoff-screenshot.mjs'
import { encodeMasterChunk, haveFfmpeg } from '../tools/lib/encode.mjs'
import { readBack, recordsFor, recordsZip } from '../tools/lib/handoff-upload.mjs'
import { readAssetStream } from '../tools/lib/handoff-release-assets.mjs'
import { redactRecordText, releaseBody, releaseMachine, safeDraftIdentity } from '../tools/lib/handoff-record-privacy.mjs'
import { zipRead, zipWrite } from '../tools/lib/handoff-zip.mjs'

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

describe('screenshot proof', () => {
  const pngSpec = { width: 64, height: 64, bitDepth: 8, measure: LOOP_SCREENSHOT_MEASURE, measuredDb: 45, marginDb: 3, floorDb: 42, from: 'a test fixture' }
  const image = (color: string) => sharp({ create: { width: pngSpec.width, height: pngSpec.height, channels: 3, background: color } }).png()

  it('refuses an older stamp or a changed floor before it checks any release file', async () => {
    const plan = { screenshot: pngSpec }
    const format = { width: pngSpec.width, height: pngSpec.height }
    const expected = { pass: false, why: 'the stamp is older than the plan and must be made again by the remote team' }
    expect(await Work.check({}, { stamp: { format }, plan })).toEqual(expected)
    expect(await Work.check({}, { stamp: { format, screenshot: { ...pngSpec, measuredDb: 44, floorDb: 41 } }, plan })).toEqual(expected)
    expect(validScreenshotSpec(pngSpec, format)).toBe(true)
    expect(validScreenshotSpec({ ...pngSpec, floorDb: 41 }, format)).toBe(false)
    expect(validScreenshotSpec(pngSpec, { ...format, width: 32 })).toBe(false)
  })

  it('rejects a PNG with a readable header but incomplete pixels, and checks the original bit depth', async () => {
    const root = temporary()
    const good = path.join(root, 'good.png')
    const bad = path.join(root, 'bad.png')
    const data = await image('#336699').toBuffer()
    fs.writeFileSync(good, data)
    fs.writeFileSync(bad, data.subarray(0, data.indexOf(Buffer.from('IDAT')) + 13))
    expect(await sharp(bad).metadata()).toMatchObject({ width: 64, height: 64, format: 'png' })
    expect(await decodeScreenshot(good, pngSpec)).toMatchObject({ ok: true, said: expect.stringContaining('every pixel decoded') })
    expect(await decodeScreenshot(good, { ...pngSpec, bitDepth: 16 })).toMatchObject({ ok: false })
    expect(await decodeScreenshot(good, { ...pngSpec, width: 32 })).toMatchObject({ ok: false })
    expect(await decodeScreenshot(bad, pngSpec)).toMatchObject({ ok: false })
  })

  it.skipIf(!haveFfmpeg())('measures the decoded first loop frame and fails below the stated floor', async () => {
    const root = temporary()
    const png = path.join(root, 'screen.png')
    const other = path.join(root, 'another.png')
    const bad = path.join(root, 'wrong first frame.mp4')
    const good = path.join(root, 'right first frame.mp4')
    await image('#445566').toFile(png)
    await image('#ddcccc').toFile(other)
    const { video: settings, intermediate } = Work.loadCfg().deliver.master
    const video = { ...settings, ...intermediate }
    const fps = Work.loadCfg().film.fps
    await encodeMasterChunk({ files: [other, png], video, fps, gop: 2, out: bad })
    await encodeMasterChunk({ files: [png, other], video, fps, gop: 2, out: good })
    const proof = (file: string) => compareLoopScreenshot({ file, png, fps, pixFmt: video.pixFmt, floorDb: pngSpec.floorDb })
    expect(await proof(bad)).toMatchObject({ pass: false, found: expect.stringContaining('MEASURED') })
    expect(await proof(good)).toMatchObject({ pass: true, found: expect.stringContaining('MEASURED') })
    expect(await proof(path.join(root, 'not there.mp4'))).toMatchObject({ pass: false })
  })
})

describe('release readback', () => {
  const env = { gh: 'fake gh', slug: 'owner/repo' }
  const ctx = { say: () => {}, note: () => {} }
  const names = ['video.mp4', 'reports.zip']
  const contents = [Buffer.from('the film'), Buffer.from('the records')]
  const sum = (value: Buffer) => createHash('sha256').update(value).digest('hex')
  const wanted = contents.map((value, i) => ({ name: names[i], label: names[i], bytes: value.length, sha256: sum(value) }))
  const assets = wanted.map((w, i) => ({ id: i + 71, name: w.name, label: w.label, size: w.bytes, digest: `sha256:${w.sha256}`, state: 'uploaded' }))
  const list = (assetsOfRelease: { digest?: string }[] = assets) => vi.fn(async () => ({ ok: true, kind: '', json: { draft: true, assets: assetsOfRelease }, bytes: Buffer.alloc(0) }))
  const fetch = (which = contents) => vi.fn(async (_ctx: unknown, _endpoint: unknown, id: number) => {
    const value = which[id - 71]
    return { bytes: value.length, sha256: sum(value), why: '' }
  })

  it('downloads each listed asset and passes only if every byte count and SHA-256 match', async () => {
    const get = list()
    const fetchAsset = fetch()
    const good = await readBack(ctx, env, 27, wanted, { get, fetchAsset })
    expect(get).toHaveBeenCalledWith(ctx, env, 'GET', 'repos/owner/repo/releases/27')
    expect(fetchAsset.mock.calls.map(([, , id]) => id)).toEqual([71, 72])
    expect(good.rows.filter((r: { pass: boolean | null }) => r.pass === false)).toEqual([])
    const wrong = Buffer.from('bad film')
    expect(wrong.length).toBe(contents[0].length)
    const bad = await readBack(ctx, env, 27, wanted, { get, fetchAsset: fetch([wrong, contents[1]]) })
    expect(bad.rows.filter((r: { pass: boolean | null }) => r.pass === false)).toMatchObject([{ check: 'downloaded from the draft: video.mp4' }])
    const short = await readBack(ctx, env, 27, wanted, { get, fetchAsset: fetch([contents[0], contents[1].subarray(0, 3)]) })
    expect(short.rows.filter((r: { pass: boolean | null }) => r.pass === false)).toMatchObject([{ check: 'downloaded from the draft: reports.zip' }])
  })

  it('fails when GitHub omits the listed digest or a download supplies no hash', async () => {
    const get = list([{ ...assets[0], digest: undefined }, assets[1]])
    const back = await readBack(ctx, env, 27, wanted, { get, fetchAsset: fetch() })
    expect(back.rows.filter((r: { pass: boolean | null }) => r.pass === false)).toMatchObject([{ check: 'on the release: video.mp4', found: expect.stringContaining('did not list a valid SHA-256') }])
    const partial = await readBack(ctx, env, 27, wanted, { get: list(), fetchAsset: async () => ({ bytes: 4, sha256: null, why: 'the download did not complete' }) })
    expect(partial.rows.filter((r: { pass: boolean | null }) => r.pass === false)).toMatchObject([
      { check: 'downloaded from the draft: video.mp4', found: expect.stringContaining('no SHA-256 from the download') },
      { check: 'downloaded from the draft: reports.zip', found: expect.stringContaining('no SHA-256 from the download') },
    ])
    const noLocal = await readBack(ctx, env, 27, [{ ...wanted[0], sha256: '' }, wanted[1]], { get: list(), fetchAsset: fetch() })
    expect(noLocal.rows.filter((r: { pass: boolean | null }) => r.pass === false)).toMatchObject([{ check: 'downloaded from the draft: video.mp4' }])
  })

  it('hashes a child asset response incrementally and discards a hash on an unsuccessful exit', async () => {
    const bytes = Buffer.alloc(1024 * 1024, 13)
    const response = (code: number) => vi.fn<NonNullable<Parameters<typeof readAssetStream>[3]>>((_file, _args, options) => spawn(process.execPath, ['-e', `const b = Buffer.alloc(1024 * 64, 13); for (let i = 0; i < 16; i++) process.stdout.write(b); process.exitCode = ${code}`], options))
    const good = response(0)
    expect(await readAssetStream(ctx, env, 71, good)).toEqual({ bytes: bytes.length, sha256: sum(bytes), why: '' })
    expect(good.mock.calls[0].slice(0, 2)).toEqual(['fake gh', ['api', '--method', 'GET', '-H', 'Accept: application/octet-stream', 'repos/owner/repo/releases/assets/71']])
    expect(await readAssetStream(ctx, env, 71, response(3))).toEqual({ bytes: bytes.length, sha256: null, why: 'the download did not complete' })
  })
})

describe('release and records privacy', () => {
  const ctx = (H: string) => ({ H, say: () => {} })
  const mode = { small: true }

  it('uses the platform and known card in draft metadata and refuses a legacy or mismatched draft', () => {
    const host = 'A-Private-Computer'
    const card = 'NVIDIA GeForce RTX 5080'
    const machine = releaseMachine({ platform: 'win32', cards: [{ name: 'AMD Radeon Graphics' }, { name: card }], renderer: `ANGLE (${card} Direct3D)` })
    const renderTime = '2026-11-28T12:00:00.000Z'
    const engineHash = '7dbb2c54aa42b34a'
    const commit = '2'.repeat(40)
    const names = L.releaseNames({ date: renderTime, engineHash, machine })
    const body = releaseBody({ machine, engineHash, commit, renderTime })
    expect(machine).toBe(`Windows ${card}`)
    expect([names.tag, names.title, body].join('\n')).not.toContain(host)
    expect(releaseMachine({ platform: 'darwin' })).toBe('macOS')
    expect(body).toContain('visible to everyone with write access to this repository')
    const legacy = L.releaseNames({ date: renderTime, engineHash, machine: host })
    const draft = { draft: true, tag_name: names.tag, name: names.title, body }
    expect(safeDraftIdentity(draft, names, body)).toBe(true)
    expect(safeDraftIdentity({ ...draft, tag_name: legacy.tag, name: legacy.title }, names, body)).toBe(false)
    expect(safeDraftIdentity({ ...draft, body: `made on ${host}` }, names, body)).toBe(false)
    expect(safeDraftIdentity({ ...draft, body: releaseBody({ machine, engineHash, commit, renderTime: '2026-11-28T12:01:00.000Z' }) }, names, body)).toBe(false)
  })

  it('redacts a home root in plain text, file URLs and escaped JSON without touching sibling paths', () => {
    const windows = String.raw`C:\Users\Case Name`
    const output = redactRecordText(JSON.stringify({ path: `${windows}\\Desktop\\render.txt`, similar: `${windows}-other\\Desktop` }), windows)
    expect(JSON.parse(output)).toEqual({ path: '~\\Desktop\\render.txt', similar: `${windows}-other\\Desktop` })
    expect(redactRecordText('from c:/USERS/case name/Desktop and file:///C:/Users/Case%20Name/Desktop', windows)).toBe('from ~/Desktop and file:///~/Desktop')
    const posix = '/home/left'
    const inputs = `exact "${posix}"; nested ${posix}/render; file://${posix}/report; other ${posix}2/report; under /tmp${posix}/report`
    expect(redactRecordText(inputs, posix)).toBe('exact "~"; nested ~/render; file://~/report; other /home/left2/report; under /tmp/home/left/report')
  })

  it('redacts text in a new records zip and leaves approval and ownership entries out', () => {
    const H = fs.mkdtempSync(path.join(process.cwd(), '.handoff-records-test-'))
    roots.push(H)
    const home = os.homedir()
    const report = path.join(home, 'Desktop', 'render report.txt')
    write(path.join(H, 'render.json'), JSON.stringify({ report }))
    for (const file of ['approval-render.json', 'approval-upload.json', 'approval-asked.json', 'job-approve.json', 'report-approve.txt']) write(path.join(H, file), 'do not include')
    for (const name of ['browser-profiles', 'browser-processes', 'failed-test-ownership']) {
      fs.mkdirSync(path.join(H, name))
      write(path.join(H, name, 'private.json'), 'do not include')
    }
    const zip = zipRead(recordsZip(ctx(H), mode).file)
    const own = zip.filter(({ name }) => name.startsWith(path.basename(H) + '/'))
    expect(own.map(({ name }) => path.basename(name))).toEqual(['render.json'])
    expect(JSON.parse(own[0].data.toString('utf8'))).toEqual({ report: `~${path.sep}Desktop${path.sep}render report.txt` })
    expect(fs.readFileSync(path.join(H, 'render.json'), 'utf8')).toBe(JSON.stringify({ report }))
  })

  it('removes private entries and redacts an older cached zip before it can be reused', () => {
    const H = temporary()
    const dir = path.join(H, 'upload')
    const file = path.join(dir, L.recordsName())
    fs.mkdirSync(dir)
    const home = os.homedir()
    zipWrite(file, [
      { name: 'out/work/handoff/approval-render.json', data: 'do not include' },
      { name: 'out/work/handoff/browser-processes/process.json', data: 'do not include' },
      { name: 'out/work/handoff/report-render.txt', data: `in "${path.join(home, 'Desktop')}"\n` },
    ])
    const made = recordsFor(ctx(H), mode)
    expect(made.entries).toBe(1)
    expect(zipRead(made.file).map(({ name, data }) => [name, data.toString('utf8')])).toEqual([['out/work/handoff/report-render.txt', `in "~${path.sep}Desktop"\n`]])
    const hash = L.sha256File(file)
    expect(recordsFor(ctx(H), mode)).toMatchObject({ file, entries: 1 })
    expect(L.sha256File(file)).toBe(hash)
  })
})
