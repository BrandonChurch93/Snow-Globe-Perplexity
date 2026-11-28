// The approval of the render handoff: Brandon's own word for the full render and for the upload, the build his word
// covers, what of a long run his yes must have seen, the room a render that carries on still needs, and which
// finished chunks count for an approved render. Rules only: nothing here reads the machine or starts anything.
// tools/lib/handoff-work.mjs does the reading and the writing with these rules.
import crypto from 'node:crypto'

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex')
const gbText = (bytes) => `${(bytes / 1024 ** 3).toFixed(1)} GB`
const timeText = (seconds) => (seconds < 90 ? `${Math.round(seconds)} s` : seconds < 5400 ? `${(seconds / 60).toFixed(1)} min` : `${(seconds / 3600).toFixed(1)} h`)

/** The records of an approval, by their file names under out/work/handoff. */
export const APPROVAL_FILES = { render: 'approval-render.json', upload: 'approval-upload.json', asked: 'approval-asked.json', ledger: 'chunk-ledger.json' }
export const APPROVE_KINDS = ['render', 'upload']
/** The line of the handoff file, with the place for his words as the file writes it. */
export const approveLine = (what) => `node tools/handoff.mjs approve ${what} <his words>`

/**
 * What the approve line was given: which yes it is, and Brandon's words. The words are letters, digits and spaces
 * only, so that the line means the same in every terminal and needs no quoting.
 * @param {string[]} argv the arguments of the tool, beginning with "approve"
 * @returns {{ problem: string } | { what: string, words: string }}
 */
export function approveArgs(argv) {
  const what = argv[1]
  const words = argv.slice(2)
  const usage = `The two approve lines are: ${approveLine('render')} and ${approveLine('upload')}, with the words Brandon wrote in the chat in the place of <his words>`
  if (!APPROVE_KINDS.includes(what)) return { problem: `approve wants the word render or the word upload after it, and was given "${argv.slice(1).join(' ')}". ${usage}` }
  if (!words.length) return { problem: `the approve line carries the words Brandon wrote in the chat, copied after "approve ${what}", and it was given none. The agent never writes these words for him. ${usage}` }
  const bad = words.find((w) => !/^[A-Za-z0-9]+$/.test(w))
  if (bad !== undefined) return { problem: `the words after "approve ${what}" are letters, digits and spaces only, and "${bad}" is not: leave out every other sign of what Brandon wrote. ${usage}` }
  return { what, words: words.join(' ') }
}

// ---------------------------------------------------------------------------------------------------------------------
// The build a test passed on.

/** The references and the floors of a stamp, as one short mark: a stamp that compares other pictures or holds other floors has another mark. */
export const stampMark = (stamp) => sha(JSON.stringify({ references: stamp?.references ?? null, floors: stamp?.floors ?? null })).slice(0, 16)

/**
 * The version of the driver of the card that draws, as text. On Windows it is the card's own driver version. On a
 * Mac the driver is a part of the system and has no version of its own, so the system's version and build stand
 * for it. `missing` says that it should have been read and was not.
 * @param {{ platform: string, os?: string, cards?: { name: string, driverVersion?: string, driverDate?: string }[], wanted?: { name: string } | null }} o
 */
export function driverText({ platform, os = '', cards = [], wanted = null }) {
  if (platform === 'darwin') return os ? { text: `a part of the system, ${os}`, missing: false } : { text: 'not read', missing: true }
  if (platform !== 'win32') return { text: 'none is read on this system', missing: false }
  const card = (wanted && cards.find((c) => c.name === wanted.name)) || cards[0] || null
  if (!card || !card.driverVersion) return { text: 'not read', missing: true }
  return { text: `${card.driverVersion}${card.driverDate ? ` of ${card.driverDate}` : ''} (${card.name})`, missing: false }
}

const IDENTITY = {
  engineHash: 'the engine',
  stamp: "the stamp's references and floors",
  calibration: 'the calibration picture kept on this machine',
  renderer: 'the graphics card the page draws on',
  driver: "the card's driver",
  chrome: 'Chrome',
}
/**
 * What a short test passed on, and what a render must find again: the engine, the stamp's references and floors,
 * the kept calibration picture, the renderer string of the page, the driver's version and Chrome's version.
 */
export function identityOf({ engineHash, stamp, calibration, renderer, driver, chrome }) {
  return { engineHash: engineHash ?? '', stamp: stampMark(stamp), calibration: calibration ?? '', renderer: renderer ?? '', driver: driver ?? '', chrome: chrome ?? '' }
}
/** What differs between the build a test passed on and the build that is here now, each in a few words. An empty list: the same build. */
export function identityDiff(test, now) {
  const out = []
  for (const [k, name] of Object.entries(IDENTITY)) {
    // a calibration picture that is not drawn yet is no other picture
    if (k === 'calibration' && (!now?.[k] || !test?.[k])) continue
    if ((test?.[k] ?? '') !== (now?.[k] ?? '')) out.push(`${name} is now ${now?.[k] || 'not read'}, and the test passed on ${test?.[k] || 'none recorded'}`)
  }
  return out
}
export const BUILD_CHANGED = "the build changed since the test: run step 1's test again, give Brandon its report, stop"
/** The refusal of a render whose build is not the one the test passed on. */
export const buildChanged = (diff) => `${BUILD_CHANGED}. What changed: ${diff.join('; ')}`
export const NO_IDENTITY = `${BUILD_CHANGED}. The record of the short test on this machine does not say which build it passed on`

// ---------------------------------------------------------------------------------------------------------------------
// What bears on a long run. Each line has a kind, so that it is known again when its numbers have moved.

/** Whether the Desktop is a folder that a cloud service copies: OneDrive on Windows, iCloud Drive on a Mac. */
export function desktopInCloud({ platform, desktop = '', env = {}, icloudDesktop = false }) {
  if (platform === 'win32') {
    const low = desktop.toLowerCase()
    const roots = [env.OneDrive, env.OneDriveConsumer, env.OneDriveCommercial].filter(Boolean).map((r) => String(r).toLowerCase())
    const inside = roots.some((r) => low === r || low.startsWith(`${r}\\`)) || /\\onedrive( - [^\\]+)?\\/i.test(`${desktop}\\`)
    return inside ? `the Desktop of this machine is inside OneDrive (${desktop}). OneDrive copies what is put there to the cloud and can hold a file while it does: the test film, the sheet of pictures and the four files of the delivery are written there` : ''
  }
  if (platform === 'darwin' && icloudDesktop) return `the Desktop of this Mac is kept in iCloud Drive (${desktop}). iCloud copies what is put there to the cloud and can move a file off the disk: the test film, the sheet of pictures and the four files of the delivery are written there`
  return ''
}

/**
 * The LOOK lines that bear on a render of hours: its hours, the room on the disk, the power, a restart that Windows
 * waits for, a Desktop in a cloud folder, a driver whose version cannot be read, a machine that cannot be kept
 * awake, and a second render of a film that was delivered and cleaned here.
 * @param {{ projectionSeconds?: number | null, tooLongHours?: number, freeBytes?: number | null, needBytes?: number | null, onBattery?: boolean, power?: string, pendingRestart?: string, cloud?: string, driverMissing?: boolean, awakeFailed?: string, again?: string }} [o]
 * @returns {{ kind: string, text: string }[]}
 */
export function longRunLines({ projectionSeconds = null, tooLongHours = 10, freeBytes = null, needBytes = null, onBattery = false, power = '', pendingRestart = '', cloud = '', driverMissing = false, awakeFailed = '', again = '' } = {}) {
  const out = []
  const add = (kind, text) => out.push({ kind, text })
  if (Number.isFinite(projectionSeconds) && projectionSeconds > tooLongHours * 3600) add('hours', `the full render is projected at ${timeText(projectionSeconds)} on this machine, which is more than ${tooLongHours} hours. The machine must stay on, awake and on mains power for all of it`)
  if (Number.isFinite(freeBytes) && Number.isFinite(needBytes) && freeBytes >= needBytes && freeBytes < needBytes * 1.25) add('disk', `the drive of the clone has ${gbText(freeBytes)} free and the render needs ${gbText(needBytes)} at its fullest: it fits with less than a quarter to spare, so anything else that fills this drive during the render can stop it`)
  if (onBattery) add('power', `this machine runs on its battery now (${power}). A render of hours needs mains power: plug it in before the render starts`)
  if (pendingRestart) add('restart', `Windows waits for a restart (${pendingRestart}). A restart in the middle stops the render, and the same line carries on afterwards. Restart the machine before the render starts`)
  if (cloud) add('cloud', cloud)
  if (driverMissing) add('driver', "the version of the card's driver could not be read on this machine, so the tool cannot see a driver that is updated between the test and the render, or in the middle of the render")
  if (awakeFailed) add('awake', `${awakeFailed}. A machine that goes to sleep stops the render, and the same line carries on afterwards`)
  if (again) add('again', again)
  return out
}
/**
 * The lines of `now` whose kind is not among `covered`: what is new since a test or since a yes. The line of a film
 * that was rendered and cleaned here is held by its words too, which name the clean: one clean does not cover the next.
 */
export const freshLines = (now = [], covered = []) => now.filter((l) => !covered.some((c) => c.kind === l.kind && (l.kind !== 'again' || c.text === l.text)))
/** The sentence for a film that was rendered, delivered and cleaned here, when the render line is run once more. */
export const againText = (cleanTime) => `the film was rendered, delivered and cleaned on this machine already (the clean passed at ${cleanTime}). The render line would begin the whole film again from nothing`

// ---------------------------------------------------------------------------------------------------------------------
// The yes for the full render.

/**
 * What a yes for the full render covers, as the lines the approve word prints and the record it writes.
 * @param {{ words: string, time: string, machine: string, identity: Record<string, string>, test: { time: string, report: { path: string, sha256: string }, film: { path: string, sha256: string }, sheet: { path: string, sha256: string } }, projection?: { seconds: number, procs: number } | null, disk: { needBytes: number, freeBytes: number }, longRun: { kind: string, text: string }[], look?: string[], small?: boolean }} o
 */
export function renderApproval(o) {
  const look = o.look ?? []
  const record = { what: 'render', words: o.words, time: o.time, machine: o.machine, identity: o.identity, test: o.test, projection: o.projection ?? null, disk: o.disk, longRun: o.longRun, look, small: o.small === true }
  const lines = [
    `WHAT THIS YES COVERS. Brandon's words, as they were copied into the line: "${o.words}"`,
    `  the machine      ${o.machine}`,
    `  the card         ${o.identity.renderer}`,
    `  its driver       ${o.identity.driver}`,
    `  the browser      Chrome ${o.identity.chrome}`,
    `  the engine       ${o.identity.engineHash}, with the stamp's references and floors ${o.identity.stamp}`,
    `  the short test   passed, begun at ${o.test.time}`,
    `  its report       ${o.test.report.path}`,
    `                   sha256 ${o.test.report.sha256}`,
    `  the test film    ${o.test.film.path}`,
    `                   sha256 ${o.test.film.sha256}`,
    `  the sheet        ${o.test.sheet.path}`,
    `                   sha256 ${o.test.sheet.sha256}`,
    `  projected        ${o.projection ? `${timeText(o.projection.seconds)} with ${o.projection.procs} ${o.projection.procs === 1 ? 'worker' : 'workers'}` : "no projection: this is a small run of the tool's own tests"}`,
    `  the disk         ${gbText(o.disk.needBytes)} are needed for what is still to do, and ${gbText(o.disk.freeBytes)} are free now`,
    o.longRun.length ? `  still open now and bearing on a run of hours, covered by this yes, ${o.longRun.length}:` : '  still open now   nothing that bears on a run of hours',
    ...o.longRun.map((l) => `    LOOK  ${l.text}`),
    look.length ? `  marked LOOK in the report of the test beside these, for the remote team, ${look.length}:` : '  marked LOOK in the report of the test beside these: nothing',
    ...look.map((l) => `    LOOK  ${l}`),
  ]
  return { record, lines }
}

/**
 * Why a render may not start on the approval that is here. An empty list: the approval fits.
 * @param {{ approval: any, machine: string, identity: Record<string, string>, test: { time?: string } | null, reportSha: string, longRun: { kind: string, text: string }[], cleanTime?: string }} o
 */
export function renderApprovalProblems({ approval, machine, identity, test, reportSha, longRun, cleanTime = '' }) {
  const line = approveLine('render')
  if (!approval || approval.what !== 'render') return [`the full render is not approved on this machine, and nothing was drawn. It starts only after Brandon wrote in the chat that the full render may start, and after his words were copied into this line: ${line}`]
  const out = []
  if (approval.machine !== machine) out.push('the yes that is recorded here was given for another machine')
  const diff = identityDiff(approval.identity, identity)
  if (diff.length) out.push(`the yes that is recorded here was given for another build than the one that is here now (${diff.join('; ')})`)
  if (!test || approval.test?.time !== test.time || approval.test?.report?.sha256 !== reportSha) out.push('the short test was run again since his yes, or its report is not the one his yes names')
  if (cleanTime && !(Date.parse(approval.time) > Date.parse(cleanTime))) out.push('his yes was given before the film was rendered, delivered and cleaned here. It covered that render, which is done')
  const fresh = freshLines(longRun, approval.longRun ?? [])
  if (fresh.length) out.push(`this is new since his yes, and his yes does not cover it: ${fresh.map((l) => l.text).join(' | ')}`)
  if (!out.length) return []
  return [`the full render is not started, and nothing was drawn: ${out.join('. ')}. Give Brandon the report of the short test and what is said here. If he says that the full render may start, copy his words into this line, then run the render line again: ${line}`]
}

// ---------------------------------------------------------------------------------------------------------------------
// The yes for the upload.

/**
 * What a yes for the upload covers: the repository by owner and name, that it is private, and the four files.
 * @param {{ words: string, time: string, repo: { owner: string, name: string, slug: string }, isPrivate: boolean, files: { kind: string, name: string, bytes: number, sha256: string }[], deliverTime: string }} o
 */
export function uploadApproval(o) {
  const record = { what: 'upload', words: o.words, time: o.time, repo: { owner: o.repo.owner, name: o.repo.name, slug: o.repo.slug, private: o.isPrivate === true }, files: o.files, deliverTime: o.deliverTime }
  const lines = [
    `WHAT THIS YES COVERS. Brandon's words, as they were copied into the line: "${o.words}"`,
    `  the repository   ${o.repo.slug} (owner ${o.repo.owner}, name ${o.repo.name})`,
    `  it is            ${o.isPrivate ? 'private: GitHub was asked now' : 'NOT private'}`,
    '  who can see it   everyone with write access to that repository can see the draft and its files',
    `  the files, ${o.files.length}:`,
    ...o.files.flatMap((f) => [`    ${f.name}`, `      ${f.bytes} bytes, sha256 ${f.sha256}`]),
    '  with them go a file of sums and one zip of the reports, logs and records of this machine',
    '  the draft is named by the day, the engine, the platform and the graphics card when it is known, not by the name of this computer',
    '  the records can still name the computer, the card, its driver, the browser and folders outside the home folder',
    "  in the records the home folder is written as ~, and the records of Brandon's yes stay on this machine and are not sent",
  ]
  return { record, lines }
}

/**
 * Whether the delivery on record passed, and is the delivery of the very files that passed the check that is on
 * record now. A delivery of an earlier render is no delivery of this one.
 * @param {any} delivered the record of the deliver word
 * @param {any} [checked] the record of the check word; left out, the delivery is taken by its own word
 */
export function deliveryStands(delivered, checked) {
  if (!delivered?.pass) return false
  if (checked === undefined) return true
  if (!checked?.pass) return false
  const files = delivered.files ?? []
  return files.length > 0 && files.every((f) => checked.files?.[f.kind]?.bytes === f.bytes && checked.files?.[f.kind]?.sha256 === f.sha256)
}

/**
 * Why the upload may not send on the approval that is here. It refuses first while the delivery has not passed.
 * @param {{ approval: any, delivered: any, repo: { slug: string } | null, checked?: any }} o
 */
export function uploadApprovalProblems({ approval, delivered, repo, checked }) {
  const line = approveLine('upload')
  if (!deliveryStands(delivered, checked)) return [`the four files are not delivered to the Desktop yet${delivered?.pass ? ' as they were checked last (the delivery on record is of other files)' : ''}, so nothing is sent and no yes for the upload is taken. Run this line first: node tools/handoff.mjs deliver`]
  if (!approval || approval.what !== 'upload') return [`the upload is not approved on this machine, and nothing is sent. It starts only after Brandon said yes to the question of 2.5, and after his words were copied into this line: ${line}`]
  const out = []
  if (!repo || approval.repo?.slug !== repo.slug) out.push(`his yes names the repository ${approval.repo?.slug ?? 'none'}, and this clone belongs to ${repo?.slug ?? 'no repository the tool knows'}`)
  if (approval.repo?.private !== true) out.push('his yes does not say that the repository is private')
  const now = delivered.files ?? []
  const same = (approval.files ?? []).length === now.length && now.every((f) => (approval.files ?? []).some((a) => a.kind === f.kind && a.bytes === f.bytes && a.sha256 === f.sha256))
  if (!same) out.push('the files that were delivered are not the files his yes names by size and sha256')
  if (!out.length) return []
  return [`the upload is not started, and nothing is sent: ${out.join('. ')}. Ask Brandon the question of 2.5 again. If he says yes, copy his words into this line, then run the upload line again: ${line}`]
}

// ---------------------------------------------------------------------------------------------------------------------
// The room a render still needs.

/**
 * What of the room of a whole render (diskPlan) is still needed when a part of it is done: the chunks that are left,
 * the frames in work while any chunk is left, the films that are not encoded yet with the room to encode them, the
 * copies for the Desktop that are not made yet, and the spare. `desktop` is what the Desktop's own drive must take.
 * @param {{ chunks: number, intermediates: number, inFlight: number, finals: number, encodeRoom: number, spare: number }} plan
 * @param {{ chunksFinished?: number, finalsBytes?: number, deliveredBytes?: number, sameDrive?: boolean }} [done]
 */
export function diskRemaining(plan, { chunksFinished = 0, finalsBytes = 0, deliveredBytes = 0, sameDrive = true } = {}) {
  const leftChunks = Math.max(0, plan.chunks - chunksFinished)
  const intermediates = plan.chunks ? plan.intermediates * (leftChunks / plan.chunks) : 0
  const inFlight = leftChunks ? plan.inFlight : 0
  const finals = Math.max(0, plan.finals - finalsBytes)
  const encodeRoom = finals > 0 ? plan.encodeRoom : 0
  const desktop = Math.max(0, plan.finals - deliveredBytes)
  const copies = sameDrive ? desktop : 0
  return { chunks: plan.chunks, leftChunks, intermediates, inFlight, finals, encodeRoom, copies, desktop, spare: plan.spare, total: intermediates + inFlight + finals + encodeRoom + copies + plan.spare }
}
/** The room the Desktop's own drive must have for what the tool writes there, with a little over. */
export const DESKTOP_SPARE = 256 * 1024 ** 2
/** The words of the wanted room, for a row of the doctor. */
export function remainingText(left) {
  const g = (b) => (b / 1024 ** 3).toFixed(1)
  const head = left.leftChunks === left.chunks ? `${left.chunks} chunks ${g(left.intermediates)}` : `the ${left.leftChunks} of ${left.chunks} chunks that are not on disk yet ${g(left.intermediates)}`
  return `${g(left.total)} GB for what is still to do: ${head}, frames in work ${g(left.inFlight)}, the files still to encode ${g(left.finals)}, room to encode ${g(left.encodeRoom)}, the copies for the Desktop ${g(left.copies)}, spare ${g(left.spare)}`
}

// ---------------------------------------------------------------------------------------------------------------------
// Which finished chunks count.

/**
 * Whether a finished chunk on disk counts for the approved render. It counts only when its record names the build
 * the approved test passed on (the engine, the calibration picture, the renderer string, Chrome's version), when
 * the tool's own ledger says which driver was read before its first frame and that is the test's driver, when its
 * bytes have the sha256 its record names, and when the tool has not rejected this very chunk before. A chunk of
 * the opening is read from the pack and drawn by no card: its bytes and the ledger of rejected chunks are held.
 * @param {{ what: string, record: any, bytesSha: string, identity: Record<string, string>, calibration: string, drawn?: { driver?: string } | null, rejected?: { key: string, time?: string, sha256?: string }[], key: string, allowSoftware?: boolean }} o
 * @returns {string} empty when the chunk counts, else why it does not
 */
export function chunkProblem({ what, record, bytesSha, identity, calibration, drawn = null, rejected = [], key }) {
  if (!record) return 'it left no record'
  if (rejected.some((r) => r.key === key && r.time === record.time && r.sha256 === record.sha256)) return 'the tool rejected this very chunk before, and a rejected chunk is never taken again'
  if (bytesSha !== record.sha256) return `its bytes are not the ones its record names (sha256 ${String(bytesSha).slice(0, 12)}, the record says ${String(record.sha256).slice(0, 12)})`
  if (what === 'opening') return ''
  if (record.engineHash !== identity.engineHash) return `it was drawn by engine ${record.engineHash}, and the approved test passed on ${identity.engineHash}`
  if (!calibration || record.calibration !== calibration) return 'it names another calibration picture than the one the approved test saw'
  if (record.graphics !== identity.renderer) return `it was drawn on "${record.graphics}", and the approved test passed on "${identity.renderer}"`
  const chrome = String(record.browser ?? '').trim().split(/\s+/).pop()
  if (chrome !== identity.chrome) return `it was drawn by browser version ${chrome || 'not recorded'}, and the approved test passed on ${identity.chrome}`
  if (!drawn || typeof drawn.driver !== 'string') return 'the tool holds no record of the driver that was read before its first frame'
  if (drawn.driver !== identity.driver) return `the driver read before its first frame was ${drawn.driver}, and the approved test passed on ${identity.driver}`
  return ''
}

// ---------------------------------------------------------------------------------------------------------------------
// A word whose work was stopped: what the line says, and when its line is not run again.

/**
 * What the line says of a word whose work was found gone, or was ended here because it gave no sign of life. Every
 * such stop is a FAIL with a report of its own, and the next line carries on. The tool counts the stops in a row
 * itself: a word that may be run once more is not run a third time, a render is not run again after two stops with
 * no more frames done in between, and an upload not after its third stop in a row.
 * @param {{ cmd: string, stops: number, how: 'gone' | 'silent', minutes?: number, line: string, made?: boolean }} p
 *   `stops` counts this stop too; `made` says that more frames were done than at the stop before (a render only)
 * @returns {{ again: boolean, why: string }}
 */
export function stopVerdict({ cmd, stops, how, minutes = 0, line, made = true }) {
  const what = how === 'silent' ? `it gave no sign of life for ${minutes} min and was ended here` : 'its process is gone (the machine slept or restarted, or the process was ended)'
  const head = `"${cmd}" was stopped before it ended: ${what}`
  const upload = cmd === 'upload' || cmd === 'upload-test'
  const last = cmd === 'render' ? stops >= 2 && !made : upload ? stops >= 3 : stops >= 2
  if (!last) return { again: true, why: `${head}. Nothing finished is lost. Run the same line again and it carries on: ${line}` }
  const count = cmd === 'render' ? `This is stop ${stops} in a row, and no more frames were done since the stop before` : `This is stop ${stops} in a row`
  return { again: false, why: `${head}. ${count}. Nothing finished is lost. Do not run the line again: stop and give Brandon the report` }
}
