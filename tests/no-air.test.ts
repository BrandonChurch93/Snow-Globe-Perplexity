import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { VEIL_GLSL } from '../src/core/chunks/veil'
import { handleOf, stageUniforms } from '../src/core/materials'
import { AirHold, clearVeil, seasonAir } from '../src/scene/air'
import * as fall from '../src/seasons/fall/glass'
import * as spring from '../src/seasons/spring/glass'
import * as summer from '../src/seasons/summer/glass'
import { noAirProblem, renderStill, stillName, stillSpec } from '../tools/lib/page.mjs'
import { parseArgs, rel } from '../tools/lib/paths.mjs'

// `npm run still -- --no-air`: the same still with the air left out, so that a builder can read the tone of wood, walls and
// lawn. It is a measuring aid and never a judged picture, and a still without the switch is the still it always was.

type Spec = Record<string, unknown>
const spec = (args: Record<string, unknown>): Spec => stillSpec(args) as Spec
const argsOf = parseArgs as (argv: string[], on?: { aid?: boolean }) => Record<string, unknown>
const draw = renderStill as (session: unknown, spec: Spec, on: { file: string; force: boolean; aid?: boolean }) => Promise<unknown>
const plain = spec({ season: 'summer' })
const bare = spec({ season: 'summer', 'no-air': true })

const sources = (dir: string, ext: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'briefs' ? [] : sources(p, ext)
    return e.name.endsWith(ext) ? [p] : []
  })
const naming = (dir: string, ext: string, word: string): string[] =>
  sources(rel(dir), ext)
    .filter((f) => fs.readFileSync(f, 'utf8').includes(word))
    .map((f) => path.relative(rel(), f).split(path.sep).join('/'))
    .sort()

describe('a still without the air: the tool', () => {
  it('leaves a plain still as it was: the same spec, to the letter, and the same name', () => {
    expect(JSON.stringify(plain)).toBe('{"id":"","season":"summer","state":"rest","camera":"hero","tier":"draft","format":"hd","assets":"full","diag":"","interface":false,"live":""}')
    expect(stillName(plain)).toBe('summer-rest-hero-hd-draft.png')
    expect(stillName(spec({ key: 'summer-rest', tier: 'review' }))).toBe('summer-rest-hd-review.png')
    expect(noAirProblem(plain, rel('out', 'work', 'stills', stillName(plain)), false)).toBe('')
  })

  it('says in the spec and at the end of the name that the air is left out', () => {
    expect(bare).toEqual({ ...plain, noAir: true })
    expect(stillName(bare)).toBe('summer-rest-hero-hd-draft-noair.png')
    expect(stillName(bare, 'stage')).toBe('summer-rest-hero-hd-draft-stage-noair.png')
    expect(stillName(spec({ season: 'fall', state: 'landed', diag: 'ids', live: 'low', interface: true, rig: '{}', 'no-air': true }))).toBe('fall-landed-hero-hd-draft-ids-live-low-ui-rig-noair.png')
    expect(noAirProblem(bare, rel('out', 'work', 'stills', stillName(bare)), true)).toBe('')
  })

  it('is refused of a judged picture, and takes no value', () => {
    expect(() => spec({ key: 'summer-rest', 'no-air': true })).toThrow(/judged picture/)
    expect(() => spec({ id: 'summer-shake', 'no-air': true })).toThrow(/judged picture/)
    expect(() => spec({ season: 'summer', 'no-air': 'yes' })).toThrow(/takes no value/)
    expect(noAirProblem({ ...bare, id: 'summer-rest' }, 'summer-rest-hd-draft-noair.png', true)).toMatch(/judged picture/)
  })

  it('is refused by every tool but the still tool', () => {
    expect(argsOf(['--season', 'summer', '--no-air'], { aid: true })['no-air']).toBe(true)
    expect(() => argsOf(['--season', 'summer', '--no-air'])).toThrow(/No gate, guard, measure, judged still, film or poster/)
    expect(() => argsOf(['--no-air', 'yes', '--tier', 'final'])).toThrow(/npm run still/)
    expect(noAirProblem(bare, stillName(bare), false)).toMatch(/npm run still/)
    expect(naming('tools', '.mjs', 'aid: true')).toEqual(['tools/still.mjs'])
    expect(naming('tools', '.mjs', 'noAir')).toEqual(['tools/lib/page.mjs', 'tools/still.mjs'])
  })

  it('never has the name of a plain still, and a plain still never has its name', () => {
    expect(noAirProblem(bare, 'summer-rest-hero-hd-draft.png', true)).toMatch(/ends in -noair\.png/)
    expect(noAirProblem(bare, 'noair.png', true)).toMatch(/ends in -noair\.png/)
    expect(noAirProblem(plain, 'summer-rest-hero-hd-draft-noair.png', false)).toMatch(/this still has its air/)
    expect(noAirProblem(plain, 'summer-rest-hero-hd-draft-noair.png', true)).toMatch(/this still has its air/)
  })

  it('stops before a page is asked for anything', async () => {
    const untouched = new Proxy({}, { get: (_, key) => { throw new Error(`the session was asked for ${String(key)}`) } })
    await expect(draw(untouched, bare, { file: '/tmp/a-noair.png', force: true })).rejects.toThrow(/npm run still/)
    await expect(draw(untouched, bare, { file: '/tmp/a.png', force: true, aid: true })).rejects.toThrow(/ends in -noair\.png/)
    await expect(draw(untouched, plain, { file: '/tmp/a-noair.png', force: true, aid: true })).rejects.toThrow(/this still has its air/)
  })

  it('is never paired with an approved image as the build\'s still', () => {
    const status = fs.readFileSync(rel('tools', 'status.mjs'), 'utf8')
    const left = /!\/-\(([a-z|]+)\)\\b\/\.test\(f\)/.exec(status)
    expect(left?.[1]?.split('|')).toContain('noair')
  })
})

describe('a still without the air: the stage', () => {
  const orders = (objects: THREE.Object3D[]): number[] => objects.map((o) => o.renderOrder).sort((a, b) => a - b)
  const partsOf = (objects: THREE.Object3D[]): string[] => [...new Set(objects.map((o) => handleOf((o as THREE.Mesh).material as THREE.Material).part))]
  const meshes = (root: THREE.Object3D): THREE.Object3D[] => {
    const out: THREE.Object3D[] = []
    root.traverse((o) => void ((o as THREE.Mesh).material && out.push(o)))
    return out
  }

  it("takes spring's mist out of the liquid and leaves what lies on its glass", () => {
    const root = spring.dressing()
    const air = seasonAir([root])
    expect(orders(air)).toEqual([3, 3.1, 3.2])
    expect(partsOf(air)).toEqual(['veil-spring'])
    const rest = meshes(root).filter((o) => !air.includes(o))
    expect(rest.length).toBe(3)
    expect(partsOf(rest)).toEqual(['glass-dressing-spring'])
  })

  it("takes fall's pooled fog and its lip out of the liquid and leaves the crack in its glass", () => {
    const root = fall.dressing()
    const air = seasonAir([root])
    expect(orders(air)).toEqual([5.4, 5.5])
    const rest = meshes(root).filter((o) => !air.includes(o))
    expect(orders(rest)).toEqual([11])
  })

  it("hides no mesh of summer's glass: its far wall, its sun and its reflections are drawn", () => {
    const root = summer.dressing()
    expect(seasonAir([root])).toEqual([])
    expect(meshes(root).length).toBe(5)
  })

  it('gives back after the frame exactly what it hid, also after a frame that failed', () => {
    const root = spring.dressing()
    const air = seasonAir([root])
    const others = meshes(root).filter((o) => !air.includes(o))
    air.forEach((o, i) => void (o.visible = i > 0))
    const hold = new AirHold()
    hold.hide([root])
    expect(air.map((o) => o.visible)).toEqual([false, false, false])
    expect(others.every((o) => o.visible)).toBe(true)
    hold.hide([root])
    hold.back()
    expect(air.map((o) => o.visible)).toEqual([false, true, true])
    hold.back()
    expect(air.map((o) => o.visible)).toEqual([false, true, true])
    expect(others.every((o) => o.visible)).toBe(true)
  })

  it('empties the shared veil of all four of its amounts and leaves its colour and its shape', () => {
    const u = stageUniforms
    const kept = [u.uVeil.value.clone(), u.uVeilRoll.value.clone(), u.uVeilBank.value.clone(), u.uVeilDrift.value.clone()]
    u.uVeil.value.set(1.75, 1.4, 0.86, 0.02)
    u.uVeilRoll.value.set(0.4, 0.7, 0.0004, 0.9)
    u.uVeilBank.value.set(-0.17, 0.25, 0.006, 0.7)
    u.uVeilDrift.value.set(0.003, 0.2, 0.5, 0)
    clearVeil()
    expect(u.uVeil.value.toArray()).toEqual([1.75, 1.4, 0.86, 0])
    expect(u.uVeilRoll.value.toArray()).toEqual([0.4, 0.7, 0, 0.9])
    expect(u.uVeilBank.value.toArray()).toEqual([-0.17, 0.25, 0, 0.7])
    expect(u.uVeilDrift.value.toArray()).toEqual([0, 0.2, 0.5, 0])
    u.uVeil.value.copy(kept[0]!)
    u.uVeilRoll.value.copy(kept[1]!)
    u.uVeilBank.value.copy(kept[2]!)
    u.uVeilDrift.value.copy(kept[3]!)
  })

  // The veil's own shader: these four are all it has to draw with, and with none of them its path ends before it marches.
  // A fifth amount added there must be emptied in `clearVeil` too.
  it('empties every amount the veil draws with', () => {
    expect(VEIL_GLSL).toContain('float thin = (uVeil.a + uVeilRoll.z + uVeilBank.z + uVeilDrift.x) * path;\n  if (thin <= 0.0) return vec4(0.0);')
  })

  it('is switched by the page for the one still alone', () => {
    expect(naming('src', '.ts', 'setAir')).toEqual(['src/capture/showcase.ts', 'src/core/stage.ts', 'src/scene/stage.ts'])
    expect(naming('src', '.ts', 'noAir')).toEqual(['src/capture/showcase.ts'])
    const page = fs.readFileSync(rel('src', 'capture', 'showcase.ts'), 'utf8')
    expect(page.split('withoutAir(').length - 1).toBe(1)
    expect(page).toContain('if (spec.noAir) return withoutAir(spec)')
  })
})
