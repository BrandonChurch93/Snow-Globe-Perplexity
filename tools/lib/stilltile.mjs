// The order in which the pixels of a tile give way, by the method of the void and the cluster (Ulichney, 1993): at every
// share of the tile the pixels that are gone stand as far from one another as they can, in no rows. The weights are rounded
// to whole numbers, so the sums are exact and the order does not hang on how a machine adds.

export const STILL_SIDE = 128
export const STILL_SEED = 30
export const STILL_SIGMA = 1.3
const REACH = 10
const START_SHARE = 0.1

function random(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The place of every pixel of the tile in that order, 0 for the first to go: `side * side` whole numbers, each once. */
export function stillRanks(side = STILL_SIDE, seed = STILL_SEED, sigma = STILL_SIGMA) {
  const count = side * side
  const span = 2 * REACH + 1
  const weight = new Float64Array(span * span)
  for (let dy = -REACH; dy <= REACH; dy++) for (let dx = -REACH; dx <= REACH; dx++) weight[(dy + REACH) * span + dx + REACH] = Math.round(Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)) * 2 ** 30)
  const on = new Uint8Array(count)
  const crowd = new Float64Array(count)
  const put = (i, sign) => {
    on[i] = sign > 0 ? 1 : 0
    const x = i % side
    const y = (i - x) / side
    for (let dy = -REACH; dy <= REACH; dy++) {
      const row = ((y + dy + side) % side) * side
      for (let dx = -REACH; dx <= REACH; dx++) crowd[row + ((x + dx + side) % side)] += sign * weight[(dy + REACH) * span + dx + REACH]
    }
  }
  /** The pixel of one kind where the crowd of the kind that is counted is thickest, or thinnest. */
  const find = (kind, thickest) => {
    let best = -1
    for (let i = 0; i < count; i++) if (on[i] === kind && (best < 0 || (thickest ? crowd[i] > crowd[best] : crowd[i] < crowd[best]))) best = i
    return best
  }

  const next = random(seed)
  const first = Math.floor(count * START_SHARE)
  for (let n = 0; n < first; ) {
    const i = Math.floor(next() * count)
    if (!on[i]) {
      put(i, 1)
      n++
    }
  }
  for (;;) {
    const cluster = find(1, true)
    put(cluster, -1)
    const hole = find(0, false)
    put(hole, 1)
    if (hole === cluster) break
  }

  const begun = on.slice()
  const ranks = new Int32Array(count)
  for (let rank = first - 1; rank >= 0; rank--) {
    const cluster = find(1, true)
    put(cluster, -1)
    ranks[cluster] = rank
  }
  for (let i = 0; i < count; i++) if (begun[i]) put(i, 1)
  const half = count >> 1
  for (let rank = first; rank < half; rank++) {
    const hole = find(0, false)
    put(hole, 1)
    ranks[hole] = rank
  }
  // Past the half the pixels still there are the few, and it is their crowd that is counted.
  crowd.fill(0)
  const gone = on.slice()
  on.fill(0)
  for (let i = 0; i < count; i++) if (!gone[i]) put(i, 1)
  for (let rank = half; rank < count; rank++) {
    const cluster = find(1, true)
    put(cluster, -1)
    ranks[cluster] = rank
  }
  return ranks
}

/** The tile as the page holds it: a byte a pixel, every value of a byte as often as every other. */
export function stillTile(side = STILL_SIDE, seed = STILL_SEED, sigma = STILL_SIGMA) {
  const ranks = stillRanks(side, seed, sigma)
  const bytes = new Uint8Array(ranks.length)
  for (let i = 0; i < ranks.length; i++) bytes[i] = Math.floor((ranks[i] * 256) / ranks.length)
  return bytes
}

export const STILL_FILE = 'src/core/still.ts'

/** The text of `STILL_FILE`: the tile as a literal the page decodes, so that it costs the page no file and no work. */
export function stillSource(tile = stillTile()) {
  const text = Buffer.from(tile).toString('base64')
  const lines = []
  for (let i = 0; i < text.length; i += 128) lines.push(`  '${text.slice(i, i + 128)}',`)
  return `// Written by \`node tools/stilltile.mjs\` and by nothing else: tests/shake-change.test.ts holds it against what that makes.

/** The tile's side in pixels. A power of two, so a pixel is wrapped into the tile with a mask. */
export const STILL_SIDE = ${Math.sqrt(tile.length)}

const TILE = [
${lines.join('\n')}
].join('')

/**
 * The order in which the pixels of a part give way where the page draws one sample a frame (\`stageStill\` in materials.ts):
 * a byte a pixel, row after row, every value as often as every other. The pixel with the lower byte goes sooner.
 */
export function stillBytes(): Uint8Array<ArrayBuffer> {
  const text = atob(TILE)
  const bytes = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return bytes
}
`
}
