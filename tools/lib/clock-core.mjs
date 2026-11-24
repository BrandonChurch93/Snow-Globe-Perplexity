const H = 3600

export function emptyClock() {
  return {
    version: 1,
    bootId: null,
    last: null,
    sinceStatus: 0,
    segment: null,
    totals: { run: 0, afterReview: 0, reviewRounds: 0, extensions: 0 },
    phaseTotals: {},
    reviewApproved: false,
    continuations: 0,
    reviewRounds: {},
    extensions: {},
    ticks: 0,
    lastReport: [],
  }
}

function runSegment(cfg) {
  const boxes = {}
  for (const [k, v] of Object.entries(cfg.budget.phaseHours)) boxes[k] = v
  return { kind: 'run', allowedHours: cfg.budget.runHours, boxes, used: 0, phaseUsed: {}, continuation: 0 }
}

function ensureSegment(state, cfg) {
  if (!state.segment) state.segment = runSegment(cfg)
}

function elapsed(state, now, boot) {
  if (state.last === null || state.bootId !== boot) return 0
  return Math.max(0, (now - state.last) / 1000)
}

function touch(state, now, boot) {
  state.last = now
  state.bootId = boot
}

export function applyStart(state, cfg, now, boot) {
  ensureSegment(state, cfg)
  touch(state, now, boot)
  return state
}

export function applyTick(state, cfg, { phase, now, boot, status = false }) {
  ensureSegment(state, cfg)
  const dt = elapsed(state, now, boot)
  const seg = state.segment
  const key = String(phase)
  seg.used += dt
  seg.phaseUsed[key] = (seg.phaseUsed[key] ?? 0) + dt
  state.totals[seg.kind] += dt
  state.phaseTotals[key] = (state.phaseTotals[key] ?? 0) + dt
  state.sinceStatus += dt
  if (status) state.sinceStatus = 0
  state.ticks += 1
  touch(state, now, boot)
  return dt
}

export function applyReview(state, cfg, now, boot) {
  ensureSegment(state, cfg)
  if (state.reviewApproved) return false
  state.reviewApproved = true
  state.segment = {
    kind: 'afterReview',
    allowedHours: cfg.budget.afterReviewHours,
    boxes: { 6: cfg.budget.afterReviewHours },
    used: 0,
    phaseUsed: {},
    continuation: 0,
  }
  touch(state, now, boot)
  return true
}

export function applyContinue(state, cfg, { n, now, boot, donePhases }) {
  ensureSegment(state, cfg)
  if (n !== state.continuations + 1) throw new Error(`continuation ${n} does not follow ${state.continuations}`)
  const boxes = {}
  if (state.reviewApproved) boxes[6] = cfg.budget.continueHours
  else {
    const open = Object.keys(cfg.budget.phaseHours).filter((p) => !donePhases.includes(Number(p)))
    const sum = open.reduce((a, p) => a + cfg.budget.phaseHours[p], 0)
    for (const p of open) boxes[p] = sum > 0 ? (cfg.budget.continueHours * cfg.budget.phaseHours[p]) / sum : 0
  }
  state.continuations = n
  state.segment = {
    kind: state.reviewApproved ? 'afterReview' : 'run',
    allowedHours: cfg.budget.continueHours,
    boxes,
    used: 0,
    phaseUsed: {},
    continuation: n,
  }
  touch(state, now, boot)
  return boxes
}

function sideTick(bucket, total, state, allowedHours, { n, now, boot, status }) {
  const key = String(n)
  const dt = bucket[key] ? elapsed(state, now, boot) : 0
  if (!bucket[key]) bucket[key] = { used: 0, allowedHours }
  bucket[key].used += dt
  state.totals[total] += dt
  state.sinceStatus += dt
  if (status) state.sinceStatus = 0
  state.ticks += 1
  touch(state, now, boot)
  return dt
}

export function applyReviewRoundTick(state, cfg, args) {
  ensureSegment(state, cfg)
  return sideTick(state.reviewRounds, 'reviewRounds', state, cfg.budget.reviewRoundHours, args)
}

export function applyExtensionTick(state, cfg, args) {
  ensureSegment(state, cfg)
  return sideTick(state.extensions, 'extensions', state, cfg.budget.extendHours, args)
}

export function boxSum(seg, phase) {
  let sum = 0
  for (const [p, h] of Object.entries(seg.boxes)) if (Number(p) <= Number(phase)) sum += h
  return sum
}

export function phaseFlags(state, cfg, phase) {
  const seg = state.segment
  const key = String(phase)
  const box = seg.boxes[key] ?? 0
  const usedPhase = seg.phaseUsed[key] ?? 0
  const allowed = seg.allowedHours * H
  const reserve = (cfg.budget.reserveHours?.[key] ?? 0) * H
  const due = seg.used >= allowed
  let extra = seg.used < boxSum(seg, phase) * H && !due
  if (reserve > 0 && allowed - seg.used < reserve) extra = false
  return {
    extraRounds: extra,
    halfPoint: usedPhase >= (box * H) / 2,
    boxEnd: usedPhase >= box * H,
    budgetDue: due,
    statusOverdue: state.sinceStatus > cfg.budget.statusMaxGapMinutes * 60,
    usedPhase,
    box,
    used: seg.used,
    allowed,
  }
}

const hrs = (s) => (s / H).toFixed(2)

export function phaseReport(state, cfg, phase, dt = 0) {
  const f = phaseFlags(state, cfg, phase)
  const seg = state.segment
  const name = seg.kind === 'run' ? 'before the review' : 'after the review'
  const cont = seg.continuation ? `, continuation ${seg.continuation}` : ''
  const lines = [
    `clock: phase ${phase}, tick of ${(dt / 60).toFixed(1)} minutes`,
    `phase ${phase}: ${hrs(f.usedPhase)} h used of its ${f.box.toFixed(2)} h box`,
    `allowance (${name}${cont}): ${hrs(f.used)} h used of ${seg.allowedHours.toFixed(2)} h allowed`,
    `all time before the review: ${hrs(state.totals.run)} h, after it: ${hrs(state.totals.afterReview)} h, in review rounds: ${hrs(state.totals.reviewRounds)} h, in extensions: ${hrs(state.totals.extensions)} h`,
    `extra rounds: ${f.extraRounds ? 'yes' : 'no'}`,
    `half point: ${f.halfPoint ? 'reached' : 'not reached'}`,
    `box end: ${f.boxEnd ? 'reached' : 'not reached'}`,
    `budget report: ${f.budgetDue ? 'due' : 'not due'}`,
    `minutes since the last status: ${Math.floor(state.sinceStatus / 60)}${f.statusOverdue ? ', status overdue' : ''}`,
  ]
  return lines
}

export function sideReport(state, cfg, kind, n, dt = 0) {
  const bucket = kind === 'review round' ? state.reviewRounds : state.extensions
  const b = bucket[String(n)]
  const extra = b.used < b.allowedHours * H
  const overdue = state.sinceStatus > cfg.budget.statusMaxGapMinutes * 60
  return [
    `clock: ${kind} ${n}, tick of ${(dt / 60).toFixed(1)} minutes`,
    `${kind} ${n}: ${hrs(b.used)} h used of ${b.allowedHours.toFixed(2)} h allowed`,
    `extra rounds: ${extra ? 'yes' : 'no'}`,
    `minutes since the last status: ${Math.floor(state.sinceStatus / 60)}${overdue ? ', status overdue' : ''}`,
  ]
}
