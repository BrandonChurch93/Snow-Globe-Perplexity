import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { GUST_STREAK, partStreaks } from '../src/core/materials'
import type { Sample } from '../src/core/sampler'
import { barSeconds } from '../src/film/timeline'
import { MELT, SKITTER, SKITTER_OVER, leafCover, leafCut, leafFace, leafGoes, leafLean, leafMelt, leafShutter, skitterLeft, skitterPush, skitterShare } from '../src/seasons/fall/slab'

// Decision 306 and its addition 307, W2b: at the masters' size a leaf that moves at the landing was a row of whole copies,
// one a sample, with ribs on its face and teeth along its edge (24 samples in a frame in which the globe stands). The
// lifted leaves are drawn as the flown leaves of a change are: in parts of each sample's share of the shutter, every pixel
// keeping one, so that a leaf is one smear. The count of the frame's samples and the shutter's deal are as they were.
// What the parts cannot melt, the veins, teeth and lobes that lie along a leaf's way, is melted in the leaf's sheet.
//
// Order 319, W2c: at 3840 such a smear still read as a shape cut from paper, one flat colour inside a hard edge, and it
// ended hard. Its face keeps two or three tones of its own (and no vein), its edge is open, its moments lean to the
// middle of the exposure so that it fades toward both ends of its way, and a leaf that takes off inside the exposure is
// no longer drawn sharp at the foot of its own smear. A leaf at rest is drawn as it always was.
describe("fall's leaves at the landing, at the masters' size", () => {
  const shutter = config.film.shutterDegrees / 360 / config.film.fps
  const sample = (t: number, of: number): Sample => ({ index: 0, px: 0, py: 0, lu: 0.3, lv: -0.2, t, of })

  it('draws a moving leaf in parts in every frame of the film that has samples enough, and only there', () => {
    // The live page has no sample and a draft has two: the leaves are drawn once, as they were.
    expect(partStreaks(null)).toBe(0)
    expect(partStreaks(sample(0.5, 2))).toBe(0)
    expect(partStreaks(sample(0.5, GUST_STREAK.join - 1))).toBe(0)
    // The masters' least count is 24: a sample stands for a 24th of the shutter.
    expect(partStreaks(sample(0.5, 24), 1.2, 400)).toBeCloseTo(1 / 24, 12)
    expect(partStreaks(sample(0.02, 77))).toBeCloseTo(1 / 77, 12)
    expect(GUST_STREAK.parts * 24).toBeGreaterThanOrEqual(192)
  })

  it('is on from the landing until the last leaf lies still, and off before it and at rest', () => {
    expect(skitterShare(0, 24)).toBe(0)
    expect(skitterShare(1e3, 24)).toBe(0)
    expect(skitterShare(SKITTER_OVER + shutter, 24)).toBe(0)
    for (const s of [1e-4, 0.01, 1 / 60, 0.1, 0.5, 1, SKITTER_OVER]) {
      expect(skitterShare(s, 24)).toBeCloseTo(shutter / 24, 15)
      expect(skitterShare(s, 77)).toBeCloseTo(shutter / 77, 15)
    }
    // No leaf is still on its way when the parts are put away: the farthest, the last to start and the slowest.
    for (const gap of [0, 40, 130, 400, 719]) {
      for (const wait of [0, 0.5, 1]) {
        for (const long of [0, 0.5, 1]) expect(skitterLeft(gap, wait, long, SKITTER_OVER)).toBe(0)
      }
    }
    expect(skitterLeft(719, 1, 1, SKITTER_OVER - 0.02)).toBeGreaterThan(0)
  })

  /** The places in the shutter of a lifted leaf's moments in a frame of `of` samples, as the shader deals them. */
  const places = (of: number): number[] => {
    const at: number[] = []
    for (let k = 0; k < of; k++) {
      for (let part = 0; part < GUST_STREAK.parts; part++) at.push(leafLean(k / of + (1 / of) * ((part + 0.5) / GUST_STREAK.parts)))
    }
    return at.sort((a, b) => a - b)
  }

  it('gives a leaf eight moments in every sample, more of them the nearer the middle of the shutter', () => {
    const slab = readFileSync('src/seasons/fall/slab.ts', 'utf8')
    expect(slab).toContain('float leafDealt = uLeafTime.z + uLeafTime.y / ${SHUTTER_SECONDS.toFixed(6)} * (vGustPart + 0.5) / float(STAGE_STREAK);')
    expect(slab).toContain('leafNow += ${SHUTTER_SECONDS.toFixed(6)} * ((leafDealt < 0.5 ? sqrt(0.5 * leafDealt) : 1.0 - sqrt(0.5 * (1.0 - leafDealt))) - uLeafTime.w);')
    expect(slab).not.toContain('leafNow += uLeafTime.y * ((vGustPart + 0.5) / float(STAGE_STREAK) - 0.5);')
    expect(slab).toContain('float leafT = clamp((leafNow - leafWait) / leafLong, 0.0, 1.0);')
    expect(slab).not.toContain('(uLeafTime.x - leafWait)')
    // The lean: the middle stays the middle, the ends stay the ends, and it is the same from both ends.
    expect(leafLean(0)).toBe(0)
    expect(leafLean(0.5)).toBeCloseTo(0.5, 15)
    expect(leafLean(1)).toBe(1)
    expect(leafLean(-3)).toBe(0)
    expect(leafLean(7)).toBe(1)
    for (let q = 0; q <= 1.0001; q += 0.01) expect(leafLean(q) + leafLean(1 - q)).toBeCloseTo(1, 12)
    // As many moments as before, of * parts of them, none twice, every one inside the shutter.
    const of = 24
    const at = places(of)
    expect(at.length).toBe(of * GUST_STREAK.parts)
    for (let i = 1; i < at.length; i++) expect(at[i]!).toBeGreaterThan(at[i - 1]!)
    expect(at[0]!).toBeGreaterThan(0)
    expect(at[at.length - 1]!).toBeLessThan(1)
    // Their number up to a place falls as the square of the way to the nearer end: a straight fall of their density
    // from the middle of the shutter to none as it opens and none as it closes.
    const upTo = (x: number): number => at.filter((a) => a < x).length / at.length
    for (const x of [0.05, 0.1, 0.2, 0.25, 0.35, 0.5]) {
      expect(upTo(x)).toBeCloseTo(2 * x * x, 2)
      expect(1 - upTo(1 - x)).toBeCloseTo(2 * x * x, 2)
    }
    // Three in four lie in the middle half; an even deal put one in two there. In the first tenth and in the last lie
    // two in a hundred each; an even deal put ten there.
    expect(upTo(0.75) - upTo(0.25)).toBeCloseTo(0.75, 2)
    expect(upTo(0.1)).toBeLessThan(0.025)
    expect(1 - upTo(0.9)).toBeLessThan(0.025)
    // No two neighbours are as far apart as two samples were, so no leaf is a row of copies again: the widest gap is
    // the first, and it is under two thirds of a sample's share. In the middle they are twice as close as evenly dealt.
    let widest = 0
    for (let i = 1; i < at.length; i++) widest = Math.max(widest, at[i]! - at[i - 1]!)
    expect(widest).toBeCloseTo(at[1]! - at[0]!, 12)
    expect(widest).toBeLessThan((2 / 3) * (1 / of))
    const mid = at.length / 2
    expect(at[mid]! - at[mid - 1]!).toBeCloseTo(0.5 / at.length, 4)
    // The fastest leaf goes less between two of its moments, the widest apart, than it went between two samples.
    const push = skitterPush(100, 1)
    const went = (a: number, b: number): number => push * (skitterLeft(100, 0, 0, a) - skitterLeft(100, 0, 0, b))
    const first = 100 / SKITTER.waveMmPerSecond
    const aSample = went(first, first + shutter / of)
    // A tenth of a millimetre and more a sample along its way (and a leaf that turns over sweeps its tip some ten times
    // as far): a pixel and more at 3840, which is a row of copies.
    expect(aSample).toBeGreaterThan(0.1)
    expect(went(first, first + widest * shutter)).toBeLessThan(aSample)
    expect(went(first, first + shutter / (of * GUST_STREAK.parts))).toBeLessThan(aSample / (GUST_STREAK.parts - 1))
  })

  it('fades a smear toward where the leaf was as the shutter opened and as it closed', () => {
    // A leaf an eighth as long as its way in the shutter, going evenly. Its cover at a place is the share of its
    // moments at which it lies over that place.
    const long = 1 / 8
    const cover = (at: number[], x: number): number => at.filter((a) => x >= a && x <= a + long).length / at.length
    const lean = places(24)
    const even = lean.map((_, i) => (i + 0.5) / lean.length)
    // Evenly dealt (W2b) the smear is as dense a leaf's length in from either end as in its middle: it ends on an edge.
    expect(cover(even, long)).toBeCloseTo(long, 2)
    expect(cover(even, 0.5 + long / 2)).toBeCloseTo(long, 2)
    expect(cover(even, 1)).toBeCloseTo(long, 2)
    // Leaning, it is nearly twice as dense in the middle and falls from there to both ends with no step: at a leaf's
    // length in from either end it is under a seventh of its middle, and at half a length under a twentieth.
    const middle = cover(lean, 0.5 + long / 2)
    expect(middle).toBeGreaterThan(1.8 * long)
    for (const end of [0, 1]) {
      const inFrom = (way: number): number => cover(lean, end === 0 ? way : 1 + long - way)
      expect(inFrom(long)).toBeLessThan(middle / 7)
      expect(inFrom(long / 2)).toBeLessThan(middle / 20)
      let last = 0
      for (let way = 0; way <= 0.5 + long / 2 + 1e-9; way += 1 / 64) {
        const now = inFrom(way)
        expect(now).toBeGreaterThanOrEqual(last - 1e-9)
        expect(now - last).toBeLessThan(middle / 12)
        last = now
      }
    }
    // The same leaf is no thinner for it: over its whole way the smear holds what it held.
    let sumLean = 0
    let sumEven = 0
    for (let x = 0; x <= 1 + long; x += 1 / 512) {
      sumLean += cover(lean, x)
      sumEven += cover(even, x)
    }
    expect(sumLean / sumEven).toBeCloseTo(1, 2)
    // A leaf that takes off inside the exposure lay still until then: it is read as coarse as it leaves through the
    // whole exposure, and so is not drawn sharp at the foot of its smear. A leaf that takes off in a later frame is
    // not touched.
    const slab = readFileSync('src/seasons/fall/slab.ts', 'utf8')
    expect(slab).toContain('float leafShut = uLeafTime.x + ${SHUTTER_SECONDS.toFixed(6)} * (1.0 - uLeafTime.w);')
    expect(slab).toContain('vLeafMelt = uLeafTime.y > 0.0 && uState.w < 0.5 && leafShut > leafWait ? ')
    expect(slab).not.toContain('uState.w < 0.5 && leafNow > leafWait ? ')
  })

  it('reads where in its shutter a sample stands from the clock of the leaves', () => {
    // A landing lies on a frame of the film, and the landed picture a whole number of frames after its landing.
    expect(Number.isInteger(Math.round(barSeconds * config.film.fps * 1e6) / 1e6)).toBe(true)
    expect(Number.isInteger(Math.round(config.states.landedSeconds * config.film.fps * 1e6) / 1e6)).toBe(true)
    for (const frame of [0, 2, 3, 10, 30, 71]) {
      for (const place of [0, 0.02, 0.3, 0.5, 0.77, 0.999]) {
        // Wherever the frame dealt the sample: the clock says where it stands.
        for (const dealt of [0, place, 0.9]) expect(leafShutter(frame / config.film.fps + place * shutter, dealt)).toBeCloseTo(place, 9)
      }
    }
    expect(leafShutter(0.5 + 0.25 * shutter, 0.7)).toBeCloseTo(0.25, 9)
    // A clock that stands where the film's shutter is shut says nothing: the sample stands where its set dealt it.
    expect(leafShutter(2 / config.film.fps + 1.5 * shutter, 0.4)).toBe(0.4)
    expect(leafShutter(2 / config.film.fps + 1.01 * shutter, 0.4)).toBe(0.4)
    const slab = readFileSync('src/seasons/fall/slab.ts', 'utf8')
    const update = slab.slice(slab.indexOf('export function update(moment: KitMoment)'))
    expect(update).toContain('leafUniforms.uLeafTime.value.z = parts > 0 && f.sample ? Math.min(of - 1, Math.floor(f.sample.t * of)) / of : 0')
    expect(update).toContain('leafUniforms.uLeafTime.value.w = parts > 0 && f.sample ? leafShutter(leafUniforms.uLeafTime.value.x, f.sample.t) : 0')
  })

  it('reads the sheet of a lifted leaf as coarse as the leaf is fast, and that of a leaf at rest as it was', () => {
    // No level under a texel of travel, one level for every doubling of it, and no more than `most`.
    expect(leafMelt(0, 20)).toBe(0)
    expect(leafMelt(20 / MELT.texels, 20)).toBe(0)
    expect(leafMelt((2 * 20) / MELT.texels, 20)).toBeCloseTo(1, 12)
    expect(leafMelt((8 * 20) / MELT.texels, 20)).toBeCloseTo(3, 12)
    expect(leafMelt(1e3, 20)).toBe(MELT.most)
    // The same travel is more texels on a small leaf than on a large one.
    expect(leafMelt(0.5, 10)).toBeGreaterThan(leafMelt(0.5, 30))
    // At `most` a texel is as wide as the widest thing on a leaf, a lobe (some 40 texels of 256 on the sheet), and far
    // wider than a tooth (some 8) and the gap between two veins (some 15). A leaf is still eight texels long there.
    expect(2 ** MELT.most).toBeGreaterThanOrEqual(32)
    expect(MELT.texels / 2 ** MELT.most).toBeGreaterThanOrEqual(8)
    // A leaf goes fastest as it starts and stands still at the end of its way: a leaf of the mean (a slide of 45 mm in
    // 0.75 s, 20 mm long, turning a radian, hopping) is read over four levels coarser when it starts (it goes 2 mm
    // in the shutter there, a tenth of its length), sharper as it goes, and as it was when it lies: it comes to rest
    // sharp, with no step. The fastest (70 mm in 0.36 s) is read at `most`.
    const mean = (t: number): number => leafMelt(leafGoes(45, 1, 10, 20, t, 0.75), 20)
    expect(mean(0)).toBeGreaterThan(4)
    expect(leafMelt(leafGoes(70, 1, 10, 20, 0, 0.36), 20)).toBe(MELT.most)
    expect(mean(1)).toBe(0)
    let last = mean(0)
    let lies = 0
    for (let t = 0.01; t <= 1.0001; t += 0.01) {
      const now = mean(t)
      expect(now).toBeLessThanOrEqual(last)
      expect(last - now).toBeLessThan(0.5)
      if (now === 0 && lies === 0) lies = t
      last = now
    }
    // It is as it was a good while before it lies still: from where it goes under a texel in the shutter.
    expect(lies).toBeGreaterThan(0.5)
    expect(lies).toBeLessThan(0.95)
    // A leaf that turns over or hops goes further than one that only slides.
    expect(leafGoes(30, 6.3, 0, 20, 0.5, 0.75)).toBeGreaterThan(leafGoes(30, 0, 0, 20, 0.5, 0.75))
    expect(leafGoes(30, 0, 40, 20, 0.5, 0.75)).toBeGreaterThan(leafGoes(30, 0, 0, 20, 0.5, 0.75))
    // One law in the shader and here; only the second mesh has it, only for the landing's lift, and the first mesh
    // reads the sheet as it did.
    const slab = readFileSync('src/seasons/fall/slab.ts', 'utf8')
    expect(slab).toContain('float leafGoes = sqrt(leafPush * leafPush + leafSwing * leafSwing + leafLeap * leafLeap) * 4.0 * (1.0 - leafT) * (1.0 - leafT) * (1.0 - leafT) / leafLong * ${SHUTTER_SECONDS.toFixed(6)};')
    expect(slab).toContain('vLeafMelt = uLeafTime.y > 0.0 && uState.w < 0.5 && leafShut > leafWait ? clamp(log2(max(leafGoes * ${MELT.texels.toFixed(1)} / max(leafSize, 1e-3), 1.0)), 0.0, ${MELT.most.toFixed(1)}) : 0.0;')
    expect(slab).toContain('vec4 leaf = vLeafMelt > leafSeen ? textureLod(uLeafMap, vLeafUv, vLeafMelt) : texture2D(uLeafMap, vLeafUv);')
    const from = slab.indexOf('const LEAF_FRAG')
    const frag = slab.slice(from, slab.indexOf('\n`\n', from))
    const lifted = frag.slice(frag.indexOf('#ifdef STAGE_STREAK\n  // A lifted leaf'), frag.indexOf('if (leaf.a < 0.5) discard;'))
    expect(lifted).toContain('#else\n  vec4 leaf = texture2D(uLeafMap, vLeafUv);\n#endif')
    expect(slab.split('vLeafMelt').length - 1).toBe(8)
    // A draft never draws the second mesh, so no draft shows whether its shader is whole: no name is set up twice in
    // the body of the leaves' fragment shader (the first draft of the melt took a name that was there, and no leaf
    // was drawn at all). What stands after an #else is the other reading of the same lines and is left out.
    const body = frag.slice(frag.indexOf('void main() {')).replace(/#else[^]*?#endif/g, '#endif')
    const names = [...body.matchAll(/^\s*(?:float|vec2|vec3|vec4|bool|int|mat3)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|;)/gm)].map((m) => m[1]!)
    expect(names.length).toBeGreaterThan(10)
    expect(names).toContain('leafSeen')
    for (const name of ['leafOpen', 'leafFace', 'leafOwn', 'leafIn', 'leafRim', 'leafDeal']) expect(names).toContain(name)
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([])
  })

  it('keeps two or three tones of its own on the face of a lifted leaf, and no vein', async () => {
    // The face is read as coarse as the outline up to `tones` and no coarser, however fast the leaf.
    expect(MELT.tones).toBeLessThan(MELT.most)
    const goes = (level: number): number => (2 ** level * 20) / MELT.texels
    expect(leafFace(0, 20)).toBe(0)
    expect(leafFace(goes(2), 20)).toBeCloseTo(2, 12)
    expect(leafFace(goes(MELT.tones), 20)).toBeCloseTo(MELT.tones, 12)
    expect(leafFace(goes(MELT.most), 20)).toBe(MELT.tones)
    expect(leafFace(1e3, 20)).toBe(MELT.tones)
    expect(leafMelt(1e3, 20)).toBe(MELT.most)
    // At `tones` a texel is wider than the gap between two veins (some 15 texels of 256 on the sheet) and than a tooth
    // (some 8), so no rib comes back, and a leaf is sixteen texels long.
    expect(2 ** MELT.tones).toBeGreaterThanOrEqual(16)
    expect(MELT.texels / 2 ** MELT.tones).toBe(16)
    // The sheet itself: `cells` leaves of 256 texels. Read at `tones`, every leaf holds paler and darker patches: a
    // tenth of its patches set aside at either end, its palest is over a quarter brighter than its darkest (1.30 to
    // 1.69 times, leaf by leaf), and with none set aside over 1.7 times. Read as one mean colour, as the fastest
    // leaves were, it held none.
    const read = await sharp('assets-full/fall/slab-leaves.srgb.w1024.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const sheet = { width: read.info.width, height: read.info.height, data: read.data }
    expect(read.info.channels).toBe(4)
    expect(sheet.width).toBe(MELT.cells[0] * MELT.texels)
    expect(sheet.height).toBe(MELT.cells[1] * MELT.texels)
    const block = 2 ** MELT.tones
    for (let cell = 0; cell < MELT.cells[0] * MELT.cells[1]; cell++) {
      const x0 = (cell % MELT.cells[0]) * MELT.texels
      const y0 = Math.floor(cell / MELT.cells[0]) * MELT.texels
      const tones: number[] = []
      for (let by = 0; by < MELT.texels / block; by++) {
        for (let bx = 0; bx < MELT.texels / block; bx++) {
          let light = 0
          let cover = 0
          for (let y = 0; y < block; y++) {
            for (let x = 0; x < block; x++) {
              const at = ((y0 + by * block + y) * sheet.width + x0 + bx * block + x) * 4
              const a = sheet.data[at + 3]! / 255
              light += a * (0.3 * sheet.data[at]! + 0.5 * sheet.data[at + 1]! + 0.2 * sheet.data[at + 2]!)
              cover += a
            }
          }
          // A patch that is all leaf, or nearly: the leaf's face and not its edge.
          if (cover > 0.9 * block * block) tones.push(light / cover)
        }
      }
      tones.sort((a, b) => a - b)
      expect(tones.length).toBeGreaterThanOrEqual(40)
      const dark = tones[Math.floor(0.1 * (tones.length - 1))]!
      const pale = tones[Math.ceil(0.9 * (tones.length - 1))]!
      expect(pale / dark).toBeGreaterThan(1.25)
      expect(tones[tones.length - 1]! / tones[0]!).toBeGreaterThan(1.7)
    }
    const slab = readFileSync('src/seasons/fall/slab.ts', 'utf8')
    expect(slab).toContain('vec4 leafFace = textureLod(uLeafMap, vLeafUv, min(vLeafMelt, max(${MELT.tones.toFixed(1)}, leafSeen)));')
    expect(slab).toContain('vec3 leafOwn = mix(leaf.rgb / max(leaf.a, 0.1), leafFace.rgb / max(leafFace.a, 0.2), smoothstep(0.2, 0.6, leafFace.a));')
    expect(slab).toContain('leaf.rgb = mix(leaf.rgb, leafOwn, leafOpen);')
    // Nothing takes the face to one colour any more.
    for (const no of ['leafMean', 'leafMid', 'leafFlat', 'MELT.flat']) expect(slab).not.toContain(no)
  })

  it('opens the edge of a lifted leaf and cuts a leaf at rest where it always was', () => {
    // At rest every pixel of every sample cuts at half cover, whatever its own number.
    for (const deal of [0, 0.2, 0.5, 0.99]) expect(leafCut(deal, 0)).toBe(0.5)
    expect(leafCover(0.49, 0)).toBe(0)
    expect(leafCover(0.5, 0)).toBe(1)
    // Lifted by a level or more, a pixel cuts anywhere from `0.5 - edge / 2` to `0.5 + edge / 2`.
    expect(MELT.edge).toBeGreaterThan(0.5)
    expect(MELT.edge).toBeLessThan(1)
    expect(leafCut(0, 1)).toBeCloseTo(0.5 - MELT.edge / 2, 12)
    expect(leafCut(1, 1)).toBeCloseTo(0.5 + MELT.edge / 2, 12)
    expect(leafCut(0.5, 1)).toBe(0.5)
    expect(leafCut(0, 5)).toBe(leafCut(0, 1))
    expect(leafCut(0, 0.5)).toBeCloseTo(0.5 - MELT.edge / 4, 12)
    // So its cover in the frame follows the cover of its sheet: none under the lowest cut, whole over the highest,
    // half at half, rising evenly between, where a leaf cut at half cover went from none to whole at once.
    expect(leafCover(0.5 - MELT.edge / 2, 1)).toBe(0)
    expect(leafCover(0.5 + MELT.edge / 2, 1)).toBe(1)
    expect(leafCover(0.5, 1)).toBeCloseTo(0.5, 12)
    expect(leafCover(0.5 + MELT.edge / 4, 1)).toBeCloseTo(0.75, 12)
    expect(leafCover(1, 1)).toBe(1)
    expect(leafCover(0, 1)).toBe(0)
    // The pixel's number goes round with the samples by the golden section, as its part does (materials.ts,
    // `partStreaks`): whatever the pixel's own number and wherever in the frame a run of samples begins, the share of
    // a run that keeps the leaf is the cover above to within two samples and a quarter of the run (2.11 of 24, 1.77 of
    // 12, 1.69 of 6 at the worst). A leaf is over a pixel for a run of the frame's samples, so this holds where a
    // smear is thin too.
    const turn = 0.6180339887
    for (const run of [24, 12, 6]) {
      let worst = 0
      for (let own = 0; own < 256; own++) {
        for (let from = 0; from <= 24 - run; from++) {
          for (let cover = 0.1; cover <= 0.9001; cover += 0.01) {
            let kept = 0
            for (let k = from; k < from + run; k++) {
              const deal = ((own + 0.5) / 256 + ((k * turn) % 1)) % 1
              if (!(cover < leafCut(deal, 1))) kept++
            }
            worst = Math.max(worst, Math.abs(kept / run - leafCover(cover, 1)))
          }
        }
      }
      expect(worst).toBeLessThan(2.25 / run)
    }
    // A leaf fills its cell of the sheet to the cell's edge, and its open edge would end on the straight side of its
    // card: its cover is taken off over the last `rim` of the cell, one texel of its coarsest level.
    expect(MELT.rim * MELT.texels).toBe(2 ** MELT.most)
    const slab = readFileSync('src/seasons/fall/slab.ts', 'utf8')
    expect(slab).toContain('vec2 leafIn = fract(vLeafUv * vec2(${MELT.cells[0].toFixed(1)}, ${MELT.cells[1].toFixed(1)}));')
    expect(slab).toContain('float leafRim = mix(1.0, smoothstep(0.0, ${MELT.rim.toFixed(3)}, min(leafIn.x, leafIn.y)), leafOpen);')
    expect(slab).toContain('float leafDeal = fract(stageStill(ivec2(gl_FragCoord.yx) + ivec2(7, 91)) + uGustSlot.z);')
    expect(slab).toContain('if (leaf.a * leafRim < 0.5 + (leafDeal - 0.5) * ${MELT.edge.toFixed(2)} * leafOpen) discard;')
    // Everything new stands inside the one branch of a leaf whose level is over the lens's own: outside it the second
    // mesh reads the sheet as the first does and cuts at half cover.
    const from = slab.indexOf('const LEAF_FRAG')
    const frag = slab.slice(from, slab.indexOf('\n`\n', from))
    const branch = frag.slice(frag.indexOf('  if (vLeafMelt > leafSeen) {\n'), frag.indexOf('    leaf.a = 1.0;\n  }\n#else\n'))
    expect(branch.length).toBeGreaterThan(400)
    const outside = frag.replace(branch, '')
    for (const name of ['leafOpen', 'leafFace', 'leafOwn', 'leafIn', 'leafRim', 'leafDeal', 'textureLod(uLeafMap, vLeafUv, min(']) expect(outside).not.toContain(name)
    expect(outside).toContain('#else\n  vec4 leaf = texture2D(uLeafMap, vLeafUv);\n#endif\n  if (leaf.a < 0.5) discard;')
    expect(outside.split('discard;').length).toBe(frag.split('discard;').length - 1)
  })

  it('leaves the change, the page, the stills at rest and the count of samples as they were', () => {
    const slab = readFileSync('src/seasons/fall/slab.ts', 'utf8')
    const update = slab.slice(slab.indexOf('export function update(moment: KitMoment)'))
    // Inside a change the gust has the second mesh, and the leaves' own clock adds nothing to it.
    expect(update).toContain('!flown && f.from === f.to && f.to.season === ')
    expect(update).toContain('leafUniforms.uLeafTime.value.y = parts * SHUTTER_SECONDS')
    // Where the leaves are drawn once nothing leans: the clock is the sample's own, as on the main branch.
    expect(slab).toContain('if (uLeafTime.y > 0.0) {\n  float leafDealt')
    expect(update).toContain('inAir?.(flown || parts > 0)')
    // Nothing here counts samples or deals the shutter.
    for (const no of ['samplesPerFrame', 'evenSet', 'pictureSet', 'tierSamples']) expect(slab).not.toContain(no)
    const film = JSON.parse(readFileSync('config/showcase.json', 'utf8')) as { tiers: Record<string, { samplesPerFrame: number }> }
    expect(film.tiers['final']!.samplesPerFrame).toBe(24)
    expect(film.tiers['draft']!.samplesPerFrame).toBeLessThan(GUST_STREAK.join)
  })
})
