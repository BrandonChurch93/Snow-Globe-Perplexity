import type { AppBridge, AudioIndex, InterfaceHandle, ProbeBridge, SoundEngine, SoundEngineOptions } from '../core/bridge'

interface InterfaceModule {
  mountInterface(root: HTMLElement, bridge: AppBridge): InterfaceHandle
}
interface ProbeModule {
  mountProbe(root: HTMLElement, bridge: ProbeBridge): void
}
interface AudioModule {
  createSoundEngine(opts: SoundEngineOptions): SoundEngine
}

const interfaces = import.meta.glob<InterfaceModule>('../ui/index.ts')
const probes = import.meta.glob<ProbeModule>('../probe/index.ts')
const audios = import.meta.glob<AudioModule>('../audio/index.ts')

const first = <T>(found: Record<string, () => Promise<T>>): Promise<T | null> => {
  const load = Object.values(found)[0]
  return load ? load().catch(() => null) : Promise.resolve(null)
}

export const loadInterface = (): Promise<InterfaceModule | null> => first(interfaces)
export const loadProbe = (): Promise<ProbeModule | null> => first(probes)
export const loadAudio = (): Promise<AudioModule | null> => first(audios)
export const audioIndex: AudioIndex | null = __AUDIO_INDEX__
export const audioShips = audioIndex !== null && Object.keys(audios).length > 0
export const audioBase = (): string => new URL('audio/', document.baseURI).href
