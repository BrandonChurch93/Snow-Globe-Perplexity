type Spec = 'n' | 's' | 'b' | readonly ['arr', Spec] | readonly ['rec', Spec] | { readonly [k: string]: Spec }

const camera: Spec = { fovDeg: 'n', distanceMm: 'n', yawDeg: 'n', pitchDeg: 'n', aimHeightMm: 'n' }
const format: Spec = { id: 's', width: 'n', height: 'n' }
const samples: Spec = { samplesPerFrame: 'n' }
const assetSet: Spec = { baseMapPx: 'n', interiorMapPx: 'n', maxTextureMb: 'n' }
const picture: Spec = { id: 's', unit: 's', season: 's', state: 's', camera: 's', format: 's' }

const spec: Spec = {
  name: 's',
  slug: 's',
  seed: 'n',
  repo: { url: 's', branch: 's', expectPrivate: 'b', maxFileMb: 'n', maxTreeGb: 'n', maxPushGb: 'n' },
  host: { name: 's', maxShippedMb: 'n', maxFileMb: 'n', firstLoadMaxMb: 'n', maxBuildMinutes: 'n' },
  seasons: ['arr', 's'],
  defaultSeason: 's',
  film: { fps: 'n', previewFps: 'n', defaultBpm: 'n', beatsPerBar: 'n', minSeconds: 'n', maxSeconds: 'n', shutterDegrees: 'n', hookSeconds: 'n', revealBySeconds: 'n', shots: ['arr', { id: 's', kind: 's', bars: 'n' }] },
  intro: { prompt: 's', model: 's', reasoning: 's', reasoningFrom: 's', reasoningLevels: ['arr', 's'], charsPerSecond: 'n', pauseBeforeSendSeconds: 'n', buildTitle: 's', steps: ['arr', 's'], stepSeconds: 'n', holdSeconds: 'n', maxSeconds: 'n' },
  formats: { master: format, hd: format, preview: format, phone: format, tablet: format },
  platform: { name: 's', standardAccountMaxSeconds: 'n', maxFileMb: 'n' },
  export: {
    container: 's',
    videoCodec: 's',
    bitrateMbps: 'n',
    audioCodec: 's',
    audioKbps: 'n',
    proofSeconds: 'n',
    local: { container: 's', videoCodec: 's', testSeconds: 'n' },
    files: { filmA: 's', filmB: 's', previewA: 's', previewB: 's', reviewCut: 's', cardLoop: 's', cardLoopWeb: 's', cardStill: 's' },
  },
  previewFilm: { bitrateMbps: 'n' },
  tiers: { draft: samples, review: samples, final: { samplesPerFrame: 'n', motion: { spacingPx: 'n', maxSamplesPerFrame: 'n', evenFromPx: 'n', spreadFromPx: 'n', spreadFullPx: 'n' } } },
  live: {
    defaultQuality: 's',
    probeFrames: 'n',
    quality: ['rec', { particleFraction: 'n', pixelRatioCap: 'n', shadowMapPx: 'n', surfaceReflection: 's', minFps: 'n' }],
    orbitYawDeg: 'n',
    orbitPitchMinDeg: 'n',
    orbitPitchMaxDeg: 'n',
    hintAfterSeconds: 'n',
    loadWaitSeconds: 'n',
  },
  perf: { maxTriangles: ['rec', 'n'], maxDrawCalls: 'n', probeSeconds: 'n' },
  assetSets: { web: assetSet, full: assetSet },
  globe: { sphereDiameterMm: 'n', glassThicknessMm: 'n', liquidIor: 'n', glassIor: 'n', baseHeightMm: 'n', baseDiameterMm: 'n', collarDepthMm: 'n', islandLevelMm: 'n' },
  cameras: ['rec', camera],
  framing: { heroFillMin: 'n', heroFillMax: 'n', macroMaxRadiusFraction: 'n' },
  shake: {
    liftBeats: 'n',
    strokeBeats: 'n',
    setDownBeats: 'n',
    strokes: 'n',
    liftMm: 'n',
    strokeMm: 'n',
    tiltDeg: 'n',
    landSettleSeconds: 'n',
    swapWindow: { fromBeat: 'n', toBeat: 'n' },
    coverOpacity: 'n',
    minCoverAtSwap: 'n',
    settleCheckSeconds: 'n',
    minVisibleAfterSettle: 'n',
    spinDownSeconds: 'n',
  },
  states: { landedSeconds: 'n', restSeconds: 'n', settledSeconds: 'n' },
  sim: { stepHz: 'n', checkpointSeconds: 'n', maxInsideFraction: 'n' },
  particles: { tuneMin: 'n', tuneMax: 'n' },
  scene: { bokehLights: 'n', ambientPeriodSeconds: 'n' },
  units: ['arr', { id: 's', phase: 'n', name: 's' }],
  lookLockUnit: 's',
  buildOrderAfterLookLock: ['arr', 's'],
  settledAll: ['arr', 's'],
  keys: ['arr', { ...picture, image: 's', settled: ['arr', 's'] }],
  stills: ['arr', picture],
  detail: { focusCocPx: 'n', minTexelsPerPixel: 'n', maxSoftPixelFraction: 'n', minSharpnessRatio: 'n' },
  assets: { maxTakesPerAsset: 'n', maxTuningLooksPerPart: 'n', maxStudySources: 'n' },
  audio: { sampleRate: 'n', maxTakesPerCue: 'n', candidates: ['arr', 's'], appLoopBars: 'n', filmLoudnessLufs: 'n', truePeakDb: 'n', appMaxMb: 'n', sfx: ['arr', { id: 's', seconds: 'n' }] },
  quality: {
    passScore: 'n',
    blockoutPass: 'n',
    blockoutMaxRounds: 'n',
    lookLockMaxRounds: 'n',
    maxRoundsPerUnit: 'n',
    globeMaxRounds: 'n',
    polishMaxRounds: 'n',
    filmMaxRounds: 'n',
    plateauRounds: 'n',
    recordRoundMaxRuns: 'n',
    gauntletMaxPasses: 'n',
    gateFixMaxAttempts: 'n',
    compressionStressMbps: 'n',
    jury: { jurors: 'n', maxShareGap: 'n', stillsPerUnit: 'n' },
    crossMachineMinPsnr: 'n',
  },
  critics: { maxImageLongEdgePx: 'n', contactSheetFrames: 'n', phonePreviewWidthPx: 'n', maxFilesPerMessage: 'n' },
  status: { minGapMinutes: 'n', maxPictures: 'n', pictureLongEdgePx: 'n' },
  budget: {
    runHours: 'n',
    phaseHours: ['rec', 'n'],
    afterReviewHours: 'n',
    reserveHours: ['rec', 'n'],
    reviewRoundHours: 'n',
    continueHours: 'n',
    extendHours: 'n',
    wrapUpMinutes: 'n',
    floorFixMinutes: 'n',
    statusMaxGapMinutes: 'n',
    jobOverrunFactor: 'n',
    agentWaitMinutes: 'n',
    buildAgentMaxHours: 'n',
    defaultJobMinutes: 'n',
    toolRetryMax: 'n',
  },
  sandbox: {
    stepTimeoutMinutes: 'n',
    chunkBudgetMinutes: 'n',
    previewFilmMaxHours: 'n',
    reviewCutMaxHours: 'n',
    cardLoopMaxHours: 'n',
    maxRenderProcesses: 'n',
    maxFramesOnDisk: 'n',
    minFreeDiskGb: 'n',
    maxDownloadGb: 'n',
    maxAgents: 'n',
    criticSlots: 'n',
  },
  deliver: {
    sandboxMaster: 'b',
    master: {
      format: 's',
      chunkFrames: 'n',
      samples: { 'film-b': 'n', loop: 'n' },
      slow: { underPx: 'n', samples: 'n', runFrames: 'n' },
      video: { codec: 's', maxrateMbps: 'n', bufsizeMbps: 'n', profile: 's', level: 's', pixFmt: 's' },
      intermediate: { preset: 's', crf: 'n', minPsnr: 'n', partMb: 'n' },
      final: { preset: 's', passes: 'n', targetMb: { 'film-a': 'n', 'film-b': 'n' }, keyint: 'n', minKeyint: 'n', bframes: 'n', refs: 'n', aqMode: 'n', params: 's', minPsnr: 'n', loop: { crf: 'n', crfStep: 'n', minCrf: 'n', params: 's', seamDb: 'n' } },
      audioKbps: 'n',
      chunkBranches: 's',
      names: { 'film-a': 's', 'film-b': 's', loop: 's', still: 's' },
    },
    cardLoop: { seconds: 'n', fps: 'n', season: 's', camera: 's', format: 's', shakeStartSeconds: 'n', pickJurors: 'n', webWidth: 'n', webBitrateMbps: 'n' },
  },
}

function shape(value: unknown, s: Spec, at: string, out: string[]): void {
  if (s === 'n') {
    if (typeof value !== 'number' || !Number.isFinite(value)) out.push(`${at} is missing or is not a number`)
  } else if (s === 's') {
    if (typeof value !== 'string' || value === '') out.push(`${at} is missing or is not text`)
  } else if (s === 'b') {
    if (typeof value !== 'boolean') out.push(`${at} is missing or is not true or false`)
  } else if (Array.isArray(s)) {
    const [kind, inner] = s as readonly ['arr' | 'rec', Spec]
    if (kind === 'arr') {
      if (!Array.isArray(value) || value.length === 0) out.push(`${at} is missing or is an empty list`)
      else value.forEach((v, i) => shape(v, inner, `${at}[${i}]`, out))
    } else if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.keys(value).length === 0) out.push(`${at} is missing or is empty`)
    else for (const [k, v] of Object.entries(value)) shape(v, inner, `${at}.${k}`, out)
  } else if (typeof value !== 'object' || value === null || Array.isArray(value)) out.push(`${at} is missing`)
  else for (const [k, inner] of Object.entries(s as { [k: string]: Spec })) shape((value as Record<string, unknown>)[k], inner, at ? `${at}.${k}` : k, out)
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9
const whole = (a: number) => near(a, Math.round(a))

export function configProblems(input: unknown, approvedPresent: readonly string[]): string[] {
  const out: string[] = []
  shape(input, spec, '', out)
  if (out.length) return out
  const c = input as any
  const seasons: string[] = c.seasons
  const cameras = Object.keys(c.cameras)
  const formats = Object.values(c.formats as Record<string, { id: string }>).map((f) => f.id)
  const units: string[] = c.units.map((u: { id: string }) => u.id)
  const states = ['landed', 'rest', 'settled']

  if (!seasons.includes(c.defaultSeason)) out.push(`defaultSeason names a season that does not exist: ${c.defaultSeason}`)
  for (const s of seasons) {
    const kinds = c.particles[s]
    if (!Array.isArray(kinds) || kinds.length === 0) out.push(`particles.${s} is missing`)
    else for (const k of kinds) if (typeof k?.kind !== 'string' || typeof k?.count !== 'number') out.push(`particles.${s} holds an entry without a kind or a count`)
  }

  const shots: { id: string; kind: string; season?: string; from?: string; to?: string; bars: number }[] = c.film.shots
  shots.forEach((shot, i) => {
    if (shot.kind === 'hold') {
      if (!seasons.includes(String(shot.season))) out.push(`shot ${shot.id} names a season that does not exist: ${shot.season}`)
    } else if (shot.kind === 'shake') {
      if (!seasons.includes(String(shot.from))) out.push(`shot ${shot.id} names a season that does not exist: ${shot.from}`)
      if (!seasons.includes(String(shot.to))) out.push(`shot ${shot.id} names a season that does not exist: ${shot.to}`)
      const before = shots[i - 1]
      const after = shots[i + 1]
      if (!before || before.kind !== 'hold' || before.season !== shot.from) out.push(`shake ${shot.id} starts from ${shot.from}, which is not the season of the hold before it`)
      if (!after || after.kind !== 'hold' || after.season !== shot.to) out.push(`shake ${shot.id} goes to ${shot.to}, which is not the season of the hold after it`)
      if (shot.bars !== 1) out.push(`shake ${shot.id} is not one bar long`)
    } else out.push(`shot ${shot.id} has a kind that is neither hold nor shake: ${shot.kind}`)
  })

  const pictures: { id: string; unit: string; season: string; state: string; camera: string; format: string; image?: string }[] = [...c.keys, ...c.stills]
  for (const p of pictures) {
    if (!seasons.includes(p.season)) out.push(`${p.id} names a season that does not exist: ${p.season}`)
    if (!cameras.includes(p.camera)) out.push(`${p.id} names a camera that does not exist: ${p.camera}`)
    if (!formats.includes(p.format)) out.push(`${p.id} names a format that does not exist: ${p.format}`)
    if (!units.includes(p.unit)) out.push(`${p.id} names a unit that does not exist: ${p.unit}`)
    if (!states.includes(p.state)) out.push(`${p.id} names a state that does not exist: ${p.state}`)
  }
  for (const k of c.keys as { id: string; image: string }[]) if (!approvedPresent.includes(k.image)) out.push(`the approved image of ${k.id} is missing: ${k.image}`)
  const ids = pictures.map((p) => p.id)
  for (const id of ids) if (ids.indexOf(id) !== ids.lastIndexOf(id)) out.push(`two pictures share the id ${id}`)

  if (!units.includes(c.lookLockUnit)) out.push(`lookLockUnit names a unit that does not exist: ${c.lookLockUnit}`)
  for (const u of c.buildOrderAfterLookLock as string[]) if (!units.includes(u)) out.push(`buildOrderAfterLookLock names a unit that does not exist: ${u}`)
  const loop = c.deliver.cardLoop
  if (!cameras.includes(loop.camera)) out.push(`deliver.cardLoop names a camera that does not exist: ${loop.camera}`)
  if (loop.season !== 'auto' && !seasons.includes(loop.season)) out.push(`deliver.cardLoop names a season that does not exist: ${loop.season}`)
  if (!formats.includes(loop.format)) out.push(`deliver.cardLoop names a format that does not exist: ${loop.format}`)
  const master = c.deliver.master
  if (!formats.includes(master.format)) out.push(`deliver.master names a format that does not exist: ${master.format}`)
  if (!whole(master.chunkFrames) || master.chunkFrames < 1) out.push(`deliver.master.chunkFrames (${master.chunkFrames}) is not a whole number of frames, one or more`)
  for (const [what, n] of Object.entries(master.samples as Record<string, number>)) if (!whole(n) || n < 1) out.push(`deliver.master.samples.${what} (${n}) is not a whole number of samples, one or more`)
  if (!(master.video.maxrateMbps > 0) || !(master.video.bufsizeMbps >= master.video.maxrateMbps)) out.push(`deliver.master.video.bufsizeMbps (${master.video.bufsizeMbps}) is under deliver.master.video.maxrateMbps (${master.video.maxrateMbps}), or the rate is not above zero`)
  if (new Set(Object.values(master.names as Record<string, string>)).size !== Object.keys(master.names).length) out.push('deliver.master.names gives two results the same file name')

  const boxes = Object.values(c.budget.phaseHours as Record<string, number>).reduce((a, b) => a + b, 0)
  if (!near(boxes, c.budget.runHours)) out.push(`budget.phaseHours adds up to ${boxes}, not to budget.runHours (${c.budget.runHours})`)

  const sh = c.shake
  const beats = sh.liftBeats + sh.strokeBeats + sh.setDownBeats
  if (!near(beats, c.film.beatsPerBar)) out.push(`shake.liftBeats, shake.strokeBeats and shake.setDownBeats add up to ${beats}, not to film.beatsPerBar (${c.film.beatsPerBar})`)
  const from = sh.swapWindow.fromBeat
  const to = sh.swapWindow.toBeat
  if (!(from < to) || from < sh.liftBeats - 1e-9 || to > sh.liftBeats + sh.strokeBeats + 1e-9) out.push(`shake.swapWindow (${from} to ${to}) does not lie inside the strokes (${sh.liftBeats} to ${sh.liftBeats + sh.strokeBeats})`)

  if (!whole(c.film.fps / c.film.previewFps)) out.push(`film.fps (${c.film.fps}) is not a whole multiple of film.previewFps (${c.film.previewFps})`)
  if (!whole(c.film.fps / loop.fps)) out.push(`film.fps (${c.film.fps}) is not a whole multiple of deliver.cardLoop.fps (${loop.fps})`)
  const bar = (c.film.beatsPerBar * 60) / c.film.defaultBpm
  const need = loop.shakeStartSeconds + bar + sh.spinDownSeconds
  if (!(need < loop.seconds)) out.push(`deliver.cardLoop.shakeStartSeconds plus one bar plus shake.spinDownSeconds is ${need}, which is not less than deliver.cardLoop.seconds (${loop.seconds})`)

  const levels: string[] = c.intro.reasoningLevels
  for (const k of ['reasoning', 'reasoningFrom']) if (!levels.includes(c.intro[k])) out.push(`intro.${k} names a level that is not in intro.reasoningLevels: ${c.intro[k]}`)
  if (c.intro.reasoning === c.intro.reasoningFrom) out.push(`intro.reasoning and intro.reasoningFrom are the same level (${c.intro.reasoning}), so the opening would show no change`)
  return out
}
