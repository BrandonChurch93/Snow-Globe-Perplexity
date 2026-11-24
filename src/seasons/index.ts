import { config } from '../config'
import { kit as fall } from './fall'
import type { SeasonKit } from './kit'
import { kit as spring } from './spring'
import { kit as summer } from './summer'
import { kit as winter } from './winter'

const all: Record<string, SeasonKit> = { winter, spring, summer, fall }

export function kitOf(season: string): SeasonKit {
  const k = all[season]
  if (!k) throw new Error(`no kit for season: ${season}`)
  return k
}

export const kits: SeasonKit[] = config.seasons.map(kitOf)
