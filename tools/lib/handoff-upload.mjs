// The upload of the render handoff: the finished files of this machine go to a draft release of the private repo,
// so that the remote team can fetch them. tools/handoff.mjs calls upload() for the word "upload" and uploadTest()
// for the word of the tool's own tests. The rules are in tools/lib/handoff.mjs.
//
// Everything GitHub is asked goes through gh, the GitHub program, started by its full path and never through a
// shell. The tool reads no token and prints no environment: gh holds the sign in.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { rel } from './paths.mjs'
import * as L from './handoff.mjs'
import * as X from './handoff-machine.mjs'
import * as W from './handoff-work.mjs'
import { zipWrite, zipRead } from './handoff-zip.mjs'
import { privateRecord, redactRecordText, releaseBody, releaseMachine, safeDraftIdentity } from './handoff-record-privacy.mjs'
import { readAssetStream, sha256Hex } from './handoff-release-assets.mjs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const mb = (bytes) => (bytes < 1e5 ? `${bytes} bytes` : `${(bytes / 1e6).toFixed(1)} MB`)
const writeJson = (f, v) => {
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n')
}

// ---------------------------------------------------------------------------------------------------------------------
// gh.

/** gh, run to its end. What it writes is kept as bytes, so that a file read back is the file. */
function gh(ctx, file, args) {
  return new Promise((resolve) => {
    ctx.note(`> gh ${args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')}`)
    let child
    try {
      child = spawn(file, args, { cwd: rel(), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env: { ...process.env, GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', NO_COLOR: '1' } })
    } catch (e) {
      return resolve({ code: -1, out: Buffer.alloc(0), err: e.message })
    }
    const out = []
    let err = ''
    child.stdout.on('data', (d) => out.push(d))
    child.stderr.on('data', (d) => (err = (err + d).slice(-4000)))
    child.on('error', (e) => resolve({ code: -1, out: Buffer.concat(out), err: e.message }))
    child.on('close', (code) => resolve({ code, out: Buffer.concat(out), err }))
  })
}

/**
 * One question to GitHub's API. `where` is a path of the API or a whole address; `input` a file that is sent as it is.
 * A question that only reads is asked up to three times before its answer counts, because GitHub can answer "not
 * found" for a moment about something that is there (measured once, right after a file of 600 MB was sent: the
 * list of releases and a release by its id were both "not found", and were there again seconds later).
 */
async function api(ctx, E, method, where, { fields = null, input = null, type = null, accept = 'application/vnd.github+json', tries = method === 'GET' ? 3 : 1 } = {}) {
  const args = ['api', '--method', method, '-H', `Accept: ${accept}`]
  if (type) args.push('-H', `Content-Type: ${type}`)
  for (const [k, v] of Object.entries(fields ?? {})) args.push(typeof v === 'string' ? '-f' : '-F', `${k}=${v}`)
  if (input) args.push('--input', input)
  args.push(where)
  for (let n = 1; ; n++) {
    const r = await gh(ctx, E.gh, args)
    const text = accept.includes('json') ? r.out.toString('utf8') : ''
    const says = L.ghSays({ code: r.code, out: text.slice(0, 4000), err: r.err })
    let json = null
    try {
      if (text) json = JSON.parse(text)
    } catch {}
    if (!says.ok) ctx.note(`  gh answered with code ${r.code}: ${says.said}`)
    if (says.ok || says.kind === 'sign in' || n >= tries) return { ...says, json, bytes: r.out }
    await sleep(n * 4000)
  }
}

/** Every release of the repo, drafts too: the tag, the id and whether it is a draft. */
async function listReleases(ctx, E) {
  const all = []
  for (let page = 1; page <= 20; page++) {
    const r = await api(ctx, E, 'GET', `repos/${E.slug}/releases?per_page=100&page=${page}`)
    if (!r.ok || !Array.isArray(r.json)) return { ok: false, said: r.said ?? 'GitHub gave no list', all }
    all.push(...r.json)
    if (r.json.length < 100) break
  }
  return { ok: true, all }
}

/** The repo this clone belongs to, read from its origin. gh is not asked. */
function whichRepo() {
  const origin = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: rel(), encoding: 'utf8', windowsHide: true })
  return L.repoOf(origin.error || origin.status !== 0 ? '' : origin.stdout)
}
const NO_REPO = 'the origin of this clone is no GitHub address this tool knows, so it does not know which repo to send to. Nothing is sent'

/** Where gh is and what the sign in of this machine may do in the repo. */
async function ground(ctx, repo, { wantPrivate }) {
  const G = X.locate('gh', 'gh')
  if (!G.file) return { refuse: L.ghMissing(process.platform) }
  const v = spawnSync(G.file, ['--version'], { encoding: 'utf8', windowsHide: true })
  ctx.say(`gh         ${v.error || v.status !== 0 ? 'it does not say its version' : String(v.stdout).split(/\r?\n/)[0]}, found on ${G.from}`)
  const E = { gh: G.file, slug: repo.slug }
  const seen = await api(ctx, E, 'GET', `repos/${repo.slug}`)
  if (!seen.ok) {
    if (seen.kind === 'sign in') return { refuse: L.notSignedIn() }
    if (seen.kind === 'not found') return { refuse: `the GitHub sign in of this machine does not see the repo ${repo.slug}, so nothing is sent. It must be the account that owns the repo: Brandon runs this one line in a terminal of his own and signs in with that account, then the upload line is run again: ${L.SIGN_IN_LINE}` }
    return { refuse: `GitHub could not be asked about the repo ${repo.slug} (${seen.said}). Nothing is sent. If the network was down, run the same line again` }
  }
  const isPrivate = seen.json?.private === true
  const mayWrite = seen.json?.permissions?.push
  // what GitHub says the sign in may do is printed and not trusted: the making of the draft is what tells
  ctx.say(`repo       ${repo.slug}, ${isPrivate ? 'private' : 'not private'}${mayWrite === true ? ', and this sign in may write to it' : mayWrite === false ? ', and GitHub says of this sign in that it may not write to it' : ''}`)
  if (wantPrivate && !isPrivate) return { refuse: L.notPrivate(repo.slug) }
  return { E, isPrivate }
}

// ---------------------------------------------------------------------------------------------------------------------
// Sending and reading back. The real word and the tool's own test share these.

/**
 * Sends what the release lacks: lists what it holds, removes what is short or not finished, sends what is missing.
 * A file that did not go through is tried once more after a pause, and only what is then missing or short.
 */
async function sendMissing(ctx, E, release, wanted, { rounds = 2, pauseMs = 20000 } = {}) {
  const base = String(release.upload_url ?? '').replace(/\{.*$/, '')
  if (!base) return { ok: false, why: 'GitHub named no address to send the files of this release to', sent: [] }
  const sent = []
  for (let round = 1; ; round++) {
    const list = await api(ctx, E, 'GET', `repos/${E.slug}/releases/${release.id}/assets?per_page=100`)
    if (!list.ok || !Array.isArray(list.json)) return { ok: false, why: `the files of the release could not be listed (${list.said ?? 'GitHub gave no list'})`, sent }
    const plan = L.uploadPlan(wanted, list.json)
    ctx.say(`MEASURED from the listing: ${plan.keep.length} of ${wanted.length} look whole${plan.drop.length ? `, ${plan.drop.length} listed as incomplete or different` : ''}. Their bytes are not verified yet. To send: ${plan.send.length ? plan.send.map((w) => w.label).join(', ') : 'nothing'}`)
    let failed = null
    for (const d of plan.drop) {
      ctx.say(`removing ${d.name} from the release: ${d.why}`)
      const r = await api(ctx, E, 'DELETE', `repos/${E.slug}/releases/assets/${d.id}`)
      if (!r.ok && r.kind !== 'not found') {
        failed = { name: d.name, said: r.said }
        break
      }
    }
    for (const w of failed ? [] : plan.send) {
      const t0 = Date.now()
      ctx.sending = { label: w.label, bytes: w.bytes, since: t0, n: wanted.indexOf(w) + 1, of: wanted.length }
      ctx.say(`sending ${w.label} (${mb(w.bytes)})`)
      const r = await api(ctx, E, 'POST', `${base}?name=${encodeURIComponent(w.name)}&label=${encodeURIComponent(w.label)}`, { input: w.file, type: L.contentType(w.name) })
      ctx.sending = null
      if (!r.ok || r.json?.name !== w.name || r.json?.size !== w.bytes) {
        failed = { name: w.label, said: r.ok ? `GitHub took it as "${r.json?.name}" with ${r.json?.size} bytes` : r.said }
        break
      }
      sent.push(w.name)
      ctx.say(`sent: ${w.label}, ${((Date.now() - t0) / 1000).toFixed(1)} s`)
    }
    if (!failed) return { ok: true, sent, plan }
    if (round >= rounds) return { ok: false, why: `${failed.name} did not go through: ${failed.said}`, sent }
    ctx.say(`${failed.name} did not go through (${failed.said}). One more try in ${Math.round(pauseMs / 1000)} s, of what is missing or short only`)
    await sleep(pauseMs)
  }
}

/** Proof from the listing is separate from proof of the actual downloaded bytes. */
export async function readBack(ctx, E, id, wanted, { get = api, fetchAsset = readAssetStream } = {}) {
  const r = await get(ctx, E, 'GET', `repos/${E.slug}/releases/${id}`)
  if (!r.ok || !r.json) return { release: null, rows: [{ check: 'the release, read back', found: `it could not be read (${r.said ?? 'GitHub gave no answer'})`, wanted: 'read back from GitHub', pass: false }] }
  const assets = Array.isArray(r.json.assets) ? r.json.assets.filter((a) => a && typeof a.name === 'string') : []
  const release = { ...r.json, assets }
  const rows = L.readBackRows(wanted, release)
  if (release.draft !== true) return { release, rows }
  rows[wanted.length].found = 'a draft, visible to everyone with write access to the repository'
  for (const [index, w] of wanted.entries()) {
    const matches = assets.filter((a) => a.name === w.name)
    const a = matches[0]
    const check = `downloaded from the draft: ${w.name}`
    const validListedHash = /^sha256:[0-9a-f]{64}$/.test(a?.digest ?? '')
    rows[index].wanted = `STATED: ${rows[index].wanted}`
    if (a) rows[index].found = `MEASURED from the listing: ${rows[index].found}`
    if (a && !validListedHash) {
      rows[index].pass = false
      rows[index].found = `MEASURED: ${a.size} listed bytes; GitHub did not list a valid SHA-256`
    }
    const expected = sha256Hex(w.sha256)
    const want = expected ? `STATED: ${w.bytes} bytes and SHA-256 ${w.sha256}` : 'the SHA-256 of the exact file sent'
    if (matches.length !== 1 || !Number.isSafeInteger(a?.id) || a.id <= 0) {
      rows.push({ check, found: 'no single matching asset to download', wanted: want, pass: false })
      continue
    }
    ctx.say(`reading back ${w.label} to measure its SHA-256`)
    const read = await fetchAsset(ctx, E, a.id).catch(() => ({ sha256: null, bytes: null, why: 'the download failed' }))
    const proven = sha256Hex(read.sha256) && read.bytes === w.bytes
    const count = read.bytes === null ? 'UNKNOWN bytes received' : `MEASURED: ${read.bytes} bytes received`
    const found = !read.sha256 ? `no SHA-256 from the download: ${read.why}; ${count}` : `MEASURED: downloaded ${read.bytes} bytes, SHA-256 ${read.sha256}`
    rows.push({ check, found, wanted: want, pass: expected && proven && read.sha256 === w.sha256 })
  }
  return { release, rows }
}

function heart(ctx, what) {
  const line = () => {
    const s = ctx.sending
    return s ? `${what}: sending ${s.label} (${mb(s.bytes)}), file ${s.n} of ${s.of}, for ${L.hoursText((Date.now() - s.since) / 1000)} now` : `${what} is at work`
  }
  ctx.heartbeat = () => ({ line: line() })
  ctx.heartbeatLine = () => `heartbeat: ${line()}`
}

// ---------------------------------------------------------------------------------------------------------------------
// The records of a render as one zip.

const RECORD = /\.(json|txt|log|out|stderr|stdout)$/i
// what the upload itself writes while it runs is no record of the render, and would make the zip another each time
const LIVE = /^(job|report)-upload(-test)?\.|^(upload|upload-release|job|job-seen|heartbeat|children)\.json$/

function walk(dir, skip, out = []) {
  let names = []
  try {
    names = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const n of names) {
    const f = path.join(dir, n.name)
    if (n.isDirectory()) {
      if (!skip(f)) walk(f, skip, out)
    } else if (n.isFile()) out.push(f)
  }
  return out
}

/** The files that are the records of this render: reports, logs and the record of every chunk and every film. No picture, no film, no sound. */
export function recordFiles(ctx, mode) {
  const names = new Map()
  const add = (file, name) => {
    if (privateRecord(name)) return
    try {
      const st = fs.statSync(file)
      if (st.isFile() && st.size <= 64e6 && !names.has(name)) names.set(name, file)
    } catch {}
  }
  const skip = (d) => privateRecord(W.short(d)) || (path.dirname(d) === ctx.H && ['upload', 'upload-test'].includes(path.basename(d)))
  for (const root of [ctx.H, W.chunksDir(mode), W.finalsDir(mode), rel('out', 'work', 'master')]) {
    for (const f of walk(root, skip)) if (RECORD.test(f) && !(path.dirname(f) === ctx.H && LIVE.test(path.basename(f)))) add(f, W.short(f))
  }
  add(W.STAMP_FILE, 'render/STAMP.json')
  add(W.PLAN_FILE, 'render/PLAN.json')
  const delivered = W.readOr(path.join(ctx.H, 'deliver.json'))
  if (delivered?.report) add(delivered.report, `Desktop/${path.basename(delivered.report)}`)
  return [...names].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([name, file]) => ({ name, file }))
}

/** Writes the records zip into out/work/handoff/upload and reads it back whole. */
export function recordsZip(ctx, mode) {
  const entries = recordFiles(ctx, mode).map((e) => ({ ...e, data: redactRecordText(fs.readFileSync(e.file, 'utf8')) }))
  const file = path.join(ctx.H, 'upload', L.recordsName())
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const made = zipWrite(file, entries)
  const back = zipRead(file)
  if (back.length !== entries.length) throw new Error(`the records zip holds MEASURED ${back.length} files where MEASURED ${entries.length} were put in`)
  return { file, entries: made.entries, bytes: made.bytes }
}

/** The records zip of this render: made now while the work files are there, or the one that "clean" made before it deleted them. */
export function recordsFor(ctx, mode) {
  const file = path.join(ctx.H, 'upload', L.recordsName())
  const cleaned = !fs.existsSync(path.join(ctx.H, 'render-state.json'))
  if (cleaned && fs.existsSync(file)) {
    ctx.say('records    the work files are cleaned already; the earlier zip is read and redacted before it can be sent')
    const kept = zipRead(file)
    const redacted = kept.filter((e) => !privateRecord(e.name)).map((e) => ({ name: e.name, data: Buffer.from(redactRecordText(e.data.toString('utf8'))) }))
    if (redacted.length !== kept.length || redacted.some((e, i) => !e.data.equals(kept[i].data))) return zipWrite(file, redacted)
    return { file, entries: kept.length, bytes: fs.statSync(file).size }
  }
  return recordsZip(ctx, mode)
}

// ---------------------------------------------------------------------------------------------------------------------
// The word "upload".

async function factsOf(kind, file) {
  if (kind === 'still') {
    const sharp = (await import('sharp')).default
    const m = await sharp(file).metadata()
    return { frames: 1, seconds: null, pixels: `${m.width}x${m.height}` }
  }
  const { probeStreams } = await import('./encode.mjs')
  const s = probeStreams(file)
  const v = s.video[0] ?? {}
  return { frames: Number(v.nb_frames) || null, seconds: Number(s.format?.duration) || null, pixels: `${v.width}x${v.height}` }
}

/** What the approve word asks GitHub before a yes for the upload is recorded: the repository of this clone, and whether it is private. */
export async function uploadGround(ctx) {
  const repo = whichRepo()
  if (!repo) return { refuse: NO_REPO }
  const g = await ground(ctx, repo, { wantPrivate: true })
  return g.refuse ? { refuse: g.refuse, repo } : { repo, isPrivate: g.isPrivate }
}

export async function upload(ctx) {
  // before anything is read or sent: the delivery has passed, and Brandon's yes for this very upload is recorded
  // here, naming this repository as private and these files by size and sha256 (tools/lib/handoff-approve.mjs)
  const notApproved = W.uploadGate(ctx, whichRepo())
  if (notApproved) return { pass: false, why: notApproved, refused: true }
  const refuse = (why) => ({ pass: false, why, refused: true })
  const mode = W.modeOf(ctx, W.loadCfg())
  const stamp = W.readStamp()
  // 1. only what passed the check on this machine is sent
  const checked = W.readOr(path.join(ctx.H, 'check.json'))
  if (!checked?.pass) return refuse('the check has not passed on the finished files of this machine, so nothing is sent. Run: node tools/handoff.mjs check')
  if (checked.small !== mode.small) return refuse('the check that passed was of another kind of run than this one, so nothing is sent. Run: node tools/handoff.mjs check')
  X.readTools()
  const repo = whichRepo()
  if (!repo) return refuse(NO_REPO)
  // 2. what is to go is made ready first, on this machine alone, so that every file is known before GitHub is asked
  // the very files that were checked: where the check found them, or their copies on the Desktop
  const delivered = W.readOr(path.join(ctx.H, 'deliver.json'))
  const files = []
  for (const kind of L.KINDS) {
    const c = checked.files?.[kind]
    const d = delivered?.pass ? (delivered.files ?? []).find((f) => f.kind === kind) : null
    const sizeIs = (f) => {
      try {
        return fs.statSync(f).size === c?.bytes
      } catch {
        return false
      }
    }
    const from = [c?.file, d?.file].filter(Boolean).find(sizeIs)
    if (!c || !from) return refuse(`${kind} is not on this machine any more as it was checked (${c ? W.short(c.file) : 'the check names no such file'}), so nothing is sent. Run the check again: node tools/handoff.mjs check`)
    ctx.say(`reading ${path.basename(from)} (${mb(c.bytes)})`)
    const sha = L.sha256File(from)
    if (sha !== c.sha256) return refuse(`${path.basename(from)} is not the file that was checked (its sha256 is ${sha.slice(0, 12)}, the check's ${String(c.sha256).slice(0, 12)}), so nothing is sent. Run the check again: node tools/handoff.mjs check`)
    const label = L.deliveryName(kind, mode.format.width, mode.format.height)
    files.push({ kind, file: from, bytes: c.bytes, sha256: sha, label, name: L.assetName(label), ...(await factsOf(kind, from)) })
  }
  // the draft this render belongs to: the one an earlier call made, or a new one
  const stateFile = path.join(ctx.H, 'upload-release.json')
  let state = W.readOr(stateFile)
  if (state && (state.slug !== repo.slug || state.engineHash !== stamp?.engineHash || state.small !== mode.small)) state = null
  const hist = W.renderHistory(ctx.H)
  const ended = hist.sessions.map((s) => s.end ?? s.last).filter(Boolean).pop()
  const date = state?.date ?? ended ?? checked.time ?? new Date().toISOString()
  const doc = W.readOr(path.join(ctx.H, 'doctor.json'))
  const machine = releaseMachine({ platform: process.platform, cards: doc?.machine?.cards ?? [], renderer: doc?.renderer ?? '' })
  const made = state?.made ?? new Date().toISOString()
  const names = L.releaseNames({ date, engineHash: stamp?.engineHash ?? 'unknown', machine, small: mode.small })
  const unsafeDraft = 'the earlier draft has an old or changed name or description. It is left alone and nothing is sent. Ask the remote team to review that draft'
  if (state?.id && (state.safeName !== true || state.tag !== names.tag)) return refuse(unsafeDraft)
  // the records and the sums, and no file of 2,000 MB or more: all of it before the first byte is sent
  const zip = recordsFor(ctx, mode)
  const records = { kind: 'records', file: zip.file, bytes: zip.bytes, sha256: L.sha256File(zip.file), label: L.recordsName(), name: L.assetName(L.recordsName()) }
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: rel(), encoding: 'utf8', windowsHide: true })
  const body = releaseBody({ machine, engineHash: stamp?.engineHash ?? 'unknown', commit: commit.status === 0 ? commit.stdout.trim() : 'not read', renderTime: date })
  const sumsFile = path.join(ctx.H, 'upload', L.sumsName())
  fs.writeFileSync(sumsFile, L.sumsText({ title: names.title, tag: names.tag, made, engineHash: stamp?.engineHash ?? 'unknown', commit: commit.status === 0 ? commit.stdout.trim() : 'not read', machine, files: [...files, records] }))
  const sums = { kind: 'sums', file: sumsFile, bytes: fs.statSync(sumsFile).size, sha256: L.sha256File(sumsFile), label: L.sumsName(), name: L.assetName(L.sumsName()) }
  const wanted = [...files, sums, records]
  ctx.say(`records    ${zip.entries} files of reports, logs and records in one zip, ${mb(zip.bytes)}`)
  const large = L.tooLarge(wanted)
  if (large.length) return refuse(`${large.map((f) => `${f.label} is ${mb(f.bytes)}`).join(' and ')}, and a file of a release must be under 2,000 MB. Nothing is sent. The remote team names another way`)
  ctx.say(`to send    ${wanted.length} files, ${mb(wanted.reduce((n, w) => n + w.bytes, 0))} in all, the largest ${mb(Math.max(...wanted.map((w) => w.bytes)))}: each is under 2,000 MB`)
  for (const w of wanted) ctx.note(`           ${w.sha256}  ${String(w.bytes).padStart(12)}  ${w.label}`)
  // 3. gh, its sign in, and the repo: private, or nothing is sent
  const g = await ground(ctx, repo, { wantPrivate: true })
  if (g.refuse) return refuse(g.refuse)
  const E = g.E

  const awake = await X.keepAwake(process.pid)
  ctx.say(`awake: ${awake.how}${awake.pid ? ` (process ${awake.pid})` : ''}`)
  heart(ctx, 'the upload')
  try {
    let release = null
    if (state?.id) {
      const r = await api(ctx, E, 'GET', `repos/${E.slug}/releases/${state.id}`)
      if (r.ok && r.json?.draft === true) release = r.json
      else if (r.ok) return { pass: false, why: `the release of the earlier call (${r.json?.html_url}) is no draft any more: somebody published it. Nothing is added to a published release` }
      else if (r.kind !== 'not found') return { pass: false, why: `the draft of the earlier call could not be read (${r.said}). Nothing sent is lost. Run the same line again: node tools/handoff.mjs upload` }
      else ctx.say('the draft of the earlier call is not on GitHub any more; a new one is made')
    }
    if (!release) {
      // a draft of this render whose record on this machine is lost
      const all = await listReleases(ctx, E)
      if (!all.ok) return { pass: false, why: `the releases of the repo could not be listed (${all.said}). Nothing is sent. Run the same line again: node tools/handoff.mjs upload` }
      release = all.all.find((r) => r.draft === true && r.tag_name === names.tag) ?? null
      if (release) ctx.say(`a draft of this render is on GitHub already (${release.html_url}); it is carried on`)
    }
    if (release && !safeDraftIdentity(release, names, body)) return refuse(unsafeDraft)
    if (!release) {
      const r = await api(ctx, E, 'POST', `repos/${E.slug}/releases`, { fields: { tag_name: names.tag, name: names.title, body, draft: true } })
      if (!r.ok && (r.kind === 'not found' || r.kind === 'not allowed')) return refuse(L.mayNotWrite(E.slug))
      if (!r.ok && r.kind === 'sign in') return refuse(L.notSignedIn())
      if (!r.ok || !r.json?.id) return { pass: false, why: `the draft release could not be made (${r.said ?? 'GitHub gave no answer'}). Nothing is sent. Run the same line again: node tools/handoff.mjs upload` }
      release = r.json
      ctx.say(`a draft release is made: "${names.title}"`)
    }
    writeJson(stateFile, { id: release.id, tag: names.tag, title: names.title, url: release.html_url, slug: E.slug, engineHash: stamp?.engineHash, small: mode.small, date, machine, made, safeName: true })
    ctx.say(`release    ${release.html_url}`)
    const went = await sendMissing(ctx, E, release, wanted)
    if (!went.ok) return { pass: false, why: `${went.why}. Nothing that was sent is lost. Run the same line again, and it sends only what is missing or short: node tools/handoff.mjs upload` }
    const back = await readBack(ctx, E, release.id, wanted)
    const pass = back.rows.every((r) => r.pass !== false)
    return {
      pass,
      why: pass ? `the draft release "${names.title}" holds the files. MEASURED: all ${wanted.length} were downloaded and their SHA-256 sums matched: ${release.html_url}` : `the release read back is not what was sent (${back.rows.filter((r) => r.pass === false).map((r) => `${r.check}: ${r.found}`).slice(0, 3).join('; ')}): ${release.html_url}`,
      rows: back.rows,
      release: { id: release.id, tag: names.tag, title: names.title, url: release.html_url, repo: E.slug },
      files: wanted.map((w) => ({ kind: w.kind, name: w.name, label: w.label, bytes: w.bytes, sha256: w.sha256 })),
      sent: went.sent,
      small: mode.small,
    }
  } finally {
    awake.stop()
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// The word of the tool's own tests. It makes its stand-ins itself, takes no path from anywhere, sends them to a draft,
// plays a dropped connection, carries on as the real word does, reads all back, and removes the one draft it made.

export async function uploadTest(ctx) {
  const refuse = (why) => ({ pass: false, why, refused: true })
  const repo = whichRepo()
  if (!repo) return refuse(NO_REPO)
  const g = await ground(ctx, repo, { wantPrivate: false })
  if (g.refuse) return refuse(g.refuse)
  const E = g.E
  const rows = []
  const row = (check, found, wanted, pass) => rows.push({ check, found, wanted, pass })
  // the stand-ins: made here, a few bytes each
  const dir = path.join(ctx.H, 'upload-test')
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const made = new Date().toISOString()
  const machine = releaseMachine({ platform: process.platform })
  const names = L.testReleaseNames({ time: made, machine })
  const item = (label, kind) => {
    const file = path.join(dir, label)
    return { kind, file, bytes: fs.statSync(file).size, sha256: L.sha256File(file), label, name: L.assetName(label) }
  }
  for (const s of L.STAND_INS) fs.writeFileSync(path.join(dir, s.label), s.text)
  const files = L.STAND_INS.map((s) => item(s.label, 'stand-in'))
  zipWrite(path.join(dir, L.STAND_IN_RECORDS), [{ name: 'stand-in.txt', data: 'upload test: a stand-in for the records of a render\n' }])
  const records = item(L.STAND_IN_RECORDS, 'records')
  fs.writeFileSync(path.join(dir, L.STAND_IN_SUMS), L.sumsText({ title: names.title, tag: names.tag, made, engineHash: 'none: a test', commit: 'none: a test', machine, files: [...files, records] }))
  const sums = item(L.STAND_IN_SUMS, 'sums')
  const wanted = [...files, sums, records]
  const total = wanted.reduce((n, w) => n + w.bytes, 0)
  row('the stand-ins', `${wanted.length} files made by the test itself, ${total} bytes in all, every name with the word Test in it`, 'a few bytes each, and no film', wanted.every((w) => /test/i.test(w.label)) && total < 4096 && !L.tooLarge(wanted).length)
  ctx.say(`the upload's own test: MEASURED ${wanted.length} stand-in files of ${total} bytes in all go to a draft of ${E.slug}. It can be seen by everyone with write access to the repo; there is no film`)
  heart(ctx, "the upload's test")
  let id = null
  try {
    const r = await api(ctx, E, 'POST', `repos/${E.slug}/releases`, { fields: { tag_name: names.tag, name: names.title, body: 'Made by the test of the render handoff. Stand-in files of a few bytes. The test removes this draft itself.', draft: true } })
    if (!r.ok || !r.json?.id) {
      row('the draft', `it could not be made (${r.said ?? 'GitHub gave no answer'})`, 'a draft release', false)
      return { pass: false, why: `the upload's test could not make its draft${r.kind === 'not found' || r.kind === 'not allowed' ? ', because the sign in of this machine may not write to the repo' : ''}: ${r.said ?? 'GitHub gave no answer'}`, rows }
    }
    const release = r.json
    id = release.id
    row('the draft', `made, id ${id}, tag ${names.tag}, ${release.draft === true ? 'a draft' : 'NOT a draft'}`, 'a draft release', release.draft === true)
    ctx.say(`the draft is made: id ${id}, ${release.html_url}`)
    // a dropped connection, played: two files whole, one short under its own name, three not at all
    const short = { ...wanted[2], file: path.join(dir, 'cut-short.bin') }
    fs.writeFileSync(short.file, fs.readFileSync(wanted[2].file).subarray(0, Math.floor(wanted[2].bytes / 2)))
    short.bytes = fs.statSync(short.file).size
    const first = await sendMissing(ctx, E, release, [wanted[0], wanted[1], short], { rounds: 1 })
    row('a dropped connection, played', first.ok ? `2 files sent whole, ${wanted[2].label} sent with ${short.bytes} of its ${wanted[2].bytes} bytes, 3 files not sent` : `it could not be played: ${first.why}`, '2 whole, 1 short, 3 missing', first.ok)
    const list = await api(ctx, E, 'GET', `repos/${E.slug}/releases/${id}/assets?per_page=100`)
    const plan = L.uploadPlan(wanted, Array.isArray(list.json) ? list.json : [])
    row('what the same line would do next', `keep ${plan.keep.length}, remove ${plan.drop.length} (${plan.drop.map((d) => d.why).join('; ') || 'none'}), send ${plan.send.length}`, 'keep 2, remove the short one, send 4', plan.keep.length === 2 && plan.drop.length === 1 && plan.send.length === 4)
    // the same line again: only what is missing or short goes out
    const second = await sendMissing(ctx, E, release, wanted)
    row('carrying on', second.ok ? `${second.sent.length} files sent, the 2 that were whole were not sent again` : second.why, '4 sent, 2 left as they were', second.ok && second.sent.length === 4 && !second.sent.includes(wanted[0].name) && !second.sent.includes(wanted[1].name))
    const back = await readBack(ctx, E, id, wanted)
    rows.push(...back.rows)
    const same = back.rows.filter((r) => r.check.startsWith('downloaded from the draft: ') && r.pass === true).length
    row('read back and hashed', `MEASURED: ${same} of ${wanted.length} files were downloaded with the expected SHA-256`, 'every one', same === wanted.length)
  } finally {
    // the one draft this test made, by its id, and no other
    let all = { ok: false, said: 'not asked', all: [] }
    if (id) {
      // removed means: GitHub took the removal, and the list of the repo's releases does not hold the id any more
      let removed = false
      let said = ''
      for (let n = 1; n <= 4 && !removed; n++) {
        const del = await api(ctx, E, 'DELETE', `repos/${E.slug}/releases/${id}`)
        if (!del.ok) said = del.said
        all = await listReleases(ctx, E)
        if (!all.ok) said = all.said
        removed = all.ok && !all.all.some((r) => r.id === id)
        if (!removed && n < 4) await sleep(5000)
      }
      const gone = removed ? await api(ctx, E, 'GET', `repos/${E.slug}/releases/${id}`) : null
      const ok = removed && gone.kind === 'not found'
      row('the draft removed by its id', ok ? `release ${id} is removed: the list of releases does not hold it, and asked by its id GitHub does not know it` : `release ${id} is NOT removed (${said || gone?.said || 'GitHub still knows it'})`, 'removed, and only this one', ok)
    } else all = await listReleases(ctx, E)
    const left = all.all.filter((r) => String(r.tag_name).startsWith(L.UPLOAD_TEST_MARK))
    row("no release with the test's mark is left", !all.ok ? `the releases could not be listed (${all.said})` : left.length ? `left: ${left.map((r) => `id ${r.id} (${r.tag_name})`).join(', ')}` : `${all.all.length} releases and drafts listed, none of them with the mark ${L.UPLOAD_TEST_MARK}`, 'none', all.ok && left.length === 0)
    fs.rmSync(dir, { recursive: true, force: true })
  }
  const pass = rows.every((r) => r.pass !== false)
  return {
    pass,
    why: pass ? `the upload's test passed on ${E.slug}: MEASURED ${wanted.length} stand-in files of ${total} bytes went to a draft, a short one was removed and sent again, all were downloaded and matched by SHA-256, and draft ${id} was removed. No release with the test's mark is left` : `the upload's test failed: ${rows.filter((r) => r.pass === false).map((r) => `${r.check}: ${r.found}`).slice(0, 3).join('; ')}`,
    rows,
    release: { id, tag: names.tag, repo: E.slug },
  }
}
