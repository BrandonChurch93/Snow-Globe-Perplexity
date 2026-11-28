import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { GUST_STREAK, partStreaks } from '../src/core/materials'
import type { Sample } from '../src/core/sampler'
import { MELT, SKITTER, SKITTER_OVER, leafFlat, leafGoes, leafMelt, skitterLeft, skitterPush, skitterShare } from '../src/seasons/fall/slab'

// Decision 306 and its addition 307, W2b: at the masters' size a leaf that moves at the landing was a row of whole copies,
// one a sample, with ribs on its face and teeth along its edge (24 samples in a frame in which the globe stands). The
// lifted leaves are drawn as the flown leaves of a change are: in parts of each sample's share of the shutter, every pixel
// keeping one, so that a leaf is one smear. The count of the frame's samples and the shutter's deal are as they were.
// What the parts cannot melt, the veins, teeth and lobes that lie along a leaf's way, is melted in the leaf's sheet.
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

  it('gives a leaf eight moments in every sample, evenly through the shutter', () => {
    const slab = readFileSync('src/seasons/fall/slab.ts', 'utf8')
    expect(slab).toContain('leafNow += uLeafTime.y * ((vGustPart + 0.5) / float(STAGE_STREAK) - 0.5);')
    expect(slab).toContain('float leafT = clamp((leafNow - leafWait) / leafLong, 0.0, 1.0);')
    expect(slab).not.toContain('(uLeafTime.x - leafWait)')
    // The moments of the parts of evenly dealt samples: of * parts of them, a step apart, none twice.
    const of = 24
    const share = skitterShare(0.1, of)
    const at: number[] = []
    for (let k = 0; k < of; k++) {
      const own = 0.1 + ((k + 0.5) / of) * shutter
      for (let part = 0; part < GUST_STREAK.parts; part++) at.push(own + share * ((part + 0.5) / GUST_STREAK.parts - 0.5))
    }
    at.sort((a, b) => a - b)
    for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!).toBeCloseTo(shutter / (of * GUST_STREAK.parts), 12)
    expect(at[0]!).toBeGreaterThan(0.1)
    expect(at[at.length - 1]!).toBeLessThan(0.1 + shutter)
    // The fastest leaf goes less between two of its moments than it went between two samples, by the count of the parts.
    const push = skitterPush(100, 1)
    const went = (a: number, b: number): number => push * (skitterLeft(100, 0, 0, a) - skitterLeft(100, 0, 0, b))
    const first = 100 / SKITTER.waveMmPerSecond
    const aSample = went(first, first + shutter / of)
    const aPart = went(first, first + shutter / (of * GUST_STREAK.parts))
    // A tenth of a millimetre and more a sample along its way (and a leaf that turns over sweeps its tip some ten times
    // as far): a pixel and more at 3840, which is a row of copies.
    expect(aSample).toBeGreaterThan(0.1)
    expect(aPart).toBeLessThan(aSample / (GUST_STREAK.parts - 1))
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
    expect(slab).toContain('vLeafMelt = uLeafTime.y > 0.0 && uState.w < 0.5 && leafNow > leafWait ? clamp(log2(max(leafGoes * ${MELT.texels.toFixed(1)} / max(leafSize, 1e-3), 1.0)), 0.0, ${MELT.flat.toFixed(1)}) : 0.0;')
    expect(slab).toContain('vec4 leaf = vLeafMelt > leafSeen ? textureLod(uLeafMap, vLeafUv, min(vLeafMelt, ${MELT.most.toFixed(1)})) : texture2D(uLeafMap, vLeafUv);')
    const from = slab.indexOf('const LEAF_FRAG')
    const frag = slab.slice(from, slab.indexOf('\n`\n', from))
    const lifted = frag.slice(frag.indexOf('#ifdef STAGE_STREAK\n  // A lifted leaf'), frag.indexOf('if (leaf.a < 0.5) discard;'))
    expect(lifted).toContain('#else\n  vec4 leaf = texture2D(uLeafMap, vLeafUv);\n#endif')
    expect(slab.split('vLeafMelt').length - 1).toBe(10)
    // A draft never draws the second mesh, so no draft shows whether its shader is whole: no name is set up twice in
    // the body of the leaves' fragment shader (the first draft of the melt took a name that was there, and no leaf
    // was drawn at all). What stands after an #else is the other reading of the same lines and is left out.
    const body = frag.slice(frag.indexOf('void main() {')).replace(/#else[^]*?#endif/g, '#endif')
    const names = [...body.matchAll(/^\s*(?:float|vec2|vec3|vec4|bool|int|mat3)\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:=|;)/gm)].map((m) => m[1]!)
    expect(names.length).toBeGreaterThan(10)
    expect(names).toContain('leafSeen')
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([])
  })

  it('gives the face of a leaf at its fastest one colour, the mean of its own cell of the sheet', () => {
    // Up to `most` levels the face is the sheet's; from there to `flat` it goes to its mean, a share for every level.
    expect(MELT.flat).toBeGreaterThan(MELT.most)
    const goes = (level: number): number => (2 ** level * 20) / MELT.texels
    expect(leafFlat(0, 20)).toBe(0)
    expect(leafFlat(goes(MELT.most), 20)).toBe(0)
    expect(leafFlat(goes((MELT.most + MELT.flat) / 2), 20)).toBeCloseTo(0.5, 12)
    expect(leafFlat(goes(MELT.flat), 20)).toBeCloseTo(1, 12)
    expect(leafFlat(1e3, 20)).toBe(1)
    let last = 0
    for (let level = 0; level <= 9; level += 0.05) {
      const now = leafFlat(goes(level), 20)
      expect(now).toBeGreaterThanOrEqual(last)
      expect(now - last).toBeLessThan(0.03)
      last = now
    }
    // The outline is never read coarser than `most`: the leaf keeps its size.
    expect(leafMelt(goes(MELT.flat), 20)).toBe(MELT.most)
    // At `flat` a cell of the sheet is two texels by two, and their corner, the middle of the cell, reads the mean of
    // the four: the whole leaf and nothing of its neighbours. The sheet is `cells` of 256 texels.
    expect(MELT.texels / 2 ** MELT.flat).toBe(2)
    const sheet = readFileSync('assets-full/fall/slab-leaves.srgb.w1024.png')
    expect(sheet.readUInt32BE(16)).toBe(MELT.cells[0] * MELT.texels)
    expect(sheet.readUInt32BE(20)).toBe(MELT.cells[1] * MELT.texels)
    // The fastest leaf (70 mm in 0.36 s, turning over once) goes a third of its length in the shutter as it starts and
    // is three parts in four of the way to its mean colour; a leaf of the mean keeps its own face throughout.
    const fastest = (t: number): number => leafFlat(leafGoes(70, 6.3, 10, 20, t, 0.36), 20)
    const mean = (t: number): number => leafFlat(leafGoes(45, 1, 10, 20, t, 0.75), 20)
    expect(fastest(0)).toBeGreaterThan(0.7)
    expect(fastest(0)).toBeLessThan(0.8)
    expect(fastest(0.5)).toBe(0)
    expect(fastest(1)).toBe(0)
    for (const t of [0, 0.25, 0.5, 1]) expect(mean(t)).toBe(0)
    const slab = readFileSync('src/seasons/fall/slab.ts', 'utf8')
    expect(slab).toContain('if (vLeafMelt > ${MELT.most.toFixed(1)}) {')
    expect(slab).toContain('vec2 leafMid = (floor(vLeafUv * leafCells) + 0.5) / leafCells;')
    expect(slab).toContain('vec4 leafMean = textureLod(uLeafMap, mix(vLeafUv, leafMid, (vLeafMelt - ${MELT.most.toFixed(1)}) / ${(MELT.flat - MELT.most).toFixed(1)}), max(vLeafMelt, leafSeen));')
    expect(slab).toContain('leaf.rgb = leafMean.rgb / max(leafMean.a, 0.1);')
  })

  it('leaves the change, the page, the stills at rest and the count of samples as they were', () => {
    const slab = readFileSync('src/seasons/fall/slab.ts', 'utf8')
    const update = slab.slice(slab.indexOf('export function update(moment: KitMoment)'))
    // Inside a change the gust has the second mesh, and the leaves' own clock adds nothing to it.
    expect(update).toContain('!flown && f.from === f.to && f.to.season === ')
    expect(update).toContain('leafUniforms.uLeafTime.value.y = parts * SHUTTER_SECONDS')
    expect(update).toContain('inAir?.(flown || parts > 0)')
    // Nothing here counts samples or deals the shutter.
    for (const no of ['samplesPerFrame', 'evenSet', 'pictureSet', 'tierSamples']) expect(slab).not.toContain(no)
    const film = JSON.parse(readFileSync('config/showcase.json', 'utf8')) as { tiers: Record<string, { samplesPerFrame: number }> }
    expect(film.tiers['final']!.samplesPerFrame).toBe(24)
    expect(film.tiers['draft']!.samplesPerFrame).toBeLessThan(GUST_STREAK.join)
  })
})
