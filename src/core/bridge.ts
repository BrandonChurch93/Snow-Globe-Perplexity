export interface AppState {
  ready: boolean
  season: string
  target: string | null
  busy: boolean
  quality: string
  auto: boolean
  soundAvailable: boolean
  soundOn: boolean
  reducedMotion: boolean
  diagnostic: string
  state: string
  playing: 'live' | 'film-b' | 'film-a' | 'loop'
}

export interface AppBridge {
  state(): AppState
  subscribe(fn: (s: AppState) => void): () => void
  shake(): void
  goTo(season: string): void
  setSound(on: boolean): void
  setQuality(level: string): void
  setSeason(season: string): void
  setState(state: string): void
  setDiagnostic(view: string): void
  play(what: AppState['playing']): void
  activity(): void
}

export interface InterfaceHandle {
  setVisible(visible: boolean): void
  dispose(): void
}

export interface ProbeLevelResult {
  level: string
  restMedianFps: number
  restSlowFps: number
  stormMedianFps: number
  stormSlowFps: number
}

export interface ProbeResult {
  levels: ProbeLevelResult[]
  graphics: string
  screen: string
  pixelRatio: number
  pick: string
  userAgent: string
}

export interface ProbeBridge {
  levels(): string[]
  secondsPerLevel(): number
  run(onProgress: (done: ProbeLevelResult[], running: { level: string; phase: 'rest' | 'storm'; fraction: number } | null) => void): Promise<ProbeResult>
}

export interface SoundEngine {
  available(): boolean
  unlock(): Promise<void>
  setMuted(muted: boolean): void
  setSeason(season: string, immediate?: boolean): void
  shake(to: string, barSeconds: number): void
  stir(strength: number): void
  tick(): void
  chime(): void
  bytesFetched(): number
  dispose(): void
}

export interface AudioIndexEntry {
  file: string
  start: number
  seconds: number
  gain: number
}

export interface AudioIndex {
  version: number
  bytes: number
  files: { file: string; bytes: number }[]
  sprites: Record<string, AudioIndexEntry>
  loops: Record<string, { file: string; loopStart: number; loopSeconds: number; gain: number }>
}

export interface SoundEngineOptions {
  index: AudioIndex | null
  baseUrl: string
  afterFirstPicture: Promise<void>
  seasons: string[]
}
